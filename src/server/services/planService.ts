import { createHash } from 'node:crypto';
import type {
  Activity,
  AirReport,
  Fact,
  Candidates,
  HouseholdProfile,
  PlanRequest,
  PlanResponse,
  ForecastPoint,
} from '../../shared/schemas.js';
import { aiPlanJsonSchema, type AiPlan } from '../../shared/aiSchemas.js';
import { getCityById } from '../../domain/data/cities.js';
import { buildUploadedAirReport } from '../../domain/uploadedAir.js';
import { usualWindow, bestWindow, type CleanWindow } from '../../domain/windows.js';
import { commuteOptions } from '../../domain/commute.js';
import { indoorScenarios } from '../../domain/indoor.js';
import { buildCandidates, type ActivityCandidateContext } from '../../domain/candidates.js';
import { buildLedger, type ActivityDoseInfo, type CommuteDoseInfo } from '../../domain/ledger.js';
import { buildFacts } from '../../domain/facts.js';
import { fallbackPlan } from '../../domain/fallbackPlan.js';
import { validatePlan } from '../ai/grounding.js';
import { getPlanSystemInstruction, buildPlanUserMessage, sanitizeNotes } from '../ai/prompts.js';
import { AppError } from '../errors.js';
import { logEvent } from '../log.js';
import { clipErrors, isProviderFailure } from '../ai/retryPolicy.js';
import { TypedCache } from '../cache.js';
import type { AirService } from './airService.js';
import type { AiClient } from '../ai/aiClient.js';
import { doseUg, inhalationRate } from '../../domain/exposure.js';

export interface CachedPlanEntry {
  readonly plan: AiPlan;
  readonly generatedAtUtc: string;
}

export interface PlanServiceDeps {
  readonly airService: AirService;
  readonly ai: AiClient;
  readonly cache?: TypedCache<CachedPlanEntry>;
  readonly lastGoodCache?: TypedCache<CachedPlanEntry>;
  readonly clock?: () => string;
  readonly config?: { geminiModel?: string; grapStage?: string };
}

export interface PlanService {
  createPlan(request: PlanRequest): Promise<PlanResponse>;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 min
const LAST_GOOD_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function computeCacheKey(
  request: PlanRequest,
  cityName: string,
  facts: readonly { id: string; display: string }[],
  candidateIds: unknown,
): string {
  const hash = createHash('sha256');
  const cacheObj = {
    kind: 'plan',
    language: request.language,
    facts: facts.map((f) => [f.id, f.display]),
    candidateIds,
    household: {
      city: cityName,
      members: request.profile.members.map((m) => ({
        id: m.id,
        age: m.ageGroup,
        s: m.sensitivities,
      })),
      constraints: request.profile.constraints,
    },
    notes: sanitizeNotes(request.profile.notes),
  };
  return hash.update(JSON.stringify(cacheObj)).digest('hex');
}

function findTripChainWindow(
  profile: HouseholdProfile,
  points: readonly ForecastPoint[] | null | undefined,
  nowUtc: string,
): { window: CleanWindow; doseChangePct: number } | null {
  const chainable = profile.activities.filter(
    (a) =>
      (a.kind === 'errand' || a.kind === 'walk' || a.kind === 'other') &&
      a.flexible !== null,
  );
  if (chainable.length < 2) return null;

  for (let i = 0; i < chainable.length; i++) {
    for (let j = i + 1; j < chainable.length; j++) {
      const a1 = chainable[i];
      const a2 = chainable[j];
      if (!a1 || !a2 || !a1.flexible || !a2.flexible) continue;

      const m1 = [...a1.memberIds].sort().join(',');
      const m2 = [...a2.memberIds].sort().join(',');
      if (m1 !== m2) continue;

      const earliest = Math.max(a1.flexible.earliestHour, a2.flexible.earliestHour);
      const latest = Math.min(a1.flexible.latestHour, a2.flexible.latestHour);
      const combinedDuration = a1.durationMin + a2.durationMin;
      if ((latest - earliest) * 60 < combinedDuration) continue;

      const window = bestWindow(points, combinedDuration, { earliestHour: earliest, latestHour: latest }, nowUtc);
      if (window) {
        return { window, doseChangePct: -15 };
      }
    }
  }
  return null;
}

async function resolveAirReport(
  request: PlanRequest,
  airService: AirService,
  nowUtc: string,
): Promise<{ air: AirReport; cityName: string }> {
  let lat: number;
  let lon: number;
  let label: string;
  let cityId: string | undefined;

  if ('cityId' in request.location) {
    const city = getCityById(request.location.cityId);
    if (!city) {
      throw new AppError('OUT_OF_COVERAGE', 422, `Unknown city: ${request.location.cityId}`);
    }
    lat = city.lat;
    lon = city.lon;
    label = city.name;
    cityId = city.id;
  } else {
    lat = request.location.lat;
    lon = request.location.lon;
    label = 'Custom location';
  }

  if (request.upload) {
    const air = buildUploadedAirReport(request.upload, { label, lat, lon, cityId }, nowUtc);
    return { air, cityName: label };
  }

  const air = await airService.getAirReport({ lat, lon, label, cityId });
  return { air, cityName: label };
}

function computeSingleMemberActivityDose(
  m: HouseholdProfile['members'][number],
  intensity: Activity['intensity'],
  durationMin: number,
  usualPm25: number,
  bestPm25: number | null,
  baselineCIn: number,
): { uDose: number; bDose: number | null; inDose: number; pDose: number } {
  const rate = inhalationRate(m.ageGroup, intensity);
  const hours = durationMin / 60;

  const uDose = doseUg({ concentration: usualPm25, ratePerHour: rate, hours });
  const bDose = bestPm25 !== null ? doseUg({ concentration: bestPm25, ratePerHour: rate, hours }) : null;
  const inDose = doseUg({ concentration: baselineCIn, ratePerHour: rate, hours });

  const pDose =
    bDose !== null && bestPm25 !== null && bDose < uDose
      ? bestPm25 < baselineCIn
        ? bDose
        : inDose
      : uDose;

  return { uDose, bDose, inDose, pDose };
}

function computeSingleActivity(
  act: Activity,
  points: readonly ForecastPoint[] | null | undefined,
  cOut: number,
  baselineCIn: number,
  members: HouseholdProfile['members'],
  nowUtc: string,
): { ctx: ActivityCandidateContext; doseInfo: ActivityDoseInfo } {
  const usual = usualWindow(points, act.durationMin, act.usualStartHour, nowUtc);
  const best = act.flexible ? bestWindow(points, act.durationMin, act.flexible, nowUtc) : null;

  const usualPm25 = usual?.meanPm25 ?? cOut;
  const bestPm25 = best?.meanPm25 ?? null;

  const usualDoseByMember: Record<string, number> = {};
  const planDoseByMember: Record<string, number> = {};
  let totalUsualDose = 0;
  let totalBestDose: number | null = bestPm25 !== null ? 0 : null;
  let totalIndoorDose = 0;

  for (const mId of act.memberIds) {
    const m = members.find((mem) => mem.id === mId);
    if (!m) continue;
    const { uDose, bDose, inDose, pDose } = computeSingleMemberActivityDose(
      m,
      act.intensity,
      act.durationMin,
      usualPm25,
      bestPm25,
      baselineCIn,
    );
    usualDoseByMember[m.id] = uDose;
    totalUsualDose += uDose;
    if (bDose !== null && totalBestDose !== null) totalBestDose += bDose;
    totalIndoorDose += inDose;
    planDoseByMember[m.id] = pDose;
  }

  return {
    ctx: {
      activity: act,
      usualWindow: usual,
      bestWindow: best,
      usualDose: totalUsualDose,
      bestDose: totalBestDose,
      indoorDose: totalIndoorDose,
    },
    doseInfo: {
      activityId: act.id,
      memberIds: act.memberIds,
      usualDoseByMember,
      planDoseByMember,
      durationHours: act.durationMin / 60,
    },
  };
}

function computeActivityData(
  activities: readonly Activity[],
  points: readonly ForecastPoint[] | null | undefined,
  cOut: number,
  baselineCIn: number,
  members: HouseholdProfile['members'],
  nowUtc: string,
): {
  activityContexts: ActivityCandidateContext[];
  activityDoseInfos: ActivityDoseInfo[];
} {
  const activityContexts: ActivityCandidateContext[] = [];
  const activityDoseInfos: ActivityDoseInfo[] = [];

  for (const act of activities) {
    const { ctx, doseInfo } = computeSingleActivity(act, points, cOut, baselineCIn, members, nowUtc);
    activityContexts.push(ctx);
    activityDoseInfos.push(doseInfo);
  }

  return { activityContexts, activityDoseInfos };
}

async function attemptGeneration(
  ai: AiClient,
  systemPrompt: string,
  userPrompt: string,
  facts: readonly Fact[],
  candidates: Candidates,
): Promise<{ ok: true; plan: AiPlan } | { ok: false; errors: string[]; retryable: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const raw = await ai.generateJson({
      system: systemPrompt,
      user: userPrompt,
      schema: aiPlanJsonSchema,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const result = validatePlan(raw, facts, candidates);
    return result.ok ? result : { ok: false, errors: result.errors, retryable: true };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'Unknown generation error';
    return { ok: false, errors: [msg], retryable: !isProviderFailure(err) };
  }
}

async function executeAiGeneration(
  ai: AiClient,
  systemPrompt: string,
  userMessage: string,
  facts: readonly Fact[],
  candidates: Candidates,
): Promise<{ plan: AiPlan | null; attempts: number }> {
  let attempts = 1;
  const res1 = await attemptGeneration(ai, systemPrompt, userMessage, facts, candidates);
  if (res1.ok) {
    return { plan: res1.plan, attempts };
  }
  logEvent('warn', 'AI plan attempt failed', { attempt: 1, errors: clipErrors(res1.errors) });
  if (!res1.retryable) {
    return { plan: null, attempts };
  }

  attempts = 2;
  const correctiveMsg = `${userMessage}\n\nYour previous output failed validation: ${res1.errors.join('; ')}. Return corrected JSON only.`;
  const res2 = await attemptGeneration(ai, systemPrompt, correctiveMsg, facts, candidates);
  if (res2.ok) {
    return { plan: res2.plan, attempts };
  }
  logEvent('warn', 'AI plan attempt failed', { attempt: 2, errors: clipErrors(res2.errors) });

  return { plan: null, attempts };
}

interface PlanContext {
  facts: Fact[];
  candidates: Candidates;
  cacheKey: string;
}

function buildMemberInputs(profile: HouseholdProfile) {
  return profile.members.map((m) => {
    const actHours = profile.activities
      .filter((a) => a.memberIds.includes(m.id))
      .reduce((sum, a) => sum + a.durationMin / 60, 0);
    const comHours = profile.commutes
      .filter((c) => c.memberIds.includes(m.id))
      .reduce((sum) => sum + 1, 0);
    return { id: m.id, activityHours: actHours, commuteHours: comHours };
  });
}

function computeCommuteData(profile: HouseholdProfile, cOut: number): {
  commuteContexts: { commute: HouseholdProfile['commutes'][number]; commuteId: string; options: ReturnType<typeof commuteOptions> }[];
  commuteDoseInfos: CommuteDoseInfo[];
} {
  const commuteContexts = profile.commutes.map((c) => ({
    commute: c,
    commuteId: c.id,
    options: commuteOptions(c, profile.members, cOut),
  }));

  const commuteDoseInfos: CommuteDoseInfo[] = commuteContexts.map((cc) => ({
    commuteId: cc.commute.id,
    memberIds: cc.commute.memberIds,
    currentMode: cc.commute.currentMode,
    options: cc.options,
    durationHours: (cc.options.find((o) => o.mode === cc.commute.currentMode)?.minutes ?? 30) / 60,
  }));

  return { commuteContexts, commuteDoseInfos };
}

function buildPlanContext(
  request: PlanRequest,
  air: AirReport,
  cityName: string,
  nowUtc: string,
  grapStage?: string,
): PlanContext {
  const cOut = air.measured?.latest.pm25?.value ?? (air.forecast?.points[0]?.pm25 ?? 50);
  const memberInputs = buildMemberInputs(request.profile);

  const indoorScenariosList = indoorScenarios(
    {
      roomAreaM2: request.profile.home.roomAreaM2,
      ceilingHeightM: request.profile.home.ceilingHeightM,
      windowState: request.profile.home.windowState,
      purifierCadrM3h: request.profile.home.purifier.present ? request.profile.home.purifier.cadrM3h : 0,
      plants: request.profile.home.plantsCount,
    },
    cOut,
    memberInputs,
    0,
  );

  const baselineCIn = indoorScenariosList.find((s) => s.id === 'baseline')?.cIn ?? 0;
  const points = air.forecast?.points;
  const { activityContexts, activityDoseInfos } = computeActivityData(
    request.profile.activities,
    points,
    cOut,
    baselineCIn,
    request.profile.members,
    nowUtc,
  );

  const { commuteContexts, commuteDoseInfos } = computeCommuteData(request.profile, cOut);
  const tripChain = findTripChainWindow(request.profile, points, nowUtc);

  const candidates = buildCandidates({
    profile: request.profile,
    air,
    activityContexts,
    commuteContexts,
    indoorScenarios: indoorScenariosList,
    tripChainWindow: tripChain?.window,
  });

  const ledger = buildLedger({
    profile: request.profile,
    activities: activityDoseInfos,
    commutes: commuteDoseInfos,
    indoorScenarios: indoorScenariosList,
  });

  const facts = buildFacts({
    profile: request.profile,
    air,
    activityContexts,
    commuteContexts,
    indoorScenarios: indoorScenariosList,
    ledger,
    language: request.language,
    tripChain,
    grapStage,
  });

  const candidateIds = [
    candidates.activities.map((a) => a.itemId),
    candidates.commutes.map((c) => c.itemId),
  ];
  const cacheKey = computeCacheKey(request, cityName, facts, candidateIds);

  return { facts, candidates, cacheKey };
}

export function createPlanService(deps: PlanServiceDeps): PlanService {
  const airService = deps.airService;
  const ai = deps.ai;
  const planCache = deps.cache ?? new TypedCache<CachedPlanEntry>(100);
  const lastGoodCache = deps.lastGoodCache ?? new TypedCache<CachedPlanEntry>(100);
  const clock = deps.clock ?? (() => new Date().toISOString());
  const modelName = deps.config?.geminiModel ?? 'gemini-3.6-flash';
  const grapStage = deps.config?.grapStage;

  return {
    async createPlan(request: PlanRequest): Promise<PlanResponse> {
      const nowUtc = clock();
      const { air, cityName } = await resolveAirReport(request, airService, nowUtc);
      const { facts, candidates, cacheKey } = buildPlanContext(request, air, cityName, nowUtc, grapStage);

      const cached = planCache.get(cacheKey);
      if (cached) {
        return {
          air,
          facts,
          candidates,
          plan: cached.plan,
          meta: { origin: 'cache', model: modelName, attempts: 0, generatedAtUtc: cached.generatedAtUtc, warnings: [] },
        };
      }

      const systemPrompt = getPlanSystemInstruction(request.language);
      const userMessage = buildPlanUserMessage({
        facts,
        candidates,
        profile: request.profile,
        cityName,
        notes: request.profile.notes,
      });

      const { plan, attempts } = await executeAiGeneration(ai, systemPrompt, userMessage, facts, candidates);
      if (plan) {
        planCache.set(cacheKey, { plan, generatedAtUtc: nowUtc }, CACHE_TTL_MS);
        lastGoodCache.set(cacheKey, { plan, generatedAtUtc: nowUtc }, LAST_GOOD_TTL_MS);
        return {
          air,
          facts,
          candidates,
          plan,
          meta: { origin: 'gemini', model: modelName, attempts, generatedAtUtc: nowUtc, warnings: [] },
        };
      }

      const lastGood = lastGoodCache.get(cacheKey);
      if (lastGood) {
        return {
          air,
          facts,
          candidates,
          plan: lastGood.plan,
          meta: { origin: 'last-good', model: modelName, attempts, generatedAtUtc: lastGood.generatedAtUtc, warnings: [] },
        };
      }

      const fallback = fallbackPlan({ facts, candidates, language: request.language });
      return {
        air,
        facts,
        candidates,
        plan: fallback,
        meta: { origin: 'fallback', attempts, generatedAtUtc: nowUtc, warnings: [] },
      };
    },
  };
}

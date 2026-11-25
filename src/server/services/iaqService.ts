import { createHash } from 'node:crypto';
import type {
  AirReport,
  Candidates,
  Fact,
  HouseholdProfile,
  IaqExplainRequest,
  IaqExplainResponse,
  IndoorScenario,
} from '../../shared/schemas.js';
import { aiIndoorExplanationJsonSchema, type AiIndoorExplanation } from '../../shared/aiSchemas.js';
import { getCityById } from '../../domain/data/cities.js';
import { buildUploadedAirReport } from '../../domain/uploadedAir.js';
import { indoorScenarios } from '../../domain/indoor.js';
import { buildCandidates } from '../../domain/candidates.js';
import { buildFacts } from '../../domain/facts.js';
import { fallbackIndoorExplanation } from '../../domain/fallbackPlan.js';
import { validateIndoorExplanation } from '../ai/grounding.js';
import { buildIaqUserMessage, getIaqSystemInstruction, sanitizeNotes } from '../ai/prompts.js';
import { AppError } from '../errors.js';
import { logEvent } from '../log.js';
import { clipErrors, isProviderFailure } from '../ai/retryPolicy.js';
import { TypedCache } from '../cache.js';
import type { AirService } from './airService.js';
import { AI_REQUEST_BUDGET_MS, type AiClient } from '../ai/aiClient.js';

export interface CachedIaqEntry {
  readonly explanation: AiIndoorExplanation;
  readonly generatedAtUtc: string;
}

export interface IaqServiceDeps {
  readonly airService: AirService;
  readonly ai: AiClient;
  readonly cache?: TypedCache<CachedIaqEntry>;
  readonly lastGoodCache?: TypedCache<CachedIaqEntry>;
  readonly clock?: () => string;
  readonly config?: { geminiModel?: string };
}

export interface IaqService {
  explainIaq(request: IaqExplainRequest): Promise<IaqExplainResponse>;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 min
const LAST_GOOD_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function computeCacheKey(
  request: IaqExplainRequest,
  cityName: string,
  facts: readonly { id: string; display: string }[],
  candidateIds: readonly string[],
): string {
  const hash = createHash('sha256');
  const cacheObj = {
    kind: 'iaq',
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

async function resolveAirReport(
  request: IaqExplainRequest,
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

function resolveOutdoorPm25(air: AirReport): number {
  const measuredPm25 = air.measured?.latest.pm25?.value;
  if (typeof measuredPm25 === 'number' && Number.isFinite(measuredPm25)) {
    return measuredPm25;
  }
  const forecastPm25 = air.forecast?.points.find((p) => p.pm25 !== null)?.pm25;
  if (typeof forecastPm25 === 'number' && Number.isFinite(forecastPm25)) {
    return forecastPm25;
  }
  throw new AppError(
    'NO_OUTDOOR_DATA',
    422,
    'No outdoor PM2.5 reading or forecast is available to estimate indoor air quality.',
  );
}

function buildIaqContext(
  request: IaqExplainRequest,
  air: AirReport,
  cityName: string,
): {
  facts: Fact[];
  scenarios: IndoorScenario[];
  candidates: Candidates;
  cacheKey: string;
} {
  const cOut = resolveOutdoorPm25(air);
  const profileWithHome: HouseholdProfile = { ...request.profile, home: request.home };

  const memberInputs = profileWithHome.members.map((m) => ({
    id: m.id,
    activityHours: 0,
    commuteHours: 0,
  }));

  const scenarios = indoorScenarios(
    {
      roomAreaM2: request.home.roomAreaM2,
      ceilingHeightM: request.home.ceilingHeightM,
      windowState: request.home.windowState,
      purifierCadrM3h: request.home.purifier.present ? request.home.purifier.cadrM3h : 0,
      plants: request.home.plantsCount,
    },
    cOut,
    memberInputs,
    0,
  );

  const candidates = buildCandidates({
    profile: profileWithHome,
    air,
    activityContexts: [],
    commuteContexts: [],
    indoorScenarios: scenarios,
  });

  const allFacts = buildFacts({
    profile: profileWithHome,
    air,
    activityContexts: [],
    commuteContexts: [],
    indoorScenarios: scenarios,
    ledger: { members: [], householdCo2SavedWeekKg: 0 },
    language: request.language,
  });

  const facts = allFacts.filter(
    (f) =>
      f.id.startsWith('in_') ||
      f.id.startsWith('ref_') ||
      f.id.startsWith('tip_') ||
      f.id === 'air_cleanest_hour_next24',
  );

  const candidateIds = candidates.indoor.map((a) => a.actionId);
  const cacheKey = computeCacheKey(request, cityName, facts, candidateIds);

  return { facts, scenarios, candidates, cacheKey };
}

async function attemptIaqGeneration(
  ai: AiClient,
  systemPrompt: string,
  userPrompt: string,
  facts: readonly Fact[],
  candidates: Candidates,
): Promise<{ ok: true; plan: AiIndoorExplanation } | { ok: false; errors: string[]; retryable: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_BUDGET_MS);
  try {
    const raw = await ai.generateJson({
      system: systemPrompt,
      user: userPrompt,
      schema: aiIndoorExplanationJsonSchema,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const result = validateIndoorExplanation(raw, facts, candidates);
    return result.ok ? result : { ok: false, errors: result.errors, retryable: true };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'Unknown generation error';
    return { ok: false, errors: [msg], retryable: !isProviderFailure(err) };
  }
}

async function executeIaqGeneration(
  ai: AiClient,
  systemPrompt: string,
  userMessage: string,
  facts: readonly Fact[],
  candidates: Candidates,
): Promise<{ explanation: AiIndoorExplanation | null; attempts: number }> {
  let attempts = 1;
  const res1 = await attemptIaqGeneration(ai, systemPrompt, userMessage, facts, candidates);
  if (res1.ok) {
    return { explanation: res1.plan, attempts };
  }
  logEvent('warn', 'AI indoor explanation attempt failed', { attempt: 1, errors: clipErrors(res1.errors) });
  if (!res1.retryable) {
    return { explanation: null, attempts };
  }

  attempts = 2;
  const correctiveMsg = `${userMessage}\n\nYour previous output failed validation: ${res1.errors.join('; ')}. Return corrected JSON only.`;
  const res2 = await attemptIaqGeneration(ai, systemPrompt, correctiveMsg, facts, candidates);
  if (res2.ok) {
    return { explanation: res2.plan, attempts };
  }
  logEvent('warn', 'AI indoor explanation attempt failed', { attempt: 2, errors: clipErrors(res2.errors) });

  return { explanation: null, attempts };
}

async function resolveExplanation(
  request: IaqExplainRequest,
  cityName: string,
  facts: Fact[],
  scenarios: IndoorScenario[],
  candidates: Candidates,
  cacheKey: string,
  nowUtc: string,
  deps: {
    ai: AiClient;
    iaqCache: TypedCache<CachedIaqEntry>;
    lastGoodCache: TypedCache<CachedIaqEntry>;
    modelName: string;
  },
): Promise<IaqExplainResponse> {
  const cached = deps.iaqCache.get(cacheKey);
  if (cached) {
    return {
      facts,
      scenarios,
      explanation: cached.explanation,
      meta: { origin: 'cache', model: deps.modelName, attempts: 0, generatedAtUtc: cached.generatedAtUtc, warnings: [] },
    };
  }

  const systemPrompt = getIaqSystemInstruction(request.language);
  const userMessage = buildIaqUserMessage({
    facts,
    candidates,
    profile: request.profile,
    cityName,
    notes: request.profile.notes,
  });

  const { explanation, attempts } = await executeIaqGeneration(deps.ai, systemPrompt, userMessage, facts, candidates);
  if (explanation) {
    deps.iaqCache.set(cacheKey, { explanation, generatedAtUtc: nowUtc }, CACHE_TTL_MS);
    deps.lastGoodCache.set(cacheKey, { explanation, generatedAtUtc: nowUtc }, LAST_GOOD_TTL_MS);
    return {
      facts,
      scenarios,
      explanation,
      meta: { origin: 'gemini', model: deps.modelName, attempts, generatedAtUtc: nowUtc, warnings: [] },
    };
  }

  const lastGood = deps.lastGoodCache.get(cacheKey);
  if (lastGood) {
    return {
      facts,
      scenarios,
      explanation: lastGood.explanation,
      meta: { origin: 'last-good', model: deps.modelName, attempts, generatedAtUtc: lastGood.generatedAtUtc, warnings: [] },
    };
  }

  const fallback = fallbackIndoorExplanation({ facts, candidates, language: request.language });
  return {
    facts,
    scenarios,
    explanation: fallback,
    meta: { origin: 'fallback', attempts, generatedAtUtc: nowUtc, warnings: [] },
  };
}

export function createIaqService(deps: IaqServiceDeps): IaqService {
  const airService = deps.airService;
  const ai = deps.ai;
  const iaqCache = deps.cache ?? new TypedCache<CachedIaqEntry>(100);
  const lastGoodCache = deps.lastGoodCache ?? new TypedCache<CachedIaqEntry>(100);
  const clock = deps.clock ?? (() => new Date().toISOString());
  const modelName = deps.config?.geminiModel ?? 'gemini-3.6-flash';

  return {
    async explainIaq(request: IaqExplainRequest): Promise<IaqExplainResponse> {
      const nowUtc = clock();
      const { air, cityName } = await resolveAirReport(request, airService, nowUtc);
      const { facts, scenarios, candidates, cacheKey } = buildIaqContext(request, air, cityName);
      return resolveExplanation(request, cityName, facts, scenarios, candidates, cacheKey, nowUtc, {
        ai,
        iaqCache,
        lastGoodCache,
        modelName,
      });
    },
  };
}

import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { evidence } from '../../domain/data/evidence.js';
import { CATEGORIES } from '../../domain/data/naqiBreakpoints.js';
import { describeChange, formatUgM3 } from '../../domain/format.js';
import {
  indoorScenarios,
  recommendedCadrM3h,
  roomVolume,
  sourceWarnings,
} from '../../domain/indoor.js';
import { categoryFor, subIndex } from '../../domain/naqi.js';
import type {
  AirReport,
  CategoryKey,
  Home,
  HouseholdProfile,
  IaqExplainRequest,
  IaqExplainResponse,
  IndoorScenario,
  LocationRef,
  UploadedSeries,
} from '../../shared/schemas.js';
import { isApiError, postIaqExplain as apiPostIaqExplain } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { GroundedText } from './GroundedText.js';
import { IndoorControls, type CadrUnit } from './IndoorControls.js';
import { OriginBadge } from './OriginBadge.js';

export interface IndoorSimulatorProps {
  readonly profile: HouseholdProfile;
  readonly location: LocationRef;
  readonly air: AirReport | null;
  readonly upload: UploadedSeries | null;
  readonly postIaqExplain?: (body: IaqExplainRequest) => Promise<IaqExplainResponse>;
}

interface ComputedIndoor {
  readonly recCadr: number;
  readonly scenarios: IndoorScenario[];
  readonly baseline: IndoorScenario | undefined;
  readonly plantsScenario: IndoorScenario | undefined;
  readonly catKey: CategoryKey | null;
}

function ScenarioSvgBars({ scenarios }: { readonly scenarios: readonly IndoorScenario[] }): ReactElement {
  const { lang, t } = useI18n();
  const titleId = useId();
  const maxCIn = Math.max(1, ...scenarios.map((s) => s.cIn));
  const rowHeight = 32;
  const svgHeight = scenarios.length * rowHeight + 8;

  return (
    <div className="space-y-2">
      <h3 className="text-base font-bold text-ink">{t.indoor.chartHeading}</h3>
      <svg role="img" aria-labelledby={titleId} viewBox={`0 0 560 ${svgHeight}`} className="w-full h-auto">
        <title id={titleId}>{t.indoor.chartTitle}</title>
        {scenarios.map((sc, idx) => {
          const y = idx * rowHeight + 4;
          const barWidth = Math.max(4, Math.round((sc.cIn / maxCIn) * 230));
          const pctText = sc.id === 'baseline' ? '' : ` (${describeChange(sc.pctVsBaseline, lang)})`;
          return (
            <g key={sc.id} transform={`translate(0, ${y})`}>
              <text x="0" y="18" className="fill-ink text-xs font-medium">{sc.label}</text>
              <rect x="190" y="5" width={barWidth} height="18" rx="3" className="fill-accent" />
              <text x={198 + barWidth} y="18" className="fill-ink text-xs font-semibold">
                {formatUgM3(sc.cIn)}{pctText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ExplainResult({ response }: { readonly response: IaqExplainResponse }): ReactElement {
  const { t } = useI18n();
  const exp = response.explanation as {
    summary: string;
    actions: { actionId: string; headline: string; why: string; priority: 'high' | 'medium' | 'low' }[];
    caveats: string[];
  };
  return (
    <div className="rounded-lg border border-surface-2 bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OriginBadge meta={response.meta} />
      </div>
      <p className="text-sm text-ink leading-relaxed"><GroundedText text={exp.summary} facts={response.facts} /></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {exp.actions.map((act) => (
          <article key={act.actionId} className="rounded-md border border-surface-2 bg-surface-2 p-3 space-y-1.5">
            <h4 className="text-sm font-bold text-ink"><GroundedText text={act.headline} facts={response.facts} /></h4>
            <p className="text-xs text-ink leading-relaxed"><GroundedText text={act.why} facts={response.facts} /></p>
            <p className="text-xs text-ink-muted font-semibold">{t.plan.priorityLabel}: {t.plan.priorities[act.priority]}</p>
          </article>
        ))}
      </div>
      {exp.caveats.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-ink-muted space-y-1">
          {exp.caveats.map((c, idx) => <li key={idx}><GroundedText text={c} facts={response.facts} /></li>)}
        </ul>
      )}
    </div>
  );
}

function ResultsPanel({ computed, flaggedIds }: { readonly computed: ComputedIndoor; readonly flaggedIds: readonly string[] }): ReactElement {
  const { lang, t } = useI18n();
  const plantsEvidence = evidence.find((e) => e.id === 'ref_plants');
  const catMeta = computed.catKey ? CATEGORIES.find((c) => c.key === computed.catKey) : undefined;
  const catLabel = catMeta ? (lang === 'hi' ? catMeta.hiLabel : catMeta.enLabel) : '';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-surface-2 bg-surface p-4 space-y-1">
          <p className="text-xs font-semibold text-ink-muted">{t.indoor.estimatedPm25Label}</p>
          <p className="text-2xl font-extrabold text-ink">
            {computed.baseline ? formatUgM3(computed.baseline.cIn) : '—'}
            {catLabel && <span className="ml-2 text-sm font-semibold text-accent">{catLabel}</span>}
          </p>
          {computed.baseline && (
            <p className="text-xs text-ink-muted">{describeChange(computed.baseline.pctVsOutdoor, lang)} {t.indoor.vsOutdoorsLabel}</p>
          )}
        </div>
        <div className="rounded-lg border border-surface-2 bg-surface p-4 space-y-1">
          <p className="text-xs font-semibold text-ink-muted">{t.indoor.recommendedCadrLabel}</p>
          <p className="text-2xl font-extrabold text-ink">{Math.round(computed.recCadr)} {t.indoor.unitM3h}</p>
        </div>
      </div>
      <ScenarioSvgBars scenarios={computed.scenarios} />
      {computed.plantsScenario && (
        <div className="rounded-md border border-ink-muted bg-surface p-4 space-y-1">
          <h3 className="text-sm font-bold text-ink">{t.indoor.plantsCalloutHeading}</h3>
          <p className="text-xs text-ink">
            {t.indoor.plantsCalloutPrefix}{' '}
            <span className="font-bold">{computed.plantsScenario.pctVsBaseline.toFixed(2)}%</span>{' '}
            ({describeChange(computed.plantsScenario.pctVsBaseline, lang)}).
          </p>
          {plantsEvidence && <p className="text-xs text-ink-muted">{t.indoor.plantsCitationLabel} {plantsEvidence.citation}</p>}
        </div>
      )}
      {flaggedIds.length > 0 && (
        <div role="region" aria-label={t.indoor.sourcesWarningHeading} className="rounded-md border border-danger bg-surface p-4 space-y-2">
          <h3 className="text-sm font-bold text-danger">{t.indoor.sourcesWarningHeading}</h3>
          <p className="text-xs text-ink">{t.indoor.sourcesWarningNote}</p>
          <ul className="list-disc pl-5 text-xs text-ink space-y-1">
            {flaggedIds.map((id) => {
              const entry = evidence.find((e) => e.id === id);
              return entry ? <li key={id}>{lang === 'hi' ? entry.findingHi : entry.findingEn}</li> : null;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function getOutdoorPm25(air: AirReport | null): number | null {
  const measured = air?.measured?.latest.pm25?.value;
  if (typeof measured === 'number' && Number.isFinite(measured)) return measured;
  const firstForecast = air?.forecast?.points.find((p) => p.pm25 !== null)?.pm25;
  return typeof firstForecast === 'number' && Number.isFinite(firstForecast) ? firstForecast : null;
}

function isHomeValid(home: Home): boolean {
  return (
    Number.isFinite(home.roomAreaM2) && home.roomAreaM2 >= 6 && home.roomAreaM2 <= 80 &&
    Number.isFinite(home.ceilingHeightM) && home.ceilingHeightM >= 2.2 && home.ceilingHeightM <= 4.5 &&
    Number.isFinite(home.purifier.cadrM3h) && home.purifier.cadrM3h >= 0
  );
}

function computeIndoorState(home: Home, cOut: number, members: HouseholdProfile['members']): ComputedIndoor {
  const vol = roomVolume(home);
  const recCadr = recommendedCadrM3h(vol);
  const scenarios = indoorScenarios(
    {
      roomAreaM2: home.roomAreaM2,
      ceilingHeightM: home.ceilingHeightM,
      windowState: home.windowState,
      purifierCadrM3h: home.purifier.present ? home.purifier.cadrM3h : 0,
      plants: home.plantsCount,
    },
    cOut,
    members.map((m) => ({ id: m.id, activityHours: 0, commuteHours: 0 })),
    0,
  );
  const baseline = scenarios.find((s) => s.id === 'baseline');
  const plantsScenario = scenarios.find((s) => s.id === 'plants_plus_10');
  const subIdx = baseline ? subIndex('pm25', baseline.cIn) : null;
  const catKey = subIdx !== null ? categoryFor(subIdx).key : null;
  return { recCadr, scenarios, baseline, plantsScenario, catKey };
}

export default function IndoorSimulator({ profile, location, air, upload, postIaqExplain }: IndoorSimulatorProps): ReactElement {
  const { lang, t } = useI18n();
  const [home, setHome] = useState<Home>(profile.home);
  const [cadrUnit, setCadrUnit] = useState<CadrUnit>('m3h');
  const [explainStatus, setExplainStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [explainData, setExplainData] = useState<IaqExplainResponse | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setHome(profile.home);
    setExplainStatus('idle');
    setExplainData(null);
    setExplainError(null);
  }, [profile.id, profile.home]);

  const cOut = getOutdoorPm25(air);
  const validDimensions = isHomeValid(home);
  const computed = useMemo(
    () => (cOut !== null && validDimensions ? computeIndoorState(home, cOut, profile.members) : null),
    [cOut, validDimensions, home, profile.members],
  );
  const flaggedIds = sourceWarnings(home);

  const handleExplain = async (): Promise<void> => {
    if (inFlightRef.current || !validDimensions) return;
    inFlightRef.current = true;
    setExplainStatus('loading');
    setExplainError(null);
    const body: IaqExplainRequest = upload ? { profile, location, home, upload, language: lang } : { profile, location, home, language: lang };
    try {
      const res = await (postIaqExplain ?? apiPostIaqExplain)(body);
      setExplainData(res);
      setExplainStatus('success');
    } catch (err: unknown) {
      const msg = isApiError(err) && err.kind === 'rate-limited' ? t.plan.rateLimitError : isApiError(err) ? err.message : t.indoor.explainErrorTitle;
      setExplainError(msg);
      setExplainStatus('error');
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <section aria-labelledby="indoor-sim-heading" className="rounded-lg border border-surface-2 bg-surface-2 p-4 sm:p-6 space-y-6">
      <div className="space-y-1">
        <h2 id="indoor-sim-heading" className="text-xl font-bold text-ink">{t.indoor.heading}</h2>
        <p className="text-sm text-ink-muted">{t.indoor.intro}</p>
      </div>
      <IndoorControls home={home} cadrUnit={cadrUnit} onUpdateHome={(p) => setHome((prev) => ({ ...prev, ...p }))} onChangeCadrUnit={setCadrUnit} />
      {!computed ? <p className="text-sm text-ink-muted">{t.indoor.noOutdoorData}</p> : <ResultsPanel computed={computed} flaggedIds={flaggedIds} />}
      <div>
        <button
          type="button" disabled={explainStatus === 'loading' || cOut === null || !validDimensions} aria-busy={explainStatus === 'loading'}
          onClick={() => void handleExplain()}
          className="min-h-11 px-5 py-2.5 rounded-md bg-accent text-surface text-sm font-bold hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {explainStatus === 'loading' ? t.indoor.explainingButton : t.indoor.explainButton}
        </button>
      </div>
      {explainStatus === 'error' && explainError && (
        <div role="alert" className="rounded-lg border border-danger bg-surface p-4 space-y-1">
          <h3 className="text-sm font-bold text-danger">{t.indoor.explainErrorTitle}</h3>
          <p className="text-xs text-ink">{explainError}</p>
        </div>
      )}
      {explainStatus === 'success' && explainData && <ExplainResult response={explainData} />}
    </section>
  );
}

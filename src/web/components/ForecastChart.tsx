import { useId, useMemo, type ReactElement } from 'react';
import { CATEGORIES, type CategoryKey } from '../../domain/data/naqiBreakpoints.js';
import { formatIstTime } from '../../domain/format.js';
import { categoryFor, subIndex } from '../../domain/naqi.js';
import type { Forecast, ForecastPoint } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';

export interface ForecastChartProps {
  readonly forecast: Forecast | null;
}

const FILL_CLASS_BY_KEY: Record<CategoryKey, string> = {
  good: 'fill-aqi-good',
  satisfactory: 'fill-aqi-satisfactory',
  moderate: 'fill-aqi-moderate',
  poor: 'fill-aqi-poor',
  very_poor: 'fill-aqi-very-poor',
  severe: 'fill-aqi-severe',
};

const SVG_WIDTH = 576;
const SVG_HEIGHT = 160;
const BAR_STEP = 12;
const BAR_WIDTH = 9;

function getBarCategory(pm25: number | null): CategoryKey {
  if (pm25 === null || !Number.isFinite(pm25) || pm25 < 0) {
    return 'good';
  }
  const idx = subIndex('pm25', pm25);
  if (idx === null) return 'good';
  return categoryFor(idx).key;
}

function findExtremes(points: readonly ForecastPoint[]): {
  cleanest: ForecastPoint | null;
  worst: ForecastPoint | null;
  maxPm25: number;
} {
  let cleanest: ForecastPoint | null = null;
  let worst: ForecastPoint | null = null;
  let maxPm25 = 0;

  for (const pt of points) {
    if (pt.pm25 === null || !Number.isFinite(pt.pm25)) continue;
    if (pt.pm25 > maxPm25) maxPm25 = pt.pm25;
    if (!cleanest || (cleanest.pm25 !== null && pt.pm25 < cleanest.pm25)) {
      cleanest = pt;
    }
    if (!worst || (worst.pm25 !== null && pt.pm25 > worst.pm25)) {
      worst = pt;
    }
  }

  return { cleanest, worst, maxPm25: Math.max(maxPm25, 60) };
}

function ForecastSvg({
  points,
  maxPm25,
  titleId,
  summaryId,
}: {
  readonly points: readonly ForecastPoint[];
  readonly maxPm25: number;
  readonly titleId: string;
  readonly summaryId: string;
}): ReactElement {
  const { t } = useI18n();
  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="w-full h-40 block"
    >
      <title id={titleId}>{t.forecast.chartTitle}</title>
      {points.map((pt, index) => {
        const val = pt.pm25;
        const barHeight =
          val !== null && Number.isFinite(val) && val > 0
            ? Math.max(4, Math.round((val / maxPm25) * (SVG_HEIGHT - 12)))
            : 2;
        const y = SVG_HEIGHT - barHeight;
        const x = index * BAR_STEP;
        const categoryKey = getBarCategory(val);
        const fillClass = val === null ? 'fill-surface-2' : FILL_CLASS_BY_KEY[categoryKey];

        return (
          <rect
            key={pt.timeUtc}
            x={x}
            y={y}
            width={BAR_WIDTH}
            height={barHeight}
            rx={1}
            className={`${fillClass} stroke-ink-muted`}
            strokeWidth={0.5}
          />
        );
      })}
    </svg>
  );
}

function ForecastDataTable({ points }: { readonly points: readonly ForecastPoint[] }): ReactElement {
  const { lang, t } = useI18n();
  return (
    <details className="border-t border-surface-2 pt-3">
      <summary className="cursor-pointer min-h-11 inline-flex items-center text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md px-1">
        {t.forecast.showTable}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <caption className="sr-only">{t.forecast.tableCaption}</caption>
          <thead>
            <tr className="border-b border-surface-2 text-ink-muted">
              <th scope="col" className="py-2 pr-4 font-semibold">
                {t.forecast.timeCol}
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                {t.forecast.pm25Col}
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                {t.forecast.pm10Col}
              </th>
              <th scope="col" className="py-2 font-semibold">
                {t.forecast.categoryCol}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((pt) => {
              const catKey = getBarCategory(pt.pm25);
              const catMeta = CATEGORIES.find((c) => c.key === catKey);
              const catLabel =
                pt.pm25 === null
                  ? t.forecast.noValue
                  : catMeta
                    ? lang === 'hi'
                      ? catMeta.hiLabel
                      : catMeta.enLabel
                    : catKey;

              return (
                <tr key={pt.timeUtc} className="border-b border-surface-2 last:border-b-0">
                  <td className="py-1.5 pr-4 tabular-nums text-ink">{formatIstTime(pt.timeUtc)}</td>
                  <td className="py-1.5 pr-4 tabular-nums text-ink">
                    {pt.pm25 !== null ? Math.round(pt.pm25) : t.forecast.noValue}
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums text-ink">
                    {pt.pm10 !== null ? Math.round(pt.pm10) : t.forecast.noValue}
                  </td>
                  <td className="py-1.5 text-ink-muted">{catLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function ForecastChart({ forecast }: ForecastChartProps): ReactElement {
  const { t } = useI18n();
  const summaryId = useId();
  const titleId = useId();

  const points = useMemo(() => (forecast ? forecast.points.slice(0, 48) : []), [forecast]);
  const { cleanest, worst, maxPm25 } = useMemo(() => findExtremes(points), [points]);

  if (!forecast || points.length === 0) {
    return (
      <section
        aria-label={t.forecast.heading}
        className="rounded-lg border border-surface-2 bg-surface p-5"
      >
        <h2 className="text-base font-bold text-ink mb-2">{t.forecast.heading}</h2>
        <p className="text-sm text-ink-muted">{t.forecast.unavailable}</p>
      </section>
    );
  }

  const summaryText =
    cleanest && worst
      ? `${t.forecast.cleanestLabel}: ${formatIstTime(cleanest.timeUtc)} · ${t.forecast.worstLabel}: ${formatIstTime(worst.timeUtc)}`
      : t.forecast.unavailable;

  return (
    <section
      aria-label={t.forecast.heading}
      className="rounded-lg border border-surface-2 bg-surface p-5 space-y-4"
    >
      <div className="space-y-1">
        <h2 className="text-base font-bold text-ink">{t.forecast.heading}</h2>
        <p id={summaryId} className="text-sm text-ink-muted">
          {summaryText}
        </p>
      </div>
      <ForecastSvg points={points} maxPm25={maxPm25} titleId={titleId} summaryId={summaryId} />
      <ForecastDataTable points={points} />
    </section>
  );
}

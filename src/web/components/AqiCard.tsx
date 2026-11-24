import type { ReactElement } from 'react';
import { CATEGORIES, type CategoryKey } from '../../domain/data/naqiBreakpoints.js';
import type { NaqiResult } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';

export interface AqiCardProps {
  readonly naqi: NaqiResult | null;
}

const SWATCH_CLASS_BY_KEY: Record<CategoryKey, string> = {
  good: 'bg-aqi-good',
  satisfactory: 'bg-aqi-satisfactory',
  moderate: 'bg-aqi-moderate',
  poor: 'bg-aqi-poor',
  very_poor: 'bg-aqi-very-poor',
  severe: 'bg-aqi-severe',
};

export function AqiCard({ naqi }: AqiCardProps): ReactElement {
  const { lang, t } = useI18n();

  if (!naqi) {
    return (
      <section
        aria-label={t.aqi.heading}
        className="rounded-lg border border-surface-2 bg-surface p-5"
      >
        <h2 className="text-lg font-bold text-ink">{t.aqi.unavailableTitle}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t.aqi.unavailableNote}</p>
      </section>
    );
  }

  const categoryMeta = CATEGORIES.find((c) => c.key === naqi.category);
  const categoryLabel = categoryMeta
    ? lang === 'hi'
      ? categoryMeta.hiLabel
      : categoryMeta.enLabel
    : naqi.category;
  const healthNote = categoryMeta
    ? lang === 'hi'
      ? categoryMeta.healthNoteHi
      : categoryMeta.healthNoteEn
    : '';
  const swatchClass = SWATCH_CLASS_BY_KEY[naqi.category];
  const basisText = naqi.basis === '24h' ? t.aqi.basis24h : t.aqi.basisIndicative;
  const dominantText = naqi.dominant === 'pm25' ? t.aqi.pm25Name : t.aqi.pm10Name;

  return (
    <section
      aria-label={t.aqi.heading}
      className="rounded-lg border border-surface-2 bg-surface p-5 space-y-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {t.aqi.heading}
          </h2>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-5xl font-extrabold tracking-tight text-ink">
              {naqi.value}
            </span>
            <span className="text-xl font-bold text-ink">{categoryLabel}</span>
          </div>
        </div>

        <div className="text-sm text-ink-muted space-y-1">
          <p>{basisText}</p>
          <p>
            {t.aqi.dominantLabel}: <span className="font-semibold text-ink">{dominantText}</span>
          </p>
        </div>
      </div>

      <div
        className={`h-3 w-full rounded-full border border-ink-muted ${swatchClass}`}
        aria-hidden="true"
      />

      {healthNote && <p className="text-sm text-ink leading-relaxed">{healthNote}</p>}
      <p className="text-xs text-ink-muted">{t.aqi.pmOnlyNote}</p>
    </section>
  );
}

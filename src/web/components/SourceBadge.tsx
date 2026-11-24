import type { ReactElement } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, Upload, XCircle } from 'lucide-react';
import type { AirReport, MeasuredAir } from '../../shared/schemas.js';
import { formatIstTime } from '../../domain/format.js';
import { useI18n } from '../i18n/index.js';

type Freshness = MeasuredAir['freshness'];

export interface SourceBadgeProps {
  readonly report: AirReport;
  readonly clock?: () => number;
}

function FreshnessChip({ freshness }: { readonly freshness: Freshness }): ReactElement {
  const { t } = useI18n();

  if (freshness === 'fresh') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-ink-muted bg-surface text-ink text-xs font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
        <span>{t.source.freshness.fresh}</span>
      </span>
    );
  }

  if (freshness === 'stale') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-ink-muted bg-surface text-warning-ink text-xs font-semibold">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{t.source.freshness.stale}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-danger bg-surface text-danger text-xs font-semibold">
      <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{t.source.freshness.unavailable}</span>
    </span>
  );
}

function computeMinutesAgo(isoUtc: string, nowMs: number): number | null {
  const ts = Date.parse(isoUtc);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((nowMs - ts) / 60_000));
}

function UploadedBanner({ fileName }: { readonly fileName: string }): ReactElement {
  const { t } = useI18n();
  return (
    <section
      aria-label={t.source.uploadedHeading}
      className="rounded-lg border-2 border-danger bg-surface-2 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-danger font-bold text-sm">
          <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t.source.uploadedBanner}</span>
        </div>
        <span className="text-sm text-ink font-medium">
          {t.source.uploadedFileLabel}: {fileName}
        </span>
      </div>
    </section>
  );
}

function MeasuredSection({
  measured,
  nowMs,
}: {
  readonly measured: MeasuredAir;
  readonly nowMs: number;
}): ReactElement {
  const { t } = useI18n();
  const timeUtc = measured.source.dataTimeUtc ?? measured.source.fetchedAtUtc;
  const minsAgo = computeMinutesAgo(timeUtc, nowMs);
  const provider = measured.source.provider ?? measured.source.name;
  const distance = measured.station.distanceKm.toFixed(1);
  const agoText =
    minsAgo === null || minsAgo === 0 ? t.source.justNow : `${minsAgo} ${t.source.minAgoSuffix}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="space-y-0.5">
        <p className="font-semibold text-ink">
          {t.source.providerLabel}: {provider} · {t.source.stationLabel}: {measured.station.name} (
          {distance} {t.source.distanceUnit})
        </p>
        <p className="text-ink-muted">
          {t.source.updatedPrefix} {formatIstTime(timeUtc)} ({agoText})
        </p>
      </div>
      <FreshnessChip freshness={measured.freshness} />
    </div>
  );
}

function isReportUploaded(report: AirReport): boolean {
  return (
    report.warnings.some((w) => w.code === 'UPLOADED_DATA') ||
    report.measured?.source.kind === 'uploaded' ||
    report.forecast?.source.kind === 'uploaded'
  );
}

export function SourceBadge({ report, clock = Date.now }: SourceBadgeProps): ReactElement {
  const { t } = useI18n();

  if (isReportUploaded(report)) {
    const fileName =
      report.measured?.source.name ?? report.forecast?.source.name ?? report.location.label;
    return <UploadedBanner fileName={fileName} />;
  }

  return (
    <section
      aria-label={t.source.measuredHeading}
      className="rounded-lg border border-surface-2 bg-surface-2 p-4 space-y-2 text-sm"
    >
      {report.measured && <MeasuredSection measured={report.measured} nowMs={clock()} />}
      {report.forecast && (
        <div className="flex items-center gap-2 text-ink-muted">
          <Cloud className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {t.source.forecastHeading}: {report.forecast.source.name} ({t.source.modelForecastTag})
          </span>
        </div>
      )}
    </section>
  );
}

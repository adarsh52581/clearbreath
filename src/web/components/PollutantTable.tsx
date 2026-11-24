import type { ReactElement } from 'react';
import type { MeasuredAir } from '../../shared/schemas.js';
import { formatIstTime } from '../../domain/format.js';
import { average24h } from '../../domain/naqi.js';
import { useI18n } from '../i18n/index.js';

export interface PollutantTableProps {
  readonly measured: MeasuredAir | null;
  readonly fetchedAtUtc: string;
}

function formatRounded(val: number | null | undefined, fallback: string): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return fallback;
  }
  return String(Math.round(val));
}

export function PollutantTable({ measured, fetchedAtUtc }: PollutantTableProps): ReactElement | null {
  const { t } = useI18n();

  if (!measured) {
    return null;
  }

  const avgPm25 = average24h(measured.series24h.pm25, fetchedAtUtc);
  const avgPm10 = average24h(measured.series24h.pm10, fetchedAtUtc);

  const rows = [
    {
      name: t.aqi.pm25Name,
      latest: formatRounded(measured.latest.pm25?.value, t.pollutants.notAvailable),
      avg24h: avgPm25.sufficient
        ? formatRounded(avgPm25.value, t.pollutants.notAvailable)
        : t.pollutants.insufficient24h,
      unit: measured.latest.pm25?.unit ?? t.pollutants.unitValue,
      time: measured.latest.pm25
        ? formatIstTime(measured.latest.pm25.atUtc)
        : t.pollutants.notAvailable,
    },
    {
      name: t.aqi.pm10Name,
      latest: formatRounded(measured.latest.pm10?.value, t.pollutants.notAvailable),
      avg24h: avgPm10.sufficient
        ? formatRounded(avgPm10.value, t.pollutants.notAvailable)
        : t.pollutants.insufficient24h,
      unit: measured.latest.pm10?.unit ?? t.pollutants.unitValue,
      time: measured.latest.pm10
        ? formatIstTime(measured.latest.pm10.atUtc)
        : t.pollutants.notAvailable,
    },
  ];

  return (
    <section
      aria-label={t.pollutants.heading}
      className="rounded-lg border border-surface-2 bg-surface p-5 overflow-x-auto"
    >
      <h2 className="text-base font-bold text-ink mb-3">{t.pollutants.heading}</h2>
      <table className="w-full text-left text-sm border-collapse">
        <caption className="sr-only">{t.pollutants.caption}</caption>
        <thead>
          <tr className="border-b border-surface-2 text-ink-muted">
            <th scope="col" className="py-2 pr-4 font-semibold">
              {t.pollutants.pollutantCol}
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              {t.pollutants.latestCol}
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              {t.pollutants.avg24hCol}
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              {t.pollutants.unitCol}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {t.pollutants.timeCol}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-surface-2 last:border-b-0">
              <th scope="row" className="py-2.5 pr-4 font-semibold text-ink">
                {row.name}
              </th>
              <td className="py-2.5 pr-4 tabular-nums text-ink">{row.latest}</td>
              <td className="py-2.5 pr-4 tabular-nums text-ink">{row.avg24h}</td>
              <td className="py-2.5 pr-4 text-ink-muted">{row.unit}</td>
              <td className="py-2.5 tabular-nums text-ink-muted">{row.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

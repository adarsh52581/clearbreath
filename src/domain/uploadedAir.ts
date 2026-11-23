import { computeNaqi } from './naqi.js';
import type { UploadedSeries, AirReport, WarningCode } from '../shared/schemas.js';

// Re-export shared types used by callers
export type { AirReport };

/**
 * Builds an AirReport from an uploaded PM series.
 * Pure — no fetch, no Date.now(), no env.
 * Step 9 reuses this in the browser.
 *
 * Rules (ARCHITECTURE §6.4):
 * - source kind = 'uploaded'
 * - warning UPLOADED_DATA always present
 * - AQI computed via computeNaqi from the uploaded points
 * - forecast = uploaded points after nowUtc (if any), else null
 * - measured = null (uploaded data is never labelled live)
 */
export function buildUploadedAirReport(
  upload: UploadedSeries,
  location: { label: string; lat: number; lon: number; cityId?: string },
  nowUtc: string,
): AirReport {
  const fetchedAtUtc = nowUtc;
  const warnings: { code: WarningCode; message: string }[] = [
    {
      code: 'UPLOADED_DATA',
      message: 'AQI computed from uploaded data, not from a live monitoring station.',
    },
  ];

  // Build hourly series for naqi computation
  const pm25Series = upload.points
    .filter((p) => p.pm25 !== null)
    .map((p) => ({ timeUtc: p.timeUtc, value: p.pm25 as number }));
  const pm10Series = upload.points
    .filter((p) => p.pm10 !== null)
    .map((p) => ({ timeUtc: p.timeUtc, value: p.pm10 as number }));

  // Latest values: last point in the series
  const lastPm25 = [...pm25Series].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc)).at(-1);
  const lastPm10 = [...pm10Series].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc)).at(-1);

  const naqi = computeNaqi({
    pm25: pm25Series,
    pm10: pm10Series,
    latest: { pm25: lastPm25?.value, pm10: lastPm10?.value },
    nowUtc,
  });

  // Forecast = uploaded points after nowUtc
  const nowMs = Date.parse(nowUtc);
  const futurePoints = upload.points.filter((p) => Date.parse(p.timeUtc) > nowMs);

  const forecast =
    futurePoints.length > 0
      ? {
          source: {
            name: upload.fileName,
            kind: 'uploaded' as const,
            fetchedAtUtc,
            url: '',
          },
          points: futurePoints,
        }
      : null;

  return {
    location,
    measured: null,
    naqi,
    forecast,
    warnings,
    fetchedAtUtc,
  };
}

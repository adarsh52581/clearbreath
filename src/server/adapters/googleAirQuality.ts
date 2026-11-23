import { z } from 'zod';
import { fetchJson } from './http.js';
import type { ForecastPoint } from '../../shared/schemas.js';
import { AppError } from '../errors.js';

type FetchFn = typeof fetch;

const FORECAST_URL = 'https://airquality.googleapis.com/v1/forecast:lookup';

// µg/m³ unit string as returned by the API
const MICROGRAMS_UNIT = 'MICROGRAMS_PER_CUBIC_METER';

// --- Zod schemas ---

const concentrationSchema = z
  .object({ value: z.number(), units: z.string() })
  .passthrough();

const pollutantSchema = z
  .object({
    code: z.string(),
    concentration: concentrationSchema,
  })
  .passthrough();

const hourlyForecastSchema = z
  .object({
    dateTime: z.string(),
    pollutants: z.array(pollutantSchema).default([]),
  })
  .passthrough();

const pageResponseSchema = z
  .object({
    hourlyForecasts: z.array(hourlyForecastSchema).default([]),
    nextPageToken: z.string().optional(),
  })
  .passthrough();

// --- Exported types ---

export interface GoogleAqForecastResult {
  points: ForecastPoint[];
  hadUnitMismatch: boolean;
}

export interface GoogleAqAdapter {
  forecast48h(lat: number, lon: number, nowUtc: string): Promise<GoogleAqForecastResult>;
}

// --- Helpers ---

function nextFullHour(nowUtc: string): string {
  const d = new Date(nowUtc);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 1);
  return d.toISOString().replace('.000Z', 'Z');
}

function addHours(isoUtc: string, h: number): string {
  const d = new Date(isoUtc);
  d.setUTCHours(d.getUTCHours() + h);
  return d.toISOString().replace('.000Z', 'Z');
}

// --- Adapter factory ---

export function createGoogleAqAdapter({
  apiKey,
  fetchFn = fetch,
}: {
  apiKey: string;
  fetchFn?: FetchFn;
}): GoogleAqAdapter {
  async function forecast48h(
    lat: number,
    lon: number,
    nowUtc: string,
  ): Promise<GoogleAqForecastResult> {
    const startTime = nextFullHour(nowUtc);
    // endTime is startTime + 47 h (inclusive, so 48 points total)
    const endTime = addHours(startTime, 47);

    const points: ForecastPoint[] = [];
    let hadUnitMismatch = false;
    let pageToken: string | undefined;

    do {
      const body: Record<string, unknown> = {
        location: { latitude: lat, longitude: lon },
        period: { startTime, endTime },
        extraComputations: ['POLLUTANT_CONCENTRATION', 'LOCAL_AQI'],
        pageSize: 48,
        languageCode: 'en',
      };
      if (pageToken) {
        body.pageToken = pageToken;
      }

      const raw = await fetchJson<unknown>(
        FORECAST_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
          },
          body: JSON.stringify(body),
        },
        { fetchFn },
      );

      const page = pageResponseSchema.parse(raw);

      for (const hf of page.hourlyForecasts) {
        let pm25: number | null = null;
        let pm10: number | null = null;

        for (const pollutant of hf.pollutants) {
          if (pollutant.code !== 'pm25' && pollutant.code !== 'pm10') continue;
          if (pollutant.concentration.units !== MICROGRAMS_UNIT) {
            hadUnitMismatch = true;
            continue;
          }
          if (pollutant.code === 'pm25') pm25 = pollutant.concentration.value;
          if (pollutant.code === 'pm10') pm10 = pollutant.concentration.value;
        }

        points.push({ timeUtc: hf.dateTime, pm25, pm10 });
      }

      pageToken = page.nextPageToken;
    } while (pageToken && points.length < 48);

    if (points.length === 0) {
      throw new AppError('UPSTREAM_UNAVAILABLE', 502, 'Google Air Quality returned no forecast points');
    }

    return { points: points.slice(0, 48), hadUnitMismatch };
  }

  return { forecast48h };
}

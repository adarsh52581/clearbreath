import { z } from 'zod';
import { fetchJson } from './http.js';
import type { ForecastPoint } from '../../shared/schemas.js';

type FetchFn = typeof fetch;

const OPEN_METEO_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// --- Zod schema ---

const openMeteoResponseSchema = z
  .object({
    hourly: z.object({
      time: z.array(z.string()),
      pm2_5: z.array(z.number().nullable()),
      pm10: z.array(z.number().nullable()),
    }),
  })
  .passthrough();

// --- Exported types ---

export interface OpenMeteoAdapter {
  forecast48h(lat: number, lon: number, nowUtc: string): Promise<ForecastPoint[]>;
}

// --- Adapter factory ---

export function createOpenMeteoAdapter({
  fetchFn = fetch,
}: {
  fetchFn?: FetchFn;
} = {}): OpenMeteoAdapter {
  async function forecast48h(
    lat: number,
    lon: number,
    nowUtc: string,
  ): Promise<ForecastPoint[]> {
    const url =
      `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
      `&hourly=pm2_5,pm10&timezone=GMT&forecast_days=3`;

    const raw = await fetchJson<unknown>(url, {}, { fetchFn });
    const parsed = openMeteoResponseSchema.parse(raw);

    const { time, pm2_5, pm10 } = parsed.hourly;
    const nowMs = Date.parse(nowUtc);

    const allPoints: ForecastPoint[] = time.map((t, i) => ({
      // hourly.time is GMT without zone suffix — append Z
      timeUtc: `${t}Z`,
      pm25: pm2_5[i] ?? null,
      pm10: pm10[i] ?? null,
    }));

    // Keep only the next 48 h from now
    const future = allPoints.filter((p) => Date.parse(p.timeUtc) >= nowMs);
    return future.slice(0, 48);
  }

  return { forecast48h };
}

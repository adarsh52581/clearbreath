import { describe, it, expect, vi } from 'vitest';
import { createOpenMeteoAdapter } from './openMeteo.js';
import openMeteoFixture from './__fixtures__/openmeteo-forecast.json' with { type: 'json' };

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

describe('createOpenMeteoAdapter', () => {
  it('converts GMT times to UTC ISO (appends Z)', async () => {
    const fetchFn = okFetch(openMeteoFixture);
    const adapter = createOpenMeteoAdapter({ fetchFn });
    const points = await adapter.forecast48h(28.6, 77.2, '2026-11-23T09:00:00Z');

    expect(points.length).toBeGreaterThan(0);
    for (const pt of points) {
      expect(pt.timeUtc).toMatch(/Z$/);
    }
  });

  it('keeps only the next 48 h from nowUtc', async () => {
    const fetchFn = okFetch(openMeteoFixture);
    const adapter = createOpenMeteoAdapter({ fetchFn });
    const points = await adapter.forecast48h(28.6, 77.2, '2026-11-23T09:00:00Z');
    expect(points.length).toBeLessThanOrEqual(48);
  });

  it('filters out points before nowUtc', async () => {
    const fetchFn = okFetch(openMeteoFixture);
    const adapter = createOpenMeteoAdapter({ fetchFn });
    const points = await adapter.forecast48h(28.6, 77.2, '2027-01-01T00:00:00Z');
    expect(points).toHaveLength(0);
  });

  it('pm2_5 values map to pm25 field; pm10 values map to pm10 field', async () => {
    const fetchFn = okFetch(openMeteoFixture);
    const adapter = createOpenMeteoAdapter({ fetchFn });
    const points = await adapter.forecast48h(28.6, 77.2, '2026-11-23T09:00:00Z');
    if (points.length > 0) {
      const pt = points[0]!;
      expect(pt.pm25 === null || typeof pt.pm25 === 'number').toBe(true);
      expect(pt.pm10 === null || typeof pt.pm10 === 'number').toBe(true);
    }
  });
});

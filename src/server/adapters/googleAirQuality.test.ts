import { describe, it, expect, vi } from 'vitest';
import { createGoogleAqAdapter } from './googleAirQuality.js';
import page1 from './__fixtures__/google-forecast-page1.json' with { type: 'json' };
import page2 from './__fixtures__/google-forecast-page2.json' with { type: 'json' };
import wrongUnits from './__fixtures__/google-forecast-wrong-units.json' with { type: 'json' };

function fakeOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('createGoogleAqAdapter', () => {
  it('stitches two pages to 48 forecast points', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(fakeOk(page1))
      .mockResolvedValueOnce(fakeOk(page2));
    const adapter = createGoogleAqAdapter({ apiKey: 'test-key', fetchFn });
    const result = await adapter.forecast48h(28.6139, 77.209, '2026-11-23T11:00:00Z');

    expect(result.points).toHaveLength(48);
    expect(result.hadUnitMismatch).toBe(false);
    expect(result.points.every((p) => p.pm25 !== null && p.pm10 !== null)).toBe(true);
  });

  it('single-page response without nextPageToken returns its points', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(fakeOk(page2));
    const adapter = createGoogleAqAdapter({ apiKey: 'k', fetchFn });
    const result = await adapter.forecast48h(28.6, 77.2, '2026-11-24T11:00:00Z');
    expect(result.points.length).toBeLessThanOrEqual(48);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('wrong-units pollutants are dropped and hadUnitMismatch is true', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(fakeOk(wrongUnits));
    const adapter = createGoogleAqAdapter({ apiKey: 'k', fetchFn });
    const result = await adapter.forecast48h(28.6, 77.2, '2026-11-23T11:00:00Z');

    expect(result.hadUnitMismatch).toBe(true);
    const pt = result.points[0]!;
    expect(pt.pm25).toBeNull();
    expect(pt.pm10).toBeCloseTo(140.0);
  });

  it('sends POST with X-Goog-Api-Key header', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(fakeOk(page2));
    const adapter = createGoogleAqAdapter({ apiKey: 'my-key', fetchFn });
    await adapter.forecast48h(28.6, 77.2, '2026-11-24T00:00:00Z');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('airquality.googleapis.com');
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('my-key');
    expect(init.method).toBe('POST');
  });
});

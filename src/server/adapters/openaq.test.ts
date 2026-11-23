import { describe, it, expect, vi } from 'vitest';
import { createOpenAqAdapter } from './openaq.js';
import locationsDelhi from './__fixtures__/openaq-locations-delhi.json' with { type: 'json' };
import locationsEmpty from './__fixtures__/openaq-locations-empty.json' with { type: 'json' };
import latestFixture from './__fixtures__/openaq-latest.json' with { type: 'json' };
import hoursPm25Fixture from './__fixtures__/openaq-hours-pm25.json' with { type: 'json' };

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

describe('createOpenAqAdapter', () => {
  it('findStations: sends X-API-Key header and parses locations fixture', async () => {
    const fetchFn = okFetch(locationsDelhi);
    const adapter = createOpenAqAdapter({ apiKey: 'test-key', fetchFn });
    const stations = await adapter.findStations(28.6139, 77.209, 10000);

    expect(fetchFn).toHaveBeenCalledOnce();
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('test-key');

    expect(stations).toHaveLength(2);
    expect(stations[0]!.name).toContain('Anand Vihar');
    expect(stations[0]!.isMonitor).toBe(true);
  });

  it('findStations: coordinates sent as "lat,lon" with 4 decimals', async () => {
    const fetchFn = okFetch(locationsEmpty);
    const adapter = createOpenAqAdapter({ apiKey: 'k', fetchFn });
    await adapter.findStations(28.6139, 77.209, 10000);

    const [url] = fetchFn.mock.calls[0] as [string];
    expect(url).toContain('coordinates=28.6139,77.2090');
  });

  it('findStations: empty results handled gracefully', async () => {
    const fetchFn = okFetch(locationsEmpty);
    const adapter = createOpenAqAdapter({ apiKey: 'k', fetchFn });
    const stations = await adapter.findStations(0, 0, 10000);
    expect(stations).toHaveLength(0);
  });

  it('getLatest: parses pm25 and pm10 from fixture', async () => {
    const fetchFn = okFetch(latestFixture);
    const adapter = createOpenAqAdapter({ apiKey: 'k', fetchFn });
    const latest = await adapter.getLatest(8118);
    expect(latest.pm25).toBeDefined();
    expect(latest.pm25!.value).toBeCloseTo(87.5);
    expect(latest.pm10).toBeDefined();
    expect(latest.pm10!.value).toBeCloseTo(165.0);
  });

  it('getHours: parses 24 hourly pm25 values from fixture', async () => {
    const fetchFn = okFetch(hoursPm25Fixture);
    const adapter = createOpenAqAdapter({ apiKey: 'k', fetchFn });
    const hours = await adapter.getHours(10204, '2026-11-22T10:00:00Z', '2026-11-23T10:00:00Z');
    expect(hours).toHaveLength(24);
    expect(hours[0]!.value).toBeCloseTo(72.3);
    expect(hours[0]!.timeUtc).toBe('2026-11-22T10:00:00Z');
  });
});

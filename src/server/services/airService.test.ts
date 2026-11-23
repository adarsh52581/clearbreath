import { describe, it, expect, vi } from 'vitest';
import { createAirService } from './airService.js';
import { TypedCache } from '../cache.js';
import type { AirReport } from '../../shared/schemas.js';
import type { OpenAqAdapter, OpenAqStation } from '../adapters/openaq.js';
import type { GoogleAqAdapter } from '../adapters/googleAirQuality.js';
import type { OpenMeteoAdapter } from '../adapters/openMeteo.js';

const NOW = '2026-11-23T10:00:00Z';
const NOW_MS = Date.parse(NOW);

const freshMonitor: OpenAqStation = {
  id: 1,
  name: 'Fresh Monitor',
  isMonitor: true,
  lat: 28.6508,
  lon: 77.3152,
  lastUpdatedUtc: new Date(NOW_MS - 1 * 60 * 60 * 1000).toISOString(),
  sensors: [
    { id: 101, parameterName: 'pm25' },
    { id: 102, parameterName: 'pm10' },
  ],
  provider: 'CPCB',
  attribution: [{ name: 'CPCB', url: 'https://cpcb.nic.in' }],
};

const staleSensor: OpenAqStation = {
  id: 2,
  name: 'Stale Sensor',
  isMonitor: false,
  lat: 28.6229,
  lon: 77.219,
  lastUpdatedUtc: new Date(NOW_MS - 7 * 60 * 60 * 1000).toISOString(),
  sensors: [{ id: 201, parameterName: 'pm25' }],
  provider: 'AQMesh',
  attribution: [],
};

function make24hSeries(nowUtc: string, value = 85) {
  const nowMs = Date.parse(nowUtc);
  return Array.from({ length: 24 }, (_, i) => ({
    timeUtc: new Date(nowMs - (24 - i) * 60 * 60 * 1000).toISOString(),
    value,
  }));
}

function makeOpenAq(stations: OpenAqStation[]): OpenAqAdapter {
  return {
    findStations: vi.fn().mockResolvedValue(stations),
    getLatest: vi.fn().mockResolvedValue({
      pm25: { value: 87.5, atUtc: NOW },
      pm10: { value: 165.0, atUtc: NOW },
    }),
    getHours: vi.fn().mockResolvedValue(make24hSeries(NOW)),
  };
}

const goodForecastPoints = Array.from({ length: 48 }, (_, i) => ({
  timeUtc: new Date(Date.parse(NOW) + (i + 1) * 60 * 60 * 1000).toISOString(),
  pm25: 70,
  pm10: 140,
}));

function makeGoogle(fail = false): GoogleAqAdapter {
  if (fail) {
    return { forecast48h: vi.fn().mockRejectedValue(new Error('Google down')) };
  }
  return {
    forecast48h: vi.fn().mockResolvedValue({ points: goodForecastPoints, hadUnitMismatch: false }),
  };
}

function makeOpenMeteo(fail = false): OpenMeteoAdapter {
  if (fail) {
    return { forecast48h: vi.fn().mockRejectedValue(new Error('OpenMeteo down')) };
  }
  return { forecast48h: vi.fn().mockResolvedValue(goodForecastPoints) };
}

function makeCache() {
  return new TypedCache<AirReport>(200);
}

const DELHI = { lat: 28.6139, lon: 77.209, label: 'Delhi', cityId: 'delhi' };

describe('airService', () => {
  it('picks fresh monitor over closer stale sensor', async () => {
    const openaq = makeOpenAq([staleSensor, freshMonitor]);
    const service = createAirService({
      openaq,
      google: makeGoogle(),
      openMeteo: makeOpenMeteo(),
      cache: makeCache(),
      clock: () => NOW,
    });
    const report = await service.getAirReport(DELHI);
    expect(report.measured?.station.name).toBe('Fresh Monitor');
  });

  it('10 km → 25 km fallback: findStations called twice when 10 km empty', async () => {
    const findStations = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([freshMonitor]);
    const openaq: OpenAqAdapter = {
      findStations,
      getLatest: vi.fn().mockResolvedValue({}),
      getHours: vi.fn().mockResolvedValue([]),
    };
    const service = createAirService({
      openaq,
      google: makeGoogle(),
      openMeteo: makeOpenMeteo(),
      cache: makeCache(),
      clock: () => NOW,
    });
    await service.getAirReport(DELHI);
    expect(findStations).toHaveBeenCalledTimes(2);
    expect(findStations.mock.calls[1]?.[2]).toBe(25_000);
  });

  it('no station within 25 km → measured null + NO_STATION warning', async () => {
    const openaq = makeOpenAq([]);
    const service = createAirService({
      openaq,
      google: makeGoogle(),
      openMeteo: makeOpenMeteo(),
      cache: makeCache(),
      clock: () => NOW,
    });
    const report = await service.getAirReport(DELHI);
    expect(report.measured).toBeNull();
    expect(report.warnings.some((w) => w.code === 'NO_STATION')).toBe(true);
  });

  it('Google failure → Open-Meteo + FORECAST_FALLBACK warning', async () => {
    const openaq = makeOpenAq([freshMonitor]);
    const service = createAirService({
      openaq,
      google: makeGoogle(true),
      openMeteo: makeOpenMeteo(),
      cache: makeCache(),
      clock: () => NOW,
    });
    const report = await service.getAirReport(DELHI);
    expect(report.forecast).not.toBeNull();
    expect(report.forecast?.source.name).toContain('Open-Meteo');
    expect(report.warnings.some((w) => w.code === 'FORECAST_FALLBACK')).toBe(true);
  });

  it('both forecast providers fail → forecast null + FORECAST_UNAVAILABLE', async () => {
    const openaq = makeOpenAq([freshMonitor]);
    const service = createAirService({
      openaq,
      google: makeGoogle(true),
      openMeteo: makeOpenMeteo(true),
      cache: makeCache(),
      clock: () => NOW,
    });
    const report = await service.getAirReport(DELHI);
    expect(report.forecast).toBeNull();
    expect(report.warnings.some((w) => w.code === 'FORECAST_UNAVAILABLE')).toBe(true);
  });

  it('second call within TTL hits the cache (findStations only called once total)', async () => {
    const findStations = vi.fn().mockResolvedValue([freshMonitor]);
    const openaq: OpenAqAdapter = {
      findStations,
      getLatest: vi.fn().mockResolvedValue({ pm25: { value: 85, atUtc: NOW } }),
      getHours: vi.fn().mockResolvedValue(make24hSeries(NOW)),
    };
    const service = createAirService({
      openaq,
      google: makeGoogle(),
      openMeteo: makeOpenMeteo(),
      cache: makeCache(),
      clock: () => NOW,
    });
    await service.getAirReport(DELHI);
    const countAfterFirst = findStations.mock.calls.length;
    await service.getAirReport(DELHI); // should hit cache
    expect(findStations.mock.calls.length).toBe(countAfterFirst); // no additional calls
  });

  it('< 16 hourly values → INDICATIVE_AQI warning', async () => {
    const getHours = vi.fn().mockResolvedValue(make24hSeries(NOW).slice(0, 10));
    const openaq: OpenAqAdapter = {
      findStations: vi.fn().mockResolvedValue([freshMonitor]),
      getLatest: vi.fn().mockResolvedValue({ pm25: { value: 85, atUtc: NOW } }),
      getHours,
    };
    const service = createAirService({
      openaq,
      google: makeGoogle(),
      openMeteo: makeOpenMeteo(),
      cache: makeCache(),
      clock: () => NOW,
    });
    const report = await service.getAirReport(DELHI);
    expect(report.warnings.some((w) => w.code === 'INDICATIVE_AQI')).toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import type { AirService } from '../services/airService.js';
import type { AirReport } from '../../shared/schemas.js';

interface ErrorBody {
  error: { code: string; message: string; retryAfterSeconds?: number };
}

interface CitiesBody {
  cities: Array<{ id: string; name: string; state: string; lat: number; lon: number; ncr: boolean }>;
}

interface AirBody {
  location: { label: string; lat: number; lon: number; cityId?: string };
  fetchedAtUtc: string;
  warnings: Array<{ code: string; message: string }>;
}

const testConfig: Config = {
  nodeEnv: 'test',
  port: 8080,
  appVersion: 'test',
  geminiModel: 'gemini-test',
  forecastProvider: 'google',
};

const NOW = '2026-11-23T10:00:00Z';

const fakeReport: AirReport = {
  location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
  measured: null,
  naqi: null,
  forecast: null,
  warnings: [{ code: 'NO_STATION', message: 'No station found' }],
  fetchedAtUtc: NOW,
};

function makeFakeAirService(report: AirReport = fakeReport): AirService {
  return { getAirReport: vi.fn().mockResolvedValue(report) };
}

describe('GET /api/cities', () => {
  it('returns 200 with 10 cities', async () => {
    const app = createApp({ config: testConfig });
    const res = await request(app).get('/api/cities');
    expect(res.status).toBe(200);
    const body = res.body as CitiesBody;
    expect(body.cities).toHaveLength(12);
    const delhi = body.cities.find((c) => c.id === 'delhi');
    expect(delhi).toBeDefined();
    expect(delhi!.name).toBe('Delhi');
    expect(typeof delhi!.lat).toBe('number');
    expect(typeof delhi!.lon).toBe('number');
    expect(typeof delhi!.ncr).toBe('boolean');
  });
});

describe('GET /api/air', () => {
  it('400 when no params provided', async () => {
    const app = createApp({ config: testConfig, airService: makeFakeAirService() });
    const res = await request(app).get('/api/air');
    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe('VALIDATION');
  });

  it('400 when lat given without lon', async () => {
    const app = createApp({ config: testConfig, airService: makeFakeAirService() });
    const res = await request(app).get('/api/air?lat=28.6');
    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe('VALIDATION');
  });

  it('422 OUT_OF_COVERAGE for coordinates outside India', async () => {
    const app = createApp({ config: testConfig, airService: makeFakeAirService() });
    const res = await request(app).get('/api/air?lat=51.5&lon=-0.12');
    expect(res.status).toBe(422);
    expect((res.body as ErrorBody).error.code).toBe('OUT_OF_COVERAGE');
  });

  it('422 for unknown cityId', async () => {
    const app = createApp({ config: testConfig, airService: makeFakeAirService() });
    const res = await request(app).get('/api/air?cityId=narnia');
    expect(res.status).toBe(422);
    expect((res.body as ErrorBody).error.code).toBe('OUT_OF_COVERAGE');
  });

  it('200 with correct shape for cityId=delhi', async () => {
    const app = createApp({ config: testConfig, airService: makeFakeAirService() });
    const res = await request(app).get('/api/air?cityId=delhi');
    expect(res.status).toBe(200);
    const body = res.body as AirBody;
    expect(body.location.label).toBe('Delhi');
    expect(body.fetchedAtUtc).toBe(NOW);
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it('200 with correct shape for lat/lon within India', async () => {
    const app = createApp({ config: testConfig, airService: makeFakeAirService() });
    const res = await request(app).get('/api/air?lat=28.6&lon=77.2');
    expect(res.status).toBe(200);
    const body = res.body as AirBody;
    expect(body.location).toBeDefined();
  });

  it('429 after exceeding rate limit', async () => {
    const app = createApp({ config: testConfig, airService: makeFakeAirService() });
    const agent = request(app);
    const results = await Promise.all(
      Array.from({ length: 61 }, () => agent.get('/api/air?cityId=delhi')),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses).toContain(429);
    const tooMany = results.find((r) => r.status === 429);
    expect((tooMany?.body as ErrorBody).error.code).toBe('RATE_LIMITED');
    expect(typeof (tooMany?.body as ErrorBody).error.retryAfterSeconds).toBe('number');
  });
});

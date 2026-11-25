import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';
import { createApp } from '../app.js';
import { AppError } from '../errors.js';
import type { Config } from '../config.js';
import type { IaqService } from '../services/iaqService.js';

const testConfig: Config = {
  nodeEnv: 'test',
  port: 8080,
  appVersion: 'test',
  geminiModel: 'gemini-3.6-flash',
  forecastProvider: 'openmeteo',
};

const validBody = {
  profile: HOUSEHOLD_PRESETS[0]!,
  location: { cityId: 'delhi' },
  home: HOUSEHOLD_PRESETS[0]!.home,
  language: 'en' as const,
};

function makeIaqService(overrides?: Partial<IaqService>): IaqService {
  return {
    explainIaq: vi.fn().mockResolvedValue({
      facts: [],
      scenarios: [],
      explanation: { summary: 'Ok', actions: [], caveats: [] },
      meta: { origin: 'fallback', attempts: 0, generatedAtUtc: '2026-11-25T06:00:00.000Z', warnings: [] },
    }),
    ...overrides,
  };
}

describe('POST /api/iaq/explain', () => {
  it('returns 200 for a valid request', async () => {
    const app = createApp({ config: testConfig, iaqService: makeIaqService() });
    const res = await request(app).post('/api/iaq/explain').send(validBody);
    expect(res.status).toBe(200);
    expect((res.body as { meta: { origin: string } }).meta.origin).toBe('fallback');
  });

  it('returns 415 when Content-Type is not application/json', async () => {
    const app = createApp({ config: testConfig, iaqService: makeIaqService() });
    const res = await request(app)
      .post('/api/iaq/explain')
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(res.status).toBe(415);
  });

  it('returns 400 on invalid request body', async () => {
    const app = createApp({ config: testConfig, iaqService: makeIaqService() });
    const res = await request(app).post('/api/iaq/explain').send({ bad: true });
    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION');
  });

  it('returns 422 NO_OUTDOOR_DATA when service throws it', async () => {
    const iaqService = makeIaqService({
      explainIaq: vi.fn().mockRejectedValue(new AppError('NO_OUTDOOR_DATA', 422, 'No outdoor PM2.5')),
    });
    const app = createApp({ config: testConfig, iaqService });
    const res = await request(app).post('/api/iaq/explain').send(validBody);
    expect(res.status).toBe(422);
    expect((res.body as { error: { code: string } }).error.code).toBe('NO_OUTDOOR_DATA');
  });

  it('returns 429 after 10 requests per minute', async () => {
    const app = createApp({ config: testConfig, iaqService: makeIaqService() });
    for (let i = 0; i < 10; i++) {
      const okRes = await request(app).post('/api/iaq/explain').send(validBody);
      expect(okRes.status).toBe(200);
    }
    const limited = await request(app).post('/api/iaq/explain').send(validBody);
    expect(limited.status).toBe(429);
    expect((limited.body as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
  });
});

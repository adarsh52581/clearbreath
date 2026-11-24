import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import type { PlanService } from '../services/planService.js';
import type { PlanResponse } from '../../shared/schemas.js';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';

const testConfig: Config = {
  nodeEnv: 'test',
  port: 8080,
  appVersion: 'test',
  geminiModel: 'gemini-test',
  forecastProvider: 'google',
};

const fakePlanResponse: PlanResponse = {
  air: {
    location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
    measured: null,
    naqi: null,
    forecast: null,
    warnings: [],
    fetchedAtUtc: '2026-11-23T12:00:00Z',
  },
  facts: [],
  candidates: {
    activities: [],
    commutes: [],
    indoor: [],
    community: [],
  },
  plan: {
    summary: 'Plan summary',
    routine: [],
    indoor: [],
    community: [],
    caveats: [],
  },
  meta: {
    origin: 'gemini',
    model: 'gemini-test',
    attempts: 1,
    generatedAtUtc: '2026-11-23T12:00:00Z',
    warnings: [],
  },
};

interface ApiResponse {
  error?: { code: string; message: string; retryAfterSeconds?: number };
  plan?: unknown;
  meta?: { origin: string; attempts: number };
}

describe('POST /api/plan route', () => {
  const fakePlanService: PlanService = {
    createPlan: vi.fn().mockResolvedValue(fakePlanResponse),
  };

  const validBody = {
    profile: HOUSEHOLD_PRESETS[0]!, // non-null: verified preset exists
    location: { cityId: 'delhi' },
    language: 'en',
  };

  it('415 for non-JSON content type', async () => {
    const app = createApp({ config: testConfig, planService: fakePlanService });
    const res = await request(app)
      .post('/api/plan')
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(res.status).toBe(415);
    const body = res.body as ApiResponse;
    expect(body.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('400 for invalid request body', async () => {
    const app = createApp({ config: testConfig, planService: fakePlanService });
    const res = await request(app)
      .post('/api/plan')
      .set('Content-Type', 'application/json')
      .send({ invalid: true });
    expect(res.status).toBe(400);
    const body = res.body as ApiResponse;
    expect(body.error?.code).toBe('VALIDATION');
  });

  it('200 with valid body and returns plan response shape', async () => {
    const app = createApp({ config: testConfig, planService: fakePlanService });
    const res = await request(app)
      .post('/api/plan')
      .set('Content-Type', 'application/json')
      .send(validBody);

    expect(res.status).toBe(200);
    const body = res.body as ApiResponse;
    expect(body.plan).toBeDefined();
    expect(body.meta?.origin).toBe('gemini');
    expect(body.meta?.attempts).toBe(1);
  });

  it('429 after exceeding rate limit (10 req/min)', async () => {
    const app = createApp({ config: testConfig, planService: fakePlanService });
    const agent = request(app);

    // Make 10 requests successfully
    for (let i = 0; i < 10; i++) {
      const res = await agent
        .post('/api/plan')
        .set('Content-Type', 'application/json')
        .send(validBody);
      expect(res.status).toBe(200);
    }

    // 11th request should be 429
    const limitedRes = await agent
      .post('/api/plan')
      .set('Content-Type', 'application/json')
      .send(validBody);

    expect(limitedRes.status).toBe(429);
    const body = limitedRes.body as ApiResponse;
    expect(body.error?.code).toBe('RATE_LIMITED');
    expect(body.error?.retryAfterSeconds).toBeDefined();
  });
});

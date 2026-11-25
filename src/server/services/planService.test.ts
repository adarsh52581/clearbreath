import { describe, it, expect, vi } from 'vitest';
import { createPlanService, type CachedPlanEntry } from './planService.js';
import type { AiClient, GenerateJsonArgs } from '../ai/aiClient.js';
import type { AirService } from './airService.js';
import type { AirReport, PlanRequest } from '../../shared/schemas.js';
import type { AiPlan } from '../../shared/aiSchemas.js';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';
import { TypedCache } from '../cache.js';
import { AppError } from '../errors.js';

class FakeAiClient implements AiClient {
  public callCount = 0;
  public responses: (string | Error)[] = [];
  public lastSystem = '';
  public lastUser = '';

  generateJson(args: GenerateJsonArgs): Promise<string> {
    this.callCount++;
    this.lastSystem = args.system;
    this.lastUser = args.user;
    const resp = this.responses.shift();
    if (!resp) return Promise.reject(new Error('No scripted response remaining in FakeAiClient'));
    if (resp instanceof Error) return Promise.reject(resp);
    return Promise.resolve(resp);
  }
}

describe('planService', () => {
  const fakeAirReport: AirReport = {
    location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
    measured: {
      source: { name: 'OpenAQ', provider: 'CPCB', url: 'https://openaq.org', kind: 'measured', fetchedAtUtc: '2026-11-23T12:00:00Z' },
      station: { id: 1, name: 'Anand Vihar', distanceKm: 4.5, isMonitor: true },
      latest: {
        pm25: { value: 340, unit: 'µg/m³', atUtc: '2026-11-23T11:00:00Z' },
        pm10: { value: 480, unit: 'µg/m³', atUtc: '2026-11-23T11:00:00Z' },
      },
      series24h: { pm25: [], pm10: [] },
      freshness: 'fresh',
    },
    naqi: {
      value: 390,
      category: 'very_poor',
      dominant: 'pm25',
      basis: '24h',
      subIndices: { pm25: 390, pm10: 360 },
      note: 'Based on PM2.5 and PM10 only',
    },
    forecast: {
      source: { name: 'Google Air Quality API', url: 'https://airquality.googleapis.com', kind: 'forecast', fetchedAtUtc: '2026-11-23T12:00:00Z' },
      points: Array.from({ length: 48 }, (_, i) => ({
        timeUtc: new Date(Date.parse('2026-11-23T12:00:00Z') + i * 3600 * 1000).toISOString(),
        pm25: 150 + ((i * 17) % 200),
        pm10: 250 + ((i * 23) % 200),
      })),
    },
    warnings: [],
    fetchedAtUtc: '2026-11-23T12:00:00Z',
  };

  const fakeAirService: AirService = {
    getAirReport: vi.fn().mockResolvedValue(fakeAirReport),
  };

  const delhiPreset = HOUSEHOLD_PRESETS[0]!; // non-null: preset array contains 6 presets

  const defaultRequest: PlanRequest = {
    profile: delhiPreset,
    location: { cityId: 'delhi' },
    language: 'en',
  };

  function createValidAiResponse(): string {
    return JSON.stringify({
      summary: 'Air quality is {{air_category_now}} today with elevated PM2.5 levels.',
      routine: [
        {
          itemId: 'a1',
          chosenOptionId: 'a1_usual',
          headline: 'Evening park play: {{opt_a1_usual_label}}',
          why: 'Intake is {{act_a1_dose_change}} with N95 mask.',
          tradeoff: null,
          priority: 'high',
        },
        {
          itemId: 'a2',
          chosenOptionId: 'a2_usual',
          headline: 'School walk: {{opt_a2_usual_label}}',
          why: 'Intake is {{act_a2_dose_change}} outdoors.',
          tradeoff: null,
          priority: 'medium',
        },
        {
          itemId: 'c1',
          chosenOptionId: 'c1_metro',
          headline: 'Office commute: {{opt_c1_metro_label}}',
          why: 'Reduces intake {{com_c1_metro_dose_change}} and saves CO2.',
          tradeoff: null,
          priority: 'high',
        },
      ],
      indoor: [
        {
          actionId: 'close_windows',
          headline: 'Close windows',
          why: 'Reduces indoor PM2.5 infiltration by {{in_close_windows_change}}.',
          priority: 'high',
        },
      ],
      community: [
        {
          actionId: 'carpool_pod',
          headline: 'Form carpool',
          why: '{{ref_emissions}}',
        },
      ],
      caveats: ['Estimates use live outdoor data and published rates.'],
    });
  }

  it('gemini -> ok returns PlanResponse with origin: gemini and attempts: 1', async () => {
    const ai = new FakeAiClient();
    ai.responses = [createValidAiResponse()];

    const service = createPlanService({
      airService: fakeAirService,
      ai,
      clock: () => '2026-11-23T12:00:00Z',
    });

    const response = await service.createPlan(defaultRequest);

    expect(response.meta.origin).toBe('gemini');
    expect(response.meta.attempts).toBe(1);
    const plan = response.plan as AiPlan;
    expect(plan.summary).toContain('{{air_category_now}}');
    expect(ai.callCount).toBe(1);
  });

  it('invalid output on attempt 1 then valid on attempt 2 returns attempts: 2', async () => {
    const ai = new FakeAiClient();
    ai.responses = [
      '{"invalid": "json schema mismatch"}',
      createValidAiResponse(),
    ];

    const service = createPlanService({
      airService: fakeAirService,
      ai,
      clock: () => '2026-11-23T12:00:00Z',
    });

    const response = await service.createPlan(defaultRequest);

    expect(response.meta.origin).toBe('gemini');
    expect(response.meta.attempts).toBe(2);
    expect(ai.callCount).toBe(2);
    expect(ai.lastUser).toContain('Your previous output failed validation');
  });

  it('invalid twice triggers fallbackPlan with attempts: 2 and origin: fallback', async () => {
    const ai = new FakeAiClient();
    ai.responses = [
      '{"invalid": 1}',
      '{"still_invalid": 2}',
    ];

    const service = createPlanService({
      airService: fakeAirService,
      ai,
      clock: () => '2026-11-23T12:00:00Z',
    });

    const response = await service.createPlan(defaultRequest);

    expect(response.meta.origin).toBe('fallback');
    expect(response.meta.attempts).toBe(2);
    const plan = response.plan as AiPlan;
    expect(plan.summary).toContain('ClearBreath');
  });

  it('provider failure (rate limit) skips the corrective retry and falls back after 1 call', async () => {
    const ai = new FakeAiClient();
    ai.responses = [new AppError('RATE_LIMITED', 429, 'Gemini rate limit exceeded')];

    const service = createPlanService({
      airService: fakeAirService,
      ai,
      clock: () => '2026-11-23T12:00:00Z',
    });

    const response = await service.createPlan(defaultRequest);

    expect(ai.callCount).toBe(1);
    expect(response.meta.attempts).toBe(1);
    expect(response.meta.origin).toBe('fallback');
  });

  it('timeout returns last-good when present in cache', async () => {
    const ai = new FakeAiClient();
    const planCache = new TypedCache<CachedPlanEntry>(100);
    const lastGoodCache = new TypedCache<CachedPlanEntry>(100);

    // Prime with successful run
    ai.responses = [createValidAiResponse()];
    const service1 = createPlanService({
      airService: fakeAirService,
      ai,
      cache: planCache,
      lastGoodCache,
      clock: () => '2026-11-23T12:00:00Z',
    });
    await service1.createPlan(defaultRequest);

    // Second run: clear planCache to simulate expired cache, but lastGoodCache has it
    planCache.clear();
    ai.responses = [new Error('Timeout 504')];

    const service2 = createPlanService({
      airService: fakeAirService,
      ai,
      cache: planCache,
      lastGoodCache,
      clock: () => '2026-11-23T12:30:00Z',
    });
    const response = await service2.createPlan(defaultRequest);

    expect(response.meta.origin).toBe('last-good');
  });

  it('cache hit makes 0 model calls and returns origin: cache', async () => {
    const ai = new FakeAiClient();
    ai.responses = [createValidAiResponse()];
    const planCache = new TypedCache<CachedPlanEntry>(100);

    const service = createPlanService({
      airService: fakeAirService,
      ai,
      cache: planCache,
      clock: () => '2026-11-23T12:00:00Z',
    });

    // Run 1 -> calls model
    await service.createPlan(defaultRequest);
    expect(ai.callCount).toBe(1);

    // Run 2 -> cache hit
    const response2 = await service.createPlan(defaultRequest);
    expect(response2.meta.origin).toBe('cache');
    expect(response2.meta.attempts).toBe(0);
    expect(ai.callCount).toBe(1); // No new calls
  });

  it('Hindi language request sets Hindi system instruction and passes through', async () => {
    const ai = new FakeAiClient();
    ai.responses = [createValidAiResponse()];

    const service = createPlanService({
      airService: fakeAirService,
      ai,
      clock: () => '2026-11-23T12:00:00Z',
    });

    await service.createPlan({
      ...defaultRequest,
      language: 'hi',
    });

    expect(ai.lastSystem).toContain('Hindi (Devanagari script)');
  });

  it('upload requests make no live airService calls', async () => {
    const ai = new FakeAiClient();
    ai.responses = [createValidAiResponse()];
    const mockAirReportFn = vi.fn();
    const mockAirService: AirService = { getAirReport: mockAirReportFn };

    const service = createPlanService({
      airService: mockAirService,
      ai,
      clock: () => '2026-11-23T12:00:00Z',
    });

    const response = await service.createPlan({
      profile: delhiPreset,
      location: { cityId: 'delhi' },
      upload: {
        fileName: 'air-test.csv',
        points: Array.from({ length: 24 }, (_, i) => ({
          timeUtc: new Date(Date.parse('2026-11-23T00:00:00Z') + i * 3600 * 1000).toISOString(),
          pm25: 120,
          pm10: 200,
        })),
      },
      language: 'en',
    });

    expect(mockAirReportFn).not.toHaveBeenCalled();
    expect(response.air.warnings.some((w) => w.code === 'UPLOADED_DATA')).toBe(true);
  });
});

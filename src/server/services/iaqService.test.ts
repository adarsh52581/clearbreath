import { describe, it, expect, vi } from 'vitest';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';
import type { AirReport, IaqExplainRequest } from '../../shared/schemas.js';
import type { AiClient } from '../ai/aiClient.js';
import type { AirService } from './airService.js';
import { createIaqService } from './iaqService.js';

const baseProfile = HOUSEHOLD_PRESETS[0]!;

function makeAir(opts: { measuredPm25?: number; forecastPm25?: number | null }): AirReport {
  return {
    location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
    measured:
      opts.measuredPm25 !== undefined
        ? {
            source: {
              name: 'OpenAQ',
              provider: 'CPCB',
              url: 'https://openaq.org',
              kind: 'measured',
              fetchedAtUtc: '2026-11-25T06:00:00.000Z',
            },
            station: { id: 1, name: 'Anand Vihar', distanceKm: 2, isMonitor: true },
            latest: {
              pm25: { value: opts.measuredPm25, unit: 'µg/m³', atUtc: '2026-11-25T05:30:00.000Z' },
            },
            series24h: { pm25: [], pm10: [] },
            freshness: 'fresh',
          }
        : null,
    naqi: null,
    forecast:
      opts.forecastPm25 !== undefined
        ? {
            source: {
              name: 'Open-Meteo',
              url: 'https://open-meteo.com',
              kind: 'forecast',
              fetchedAtUtc: '2026-11-25T06:00:00.000Z',
            },
            points: [{ timeUtc: '2026-11-25T06:00:00.000Z', pm25: opts.forecastPm25, pm10: null }],
          }
        : null,
    warnings: [],
    fetchedAtUtc: '2026-11-25T06:00:00.000Z',
  };
}

function makeRequest(overrides?: Partial<IaqExplainRequest>): IaqExplainRequest {
  return {
    profile: baseProfile,
    location: { cityId: 'delhi' },
    home: baseProfile.home,
    language: 'en',
    ...overrides,
  };
}

describe('iaqService', () => {
  it('throws 422 NO_OUTDOOR_DATA when neither measured nor forecast has PM2.5', async () => {
    const airService: AirService = {
      getAirReport: vi.fn().mockResolvedValue(makeAir({ forecastPm25: null })),
    };
    const ai: AiClient = { generateJson: vi.fn() };
    const service = createIaqService({ airService, ai });

    await expect(service.explainIaq(makeRequest())).rejects.toMatchObject({
      code: 'NO_OUTDOOR_DATA',
      status: 422,
    });
  });

  it('uses fallback explanation when Gemini fails validation twice', async () => {
    const airService: AirService = {
      getAirReport: vi.fn().mockResolvedValue(makeAir({ measuredPm25: 200 })),
    };
    const ai: AiClient = {
      generateJson: vi.fn().mockResolvedValue('{"invalid": true}'),
    };
    const service = createIaqService({
      airService,
      ai,
      clock: () => '2026-11-25T06:00:00.000Z',
    });

    const res = await service.explainIaq(makeRequest());
    expect(res.meta.origin).toBe('fallback');
    expect(res.meta.attempts).toBe(2);
    expect(res.scenarios.length).toBeGreaterThan(0);
    expect(res.facts.some((f) => f.id === 'in_baseline_pm25')).toBe(true);
  });

  it('uses gemini on valid JSON, caches subsequent identical requests, and skips live air calls for uploads', async () => {
    const getAirReport = vi.fn().mockResolvedValue(makeAir({ measuredPm25: 200 }));
    const airService: AirService = { getAirReport };
    const validJson = JSON.stringify({
      summary: 'Indoor PM2.5 is {{in_baseline_pm25}}.',
      actions: [
        {
          actionId: 'close_windows',
          headline: 'Close windows',
          why: 'Reduces indoor PM2.5 by {{in_close_windows_change}}.',
          priority: 'high',
        },
      ],
      caveats: ['Indoor estimate assumes no smoke sources indoors.'],
    });
    const generateJson = vi.fn().mockResolvedValue(validJson);
    const ai: AiClient = { generateJson };
    const service = createIaqService({
      airService,
      ai,
      clock: () => '2026-11-25T06:00:00.000Z',
    });

    const uploadReq = makeRequest({
      upload: {
        fileName: 'episode.csv',
        points: [{ timeUtc: '2026-11-25T07:00:00.000Z', pm25: 300, pm10: 400 }],
      },
    });

    const res1 = await service.explainIaq(uploadReq);
    expect(getAirReport).not.toHaveBeenCalled();
    expect(res1.meta.origin).toBe('gemini');
    expect(res1.meta.attempts).toBe(1);

    const res2 = await service.explainIaq(uploadReq);
    expect(res2.meta.origin).toBe('cache');
    expect(res2.meta.attempts).toBe(0);
    expect(generateJson).toHaveBeenCalledTimes(1);
  });
});

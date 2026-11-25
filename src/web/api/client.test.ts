// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { getCities, getAir, postPlan, postIaqExplain, isApiError } from './client.js';
import type { AirReport, IaqExplainRequest, PlanRequest } from '../../shared/schemas.js';

const sampleReport: AirReport = {
  location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
  measured: null,
  naqi: null,
  forecast: null,
  warnings: [],
  fetchedAtUtc: '2026-11-24T12:00:00.000Z',
};

describe('api/client', () => {
  it('getCities validates and returns city list', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          cities: [
            { id: 'delhi', name: 'Delhi', state: 'Delhi', lat: 28.6139, lon: 77.209, ncr: true },
          ],
        }),
        { status: 200 },
      ),
    );

    const cities = await getCities(fetchFn);
    expect(cities).toHaveLength(1);
    expect(cities[0]?.id).toBe('delhi');
    expect(fetchFn).toHaveBeenCalledWith('/api/cities', undefined);
  });

  it('getAir requests by cityId and validates AirReport', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleReport), { status: 200 }),
    );

    const report = await getAir({ cityId: 'delhi' }, fetchFn);
    expect(report.location.label).toBe('Delhi');
    expect(fetchFn).toHaveBeenCalledWith('/api/air?cityId=delhi', undefined);
  });

  it('getAir requests by lat and lon', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleReport), { status: 200 }),
    );

    await getAir({ lat: 19.076, lon: 72.8777 }, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('/api/air?lat=19.076&lon=72.8777', undefined);
  });

  it('maps network errors without leaking raw error text', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:8080'));

    await expect(getCities(fetchFn)).rejects.toSatisfy((err: unknown) => {
      return isApiError(err) && err.kind === 'network' && !err.message.includes('ECONNREFUSED');
    });
  });

  it('maps 429 to rate-limited error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'secret upstream limit' } }), { status: 429 }),
    );

    await expect(getAir({ cityId: 'delhi' }, fetchFn)).rejects.toSatisfy((err: unknown) => {
      return isApiError(err) && err.kind === 'rate-limited' && !err.message.includes('secret');
    });
  });

  it('maps 422 and zod mismatches to validation error without raw server text', async () => {
    const fetch422 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'RAW_SERVER_DETAIL' } }), { status: 422 }),
    );
    await expect(getAir({ cityId: 'unknown' }, fetch422)).rejects.toSatisfy((err: unknown) => {
      return isApiError(err) && err.kind === 'validation' && !err.message.includes('RAW_SERVER_DETAIL');
    });

    const fetchBadShape = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ wrong: true }), { status: 200 }),
    );
    await expect(getAir({ cityId: 'delhi' }, fetchBadShape)).rejects.toSatisfy((err: unknown) => {
      return isApiError(err) && err.kind === 'validation';
    });
  });

  it('maps 500 to server error without raw server text', async () => {
    const fetch500 = vi.fn().mockResolvedValue(
      new Response('Stack trace: internal failure', { status: 500 }),
    );
    await expect(getCities(fetch500)).rejects.toSatisfy((err: unknown) => {
      return isApiError(err) && err.kind === 'server' && !err.message.includes('Stack trace');
    });
  });

  it('postPlan posts JSON and validates PlanResponse', async () => {
    const body: PlanRequest = {
      profile: {
        id: 'p1',
        title: 'Test Family',
        cityId: 'delhi',
        members: [{ id: 'm1', label: 'Aarav', ageGroup: 'child', sensitivities: ['asthma'] }],
        activities: [],
        commutes: [],
        home: {
          roomAreaM2: 20,
          ceilingHeightM: 3,
          windowState: 'closed',
          purifier: { present: false, cadrM3h: 0 },
          cookingFuel: 'lpg',
          kitchenExhaust: true,
          incense: false,
          mosquitoCoil: false,
          smokingIndoors: false,
          hoursIndoorsPerDay: 16,
          plantsCount: 0,
        },
        constraints: { budget: 'low', rented: false, mobilityLimited: false },
      },
      location: { cityId: 'delhi' },
      language: 'en',
    };

    const planPayload = {
      air: sampleReport,
      facts: [],
      candidates: { activities: [], commutes: [], indoor: [], community: [] },
      plan: {
        summary: 'Stay indoors during peak hours.',
        routine: [],
        indoor: [],
        community: [],
        caveats: [],
      },
      meta: {
        origin: 'fallback',
        attempts: 0,
        generatedAtUtc: '2026-11-24T12:00:00.000Z',
        warnings: [],
      },
    };

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(planPayload), { status: 200 }),
    );

    const res = await postPlan(body, fetchFn);
    expect(res.meta.origin).toBe('fallback');
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/plan',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('postIaqExplain posts JSON and validates IaqExplainResponse', async () => {
    const body: IaqExplainRequest = {
      profile: {
        id: 'p1',
        title: 'Test Family',
        cityId: 'delhi',
        members: [{ id: 'm1', label: 'Aarav', ageGroup: 'child', sensitivities: ['asthma'] }],
        activities: [],
        commutes: [],
        home: {
          roomAreaM2: 20,
          ceilingHeightM: 3,
          windowState: 'closed',
          purifier: { present: false, cadrM3h: 0 },
          cookingFuel: 'lpg',
          kitchenExhaust: true,
          incense: false,
          mosquitoCoil: false,
          smokingIndoors: false,
          hoursIndoorsPerDay: 16,
          plantsCount: 0,
        },
        constraints: { budget: 'low', rented: false, mobilityLimited: false },
      },
      location: { cityId: 'delhi' },
      home: {
        roomAreaM2: 20,
        ceilingHeightM: 3,
        windowState: 'closed',
        purifier: { present: false, cadrM3h: 0 },
        cookingFuel: 'lpg',
        kitchenExhaust: true,
        incense: false,
        mosquitoCoil: false,
        smokingIndoors: false,
        hoursIndoorsPerDay: 16,
        plantsCount: 0,
      },
      language: 'en',
    };

    const iaqPayload = {
      facts: [],
      scenarios: [],
      explanation: {
        summary: 'Close windows.',
        actions: [],
        caveats: [],
      },
      meta: {
        origin: 'fallback',
        attempts: 0,
        generatedAtUtc: '2026-11-25T12:00:00.000Z',
        warnings: [],
      },
    };

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(iaqPayload), { status: 200 }),
    );

    const res = await postIaqExplain(body, fetchFn);
    expect(res.meta.origin).toBe('fallback');
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/iaq/explain',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
});

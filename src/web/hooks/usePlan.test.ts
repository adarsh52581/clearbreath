// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';
import type { PlanResponse } from '../../shared/schemas.js';
import { ApiError } from '../lib/apiClient.js';
import { usePlan } from './usePlan.js';

const sampleProfile = HOUSEHOLD_PRESETS[0]!;
const sampleLocation = { cityId: 'delhi' };

function makePlanResponse(): PlanResponse {
  return {
    air: {
      location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
      measured: null,
      naqi: null,
      forecast: null,
      warnings: [],
      fetchedAtUtc: '2026-11-24T06:00:00.000Z',
    },
    facts: [
      {
        id: 'air_category_now',
        label: 'Current AQI category',
        value: 'very_poor',
        display: 'Very Poor',
        kind: 'computed',
        provenance: 'CPCB category classification',
      },
    ],
    candidates: { activities: [], commutes: [], indoor: [], community: [] },
    plan: {
      summary: 'Air quality now: {{air_category_now}}.',
      routine: [],
      indoor: [],
      community: [],
      caveats: ['Not medical advice.'],
    },
    meta: {
      origin: 'gemini',
      attempts: 1,
      generatedAtUtc: '2026-11-24T06:00:00.000Z',
      warnings: [],
    },
  };
}

describe('usePlan', () => {
  it('transitions from idle to loading to success', async () => {
    let resolveFn!: (value: PlanResponse) => void;
    const postPlanMock = vi.fn().mockImplementation(
      () =>
        new Promise<PlanResponse>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { result } = renderHook(() => usePlan({ postPlan: postPlanMock }));
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();

    let promise!: Promise<PlanResponse | null>;
    act(() => {
      promise = result.current.postPlan(sampleProfile, sampleLocation, undefined, 'en');
    });

    expect(result.current.status).toBe('loading');

    const expected = makePlanResponse();
    await act(async () => {
      resolveFn(expected);
      await promise;
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toEqual(expected);
    expect(result.current.error).toBeNull();
  });

  it('maps 429 rate-limited error to the exact retry message', async () => {
    const postPlanMock = vi
      .fn()
      .mockRejectedValue(new ApiError('rate-limited', 'Server rate limited'));

    const { result } = renderHook(() => usePlan({ postPlan: postPlanMock }));

    await act(async () => {
      await result.current.postPlan(sampleProfile, sampleLocation, undefined, 'en');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Too many requests — please try again in a minute.');
  });

  it('ignores double submits while a request is in flight', async () => {
    let resolveFn!: (value: PlanResponse) => void;
    const postPlanMock = vi.fn().mockImplementation(
      () =>
        new Promise<PlanResponse>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { result } = renderHook(() => usePlan({ postPlan: postPlanMock }));

    let p1!: Promise<PlanResponse | null>;
    let p2!: Promise<PlanResponse | null>;
    act(() => {
      p1 = result.current.postPlan(sampleProfile, sampleLocation, undefined, 'en');
      p2 = result.current.postPlan(sampleProfile, sampleLocation, undefined, 'en');
    });

    expect(postPlanMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFn(makePlanResponse());
      await Promise.all([p1, p2]);
    });

    expect(result.current.status).toBe('success');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAir, clearAirCache } from './useAir.js';
import { ApiError } from '../lib/apiClient.js';
import type { AirReport } from '../../shared/schemas.js';

function makeReport(label: string): AirReport {
  return {
    location: { label, lat: 28.6139, lon: 77.209, cityId: label.toLowerCase() },
    measured: null,
    naqi: null,
    forecast: null,
    warnings: [],
    fetchedAtUtc: '2026-11-24T12:00:00.000Z',
  };
}

describe('useAir', () => {
  beforeEach(() => {
    clearAirCache();
  });

  it('returns idle when location is null', () => {
    const fetchAir = vi.fn();
    const { result } = renderHook(() => useAir(null, { fetchAir }));
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(fetchAir).not.toHaveBeenCalled();
  });

  it('loads data and caches it for 5 minutes', async () => {
    let now = 1_000_000;
    const fetchAir = vi.fn().mockResolvedValue(makeReport('Delhi'));

    const { result, rerender } = renderHook(
      ({ loc }) => useAir(loc, { fetchAir, clock: () => now }),
      { initialProps: { loc: { cityId: 'delhi' } } },
    );

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.location.label).toBe('Delhi');
    expect(fetchAir).toHaveBeenCalledTimes(1);

    // Within 5 min: served from cache
    now += 4 * 60 * 1000;
    rerender({ loc: { cityId: 'delhi' } });
    expect(fetchAir).toHaveBeenCalledTimes(1);

    // Refresh bypasses cache
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(fetchAir).toHaveBeenCalledTimes(2));
  });

  it('re-fetches after 5-minute TTL expires', async () => {
    let now = 1_000_000;
    const fetchAir = vi.fn().mockResolvedValue(makeReport('Delhi'));

    const { result, rerender } = renderHook(
      ({ loc }) => useAir(loc, { fetchAir, clock: () => now }),
      { initialProps: { loc: { cityId: 'delhi' } } },
    );
    await waitFor(() => expect(result.current.status).toBe('success'));

    now += 6 * 60 * 1000;
    rerender({ loc: { cityId: 'mumbai' } });
    await waitFor(() => expect(result.current.status).toBe('success'));

    rerender({ loc: { cityId: 'delhi' } });
    await waitFor(() => expect(fetchAir).toHaveBeenCalledTimes(3));
  });

  it('sets error state on failure', async () => {
    const fetchAir = vi.fn().mockRejectedValue(new ApiError('network', 'Network error'));
    const { result } = renderHook(() => useAir({ cityId: 'delhi' }, { fetchAir }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toEqual({ kind: 'network', message: 'Network error' });
  });
});

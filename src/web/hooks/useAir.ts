import { useCallback, useEffect, useRef, useState } from 'react';
import type { AirReport, LocationRef } from '../../shared/schemas.js';
import { getAir, isApiError, type ApiErrorPayload } from '../api/client.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  readonly data: AirReport;
  readonly cachedAtMs: number;
}

const airCache = new Map<string, CacheEntry>();

export function clearAirCache(): void {
  airCache.clear();
}

function getLocationKey(location: LocationRef): string {
  if ('cityId' in location) {
    return `city:${location.cityId}`;
  }
  return `coords:${location.lat.toFixed(4)},${location.lon.toFixed(4)}`;
}

export type UseAirStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAirResult {
  readonly status: UseAirStatus;
  readonly data: AirReport | null;
  readonly error: ApiErrorPayload | null;
  readonly refresh: () => void;
}

export interface UseAirDeps {
  readonly fetchAir?: (location: LocationRef) => Promise<AirReport>;
  readonly clock?: () => number;
}

function toApiErrorPayload(err: unknown): ApiErrorPayload {
  if (isApiError(err)) {
    return { kind: err.kind, message: err.message };
  }
  return {
    kind: 'server',
    message: 'Unable to load air quality data right now. Please try again.',
  };
}

export function useAir(location: LocationRef | null, deps?: UseAirDeps): UseAirResult {
  const fetchAir = deps?.fetchAir ?? getAir;
  const clock = deps?.clock ?? Date.now;

  const fetchAirRef = useRef(fetchAir);
  fetchAirRef.current = fetchAir;
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const locationRef = useRef(location);
  locationRef.current = location;

  const [status, setStatus] = useState<UseAirStatus>(location ? 'loading' : 'idle');
  const [data, setData] = useState<AirReport | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const forceRefreshRef = useRef(false);
  const requestIdRef = useRef(0);

  const locationKey = location ? getLocationKey(location) : null;

  useEffect(() => {
    const currentLoc = locationRef.current;
    if (!currentLoc || !locationKey) {
      setStatus('idle');
      setData(null);
      setError(null);
      return;
    }

    const bypassCache = forceRefreshRef.current;
    forceRefreshRef.current = false;

    if (!bypassCache) {
      const cached = airCache.get(locationKey);
      if (cached && clockRef.current() - cached.cachedAtMs < CACHE_TTL_MS) {
        setData(cached.data);
        setError(null);
        setStatus('success');
        return;
      }
    }

    const currentRequestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);

    let cancelled = false;

    fetchAirRef
      .current(currentLoc)
      .then((report) => {
        if (cancelled || currentRequestId !== requestIdRef.current) return;
        airCache.set(locationKey, { data: report, cachedAtMs: clockRef.current() });
        setData(report);
        setError(null);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (cancelled || currentRequestId !== requestIdRef.current) return;
        setData(null);
        setError(toApiErrorPayload(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [locationKey, reloadToken]);

  const refresh = useCallback(() => {
    forceRefreshRef.current = true;
    setReloadToken((prev) => prev + 1);
  }, []);

  return { status, data, error, refresh };
}

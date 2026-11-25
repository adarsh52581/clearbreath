import { useCallback, useRef, useState } from 'react';
import type {
  HouseholdProfile,
  Language,
  LocationRef,
  PlanRequest,
  PlanResponse,
  UploadedSeries,
} from '../../shared/schemas.js';
import { isApiError, postPlan as apiPostPlan } from '../lib/apiClient.js';

export type UsePlanStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UsePlanDeps {
  readonly postPlan?: (body: PlanRequest) => Promise<PlanResponse>;
}

export interface UsePlanResult {
  readonly status: UsePlanStatus;
  readonly data: PlanResponse | null;
  readonly error: string | null;
  readonly postPlan: (
    profile: HouseholdProfile,
    location: LocationRef,
    upload: UploadedSeries | undefined,
    language: Language,
  ) => Promise<PlanResponse | null>;
  readonly reset: () => void;
}

const RATE_LIMIT_MESSAGE = 'Too many requests — please try again in a minute.';

function mapPlanError(err: unknown): string {
  if (isApiError(err)) {
    if (err.kind === 'rate-limited') {
      return RATE_LIMIT_MESSAGE;
    }
    return err.message;
  }
  return 'Unable to build plan right now. Please try again.';
}

export function usePlan(deps?: UsePlanDeps): UsePlanResult {
  const fetchPlan = deps?.postPlan ?? apiPostPlan;
  const fetchPlanRef = useRef(fetchPlan);
  fetchPlanRef.current = fetchPlan;

  const [status, setStatus] = useState<UsePlanStatus>('idle');
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const postPlan = useCallback(
    async (
      profile: HouseholdProfile,
      location: LocationRef,
      upload: UploadedSeries | undefined,
      language: Language,
    ): Promise<PlanResponse | null> => {
      if (inFlightRef.current) {
        return null;
      }

      inFlightRef.current = true;
      setStatus('loading');
      setError(null);

      const body: PlanRequest = upload
        ? { profile, location, upload, language }
        : { profile, location, language };

      try {
        const result = await fetchPlanRef.current(body);
        setData(result);
        setError(null);
        setStatus('success');
        return result;
      } catch (err: unknown) {
        setError(mapPlanError(err));
        setStatus('error');
        return null;
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    inFlightRef.current = false;
    setStatus('idle');
    setData(null);
    setError(null);
  }, []);

  return { status, data, error, postPlan, reset };
}

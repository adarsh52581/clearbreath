import { z } from 'zod';
import {
  airReportSchema,
  citySchema,
  iaqExplainResponseSchema,
  planResponseSchema,
  type AirReport,
  type City,
  type IaqExplainRequest,
  type IaqExplainResponse,
  type LocationRef,
  type PlanRequest,
  type PlanResponse,
} from '../../shared/schemas.js';
import { aiIndoorExplanationSchema, aiPlanSchema } from '../../shared/aiSchemas.js';

export type ApiErrorKind = 'network' | 'rate-limited' | 'validation' | 'server';

export interface ApiErrorPayload {
  readonly kind: ApiErrorKind;
  readonly message: string;
}

export class ApiError extends Error implements ApiErrorPayload {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

const citiesResponseSchema = z.object({
  cities: z.array(citySchema),
});

const strictPlanResponseSchema = planResponseSchema.extend({
  plan: aiPlanSchema,
});

const strictIaqExplainResponseSchema = iaqExplainResponseSchema.extend({
  explanation: aiIndoorExplanationSchema,
});

function mapStatusToError(status: number): ApiError {
  if (status === 429) {
    return new ApiError('rate-limited', 'Too many requests. Please wait a moment and try again.');
  }
  if (status === 400 || status === 422 || status === 413 || status === 415) {
    return new ApiError('validation', 'The request could not be processed. Please check your input.');
  }
  return new ApiError('server', 'Unable to reach air quality services right now. Please try again.');
}

async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  schema: z.ZodType<T>,
  fetchFn: typeof fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchFn(url, init);
  } catch {
    throw new ApiError('network', 'Network error. Please check your connection and try again.');
  }

  if (!response.ok) {
    throw mapStatusToError(response.status);
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new ApiError('validation', 'Received an unreadable response from the server.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError('validation', 'Received unexpected data format from the server.');
  }

  return parsed.data;
}

export async function getCities(fetchFn: typeof fetch = fetch): Promise<City[]> {
  const data = await requestJson('/api/cities', undefined, citiesResponseSchema, fetchFn);
  return data.cities;
}

export async function getAir(
  location: LocationRef,
  fetchFn: typeof fetch = fetch,
): Promise<AirReport> {
  const params =
    'cityId' in location
      ? new URLSearchParams({ cityId: location.cityId })
      : new URLSearchParams({ lat: String(location.lat), lon: String(location.lon) });

  return requestJson(`/api/air?${params.toString()}`, undefined, airReportSchema, fetchFn);
}

export async function postPlan(
  body: PlanRequest,
  fetchFn: typeof fetch = fetch,
): Promise<PlanResponse> {
  return requestJson(
    '/api/plan',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    strictPlanResponseSchema,
    fetchFn,
  );
}

export async function postIaqExplain(
  body: IaqExplainRequest,
  fetchFn: typeof fetch = fetch,
): Promise<IaqExplainResponse> {
  return requestJson(
    '/api/iaq/explain',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    strictIaqExplainResponseSchema,
    fetchFn,
  );
}

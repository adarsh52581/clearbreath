import { AppError } from '../errors.js';

type FetchFn = typeof fetch;

export interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
  fetchFn?: FetchFn;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    const params = new URLSearchParams();
    for (const [k] of u.searchParams) {
      params.set(k, '[REDACTED]');
    }
    u.search = params.toString();
    return u.toString();
  } catch {
    return '[URL_REDACTED]';
  }
}

/** Returns an AppError for 4xx/429, or null if status is retryable (5xx). */
function mapHttpStatus(status: number): AppError | null {
  if (status === 429) {
    return new AppError('RATE_LIMITED', 429, 'Upstream rate limit reached');
  }
  if (status >= 400 && status < 500) {
    return new AppError('UPSTREAM_UNAVAILABLE', 502, `Upstream responded with ${status}`);
  }
  return null;
}

/** Converts a caught non-AppError into an AppError for the retry loop. */
function toAppError(err: unknown, timeoutMs: number, url: string): AppError {
  if (err instanceof AppError) throw err; // propagate immediately
  if (err instanceof Error && err.name === 'AbortError') {
    return new AppError(
      'UPSTREAM_UNAVAILABLE',
      502,
      `Upstream timed out after ${timeoutMs}ms at ${redactUrl(url)}`,
    );
  }
  return new AppError('UPSTREAM_UNAVAILABLE', 502, 'Upstream unreachable');
}

/**
 * Fetches JSON from a URL with timeout, one retry on timeout/5xx, and
 * structured error codes. Never logs headers or key-bearing URLs.
 *
 * - 429 → AppError RATE_LIMITED (no retry)
 * - 4xx → AppError UPSTREAM_UNAVAILABLE (no retry)
 * - 5xx / timeout / network error → retry once after 500 ms → UPSTREAM_UNAVAILABLE
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  options: FetchJsonOptions = {},
): Promise<T> {
  const { timeoutMs = 8000, retries = 1, fetchFn = fetch } = options;
  let lastError: AppError = new AppError('UPSTREAM_UNAVAILABLE', 502, 'Upstream unavailable');

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500);

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, { ...init, signal: controller.signal });
      clearTimeout(timerId);

      const appErr = mapHttpStatus(response.status);
      if (appErr) throw appErr; // 4xx / 429 — no retry (thrown, caught below, rethrown)

      if (!response.ok) {
        // 5xx — record error and loop for retry
        lastError = new AppError('UPSTREAM_UNAVAILABLE', 502, `Upstream responded with ${response.status}`);
        continue;
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timerId);
      if (err instanceof AppError) throw err; // structured errors (4xx/429) — no retry
      lastError = toAppError(err, timeoutMs, url);
    }
  }

  throw lastError;
}

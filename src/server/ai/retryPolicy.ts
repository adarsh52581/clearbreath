import { AppError } from '../errors.js';

/**
 * Provider failures (bad key, quota, outage, timeout) cannot be fixed by a corrective retry,
 * so they go straight to last-good / fallback instead of spending a second model call.
 */
export function isProviderFailure(err: unknown): boolean {
  return (
    err instanceof AppError && (err.code === 'RATE_LIMITED' || err.code === 'UPSTREAM_UNAVAILABLE')
  );
}

/** Shortens error text before it is logged. */
export function clipErrors(errors: readonly string[], max = 300): string[] {
  return errors.map((e) => (e.length > max ? `${e.slice(0, max)}…` : e));
}

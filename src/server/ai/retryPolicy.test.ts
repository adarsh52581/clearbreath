import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import { clipErrors, isProviderFailure } from './retryPolicy.js';

describe('isProviderFailure', () => {
  it('is true for rate limits and upstream outages', () => {
    expect(isProviderFailure(new AppError('RATE_LIMITED', 429, 'quota'))).toBe(true);
    expect(isProviderFailure(new AppError('UPSTREAM_UNAVAILABLE', 502, 'down'))).toBe(true);
  });

  it('is false for other errors', () => {
    expect(isProviderFailure(new AppError('VALIDATION', 400, 'bad'))).toBe(false);
    expect(isProviderFailure(new Error('Timeout 504'))).toBe(false);
    expect(isProviderFailure('nope')).toBe(false);
  });
});

describe('clipErrors', () => {
  it('shortens long messages and keeps short ones', () => {
    expect(clipErrors(['short'])).toEqual(['short']);
    const clipped = clipErrors(['x'.repeat(400)], 10);
    expect(clipped[0]).toBe(`${'x'.repeat(10)}…`);
  });
});

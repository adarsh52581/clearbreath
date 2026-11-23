import { describe, it, expect, vi } from 'vitest';
import { fetchJson } from './http.js';
import { AppError } from '../errors.js';

function fakeResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('fetchJson', () => {
  it('returns parsed JSON on success', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(fakeResponse(200, { ok: true }));
    const result = await fetchJson<{ ok: boolean }>('https://example.com', {}, { fetchFn });
    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('429 → RATE_LIMITED, no retry', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(429));
    await expect(fetchJson('https://example.com', {}, { fetchFn })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('404 → UPSTREAM_UNAVAILABLE, no retry', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(404));
    await expect(fetchJson('https://example.com', {}, { fetchFn })).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('500 → retries once → UPSTREAM_UNAVAILABLE', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(500));
    await expect(
      fetchJson('https://example.com', {}, { fetchFn, retries: 1 }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('timeout → retries once → UPSTREAM_UNAVAILABLE', async () => {
    const fetchFn = vi.fn().mockImplementation(() => {
      const err = new DOMException('Aborted', 'AbortError');
      return Promise.reject(err);
    });
    await expect(
      fetchJson('https://example.com', {}, { fetchFn, timeoutMs: 1, retries: 1 }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('succeeds on second attempt after 500', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(500))
      .mockResolvedValueOnce(fakeResponse(200, { data: 'ok' }));
    const result = await fetchJson<{ data: string }>('https://example.com', {}, { fetchFn, retries: 1 });
    expect(result).toEqual({ data: 'ok' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws AppError, not raw error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(503));
    const err = await fetchJson('https://example.com', {}, { fetchFn }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
  });
});

import { LRUCache } from 'lru-cache';

// Max TTL for failed loads (60 s per ARCHITECTURE §7)
const FAILURE_TTL_MS = 60_000;

interface OkEntry<T> {
  kind: 'ok';
  value: T;
}

interface ErrEntry {
  kind: 'err';
  err: unknown;
}

type Entry<T> = OkEntry<T> | ErrEntry;

/**
 * Typed wrapper over lru-cache with TTL and getOrSet.
 * Failures are cached for at most 60 s regardless of the requested TTL.
 */
export class TypedCache<T> {
  private inner: LRUCache<string, Entry<T>>;

  constructor(maxItems: number) {
    // allowStale:false (default) — expired entries are treated as missing
    this.inner = new LRUCache<string, Entry<T>>({ max: maxItems, ttlAutopurge: false });
  }

  get(key: string): T | undefined {
    const entry = this.inner.get(key);
    if (!entry || entry.kind === 'err') return undefined;
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.inner.set(key, { kind: 'ok', value }, { ttl: ttlMs });
  }

  /**
   * Returns the cached value if present; otherwise runs loader,
   * caches the result for ttlMs, and returns it.
   * On loader failure, caches the error for ≤ 60 s and rethrows.
   */
  async getOrSet(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const entry = this.inner.get(key);
    if (entry) {
      if (entry.kind === 'err') throw entry.err;
      return entry.value;
    }

    try {
      const value = await loader();
      this.inner.set(key, { kind: 'ok', value }, { ttl: ttlMs });
      return value;
    } catch (err) {
      const failTtl = Math.min(ttlMs, FAILURE_TTL_MS);
      this.inner.set(key, { kind: 'err', err }, { ttl: failTtl });
      throw err;
    }
  }
}

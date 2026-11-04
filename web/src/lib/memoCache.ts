import "server-only";

// Tiny in-process cache for expensive, public (not user-specific) server
// computations -- this app runs as one long-lived `next start` process
// (see package.json's start script), not serverless functions, so a plain
// in-memory Map persists across requests and needs no external store.
//
// Single-flights concurrent misses: if many requests hit the same key
// while it's being computed, they all await the SAME in-flight promise
// instead of each firing their own copy of the underlying (DB-heavy)
// query. That's the actual fix for "100/1000 people load this at once" --
// without it, a cache keyed purely by expiry would still let every
// concurrent request during a miss run the full query itself.
interface Entry<T> {
  promise: Promise<T>;
  expiresAt: number;
}

const cache = new Map<string, Entry<unknown>>();

export function cachedAsync<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as Entry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  // Never cache a rejected promise -- a failed compute should let the
  // very next request retry, not serve (or pile up behind) the same
  // rejection until the TTL expires.
  const promise = compute().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

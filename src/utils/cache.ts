/**
 * Lightweight in-process TTL cache.
 * Single Node process on Railway means this Map is shared across all requests.
 * Use for read-heavy endpoints whose data changes slowly (matches, analytics, catalogues).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();

// Remove stale entries every 10 minutes to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 10 * 60 * 1000);

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheDelete(pattern: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(pattern)) store.delete(key);
  }
}

/** TTL presets in seconds. */
export const TTL = {
  SHORT:  5  * 60,  // 5 min  — personalised data (matches, feed)
  MEDIUM: 15 * 60,  // 15 min — semi-static (events, places, catalogue)
  LONG:   60 * 60,  // 1 hr   — rarely changes (analytics aggregates)
} as const;

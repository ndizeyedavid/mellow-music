/**
 * Tiny localStorage cache used as the offline/backend-down fallback
 * for discovery data (home + search). Mirrors the backend's cache-first
 * philosophy on the client side.
 */

const PREFIX = "mellow-cache:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  at: number;
  value: T;
}

export function cacheGet<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.at > ttlMs) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ at: Date.now(), value } satisfies CacheEntry<T>),
    );
  } catch {
    // Storage full/unavailable — cache is best-effort.
  }
}

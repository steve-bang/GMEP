import type { JwksSource } from '@/platform/auth/cronAuth';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const RETRY_AFTER_FAILURE_MS = 30_000;
const MISS_REFRESH_MS = 60_000;

/**
 * Google's public signing keys, cached in memory. Refreshes when the cache is older than `ttlMs`, and once more when an
 * unknown kid shows up (key rotation), at most once a minute. A failed fetch is not retried for 30 s (no 5 s stall on
 * every request) and the keys already held keep being served.
 */
export function googleJwksSource(
  fetchImpl: typeof fetch = fetch,
  ttlMs = 3_600_000,
  url = GOOGLE_CERTS_URL,
  now: () => number = Date.now,
): JwksSource {
  let keys = new Map<string, JsonWebKey>();
  let loadedAt = Number.NEGATIVE_INFINITY;
  let lastAttempt = Number.NEGATIVE_INFINITY;
  let lastFailure = Number.NEGATIVE_INFINITY;
  let inflight: Promise<void> | null = null;
  const fetchKeys = async () => {
    lastAttempt = now();
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`jwks ${res.status}`);
      const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
      keys = new Map((body.keys ?? []).flatMap((k) => (k.kid ? [[k.kid, k] as const] : [])));
      loadedAt = now();
    } catch (e) {
      lastFailure = now();
      throw e;
    }
  };
  // one fetch at a time: concurrent callers share it
  const load = () => (inflight ??= fetchKeys().finally(() => (inflight = null)));
  // a failed refresh must not reject tokens signed by keys we already hold
  const tryLoad = async () => {
    if (now() - lastFailure < RETRY_AFTER_FAILURE_MS) {
      if (keys.size === 0) throw new Error('jwks unavailable');
      return;
    }
    try {
      await load();
    } catch (e) {
      if (keys.size === 0) throw e;
    }
  };
  return {
    async getKey(kid) {
      const callStart = now();
      if (callStart - loadedAt > ttlMs) await tryLoad();
      const hit = keys.get(kid);
      if (hit) return hit;
      // unknown kid: no second fetch when this very call just loaded; otherwise at most once a minute
      const justLoaded = lastAttempt >= callStart;
      if (!justLoaded && now() - lastAttempt > MISS_REFRESH_MS) await tryLoad();
      return keys.get(kid) ?? null;
    },
  };
}

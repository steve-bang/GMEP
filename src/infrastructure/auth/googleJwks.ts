import type { JwksSource } from '@/platform/auth/cronAuth';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/** Google's public signing keys, cached in memory; one refresh when an unknown kid shows up (key rotation). */
export function googleJwksSource(
  fetchImpl: typeof fetch = fetch,
  ttlMs = 3_600_000,
  url = GOOGLE_CERTS_URL,
): JwksSource {
  let keys = new Map<string, JsonWebKey>();
  let loadedAt = 0;
  let lastMissRefresh = 0;
  const load = async () => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`jwks ${res.status}`);
    const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
    keys = new Map((body.keys ?? []).flatMap((k) => (k.kid ? [[k.kid, k] as const] : [])));
    loadedAt = Date.now();
  };
  return {
    async getKey(kid) {
      if (Date.now() - loadedAt > ttlMs) await load();
      const hit = keys.get(kid);
      if (hit) return hit;
      // unknown kid: refresh at most once a minute so a forged kid cannot make us hammer Google
      if (Date.now() - lastMissRefresh > 60_000) {
        lastMissRefresh = Date.now();
        await load();
      }
      return keys.get(kid) ?? null;
    },
  };
}

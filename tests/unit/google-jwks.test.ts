import { describe, expect, it } from 'vitest';
import { googleJwksSource } from '@/infrastructure/auth/googleJwks';

const jwk = { kty: 'RSA', kid: 'k1', n: 'x', e: 'AQAB' };

function fetcher(plan: (call: number) => Response | Error) {
  let calls = 0;
  const f = (async () => {
    const r = plan(++calls);
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { f, calls: () => calls };
}
const ok = () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });

describe('googleJwksSource', () => {
  it('serves the cached keys when the refresh after the TTL fails', async () => {
    const { f } = fetcher((n) => (n === 1 ? ok() : new Error('network down')));
    const src = googleJwksSource(f, 0); // ttl 0: every call tries to refresh
    expect((await src.getKey('k1'))?.n).toBe('x');
    expect((await src.getKey('k1'))?.n).toBe('x'); // refresh fails, cached key still answers
  });

  it('fails when there is nothing cached and the fetch fails', async () => {
    const { f } = fetcher(() => new Error('network down'));
    await expect(googleJwksSource(f).getKey('k1')).rejects.toThrow();
  });

  it('concurrent callers share one fetch', async () => {
    const { f, calls } = fetcher(() => ok());
    const src = googleJwksSource(f);
    await Promise.all([src.getKey('k1'), src.getKey('k1'), src.getKey('k1')]);
    expect(calls()).toBe(1);
  });
});

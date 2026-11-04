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

  it('backs off for 30 s after a failed refresh (no fetch per request) and still serves cached keys', async () => {
    let t = 1_000_000;
    const { f, calls } = fetcher((n) => (n === 1 ? ok() : new Error('network down')));
    const src = googleJwksSource(f, 1000, 'https://x.test', () => t);
    await src.getKey('k1'); // call 1 loads
    t += 5000; // TTL passed: refresh fails (call 2)
    expect((await src.getKey('k1'))?.n).toBe('x');
    expect(calls()).toBe(2);
    t += 10_000; // within the back-off: no new fetch
    await src.getKey('k1');
    await src.getKey('k1');
    expect(calls()).toBe(2);
    t += 25_000; // back-off over: one more attempt
    await src.getKey('k1');
    expect(calls()).toBe(3);
  });

  it('with nothing cached, a failure is not retried for 30 s either', async () => {
    let t = 1_000_000;
    const { f, calls } = fetcher(() => new Error('down'));
    const src = googleJwksSource(f, 1000, 'https://x.test', () => t);
    await expect(src.getKey('k1')).rejects.toThrow();
    await expect(src.getKey('k1')).rejects.toThrow();
    expect(calls()).toBe(1);
    t += 31_000;
    await expect(src.getKey('k1')).rejects.toThrow();
    expect(calls()).toBe(2);
  });

  it('an unknown kid right after the TTL refresh costs ONE fetch; a later unknown kid refreshes at most once a minute', async () => {
    let t = 1_000_000;
    const { f, calls } = fetcher(() => ok());
    const src = googleJwksSource(f, 1000, 'https://x.test', () => t);
    expect(await src.getKey('other')).toBeNull();
    expect(calls()).toBe(1);
    t += 2000; // TTL expired and the kid is unknown: still a single fetch
    expect(await src.getKey('other')).toBeNull();
    expect(calls()).toBe(2);
    t += 500; // forged kids cannot make us hammer Google
    await src.getKey('other2');
    expect(calls()).toBe(2);
    t += 61_000;
    await src.getKey('other3'); // TTL expired -> refresh, no second one for the miss
    expect(calls()).toBe(3);
  });
});

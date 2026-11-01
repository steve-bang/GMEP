import { describe, expect, it } from 'vitest';
import {
  DocAtomicStateStore,
  LoginThrottle,
  RateLimiter,
  DEFAULT_LOCKOUT,
  retryAfterOf,
} from '@/platform/ratelimit/ratelimit';
import { fixedClock } from '@/platform/time/clock';
import { MemoryDb, MemoryDocStore, MemoryUnitOfWork } from '@/infrastructure/store/memoryDocStore';

function setup() {
  const db = new MemoryDb();
  const clock = fixedClock('2026-11-03T08:00:00Z');
  const state = new DocAtomicStateStore(new MemoryDocStore(db), new MemoryUnitOfWork(db));
  return {
    clock,
    throttle: new LoginThrottle(state, () => clock.now()),
    limiter: new RateLimiter(state, () => clock.now()),
  };
}
const subject = (over: Partial<{ deviceId: string; name: string; address: string }> = {}) => ({
  deviceId: 'dev-1',
  name: 'a@b.test',
  address: '10.0.0.1',
  ...over,
});
const advance = (c: ReturnType<typeof fixedClock>, ms: number) =>
  c.set(new Date(c.now().getTime() + ms).toISOString());

describe('ba-answers §1.4 login lockout (three counters)', () => {
  it('A: 5 failures on a device+name lock 15 minutes; the second lock within 60 minutes locks 60 minutes', async () => {
    const { clock, throttle } = setup();
    for (let i = 0; i < DEFAULT_LOCKOUT.device.maxFailures; i++) {
      await throttle.assertAllowed(subject());
      await throttle.recordFailure(subject());
      advance(clock, 3_000); // slow-down of counter B/C does not apply below their thresholds
    }
    await expect(throttle.assertAllowed(subject())).rejects.toMatchObject({ code: 'login_locked' });
    advance(clock, 15 * 60_000 + 1000);
    await throttle.assertAllowed(subject()); // lock expired
    for (let i = 0; i < DEFAULT_LOCKOUT.device.maxFailures; i++)
      await throttle.recordFailure(subject());
    const err = await throttle.assertAllowed(subject()).catch((e) => e);
    expect(retryAfterOf(err)).toBeGreaterThan(15 * 60);
    expect(retryAfterOf(err)).toBeLessThanOrEqual(60 * 60);
  });
  it('a lock on one device does not lock the same name on another device (no remote lock-out of colleagues)', async () => {
    const { clock, throttle } = setup();
    for (let i = 0; i < 5; i++) await throttle.recordFailure(subject());
    await expect(throttle.assertAllowed(subject())).rejects.toBeDefined();
    advance(clock, 60_000);
    await expect(throttle.assertAllowed(subject({ deviceId: 'dev-2' }))).resolves.toBeUndefined();
  });
  it('B: ten failures for one name across devices slow further attempts progressively but never hard-lock', async () => {
    const { clock, throttle } = setup();
    for (let i = 0; i < 10; i++) await throttle.recordFailure(subject({ deviceId: `d${i}` }));
    const err = await throttle.assertAllowed(subject({ deviceId: 'fresh' })).catch((e) => e);
    expect(err).toMatchObject({ code: 'login_locked' });
    expect(retryAfterOf(err)).toBeLessThanOrEqual(DEFAULT_LOCKOUT.name.maxDelayMs / 1000);
    advance(clock, DEFAULT_LOCKOUT.name.maxDelayMs + 1000);
    await expect(throttle.assertAllowed(subject({ deviceId: 'fresh' }))).resolves.toBeUndefined();
  });
  it('unknown names are throttled exactly like known ones; success resets counter A; unlock clears an earlier lock', async () => {
    const { clock, throttle } = setup();
    for (let i = 0; i < 5; i++) await throttle.recordFailure(subject({ name: 'nobody@x.test' }));
    await expect(throttle.assertAllowed(subject({ name: 'nobody@x.test' }))).rejects.toMatchObject({
      code: 'login_locked',
    });
    await throttle.recordFailure(subject({ name: 'ok@x.test' }));
    await throttle.recordSuccess(subject({ name: 'ok@x.test' }));
    await throttle.assertAllowed(subject({ name: 'ok@x.test' }));
    advance(clock, 1000);
    await throttle.unlockName('nobody@x.test');
    await expect(
      throttle.assertAllowed(subject({ name: 'nobody@x.test' })),
    ).resolves.toBeUndefined();
  });
  it('raw names and addresses are never stored (only hashes)', async () => {
    const db = new MemoryDb();
    const clock = fixedClock('2026-11-03T08:00:00Z');
    const t = new LoginThrottle(
      new DocAtomicStateStore(new MemoryDocStore(db), new MemoryUnitOfWork(db)),
      () => clock.now(),
    );
    await t.recordFailure(subject({ name: 'secret.person@x.test', address: '203.0.113.9' }));
    const dump = JSON.stringify([...db.col('rateLimits').entries()]);
    expect(dump).not.toContain('secret.person');
    expect(dump).not.toContain('203.0.113.9');
  });
});

describe('rate limiter (search / forgot / customer links)', () => {
  it('allows up to the limit per window then answers 429 with Retry-After, and recovers in the next window', async () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 3; i++) await limiter.hit('forgot-name', 'a@b.test');
    const err = await limiter.hit('forgot-name', 'a@b.test').catch((e) => e);
    expect(err).toMatchObject({ code: 'rate_limited', status: 429 });
    expect(retryAfterOf(err)).toBeGreaterThan(0);
    await limiter.hit('forgot-name', 'other@b.test'); // separate subject
    advance(clock, 15 * 60_000 + 1000);
    await expect(limiter.hit('forgot-name', 'a@b.test')).resolves.toBeUndefined();
  });
  it('the counter is shared state: a second limiter instance over the same store sees the same count', async () => {
    const db = new MemoryDb();
    const clock = fixedClock('2026-11-03T08:00:00Z');
    const mk = () =>
      new RateLimiter(
        new DocAtomicStateStore(new MemoryDocStore(db), new MemoryUnitOfWork(db)),
        () => clock.now(),
      );
    const a = mk();
    const b = mk();
    for (let i = 0; i < 3; i++) await a.hit('forgot-name', 'x');
    await expect(b.hit('forgot-name', 'x')).rejects.toMatchObject({ status: 429 });
  });
});

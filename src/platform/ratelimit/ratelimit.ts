import { createHash } from 'node:crypto';
import { AppError } from '../errors/errors';
import type { UnitOfWork } from '../tx/unitOfWork';
import type { DocStore } from '../store/docStore';

/**
 * Shared-state counters for rate limiting and lockout (ADR §6.3). State lives in Firestore
 * (collection `rateLimits`, TTL on `expiresAt`) so it is shared across Cloud Run instances;
 * the in-memory adapter of DocStore is used in tests. Keys are hashes: raw login names and
 * network addresses (personal data) are never stored.
 */
export const RATE_LIMIT_COLLECTION = 'rateLimits';

export const hashKey = (...parts: string[]): string =>
  createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 40);

export interface AtomicStateStore {
  /**
   * Atomic read-modify-write of one state document. `fn` returns the next state and how long the
   * record may live; returning null deletes it. The final state is returned.
   */
  update<T extends Record<string, unknown>>(
    key: string,
    now: Date,
    fn: (current: T | null) => { next: T; ttlMs: number } | null,
  ): Promise<T | null>;
  read<T extends Record<string, unknown>>(key: string, now: Date): Promise<T | null>;
}

export class DocAtomicStateStore implements AtomicStateStore {
  constructor(
    private readonly store: DocStore,
    private readonly uow: UnitOfWork,
  ) {}

  async read<T extends Record<string, unknown>>(key: string, now: Date): Promise<T | null> {
    const d = await this.store.get(RATE_LIMIT_COLLECTION, key);
    if (!d || (d.data.expiresAt as Date) <= now) return null;
    return d.data.state as T;
  }

  update<T extends Record<string, unknown>>(
    key: string,
    now: Date,
    fn: (current: T | null) => { next: T; ttlMs: number } | null,
  ): Promise<T | null> {
    return this.uow.run(async (tx) => {
      const d = await this.store.getInTx(tx, RATE_LIMIT_COLLECTION, key);
      const live = d && (d.data.expiresAt as Date) > now ? (d.data.state as T) : null;
      const out = fn(live);
      if (!out) {
        if (d) this.store.delete(tx, RATE_LIMIT_COLLECTION, key);
        return null;
      }
      this.store.set(tx, RATE_LIMIT_COLLECTION, key, {
        state: out.next,
        expiresAt: new Date(now.getTime() + out.ttlMs),
      });
      return out.next;
    });
  }
}

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

/**
 * Named policies, configuration not business rules. Numbers are technical starting values
 * [Cần xác nhận: Chủ dự án] to be measured at staging (BA §1.4 counter C).
 */
export const DEFAULT_RATE_LIMITS = {
  'forgot-ip': { limit: 10, windowMs: 15 * 60_000 },
  'forgot-name': { limit: 3, windowMs: 15 * 60_000 },
  token: { limit: 20, windowMs: 15 * 60_000 },
  search: { limit: 120, windowMs: 60_000 },
  'customer-link': { limit: 60, windowMs: 60_000 },
  reveal: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;
export type RateLimitName = keyof typeof DEFAULT_RATE_LIMITS;

interface WindowState extends Record<string, unknown> {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  constructor(
    private readonly store: AtomicStateStore,
    private readonly now: () => Date,
    private readonly policies: Record<string, RateLimitPolicy> = DEFAULT_RATE_LIMITS,
  ) {}

  /** Counts one hit; throws 429 with `retryAfterSeconds` when the fixed window is exhausted. */
  async hit(name: RateLimitName | string, subject: string): Promise<void> {
    const policy = this.policies[name];
    if (!policy) throw new Error(`unknown rate limit policy ${name}`);
    const now = this.now();
    const t = now.getTime();
    const state = await this.store.update<WindowState>(hashKey('rl', name, subject), now, (cur) => {
      const fresh = !cur || cur.windowStart + policy.windowMs <= t;
      return {
        next: { count: fresh ? 1 : cur.count + 1, windowStart: fresh ? t : cur.windowStart },
        ttlMs: policy.windowMs,
      };
    });
    if (state && state.count > policy.limit)
      throw rateLimited(Math.max(1, Math.ceil((state.windowStart + policy.windowMs - t) / 1000)));
  }
}

export function rateLimited(retryAfterSeconds: number, code = 'rate_limited'): AppError {
  return new AppError(code, 429, [], { cause: { retryAfterSeconds } });
}

export function retryAfterOf(err: unknown): number | null {
  const c = (err as { cause?: { retryAfterSeconds?: number } } | null)?.cause;
  return typeof c?.retryAfterSeconds === 'number' ? c.retryAfterSeconds : null;
}

// ---- login lockout (ba-answers-for-dev §1.4) --------------------------------

/**
 * Three counters, all applied to unknown login names too so behaviour is identical:
 *  A device + normalised name: `maxFailures` in a row -> lock `lockMs`; a second lock within
 *    `escalateWithinMs` locks `escalatedLockMs`.
 *  B normalised name on any device: never a hard lock (would let anybody lock a colleague out);
 *    after `maxFailures` in `windowMs` each further attempt is slowed progressively.
 *  C network address: higher threshold than A (branches share addresses), same slow-down.
 * [Đề xuất BA - chờ xác nhận: Khách]; counter C numbers [Cần xác nhận: Chủ dự án].
 */
export interface LockoutConfig {
  device: {
    maxFailures: number;
    lockMs: number;
    escalateWithinMs: number;
    escalatedLockMs: number;
  };
  name: { maxFailures: number; windowMs: number; baseDelayMs: number; maxDelayMs: number };
  network: { maxFailures: number; windowMs: number; baseDelayMs: number; maxDelayMs: number };
}

export const DEFAULT_LOCKOUT: LockoutConfig = {
  device: {
    maxFailures: 5,
    lockMs: 15 * 60_000,
    escalateWithinMs: 60 * 60_000,
    escalatedLockMs: 60 * 60_000,
  },
  name: { maxFailures: 10, windowMs: 15 * 60_000, baseDelayMs: 2_000, maxDelayMs: 60_000 },
  network: { maxFailures: 60, windowMs: 15 * 60_000, baseDelayMs: 1_000, maxDelayMs: 30_000 },
};

interface DeviceState extends Record<string, unknown> {
  failures: number;
  lockedUntil: number;
  lastLockAt: number;
  lockCount: number;
}
interface SlowState extends Record<string, unknown> {
  failures: number;
  windowStart: number;
  lastFailureAt: number;
  unlockedAt: number;
}

export interface LoginSubject {
  /** random device id from the device cookie */
  deviceId: string;
  /** login name as typed, normalised by the caller (lower-case, trimmed) */
  name: string;
  /** network address (any string; hashed here) */
  address: string;
}

export class LoginThrottle {
  constructor(
    private readonly store: AtomicStateStore,
    private readonly now: () => Date,
    private readonly cfg: LockoutConfig = DEFAULT_LOCKOUT,
  ) {}

  private keys(s: LoginSubject) {
    return {
      a: hashKey('login-dev', s.deviceId, s.name),
      b: hashKey('login-name', s.name),
      c: hashKey('login-net', s.address),
    };
  }

  private delayFor(st: SlowState | null, c: LockoutConfig['name'], t: number): number {
    if (!st || st.windowStart + c.windowMs <= t || st.failures < c.maxFailures) return 0;
    const over = st.failures - c.maxFailures;
    const delay = Math.min(c.maxDelayMs, c.baseDelayMs * 2 ** Math.min(over, 10));
    return Math.max(0, st.lastFailureAt + delay - t);
  }

  /** Throws 429 `login_locked` (generic, same for every login name) when an attempt must wait. */
  async assertAllowed(s: LoginSubject): Promise<void> {
    const now = this.now();
    const t = now.getTime();
    const k = this.keys(s);
    const [a, b, c] = await Promise.all([
      this.store.read<DeviceState>(k.a, now),
      this.store.read<SlowState>(k.b, now),
      this.store.read<SlowState>(k.c, now),
    ]);
    // an unlock (admin or completed password reset) clears a lock made before it
    const unlockedAt = b?.unlockedAt ?? 0;
    const lockedUntil = a && a.lastLockAt > unlockedAt ? a.lockedUntil : 0;
    const waits = [
      lockedUntil - t,
      this.delayFor(b, this.cfg.name, t),
      this.delayFor(c, this.cfg.network, t),
    ];
    const wait = Math.max(...waits);
    if (wait > 0) throw rateLimited(Math.ceil(wait / 1000), 'login_locked');
  }

  async recordFailure(s: LoginSubject): Promise<void> {
    const now = this.now();
    const t = now.getTime();
    const k = this.keys(s);
    const d = this.cfg.device;
    await this.store.update<DeviceState>(k.a, now, (cur) => {
      const st: DeviceState = cur ?? { failures: 0, lockedUntil: 0, lastLockAt: 0, lockCount: 0 };
      let { failures, lockedUntil, lastLockAt, lockCount } = st;
      failures += 1;
      if (failures >= d.maxFailures) {
        const escalate = lastLockAt > 0 && t - lastLockAt <= d.escalateWithinMs;
        lockedUntil = t + (escalate ? d.escalatedLockMs : d.lockMs);
        lastLockAt = t;
        lockCount = escalate ? lockCount + 1 : 1;
        failures = 0;
      }
      return {
        next: { failures, lockedUntil, lastLockAt, lockCount },
        ttlMs: d.escalateWithinMs * 2,
      };
    });
    const slow = (c: LockoutConfig['name']) => (cur: SlowState | null) => {
      const fresh = !cur || cur.windowStart + c.windowMs <= t;
      return {
        next: {
          failures: fresh ? 1 : cur.failures + 1,
          windowStart: fresh ? t : cur.windowStart,
          lastFailureAt: t,
          unlockedAt: cur?.unlockedAt ?? 0,
        },
        ttlMs: Math.max(c.windowMs, this.cfg.device.escalateWithinMs),
      };
    };
    await this.store.update<SlowState>(k.b, now, slow(this.cfg.name));
    await this.store.update<SlowState>(k.c, now, slow(this.cfg.network));
  }

  async recordSuccess(s: LoginSubject): Promise<void> {
    const now = this.now();
    const k = this.keys(s);
    await this.store.update<DeviceState>(k.a, now, () => null);
    await this.store.update<SlowState>(k.b, now, (cur) =>
      cur ? { next: { ...cur, failures: 0 }, ttlMs: this.cfg.name.windowMs } : null,
    );
  }

  /** Admin unlock / completed password reset for a login name: invalidates earlier device locks. */
  async unlockName(name: string): Promise<void> {
    const now = this.now();
    await this.store.update<SlowState>(hashKey('login-name', name), now, (cur) => ({
      next: {
        failures: 0,
        windowStart: cur?.windowStart ?? now.getTime(),
        lastFailureAt: 0,
        unlockedAt: now.getTime(),
      },
      ttlMs: this.cfg.device.escalateWithinMs * 2,
    }));
  }
}

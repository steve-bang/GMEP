import { describe, expect, it } from 'vitest';
import {
  employeeLoginName,
  isReservedLoginEmail,
  loginAddressOf,
  normalizeCompanyCode,
  workerLoginAddress,
} from '@/modules/sys';
import { DocAtomicStateStore, LoginThrottle } from '@/platform/ratelimit/ratelimit';
import { fixedClock } from '@/platform/time/clock';
import { MemoryDb, MemoryDocStore, MemoryUnitOfWork } from '@/infrastructure/store/memoryDocStore';

/** P2-C (phase-2-plan 14.4): internal sign-in address and the company counter of the employee-code sign-in. */
describe('P2-C internal sign-in address', () => {
  it('is deterministic, case-insensitive in the employee code, different per tenant and on the reserved domain', () => {
    const a = workerLoginAddress('tnt_demo', 'nv0001');
    expect(a).toBe(workerLoginAddress('tnt_demo', ' NV 0001 '));
    expect(a).not.toBe(workerLoginAddress('tnt_demo2', 'NV0001'));
    expect(a).toMatch(/^w-[0-9a-f]{40}@workers\.gmep\.invalid$/);
    expect(a.split('@')[0]!.length).toBeLessThanOrEqual(64); // RFC 5321 local-part limit
    // neither the tenant code nor the employee code can be read from it
    expect(a).not.toContain('tnt_demo');
    expect(a.toLowerCase()).not.toContain('nv0001');
    expect(isReservedLoginEmail(a)).toBe(true);
    expect(isReservedLoginEmail('someone@garage.vn')).toBe(false);
    expect(isReservedLoginEmail('x@anything.INVALID ')).toBe(true);
  });

  it('only employee-code accounts use it; email accounts keep their email', () => {
    const base = { tenantId: 'tnt_demo', employeeCode: 'NV0001' };
    expect(loginAddressOf({ ...base, email: 'a@b.vn' })).toBe('a@b.vn');
    expect(loginAddressOf({ ...base, email: '', loginKind: 'employee_code' })).toBe(
      workerLoginAddress('tnt_demo', 'NV0001'),
    );
  });

  it('company code and lockout name are normalised (case, spaces)', () => {
    expect(normalizeCompanyCode('  TNT_Demo ')).toBe('tnt_demo');
    expect(employeeLoginName('TNT_DEMO', ' nv 0001')).toBe(employeeLoginName('tnt_demo', 'NV0001'));
    expect(employeeLoginName('tnt_demo', 'NV0001')).not.toBe(
      employeeLoginName('tnt_demo2', 'NV0001'),
    );
  });
});

describe('login throttle counter D (company code of an employee-code sign-in)', () => {
  const setup = () => {
    const db = new MemoryDb();
    const clock = fixedClock('2026-11-07T08:00:00Z');
    const state = new DocAtomicStateStore(new MemoryDocStore(db), new MemoryUnitOfWork(db));
    return { db, throttle: new LoginThrottle(state, () => clock.now()) };
  };
  const s = (name: string, group?: string) => ({
    deviceId: `dev-${name}`,
    name,
    address: `10.0.0.${name.length}`,
    ...(group ? { group } : {}),
  });

  it('slows every code of a scanned company after the threshold; other companies and email sign-ins are untouched', async () => {
    const { throttle } = setup();
    for (let i = 0; i < 31; i++) await throttle.recordFailure(s(`emp:tnt_x|c${i}`, 'emp:tnt_x'));
    await expect(throttle.assertAllowed(s('emp:tnt_x|fresh', 'emp:tnt_x'))).rejects.toMatchObject({
      code: 'login_locked',
      status: 429,
    });
    await expect(throttle.assertAllowed(s('emp:tnt_y|c1', 'emp:tnt_y'))).resolves.toBeUndefined();
    await expect(throttle.assertAllowed(s('a@b.test'))).resolves.toBeUndefined();
  });

  it('stores hashes only (no company code in clear)', async () => {
    const { db, throttle } = setup();
    await throttle.recordFailure(s('emp:secret_garage|nv1', 'emp:secret_garage'));
    expect(JSON.stringify([...db.col('rateLimits').entries()])).not.toContain('secret_garage');
  });
});

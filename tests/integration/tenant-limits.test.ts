import { beforeAll, describe, expect, it } from 'vitest';
import {
  CONFIG_TYPES,
  DEFAULT_TENANT_LIMITS,
  FIRST_TENANT_LIMIT_EXCEPTION,
  checkTenantLimit,
  configVersionId,
  tenantLimitsAt,
  type ConfigVersion,
} from '@/modules/sys';
import { backends, createHarness, type Harness } from './harness';

/**
 * FR-TEN-044, RULE-035 (MT-0 hook for MT-2): tenant limits are effective-dated parameters (Q40 proposal), there is no trial
 * field anywhere, and the check point only reports: nothing is blocked yet.
 */
describe('tenant limits parameters', () => {
  it('Q40 proposal values; tenant number 1 is the documented exception; no trial or expiry field', () => {
    expect(DEFAULT_TENANT_LIMITS).toEqual({
      activeBranches: 3,
      users: 25,
      photoStorageMb: 10240,
      apiPerMinute: 300,
      backgroundJobs: 2,
      importRowsPerDay: 20000,
      exportRowsPerRun: 5000,
    });
    expect(FIRST_TENANT_LIMIT_EXCEPTION).toEqual({ activeBranches: 25, users: 350 });
    expect(JSON.stringify(Object.keys(DEFAULT_TENANT_LIMITS))).not.toMatch(/trial|expire|until/i);
    const def = CONFIG_TYPES['tenant-limits']!;
    expect(
      def.payload.safeParse({ ...DEFAULT_TENANT_LIMITS, trialEndsAt: '2026-12-01' }).success,
    ).toBe(false);
    expect(def.payload.safeParse(DEFAULT_TENANT_LIMITS).success).toBe(true);
    expect(def.scopeKey.safeParse('tenant').success).toBe(true);
    expect(def.scopeKey.safeParse('branch:x').success).toBe(false);
  });
});

describe.each(backends)('tenant limits hook [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });
  const sys = () => h.container.sys;

  it('defaults apply, an effective-dated version replaces them from its date, and the check never blocks', async () => {
    // a version for tenant number 1 (25 branches), effective from 2026-12-01 (written as the platform tier will)
    const v: ConfigVersion = {
      id: configVersionId('tnt_demo', 'tenant-limits', 'tenant', '2026-12-01'),
      tenantId: 'tnt_demo',
      type: 'tenant-limits',
      scopeKey: 'tenant',
      effectiveFrom: '2026-12-01',
      status: 'approved',
      payload: { ...DEFAULT_TENANT_LIMITS, ...FIRST_TENANT_LIMIT_EXCEPTION },
      proposedBy: 'platform',
      proposedAt: new Date(),
      reason: 'Ngoại lệ tenant số 1 (Q40)',
      decidedBy: 'platform',
      decidedAt: new Date(),
      decisionNote: null,
      version: 1,
    };
    await sys().uow.run(async (tx) => {
      sys().configs.create(tx, v);
    });
    // before its effective date the defaults apply (and the check reports, never blocks)
    expect(await tenantLimitsAt(sys(), 'tnt_demo', '2026-11-30')).toEqual(DEFAULT_TENANT_LIMITS);
    const c = await checkTenantLimit(sys(), 'tnt_demo', 'activeBranches', 3, '2026-11-30');
    expect(c).toMatchObject({ limit: 3, current: 3, exceeded: true, allowed: true });
    expect(await tenantLimitsAt(sys(), 'tnt_demo', '2026-12-01')).toMatchObject({
      activeBranches: 25,
      users: 350,
      exportRowsPerRun: 5000,
    });
    const later = await checkTenantLimit(sys(), 'tnt_demo', 'users', 340, '2026-12-02', 20);
    expect(later).toMatchObject({ limit: 350, exceeded: true, allowed: true });
    // the other tenant is untouched
    expect(await tenantLimitsAt(sys(), 'tnt_demo2', '2026-12-02')).toEqual(DEFAULT_TENANT_LIMITS);
  });

  it('a tenant owner cannot change the limits of his own tenant (no tenant role holds the right)', async () => {
    const owner = await h.loginAt('u_owner', 'all');
    const r = await h.call('POST', '/api/v1/sys/config/tenant-limits', {
      cookie: owner,
      key: 'limits-propose-000000001',
      body: {
        scopeKey: 'tenant',
        effectiveFrom: '2027-01-01',
        payload: { ...DEFAULT_TENANT_LIMITS, activeBranches: 999 },
        reason: 'Tự nâng hạn mức',
      },
    });
    expect([403, 404]).toContain(r.status);
  });
});

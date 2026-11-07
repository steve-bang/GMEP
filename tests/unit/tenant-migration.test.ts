import { describe, expect, it } from 'vitest';
import { migrateToTenant, type MigrationIo } from '@/infrastructure/migration/tenantMigration';

/** FR-TEN-031, UAT-TEN-11: data written before MT-0 becomes tenant number 1; nothing is renumbered, counts and money match. */
type Store = Map<string, Map<string, Record<string, unknown>>>;
const legacy = (): Store => {
  const s: Store = new Map();
  const put = (c: string, id: string, d: Record<string, unknown>) => {
    if (!s.has(c)) s.set(c, new Map());
    s.get(c)!.set(id, d);
  };
  put('companies', 'cmp_main', { name: 'Garage Một', legalEntityIds: [] });
  put('roles', 'CH', { name: 'Chủ garage', permissions: ['user:view'], canConsolidate: true });
  put('users', 'u1', { companyId: 'cmp_main', email: 'chu@x.test', employeeCode: 'NV0001' });
  put('userKeys', 'email__chu@x.test', { userId: 'u1' });
  put('userKeys', 'code__cmp_main__NV0001', { userId: 'u1' });
  put('branches', 'br_q7', { companyId: 'cmp_main', code: 'Q7' });
  put('counters', 'cmp_main__br_q7__repair-order__2611', { companyId: 'cmp_main', last: 42 });
  put('payments', 'pay_1', { companyId: 'cmp_main', amountVnd: 1_500_000, totalVnd: 1_500_000 });
  put('payments', 'pay_2', { companyId: 'cmp_main', amountVnd: 250_000, totalVnd: 250_000 });
  put('invoices', 'inv_1', { companyId: 'cmp_main', totalVnd: 1_620_000 });
  put('configVersions', 'tax-rate__vat__2026-10-01', { companyId: 'cmp_main', type: 'tax-rate' });
  put('configVersions', 'labor-rate__company__2026-10-01', {
    companyId: 'cmp_main',
    type: 'labor-rate',
    scopeKey: 'company',
  });
  return s;
};
const ioOf = (s: Store): MigrationIo => ({
  async list(c) {
    return [...(s.get(c)?.entries() ?? [])].map(([id, data]) => ({ id, data }));
  },
  async set(c, id, data) {
    if (!s.has(c)) s.set(c, new Map());
    s.get(c)!.set(id, data);
  },
  async remove(c, id) {
    s.get(c)?.delete(id);
  },
});

describe('migrate to tenant number 1 (FR-TEN-031)', () => {
  it('dry run changes nothing and reports what it would do', async () => {
    const s = legacy();
    const r = await migrateToTenant(ioOf(s), { tenantId: 'cmp_main', apply: false });
    expect(r.apply).toBe(false);
    expect(r.changed.payments).toBe(2);
    expect(s.get('users')!.get('u1')).toHaveProperty('companyId');
    expect(s.has('tenants')).toBe(false);
  });

  it('apply keeps ids and values, re-keys roles and configuration, reconciles counts and money', async () => {
    const s = legacy();
    const r = await migrateToTenant(ioOf(s), { tenantId: 'cmp_main', apply: true });
    expect(r.reconciled).toBe(true);
    expect(r.after.sums['payments.amountVnd']).toBe(1_750_000);
    expect(r.after.sums['invoices.totalVnd']).toBe(1_620_000);
    // partition field renamed, value kept
    expect(s.get('users')!.get('u1')).toMatchObject({ tenantId: 'cmp_main' });
    expect(s.get('users')!.get('u1')).not.toHaveProperty('companyId');
    // no document number and no deterministic key changes: same ids, same counter value
    expect(s.get('counters')!.get('cmp_main__br_q7__repair-order__2611')).toMatchObject({
      last: 42,
      tenantId: 'cmp_main',
    });
    expect(s.get('userKeys')!.has('code__cmp_main__NV0001')).toBe(true);
    // company -> tenant record on the free plan, no clock
    expect(s.get('tenants')!.get('cmp_main')).toMatchObject({
      plan: 'free',
      subscriptionStatus: 'none',
      status: 'active',
      name: 'Garage Một',
    });
    expect(JSON.stringify(s.get('tenants')!.get('cmp_main'))).not.toMatch(/trial/i);
    expect(s.get('companies')!.size).toBe(0);
    // global role -> per tenant
    expect(s.get('roles')!.has('CH')).toBe(false);
    expect(s.get('roles')!.get('cmp_main__CH')).toMatchObject({ tenantId: 'cmp_main', code: 'CH' });
    // configuration id carries the tenant
    expect(s.get('configVersions')!.has('tax-rate__vat__2026-10-01')).toBe(false);
    expect(s.get('configVersions')!.get('cmp_main__tax-rate__vat__2026-10-01')).toMatchObject({
      tenantId: 'cmp_main',
    });
    // MT0-5: scope key `company` becomes `tenant` in the id and the field (FR-TEN-018)
    expect(s.get('configVersions')!.has('labor-rate__company__2026-10-01')).toBe(false);
    expect(s.get('configVersions')!.get('cmp_main__labor-rate__tenant__2026-10-01')).toMatchObject({
      scopeKey: 'tenant',
    });
    // the email slot becomes an identity slot (first membership: id = uid)
    expect(s.get('userKeys')!.get('email__chu@x.test')).toMatchObject({
      zone: 'tenant',
      identityId: 'u1',
    });
  });

  it('is idempotent: a second run converts nothing and still reconciles', async () => {
    const s = legacy();
    await migrateToTenant(ioOf(s), { tenantId: 'cmp_main', apply: true });
    const again = await migrateToTenant(ioOf(s), { tenantId: 'cmp_main', apply: true });
    expect(Object.values(again.changed).reduce((a, b) => a + b, 0)).toBe(0);
    expect(again.reconciled).toBe(true);
    expect(again.rekeyed).toEqual([]);
  });

  it('leaves a document of another company alone and says so', async () => {
    const s = legacy();
    s.get('payments')!.set('pay_x', { companyId: 'cmp_other', amountVnd: 1 });
    const r = await migrateToTenant(ioOf(s), { tenantId: 'cmp_main', apply: true });
    expect(r.warnings.join('\n')).toContain('payments/pay_x');
    expect(s.get('payments')!.get('pay_x')).toHaveProperty('companyId', 'cmp_other');
  });
});

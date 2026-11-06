import { describe, expect, it } from 'vitest';
import { demoDocs } from '@/infrastructure/seed/demo';
import {
  migrateToTenant,
  TENANT_COLLECTIONS,
  type MigrationIo,
} from '@/infrastructure/migration/tenantMigration';
import {
  bulkTenantDocs,
  countDocs,
  diffDocMaps,
  downgradeToLegacy,
  onlyTenant,
  type DocMap,
} from '@/infrastructure/migration/rehearsal';

/**
 * FR-TEN-031 / UAT-TEN-11 (rehearsal, in memory): tenant data -> pre-MT-0 shape -> migration must give back the SAME
 * documents: ids, document numbers, counters, money, e-invoice idempotency keys. The Emulator run is
 * scripts/rehearse-migration.ts (same functions, much bigger data).
 */
const build = (): DocMap => {
  const m: DocMap = new Map();
  const put = (c: string, id: string, d: Record<string, unknown>) => {
    if (!m.has(c)) m.set(c, new Map());
    m.get(c)!.set(id, d);
  };
  for (const d of demoDocs())
    put(d.collection, d.id, structuredClone(d.data) as Record<string, unknown>);
  for (const d of bulkTenantDocs('tnt_demo', ['br_q7', 'br_td'], 40))
    put(d.collection, d.id, d.data);
  return m;
};
const ioOf = (s: DocMap): MigrationIo => ({
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

describe('FR-TEN-031 migration rehearsal (round trip)', () => {
  it('migrating pre-MT-0 data reproduces the tenant data exactly, reconciles, and a second run changes nothing', async () => {
    // the migration must know every collection that carries the partition field (a new one added without it fails here)
    const unknown = [...build()].filter(
      ([c, docs]) =>
        !(TENANT_COLLECTIONS as readonly string[]).includes(c) &&
        [...docs.values()].some((d) => d.tenantId !== undefined),
    );
    expect(unknown.map(([c]) => c).filter((c) => c !== 'roles' && c !== 'userKeys')).toEqual([]);
    const tenantOnly = onlyTenant(build(), 'tnt_demo');
    expect(countDocs(tenantOnly)).toBeGreaterThan(600);
    const legacy = downgradeToLegacy(tenantOnly, 'tnt_demo');
    // sanity: the legacy shape really is the old one
    expect(legacy.get('companies')!.has('tnt_demo')).toBe(true);
    expect([...legacy.get('payments')!.values()][0]).toHaveProperty('companyId');
    expect(legacy.get('roles')!.has('CH')).toBe(true);
    expect([...legacy.get('configVersions')!.keys()].some((k) => k.includes('__company__'))).toBe(
      true,
    );

    // dry run writes nothing
    const before = structuredClone(legacy);
    const dry = await migrateToTenant(ioOf(legacy), { tenantId: 'tnt_demo', apply: false });
    expect(dry.apply).toBe(false);
    expect(diffDocMaps(before, legacy)).toEqual([]);

    const run = await migrateToTenant(ioOf(legacy), { tenantId: 'tnt_demo', apply: true });
    expect(run.reconciled, JSON.stringify(run.warnings)).toBe(true);
    expect(run.warnings).toEqual([]);
    // every document equals the original: ids, document numbers, counters, money, idempotency keys
    expect(diffDocMaps(tenantOnly, legacy, ['tenants', 'companies'])).toEqual([]);
    const key = (
      legacy.get('invoiceRequests')!.get('ord_br_q7_00001__issue__1') as { idempotencyKey: string }
    ).idempotencyKey;
    expect(key).toBe('gmep:tnt_demo:ord_br_q7_00001__issue__1');

    const again = await migrateToTenant(ioOf(legacy), { tenantId: 'tnt_demo', apply: true });
    expect(Object.values(again.changed).reduce((a, b) => a + b, 0)).toBe(0);
    expect(again.reconciled).toBe(true);
  });
});

/**
 * FR-TEN-031 (M7): turns data written before MT-0 into the data of tenant number 1.
 *
 * What changes, and what must not:
 *  - the partition field `companyId` becomes `tenantId` on every business document; the VALUE is kept, so every
 *    deterministic key built from it (counters, number assignments, plate/VIN/code slots, branch codes, the e-invoice
 *    no-duplicate key) stays valid and no document number changes;
 *  - `companies/<id>` becomes the tenant record `tenants/<id>` (free plan, no clock, status `active`);
 *  - roles were global (id = code): they are copied to `<tenant>__<code>` and the global ones are removed;
 *  - effective-dated configuration ids get the tenant prefix (`<tenant>__<type>__<scope>__<date>`) and the scope key
 *    `company` becomes `tenant` (id and field);
 *  - the email slots in `userKeys` gain `zone` and `identityId` (the first membership of an identity: id = uid).
 * The run is idempotent (documents already converted are skipped, so a second run reports zero changes), dry-run by
 * default, and prints a before/after reconciliation: record counts per collection and the sums of the money fields.
 * Rollback plan: take an export/snapshot first; nothing here can be reverted field by field (roles and configuration
 * change id), so the snapshot IS the plan (no real data exists yet: Emulator only).
 */
export interface MigrationDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface MigrationIo {
  list(collection: string): Promise<MigrationDoc[]>;
  set(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}

/** Collections that hold business documents carrying the partition field. */
export const TENANT_COLLECTIONS = [
  'users',
  'roleAssignments',
  'branches',
  'warehouses',
  'authTokens',
  'configVersions',
  'notifications',
  'services',
  'priceLists',
  'auditLogs',
  'accessLogs',
  'counters',
  'numberAssignments',
  'customers',
  'customerPii',
  'customerLinks',
  'vehicles',
  'vehicleLinks',
  'vehiclePlates',
  'vehicleVins',
  'vehicleOwnerships',
  'consents',
  'dataSubjectRequests',
  'vehicleHistory',
  'parts',
  'partCodes',
  'partBarcodes',
  'partCompat',
  'stockBalances',
  'stockMovements',
  'stockDocuments',
  'stockReservations',
  'issueReturns',
  'intakes',
  'quotes',
  'quoteVersions',
  'quoteLinks',
  'repairOrders',
  'repairItems',
  'partRequests',
  'approvals',
  'approvalSlots',
  'payments',
  'paymentReversals',
  'orderAccounts',
  'cashDrawers',
  'cashEntries',
  'cashShifts',
  'dayCloses',
  'debts',
  'invoices',
  'invoicePii',
  'invoiceArtifacts',
  'invoiceRequests',
  'invoiceQueues',
  'einOrders',
  'importBatches',
  'importFileSlots',
  'importUnits',
  'rollups',
  'employees',
  'employeePii',
  'employeeCodes',
  'employeeUserLinks',
  'laborSheets',
  'messageOutbox',
  'quoteOtps',
  'messageDeliveries',
  'messageQueues',
  'emailOutbox',
] as const;

/** Money fields reconciled before and after (a mismatch is a bug in the migration, never in the data). */
export const MONEY_FIELDS: Record<string, string[]> = {
  payments: ['amountVnd', 'totalVnd'],
  cashEntries: ['amountVnd'],
  invoices: ['totalVnd', 'subtotalVnd', 'taxVnd'],
  debts: ['amountVnd', 'remainingVnd'],
  quotes: ['totalVnd'],
  repairOrders: ['totalVnd'],
  stockBalances: ['onHand', 'reserved'],
};

export interface MigrationReport {
  tenantId: string;
  apply: boolean;
  changed: Record<string, number>;
  skipped: Record<string, number>;
  rekeyed: { collection: string; from: string; to: string }[];
  warnings: string[];
  before: Reconciliation;
  after: Reconciliation;
  reconciled: boolean;
}
export interface Reconciliation {
  counts: Record<string, number>;
  sums: Record<string, number>;
}

async function reconcile(
  io: MigrationIo,
  tenantField: 'companyId' | 'tenantId',
): Promise<Reconciliation> {
  const counts: Record<string, number> = {};
  const sums: Record<string, number> = {};
  for (const col of TENANT_COLLECTIONS) {
    const docs = await io.list(col);
    // a document counts for the tenant partition whichever name it still uses
    counts[col] = docs.filter(
      (d) =>
        d.data[tenantField] !== undefined ||
        d.data.tenantId !== undefined ||
        d.data.companyId !== undefined,
    ).length;
    for (const f of MONEY_FIELDS[col] ?? [])
      sums[`${col}.${f}`] = docs.reduce(
        (n, d) => n + (typeof d.data[f] === 'number' ? (d.data[f] as number) : 0),
        0,
      );
  }
  return { counts, sums };
}

const withoutKey = (o: Record<string, unknown>, k: string) => {
  const c = { ...o };
  delete c[k];
  return c;
};

export async function migrateToTenant(
  io: MigrationIo,
  opts: { tenantId: string; apply: boolean; tenantName?: string },
): Promise<MigrationReport> {
  const { tenantId, apply } = opts;
  const report: MigrationReport = {
    tenantId,
    apply,
    changed: {},
    skipped: {},
    rekeyed: [],
    warnings: [],
    before: await reconcile(io, 'companyId'),
    after: { counts: {}, sums: {} },
    reconciled: false,
  };
  const bump = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);
  const run = async (fn: () => Promise<void>) => {
    if (apply) await fn();
  };

  // 1) the partition field
  for (const col of TENANT_COLLECTIONS) {
    for (const d of await io.list(col)) {
      if (d.data.companyId === undefined) {
        bump(report.skipped, col);
        continue;
      }
      if (d.data.companyId !== tenantId)
        report.warnings.push(
          `${col}/${d.id}: companyId ${String(d.data.companyId)} is not ${tenantId} (left untouched)`,
        );
      else {
        bump(report.changed, col);
        await run(() => io.set(col, d.id, { ...withoutKey(d.data, 'companyId'), tenantId }));
      }
    }
  }

  // 2) companies/<id> -> tenants/<id>
  for (const c of await io.list('companies')) {
    if (c.id !== tenantId) {
      report.warnings.push(`companies/${c.id}: not the tenant being migrated (left untouched)`);
      continue;
    }
    bump(report.changed, 'tenants');
    const now = new Date();
    await run(async () => {
      if ((await io.list('tenants')).some((t) => t.id === c.id)) return;
      await io.set('tenants', c.id, {
        name: (c.data.name as string | undefined) ?? opts.tenantName ?? c.id,
        legalEntityIds: (c.data.legalEntityIds as string[] | undefined) ?? [],
        status: 'active',
        plan: 'free',
        subscriptionStatus: 'none',
        environment: 'live',
        placement: 'pooled',
        legalHold: false,
        provisionRequestKey: 'migration',
        provisioning: {},
        createdAt: now,
        createdBy: 'migration',
        updatedAt: now,
        updatedBy: 'migration',
        version: 1,
      });
      await io.remove('companies', c.id);
    });
  }

  // 3) roles: global -> per tenant
  for (const r of await io.list('roles')) {
    if (r.data.tenantId !== undefined) {
      bump(report.skipped, 'roles');
      continue;
    }
    const to = `${tenantId}__${r.id}`;
    bump(report.changed, 'roles');
    report.rekeyed.push({ collection: 'roles', from: r.id, to });
    await run(async () => {
      await io.set('roles', to, { ...r.data, tenantId, code: r.id });
      await io.remove('roles', r.id);
    });
  }

  // 4) configuration ids carry the tenant, and the scope key `company` becomes `tenant` (MT0-5, FR-TEN-018)
  for (const v of await io.list('configVersions')) {
    const prefixed = v.id.startsWith(`${tenantId}__`) ? v.id : `${tenantId}__${v.id}`;
    const to = prefixed.replace('__company__', '__tenant__');
    const legacyScope = v.data.scopeKey === 'company';
    if (to === v.id && !legacyScope) continue;
    bump(report.changed, 'configVersions.rekey');
    report.rekeyed.push({ collection: 'configVersions', from: v.id, to });
    await run(async () => {
      const data = await currentData(io, 'configVersions', v.id);
      await io.set('configVersions', to, {
        ...data,
        tenantId,
        ...(legacyScope ? { scopeKey: 'tenant' } : {}),
      });
      if (to !== v.id) await io.remove('configVersions', v.id);
    });
  }
  const slots = (await io.list('approvalSlots')).filter(
    (s) => s.id.includes('__') && !s.id.includes(`${tenantId}__`),
  );
  if (slots.length)
    report.warnings.push(
      `${slots.length} approval slot(s) point at configuration ids that were re-keyed; close or re-open those approvals`,
    );

  // 5) email slots
  for (const k of await io.list('userKeys')) {
    if (!k.id.startsWith('email__') || k.data.zone !== undefined) continue;
    bump(report.changed, 'userKeys');
    await run(() =>
      io.set('userKeys', k.id, { ...k.data, zone: 'tenant', identityId: k.data.userId }),
    );
  }

  report.after = await reconcile(io, 'tenantId');
  report.reconciled = apply
    ? JSON.stringify(report.before.counts) === JSON.stringify(report.after.counts) &&
      JSON.stringify(report.before.sums) === JSON.stringify(report.after.sums)
    : false;
  return report;
}

async function currentData(
  io: MigrationIo,
  col: string,
  id: string,
): Promise<Record<string, unknown>> {
  return (await io.list(col)).find((d) => d.id === id)?.data ?? {};
}

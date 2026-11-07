import { COL } from '../repos/queries';
import { idempotencyKeyOf } from '@/modules/ein';
import { TENANT_COLLECTIONS } from './tenantMigration';

/**
 * FR-TEN-031 / UAT-TEN-11 rehearsal support. The migration turns pre-MT-0 data into tenant data. To rehearse it on
 * a large, realistic data set WITHOUT keeping an old build around, the rehearsal runs the proof backwards:
 *   tenant-shaped data  --downgradeToLegacy-->  pre-MT-0 shape  --migrateToTenant-->  must equal the original, document by
 * document (ids, numbers, money, e-invoice idempotency keys). Pure functions over an in-memory document map, so the
 * same code runs against the Firestore Emulator (scripts/rehearse-migration.ts) and in the unit suite.
 */
export type DocMap = Map<string, Map<string, Record<string, unknown>>>;

export const ALL_COLLECTIONS: string[] = [
  ...new Set([...Object.values(COL), 'companies', 'tenants', 'approvalSlots', 'userKeys']),
];

const clone = <T>(v: T): T => structuredClone(v);

/** Keeps the documents of ONE tenant (the legacy world had one company). */
export function onlyTenant(src: DocMap, tenantId: string): DocMap {
  const out: DocMap = new Map();
  const keptUsers = new Set<string>();
  for (const [id, d] of src.get('users') ?? []) if (d.tenantId === tenantId) keptUsers.add(id);
  for (const [col, docs] of src) {
    const m = new Map<string, Record<string, unknown>>();
    for (const [id, d] of docs) {
      let keep: boolean;
      if (col === 'tenants') keep = id === tenantId;
      else if (col === 'userKeys')
        keep = keptUsers.has(String(d.userId)) || id.startsWith(`code__${tenantId}__`);
      else if (d.tenantId !== undefined) keep = d.tenantId === tenantId;
      else keep = true; // documents without a partition field (platform-level)
      if (keep) m.set(id, clone(d));
    }
    out.set(col, m);
  }
  return out;
}

/** The pre-MT-0 shape of tenant data: `companyId`, `companies/<id>`, global roles, un-prefixed configuration ids. */
export function downgradeToLegacy(src: DocMap, tenantId: string): DocMap {
  const out: DocMap = new Map();
  for (const [col, docs] of src) {
    const m = new Map<string, Record<string, unknown>>();
    for (const [id0, d0] of docs) {
      let id = id0;
      const d = clone(d0);
      if (col === 'tenants') {
        out.set(
          'companies',
          (out.get('companies') ?? new Map()).set(id, {
            name: d.name,
            legalEntityIds: d.legalEntityIds ?? [],
          }),
        );
        continue;
      }
      if (col === 'roles') {
        id = id0.replace(`${tenantId}__`, '');
        delete d.tenantId;
      } else if (col === 'configVersions') {
        id = id0.replace(`${tenantId}__`, '').replace('__tenant__', '__company__');
        if (d.scopeKey === 'tenant') d.scopeKey = 'company';
      } else if (col === 'userKeys' && id.startsWith('email__')) {
        delete d.zone;
        delete d.identityId;
      }
      if ((TENANT_COLLECTIONS as readonly string[]).includes(col) && d.tenantId !== undefined) {
        d.companyId = d.tenantId;
        delete d.tenantId;
      }
      m.set(id, d);
    }
    out.set(col, m);
  }
  return out;
}

/** Large, realistic tenant-shaped extras: numbered documents, money, counters, e-invoice requests with provider keys. */
export function bulkTenantDocs(
  tenantId: string,
  branchIds: string[],
  perBranch: number,
): { collection: string; id: string; data: Record<string, unknown> }[] {
  const out: { collection: string; id: string; data: Record<string, unknown> }[] = [];
  const at = new Date('2026-10-15T03:00:00.000Z');
  for (const br of branchIds) {
    out.push({
      collection: 'counters',
      id: `${tenantId}__${br}__repair-order__2610`,
      data: { tenantId, branchId: br, last: perBranch },
    });
    for (let i = 1; i <= perBranch; i++) {
      const n = String(i).padStart(5, '0');
      const ord = `ord_${br}_${n}`;
      const requestId = `${ord}__issue__1`;
      const total = 1_000_000 + i * 1_000;
      out.push(
        {
          collection: 'numberAssignments',
          id: `${tenantId}__${br}__repair-order__2610__${n}`,
          data: {
            tenantId,
            branchId: br,
            number: `LSC-${br}-2610-${n}`,
            docId: ord,
            createdAt: at,
          },
        },
        {
          collection: 'payments',
          id: `pay_${br}_${n}`,
          data: {
            tenantId,
            branchId: br,
            orderId: ord,
            amountVnd: total,
            totalVnd: total,
            createdAt: at,
          },
        },
        {
          collection: 'cashEntries',
          id: `cash_${br}_${n}`,
          data: { tenantId, branchId: br, amountVnd: total, createdAt: at },
        },
        {
          collection: 'invoiceRequests',
          id: requestId,
          data: {
            tenantId,
            branchId: br,
            orderId: ord,
            idempotencyKey: idempotencyKeyOf(tenantId, requestId),
            createdAt: at,
          },
        },
        {
          collection: 'invoices',
          id: `inv_${requestId}`,
          data: {
            tenantId,
            branchId: br,
            orderId: ord,
            totalVnd: total,
            subtotalVnd: Math.round(total / 1.1),
            taxVnd: total - Math.round(total / 1.1),
            createdAt: at,
          },
        },
        {
          collection: 'einOrders',
          id: ord,
          data: { tenantId, branchId: br, issueRequestId: requestId, rounds: 1 },
        },
        {
          collection: 'debts',
          id: `debt_${br}_${n}`,
          data: { tenantId, branchId: br, amountVnd: total, remainingVnd: i % 3 ? 0 : total },
        },
      );
    }
  }
  return out;
}

const stable = (v: unknown): unknown => {
  if (v instanceof Date) return { $date: v.toISOString() };
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort())
      o[k] = stable((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
};
export const stableJson = (v: unknown): string => JSON.stringify(stable(v));

export interface DocDiff {
  collection: string;
  id: string;
  kind: 'missing' | 'extra' | 'changed';
}

/** Document-by-document comparison (empty collections ignored). `ignore` skips whole collections. */
export function diffDocMaps(a: DocMap, b: DocMap, ignore: string[] = []): DocDiff[] {
  const out: DocDiff[] = [];
  const cols = new Set([...a.keys(), ...b.keys()]);
  for (const col of cols) {
    if (ignore.includes(col)) continue;
    const x = a.get(col) ?? new Map();
    const y = b.get(col) ?? new Map();
    for (const [id, d] of x) {
      if (!y.has(id)) out.push({ collection: col, id, kind: 'missing' });
      else if (stableJson(d) !== stableJson(y.get(id)))
        out.push({ collection: col, id, kind: 'changed' });
    }
    for (const id of y.keys()) if (!x.has(id)) out.push({ collection: col, id, kind: 'extra' });
  }
  return out;
}

export const countDocs = (m: DocMap): number => [...m.values()].reduce((n, c) => n + c.size, 0);

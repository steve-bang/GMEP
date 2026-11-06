import type { IndexDef } from './indexes';

/**
 * Pure helpers for `pnpm check:indexes --report` (R68, docs/dev/index-budget.md): per-module count
 * and conservative merge candidates. Reporting only; nothing here removes an index.
 */

/** Collection -> owning module (SYS, CRM, INV, REC, ACC, EIN, HRM). Unknown collections report as '?'. */
export const COLLECTION_OWNER: Readonly<Record<string, string>> = {
  approvals: 'SYS',
  auditLogs: 'SYS',
  authTokens: 'SYS',
  branches: 'SYS',
  configVersions: 'SYS',
  counters: 'SYS',
  importBatches: 'SYS',
  laborSheets: 'HRM',
  notifications: 'SYS',
  priceLists: 'SYS',
  roleAssignments: 'SYS',
  services: 'SYS',
  sessions: 'SYS',
  users: 'SYS',
  warehouses: 'SYS',
  consents: 'CRM',
  customerLinks: 'CRM',
  customerPii: 'CRM',
  customers: 'CRM',
  dataSubjectRequests: 'CRM',
  vehicleHistory: 'CRM',
  vehicleLinks: 'CRM',
  vehicleOwnerships: 'CRM',
  vehicles: 'CRM',
  partCompat: 'INV',
  parts: 'INV',
  stockBalances: 'INV',
  stockDocuments: 'INV',
  stockMovements: 'INV',
  stockReservations: 'INV',
  intakes: 'REC',
  partRequests: 'REC',
  quotes: 'REC',
  repairItems: 'REC',
  repairOrders: 'REC',
  cashEntries: 'ACC',
  cashShifts: 'ACC',
  debts: 'ACC',
  payments: 'ACC',
  invoices: 'EIN',
};

/** Collection -> FR family and slice (docs/dev/implementation-plan.md §7), for the budget table. */
export const COLLECTION_SLICE: Readonly<Record<string, string>> = {
  auditLogs: 'FR-SYS-003, 1.1',
  approvals: 'FR-SYS-004, 1.1/1.7',
  authTokens: 'FR-SYS-001, 1.1',
  configVersions: 'FR-SYS-006, 1.1',
  counters: 'FR-SYS-001, 1.1',
  notifications: 'FR-SYS, 1.1',
  roleAssignments: 'FR-SYS-001/002, 1.1',
  sessions: 'FR-SYS-001, 1.1',
  users: 'FR-SYS-001, 1.1',
  branches: 'FR-SYS-005, 1.2',
  warehouses: 'FR-SYS-005, 1.2',
  services: 'FR-SYS, 1.2',
  priceLists: 'FR-SYS, 1.2',
  importBatches: 'FR-SYS-007, 1.11',
  laborSheets: 'FR-HRM-007, 020, 2.6a',
  consents: 'FR-CRM, 1.3',
  customerLinks: 'FR-CRM, 1.3',
  customerPii: 'FR-CRM, 1.3',
  customers: 'FR-CRM, 1.3',
  dataSubjectRequests: 'FR-CRM, 1.3',
  vehicleHistory: 'FR-CRM, 1.3',
  vehicleLinks: 'FR-CRM, 1.3',
  vehicleOwnerships: 'FR-CRM, 1.3',
  vehicles: 'FR-CRM, 1.3',
  partCompat: 'FR-INV, 1.4',
  parts: 'FR-INV, 1.4',
  stockBalances: 'FR-INV, 1.4',
  stockDocuments: 'FR-INV, 1.4',
  stockMovements: 'FR-INV, 1.4',
  stockReservations: 'FR-INV, 1.4',
  intakes: 'FR-REC, 1.5',
  partRequests: 'FR-REC, 1.6',
  quotes: 'FR-REC, 1.5',
  repairItems: 'FR-REC, 1.6',
  repairOrders: 'FR-REC, 1.6',
  cashEntries: 'FR-ACC-001..004, 1.7',
  cashShifts: 'FR-ACC-001..004, 1.7',
  debts: 'FR-ACC, 1.7',
  payments: 'FR-ACC-001..004, 1.7',
  invoices: 'FR-EIN, 1.8',
};

export function sliceOf(collectionGroup: string): string {
  return COLLECTION_SLICE[collectionGroup] ?? '?';
}

export function ownerOf(collectionGroup: string): string {
  return COLLECTION_OWNER[collectionGroup] ?? '?';
}

/** Index count per module, largest first (ties by module name). */
export function countByModule(defs: readonly IndexDef[]): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const d of defs) {
    const mod = ownerOf(d.collectionGroup);
    m.set(mod, (m.get(mod) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export interface PrefixCandidate {
  shorter: IndexDef;
  longer: IndexDef;
  reason: string;
}

const fmt = (d: IndexDef) =>
  `${d.collectionGroup}(${d.fields.map((f) => f.fieldPath + (f.order === 'DESCENDING' ? ' desc' : '')).join(', ')})`;

/**
 * Candidates only: `shorter` has the same collection, query scope, field paths and directions as the
 * leading fields of `longer`. Firestore may serve the shorter query from the longer index, but only
 * when every document has the extra trailing fields (documents missing one are absent from the
 * longer index) and the query's equality/order split still matches. Never remove on this alone;
 * confirm against queries.ts and a staging run.
 */
export function prefixCandidates(defs: readonly IndexDef[]): PrefixCandidate[] {
  const out: PrefixCandidate[] = [];
  for (const a of defs)
    for (const b of defs) {
      if (
        a === b ||
        a.collectionGroup !== b.collectionGroup ||
        a.queryScope !== b.queryScope ||
        a.fields.length >= b.fields.length
      )
        continue;
      const isPrefix = a.fields.every(
        (f, i) => b.fields[i]!.fieldPath === f.fieldPath && b.fields[i]!.order === f.order,
      );
      if (!isPrefix) continue;
      out.push({
        shorter: a,
        longer: b,
        reason: `${fmt(a)} is a strict prefix of ${fmt(b)}: only safe if every document carries the extra trailing field(s) and no query orders by the shorter index's last field with a different equality set`,
      });
    }
  return out;
}

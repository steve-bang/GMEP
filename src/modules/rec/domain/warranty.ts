import { createHash } from 'node:crypto';

/**
 * Warranty (bảo hành; FR-REC-018, 036, FR-CRM-016; BR-REC-08). When a vehicle is handed over, REC writes ONE warranty
 * record per repair order: the cross-branch projection P4 (BA §10). This type IS the white list: order code, branch name,
 * dates, odometer, item names and the warranty term; no price, payment, discount, cost, customer contact, internal note
 * or media. A branch reading another branch's record sees these fields only and can never open the origin order.
 *
 * The term (days and/or km per service type) is the effective-dated `warranty-term` configuration IN FORCE ON THE
 * HANDOVER DAY, copied onto the record (RULE-019: a later change never rewrites a job already delivered). No term
 * configured = no warranty is assumed. Who bears the cost of cross-branch warranty work is open (Q77): the
 * `warranty-policy` configuration only RECORDS a bearer; nothing allocates cost between branches automatically.
 */

export interface WarrantyTerm {
  /** 0 = no limit by time */
  days: number;
  /** 0 = no limit by distance */
  km: number;
  conditions?: string;
}

export interface WarrantyItem {
  /** position on the record ("1", "2", ...): what another branch uses to pick an item (the item id is never shown there) */
  key: string;
  itemId: string;
  name: string;
  /** "thợ gốc" (FR-REC-018); returned only to readers of the origin branch, never across branches */
  technicianId: string | null;
  /** null when no term was configured for the job's service type on the handover day */
  expiresOn: string | null;
  expiresAtKm: number | null;
  /** config version the term came from (null = none) */
  termVersionId: string | null;
  conditions?: string;
}

export interface WarrantyRecord {
  /** `war_<hash(tenant, order)>`: deterministic (a replayed handover writes the same record) and opaque, so a reader of
   * another branch never learns the origin order's id (P4) */
  id: string;
  tenantId: string;
  vehicleId: string;
  branchId: string;
  branchName: string;
  orderId: string;
  /** shown only; never a link outside the owning branch */
  orderCode: string;
  serviceType: string | null;
  /** yyyy-MM-dd of the handover = start of the warranty */
  startDate: string;
  startKm: number | null;
  items: WarrantyItem[];
  createdAt: Date;
}

/** Deterministic, opaque id of the warranty record of one repair order. */
export const warrantyRecordId = (tenantId: string, orderId: string): string =>
  `war_${createHash('sha256').update(`${tenantId}:${orderId}`).digest('hex').slice(0, 32)}`;

const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Expiry of one term from the start date and odometer (FR-REC-018 "thời hạn bảo hành từng hạng mục"). */
export function warrantyExpiry(
  startDate: string,
  startKm: number | null,
  term: WarrantyTerm | null,
): { expiresOn: string | null; expiresAtKm: number | null } {
  if (!term) return { expiresOn: null, expiresAtKm: null };
  return {
    expiresOn: term.days > 0 ? addDaysIso(startDate, term.days) : null,
    expiresAtKm: term.km > 0 && startKm !== null ? startKm + term.km : null,
  };
}

export type WarrantyStatus = 'valid' | 'expired' | 'none';

/**
 * Coverage of one item today: `none` when no term applied; `expired` when past the date (inclusive end) OR past the km
 * (when the vehicle's current km is known); otherwise `valid`. A term with only a km limit and no known km stays valid.
 */
export function warrantyStatus(
  item: Pick<WarrantyItem, 'expiresOn' | 'expiresAtKm' | 'termVersionId'>,
  today: string,
  currentKm: number | null,
): WarrantyStatus {
  if (!item.termVersionId) return 'none';
  if (item.expiresOn && today > item.expiresOn) return 'expired';
  if (item.expiresAtKm !== null && currentKm !== null && currentKm > item.expiresAtKm)
    return 'expired';
  return 'valid';
}

/** Cost bearer recorded on a warranty intake (Q77 open; recorded only, never allocated automatically). */
export type WarrantyCostBearer = 'performing_branch' | 'origin_branch' | 'company';
export const WARRANTY_COST_BEARERS: readonly WarrantyCostBearer[] = [
  'performing_branch',
  'origin_branch',
  'company',
];

/**
 * Effective-dated `warranty-policy` (company default, branch override). Without a version the STRICT default holds:
 * a branch opens warranty work only on its own orders, and the performing branch records the cost (Q77).
 */
export interface WarrantyPolicy {
  crossBranchOpen: boolean;
  costBearer: WarrantyCostBearer;
}
export const STRICT_WARRANTY_POLICY: WarrantyPolicy = {
  crossBranchOpen: false,
  costBearer: 'performing_branch',
};

/** Link carried by an intake opened as warranty work (FR-REC-018: linked to the origin order and its items). */
export interface WarrantyLink {
  recordId: string;
  originOrderId: string;
  originOrderCode: string;
  originBranchId: string;
  itemIds: string[];
  costBearer: WarrantyCostBearer;
  crossBranch: boolean;
  policyVersionId: string | null;
}

/** The record written at handover (pure): one item per finished item, all with the term of the job's service type. */
export function buildWarrantyRecord(p: {
  tenantId: string;
  vehicleId: string;
  branchId: string;
  branchName: string;
  orderId: string;
  orderCode: string;
  serviceType: string | null;
  startDate: string;
  startKm: number | null;
  items: readonly { id: string; name: string; technicianId: string | null }[];
  term: (WarrantyTerm & { versionId: string }) | null;
  createdAt: Date;
}): WarrantyRecord {
  const exp = warrantyExpiry(p.startDate, p.startKm, p.term);
  return {
    id: warrantyRecordId(p.tenantId, p.orderId),
    tenantId: p.tenantId,
    vehicleId: p.vehicleId,
    branchId: p.branchId,
    branchName: p.branchName,
    orderId: p.orderId,
    orderCode: p.orderCode,
    serviceType: p.serviceType,
    startDate: p.startDate,
    startKm: p.startKm,
    items: p.items.map((i, n) => ({
      key: String(n + 1),
      itemId: i.id,
      name: i.name,
      technicianId: i.technicianId,
      ...exp,
      termVersionId: p.term?.versionId ?? null,
      ...(p.term?.conditions ? { conditions: p.term.conditions } : {}),
    })),
    createdAt: p.createdAt,
  };
}

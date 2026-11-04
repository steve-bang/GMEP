/** CRM entities (FR-CRM-001, 002, 004). Company-level records; branch access goes through links (BA §10). */

export type CustomerType = 'individual' | 'business';
export type CustomerStatus = 'active' | 'anonymized';

/** Customer labels offered in the UI (G2-CRM-01 filter). Free-form labels are not allowed. */
export const CUSTOMER_LABELS = ['vip', 'contract', 'no_marketing'] as const;
export type CustomerLabel = (typeof CUSTOMER_LABELS)[number];

export interface Customer {
  id: string;
  companyId: string;
  /** branch where the record was created (every business record carries its branch) */
  branchId: string;
  /** KH-<branch>-<seq>, never reused */
  code: string;
  type: CustomerType;
  /** individual: full name; business: legal entity name (needed on invoices) */
  name: string;
  nameNorm: string;
  taxCode?: string;
  /** contact person of a business customer */
  contactName?: string;
  labels: CustomerLabel[];
  status: CustomerStatus;
  /** denormalised: vehicles whose open ownership is this customer */
  vehicleCount: number;
  /** denormalised: channels with an active advertising consent (FR-CRM-013) */
  marketing: string[];
  /** branches with a relation to this customer (links), BA §10.1.5 */
  branchIds: string[];
  anonymizedAt?: Date;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** Contact data lives in its own document so it can be anonymised without touching the business record (DM-8). */
export interface CustomerPii {
  customerId: string;
  companyId: string;
  phone?: string;
  phoneNorm?: string;
  email?: string;
  address?: string;
  createdAt: Date;
}

export const customerLinkId = (customerId: string, branchId: string): string =>
  `${customerId}~${branchId}`;
export const vehicleLinkId = (vehicleId: string, branchId: string): string =>
  `${vehicleId}~${branchId}`;
export const plateKey = (companyId: string, plateNorm: string): string =>
  `${companyId}__${plateNorm}`;
/** C11: VIN registry slot, unique per company */
export const vinKey = (companyId: string, vin: string): string => `${companyId}__${vin}`;

/** How a branch came to have a relation with a customer (C2): kept for later access reviews. */
export const RELATION_SOURCES = [
  'created',
  'lookup_adopt',
  'appointment',
  'quote',
  'repair_order',
  /** C24: the vehicle arrived and an intake file was opened for it (REC) */
  'intake',
] as const;
export type RelationSource = (typeof RELATION_SOURCES)[number];

/** Which branches may see a customer in lists (relation = created at, or appointment/quote/order there). It never expires. */
export interface CustomerLink {
  id: string;
  companyId: string;
  customerId: string;
  branchId: string;
  nameNorm: string;
  type: CustomerType;
  code: string;
  /** C2: why and by whom the relation exists */
  source: RelationSource;
  createdBy: string;
  createdAt: Date;
}

export interface Vehicle {
  id: string;
  companyId: string;
  branchId: string;
  /** as typed, upper-case */
  plate: string;
  plateNorm: string;
  /** earlier plates after "đổi biển số" (G2-CRM-07) */
  previousPlates: { plate: string; until: string }[];
  vin?: string;
  engineNo?: string;
  make: string;
  model: string;
  year: number;
  /** FR-CRM-002: drives inspection-cycle reminders (FR-CRM-015 later) */
  isCommercial: boolean;
  lastKm?: number;
  lastKmAt?: string;
  /** C5: set when a lower odometer reading was recorded because the odometer was replaced (reports must not treat it as abnormal) */
  odometerReplacedAt?: string;
  currentOwnerId: string | null;
  /** branches with a relation to this vehicle */
  branchIds: string[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export interface VehicleLink {
  id: string;
  companyId: string;
  vehicleId: string;
  branchId: string;
  plateNorm: string;
  createdAt: Date;
}

/**
 * Cross-branch repair history projection (FR-CRM-004, BA §10.2 P3, ba-answers-for-dev §10). This type
 * IS the white list: it has no payment, debt, discount, cost, mechanic, internal note, media or
 * customer phone field, so a producer cannot leak them. REC writes one entry per repair order.
 */
export interface VehicleHistoryEntry {
  /** `${sourceType}:${sourceId}`, deterministic so projection updates are idempotent */
  id: string;
  companyId: string;
  vehicleId: string;
  branchId: string;
  branchName: string;
  /** shown only; the source order cannot be opened from another branch */
  orderCode: string;
  /** yyyy-MM-dd of the visit */
  date: string;
  km?: number;
  items: string[];
  parts: { name: string; qty: number }[];
  /**
   * integer VND; C6: the sum of the order's item prices BEFORE order-level discount and BEFORE tax,
   * never the amount the customer pays (that would reveal another branch's discount policy).
   * Shown only when config `historyShowPrice` (BA P3 [Cần xác nhận: Chủ dự án])
   */
  totalVnd?: number;
  /** projection rebuild marker */
  projectedAt: Date;
}

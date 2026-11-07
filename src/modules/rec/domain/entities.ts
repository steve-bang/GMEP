import type { WarrantyLink } from './warranty';

/**
 * REC domain entities (slice 1.5, first part): intake (hồ sơ tiếp nhận) and quote. A quote, a repair
 * order, a repair item, a payment and an invoice are FIVE objects with FIVE state sets; nothing here
 * shares a status field with the order (RULE-005/006, ba-answers-03 Câu 1). Money is integer VND.
 */

export type IntakeStatus = 'draft' | 'completed' | 'cancelled';
export const INTAKE_STATUSES: readonly IntakeStatus[] = ['draft', 'completed', 'cancelled'];

/** Quote states (user-journey §7): "sent" is labelled "Chờ khách duyệt" in the UI. */
export type QuoteStatus =
  'draft' | 'sent' | 'approved_full' | 'approved_partial' | 'rejected' | 'expired';
export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  'draft',
  'sent',
  'approved_full',
  'approved_partial',
  'rejected',
  'expired',
];

/** R10: delivery of the quote to the customer. `sms`, `zalo` and `email` are set only after the gateway accepted the message (A4). */
export type SentVia = 'none' | 'print' | 'link' | 'counter' | 'sms' | 'zalo' | 'email';
export const SENT_VIA: readonly SentVia[] = [
  'none',
  'print',
  'link',
  'counter',
  'sms',
  'zalo',
  'email',
];

export type KmReason = 'typo' | 'odometer_replaced' | 'other';
export type Necessity = 'required' | 'optional';

/**
 * R7: a service type is the CODE of an entry of the company `service-type` catalogue (BR-REC-13,
 * FR-REC-032), never a label fixed in code; the workflow behind each type is configuration (later).
 */
export type ServiceTypeCode = string;

export const FUEL_LEVELS = ['empty', 'quarter', 'half', 'three_quarters', 'full'] as const;
export type FuelLevel = (typeof FUEL_LEVELS)[number];

export const BELONGINGS = [
  'registration',
  'parking_card',
  'dashcam',
  'spare_tire',
  'toolkit',
  'extinguisher',
] as const;

export interface CustomerPart {
  name: string;
  qty: number;
  condition: string;
}

/** A photo kept on an intake or an order: the bytes live in the FileStore, only this reference is stored. */
export interface PhotoRef {
  /** `ph_<first 20 hex of the content hash>`: the same bytes on the same record are one photo (idempotent) */
  id: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
  sha256: string;
  caption?: string;
  /** the technician's proposal this photo documents (FR-REC-014) */
  proposalId?: string;
  takenBy: string;
  takenAt: Date;
  /**
   * R104: a wrongly uploaded photo is hidden, never deleted (evidence): reason required, audited. A hidden photo is not
   * listed and is served only to someone who may hide photos; the file stays until the retention period.
   */
  hidden?: { at: Date; by: string; reason: string };
}

export interface Intake {
  id: string;
  tenantId: string;
  branchId: string;
  /** TX-<branch>-<yymm>-<seq>, allocated at creation (group A) */
  number: string;
  status: IntakeStatus;
  vehicleId: string;
  customerId: string;
  /** snapshots so lists need no join and no personal data (phone, address) is copied */
  plate: string;
  plateNorm: string;
  vehicleLabel: string;
  customerName: string;
  /** vehicle odometer known when the intake was opened */
  lastKmAtOpen: number | null;
  /** furthest wizard step saved (1..5) */
  step: number;
  km?: number;
  kmReason?: KmReason;
  kmNote?: string;
  /** FR-REC-003: the reading dropped by more than the configured threshold; the manager reviews it */
  kmAbnormal?: boolean;
  fuel?: FuelLevel;
  customerRequest?: string;
  condition?: string;
  belongings: string[];
  belongingsOther?: string;
  serviceType?: ServiceTypeCode;
  advisorId: string;
  /** dd/MM/yyyy as ISO date */
  promisedDate?: string;
  promisedTime?: string;
  customerParts: CustomerPart[];
  photos?: PhotoRef[];
  internalNote?: string;
  /** slice 2.8b (FR-REC-027): set when the intake was opened by "Đã đến" on an appointment */
  appointmentId?: string;
  /** slice 2.8b (FR-REC-018, 036): warranty work linked to the origin order and items */
  warranty?: WarrantyLink;
  quoteId?: string;
  cancelReason?: string;
  completedAt?: Date;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

// ---- quote -------------------------------------------------------------------------------

interface LineBase {
  lineNo: number;
  code: string;
  name: string;
  /** list price per hour (labor) or per displayed unit (part), before any discount */
  listUnitVnd: number;
  /** actual price per hour or per unit (RULE: cost, list and actual price are separate numbers) */
  unitVnd: number;
  /** ceil((list - actual) / list) in basis points, 0 when not discounted */
  discountBp: number;
  /** quantity x actual price, rounded half up to an integer VND */
  amountVnd: number;
  /** tax rate in force on the pricing date (basis points of an integer, no floats) */
  taxRateBp: number;
  /** R2: the `tax-rate` key this line used (via the `tax-mapping` config) and the version id it was read from */
  taxKey: string;
  taxVersionId: string;
}

export interface LaborLine extends LineBase {
  kind: 'labor';
  serviceId: string;
  minutes: number;
  standardMinutes: number;
  /** R5: minutes - standardMinutes (signed); the standard hours are also an input of the technician's pay, so the gap must be reportable */
  minutesDelta: number;
  /** R5: the gap in basis points of the standard hours (signed, 0 when equal) */
  minutesDeltaBp: number;
  /** R5: "khác giờ chuẩn", stored with the line */
  differsFromStandard: boolean;
  /** config versions the price was read from (price snapshot, FR-REC-031) */
  rateVersionId: string;
  hoursVersionId: string;
}

export interface PartLine extends LineBase {
  kind: 'part';
  partId: string;
  qty: number;
  /** I4: stored qty / scale = displayed quantity */
  qtyScale: number;
  priceListCode: string;
  priceVersionId: string;
}

export type QuoteLine = LaborLine | PartLine;

/** The unit of approval (ba-answers-03 Câu 2): one item = labor and parts that go together. */
export interface QuoteItem {
  no: number;
  name: string;
  necessity: Necessity;
  /** advisor flag "Khách đã yêu cầu": an optional item the customer asked for starts selected */
  customerRequested: boolean;
  /** default selection shown to the customer; the customer's own choice is recorded at approval (later) */
  selected: boolean;
  lines: QuoteLine[];
  /** sum of line amounts, before tax */
  subtotalVnd: number;
}

export interface QuoteTotals {
  /** BA C6: total of the items, before any order-level discount and before tax */
  subtotalVnd: number;
  taxVnd: number;
  totalVnd: number;
  /** same three numbers over the items selected by default (FR-REC-007) */
  selectedSubtotalVnd: number;
  selectedTaxVnd: number;
  selectedTotalVnd: number;
}

export interface TaxSnapshot {
  /** the `tax-rate` config key */
  key: string;
  versionId: string;
  name: string;
  rateBp: number;
  effectiveFrom: string;
}

/** FR-REC-009 / FR-REC-026: how the approval was given. OTP is not offered until an SMS channel is active (QUO-04/05). */
export type ApprovalMethod = 'link' | 'counter_signature' | 'counter_verbal';
export const APPROVAL_METHODS: readonly ApprovalMethod[] = [
  'link',
  'counter_signature',
  'counter_verbal',
];

/** An item the customer did NOT approve; a refused required item keeps the safety flag for the reminder list (BR-REC-11). */
export interface DeclinedItem {
  itemNo: number;
  name: string;
  necessity: Necessity;
  /** `decline-reason` catalogue code; mandatory for a refused required item */
  reasonCode?: string;
  reasonNote?: string;
  /** "Từ chối hạng mục bắt buộc" in the evidence */
  safety: boolean;
  subtotalVnd: number;
}

/**
 * The part of an approved version that the repair order (slice 1.6) is built from. `lineKey` is immutable
 * (quote id, version, item, line) and is the key the stock hold and the goods issue carry (I20, BA §17).
 */
export interface ApprovedLine {
  lineKey: string;
  itemNo: number;
  itemName: string;
  lineNo: number;
  kind: 'labor' | 'part';
  code: string;
  name: string;
  serviceId?: string;
  partId?: string;
  /** labor minutes or part quantity (stored scale, see qtyScale) */
  minutes?: number;
  qty?: number;
  qtyScale?: number;
  unitVnd: number;
  amountVnd: number;
  taxKey: string;
  taxVersionId: string;
  taxRateBp: number;
  /** the price version the line was priced with: `price-item` version (parts) or labor-rate version (labor) */
  priceVersionId: string;
  /** labor lines: the standard-hours version too */
  hoursVersionId?: string;
}

/** FR-REC-009: evidence of the approval, written once with the status change and never edited. */
export interface QuoteApproval {
  method: ApprovalMethod;
  mode: 'full' | 'partial';
  decidedAt: Date;
  /** the staff member who recorded it; null = the customer through the tokenised link */
  recordedBy: string | null;
  /** R29: CV or QL, the role the person acted in at the working branch */
  recordedByRole?: string;
  /** link id (token hash prefix) for `link` */
  linkId?: string;
  approvedItemNos: number[];
  declined: DeclinedItem[];
  /** totals of the approved items only, tax recomputed on that set (UAT-17), never prorated */
  approvedSubtotalVnd: number;
  approvedTaxVnd: number;
  approvedTotalVnd: number;
  lines: ApprovedLine[];
  /** counter signature: who signed and the paper/screen reference */
  signerName?: string;
  evidenceRef?: string;
  /** verbal approval: note, "đã đọc lại" tick; such an approval is an exception for the manager's review */
  note?: string;
  readBack?: boolean;
  exception: boolean;
  /** QUO-04/05: the one-time code sent to the customer's contact on file was verified before this approval (never the code itself) */
  otp?: { verifiedAt: Date; channel: 'sms' | 'zalo' | 'email' };
  /** SHA-256 over the canonical evidence: business evidence, NOT a digital signature */
  hash: string;
}

export interface QuoteVersion {
  id: string;
  quoteId: string;
  tenantId: string;
  branchId: string;
  n: number;
  status: QuoteStatus;
  items: QuoteItem[];
  totals: QuoteTotals;
  /** R2: one entry per distinct tax key used by the lines (empty while the version has no lines) */
  taxes: TaxSnapshot[];
  /** business date the prices and the tax rate were read on */
  pricedOn: string;
  note?: string;
  sentAt?: Date;
  sentBy?: string;
  /** end of validity once sent (config days) */
  validUntil?: string;
  /**
   * R10: how the customer was (or will be) told. `none` = frozen but nothing delivered yet; there is no
   * real channel yet, so the UI must never say a message was sent for `none`.
   */
  sentVia?: SentVia;
  /** set when a later version was sent (a replaced version is read-only, ba-answers-03 Câu 1) */
  replacedAt?: Date;
  replacedByN?: number;
  rejectedAt?: Date;
  rejectReason?: string;
  /** who refused: the staff member, or null for the customer link */
  rejectedBy?: string | null;
  /** R47: a supplementary quote closed because its order closed (completed or cancelled) */
  closedAt?: Date;
  closedReason?: string;
  /** FR-REC-009: set once when the version is approved (fully or partly); locks the content */
  approval?: QuoteApproval;
  /** hash of the live customer link (a rotated link replaces it); the raw token is never stored */
  linkHash?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** FR-REC-008: a tokenised, expiring, login-free link to ONE version of a quote. The token is never stored, only its SHA-256. */
export interface QuoteLink {
  /** SHA-256 hex of the token */
  id: string;
  tenantId: string;
  branchId: string;
  quoteId: string;
  n: number;
  createdAt: Date;
  createdBy: string;
  /** replaced by a newer link or the version was decided/superseded */
  revokedAt?: Date;
  revokedReason?: string;
  /** set on the first successful decision made through it */
  usedAt?: Date;
  /** the message delivery this link was minted for (it is live but not the version's current link until delivered) */
  deliveryId?: string;
}

export interface Quote {
  id: string;
  tenantId: string;
  branchId: string;
  /** BG-<branch>-<yymm>-<seq>; versions are the suffix -vN and never use a new number */
  number: string;
  /** source document (RULE-007): the quote exists for one intake */
  intakeId: string;
  vehicleId: string;
  customerId: string;
  plate: string;
  plateNorm: string;
  vehicleLabel: string;
  customerName: string;
  advisorId: string;
  /** slice 1.6: a supplementary quote extends this repair order when approved (RULE-005/006) */
  supplementOfOrderId?: string;
  /** the repair order opened from this quote's approval (R37); absent = approved but no order yet */
  orderId?: string;
  /** latest version number; the quote's status is the status of this version */
  currentN: number;
  status: QuoteStatus;
  /** R10: end of validity of the current version once sent; lets lists derive "Hết hạn" without loading versions */
  validUntil?: string;
  /** R10/R17: the `validUntil` the advisor was already reminded about (background job); makes the reminder once per version */
  remindedFor?: string;
  totalVnd: number;
  /** total of the approved items once approved (tax included); the order is worth this, not `totalVnd` */
  approvedTotalVnd?: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export const versionId = (quoteId: string, n: number): string => `${quoteId}__v${n}`;

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

/** R10: delivery of the quote to the customer. Only `print` and `counter` exist until a message channel is built. */
export type SentVia = 'none' | 'print' | 'link' | 'counter';
export const SENT_VIA: readonly SentVia[] = ['none', 'print', 'link', 'counter'];

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

export interface Intake {
  id: string;
  companyId: string;
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
  internalNote?: string;
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

export interface QuoteVersion {
  id: string;
  quoteId: string;
  companyId: string;
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
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export interface Quote {
  id: string;
  companyId: string;
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
  /** latest version number; the quote's status is the status of this version */
  currentN: number;
  status: QuoteStatus;
  /** R10: end of validity of the current version once sent; lets lists derive "Hết hạn" without loading versions */
  validUntil?: string;
  totalVnd: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export const versionId = (quoteId: string, n: number): string => `${quoteId}__v${n}`;

/**
 * INV entities (FR-INV-001..027). Parts are company-level master data; balances, movements,
 * documents and reservations are branch records (every one carries branchId, creator and time).
 * Quantities are whole numbers; money is integer VND (RULE-010: no floats).
 */
import type { PartGroup, PartUnit } from './normalize';

export type PartStatus = 'active' | 'inactive';

export interface Part {
  id: string;
  companyId: string;
  /** as normalised: upper-case, no spaces (unique across the chain through partCodeKey) */
  code: string;
  codeKey: string;
  name: string;
  nameNorm: string;
  brand: string;
  unit: PartUnit;
  group: PartGroup;
  barcode?: string;
  /** compatible vehicle lines, display text ("Toyota Vios") and their search keys */
  compat: string[];
  compatKeys: string[];
  status: PartStatus;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export const balanceId = (warehouseId: string, partId: string): string =>
  `${warehouseId}__${partId}`;

/**
 * The four numbers of RULE-008 for one warehouse x part, plus the value that backs the cost.
 * `available` is derived (onHand - reserved), never stored: in-transit stock is not available
 * in either branch until received.
 */
export interface StockBalance {
  id: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  partId: string;
  partCode: string;
  partCodeNorm: string;
  partName: string;
  onHand: number;
  reserved: number;
  inTransit: number;
  /** total value of on-hand units (integer VND) under the active cost method */
  valueVnd: number;
  /** reorder level and target (G3-INV-02); null = not set, no alert (BA-04 Câu 7) */
  minQty: number | null;
  maxQty: number | null;
  /** available <= minQty (maintained on every write; queried by the reorder list) */
  lowStock: boolean;
  /** onHand, reserved or inTransit is not zero (blocks deactivating the warehouse) */
  nonZero: boolean;
  /** increments on every change; movements keep the value they produced */
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

export type MovementKind =
  'receipt' | 'issue' | 'return' | 'adjust' | 'reserve' | 'release' | 'reversal';

/** Append-only ledger row (RULE-009): the stock card is this list. Never updated, never deleted. */
export interface StockMovement {
  id: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  partId: string;
  partCode: string;
  kind: MovementKind;
  /** stock document or reservation that caused it (FR-INV-021: every change traces to a document) */
  documentId: string | null;
  documentNo: string | null;
  reservationId: string | null;
  lineNo: number | null;
  sourceType: string | null;
  sourceId: string | null;
  onHandDelta: number;
  reservedDelta: number;
  inTransitDelta: number;
  valueDeltaVnd: number;
  /** per-unit cost of the movement (0 for reservation movements) */
  unitCostVnd: number;
  onHandAfter: number;
  reservedAfter: number;
  inTransitAfter: number;
  valueAfterVnd: number;
  seq: number;
  at: Date;
  businessDate: string;
  actorId: string;
  note?: string;
}

// ---- documents -------------------------------------------------------------------------

export const DOC_TYPES = ['GRN', 'GIN', 'RTN', 'ADJ'] as const;
export type StockDocType = (typeof DOC_TYPES)[number];
export type StockDocStatus = 'draft' | 'posted' | 'cancelled';

/** Numbering series per document type (BA §6.3: PN, PX, HK, DC; group B, number at posting). */
export const DOC_SERIES: Record<StockDocType, string> = {
  GRN: 'goods-receipt',
  GIN: 'goods-issue',
  RTN: 'stock-return-in',
  ADJ: 'stock-adjustment',
};

export const GRN_SOURCES = ['purchase-order', 'urgent-purchase', 'no-po'] as const;
export const GIN_SOURCES = ['repair-order', 'retail-sale', 'transfer-order'] as const;
export const RTN_SOURCES = ['repair-order'] as const;
export const ADJ_SOURCES = ['opening-balance', 'manual-adjustment'] as const;

export const SOURCES_BY_TYPE: Record<StockDocType, readonly string[]> = {
  GRN: GRN_SOURCES,
  GIN: GIN_SOURCES,
  RTN: RTN_SOURCES,
  ADJ: ADJ_SOURCES,
};

export interface StockDocLine {
  lineNo: number;
  partId: string;
  partCode: string;
  partName: string;
  /** GRN/GIN/RTN: positive. ADJ: signed, never zero. */
  qty: number;
  /** GRN and positive ADJ: entered. After posting: the actual per-unit cost of every type. */
  unitCostVnd?: number;
  /** GRN against a purchase order: what the order says (variance check, FR-INV-005) */
  expectedQty?: number;
  expectedUnitCostVnd?: number;
  /** GIN: reservation line key; defaults to the part id */
  reservationKey?: string;
  /** RTN: line of the original GIN */
  originalLineNo?: number;
  /** value of the line after posting (signed like the stock change) */
  valueVnd?: number;
  note?: string;
}

export interface StockDocSource {
  type: string;
  id: string | null;
}

export interface StockDocument {
  id: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  type: StockDocType;
  status: StockDocStatus;
  /** official number, set at posting (group B); null while draft */
  number: string | null;
  /** temporary reference printed as "Nháp" until posted (BA §6.2) */
  draftRef: string;
  businessDate: string | null;
  source: StockDocSource;
  reason?: string;
  /** GIN for a repair order: the technician who receives the parts (FR-INV-007) */
  receiverUserId?: string;
  /** RTN: the GIN being returned against */
  originalDocumentId?: string;
  lines: StockDocLine[];
  totalValueVnd: number;
  /** why posting needed a manager (variance, adjustment, no purchase order) */
  approvalReasons: string[];
  postedAt?: Date;
  postedBy?: string;
  /** posted document that cancels another one (RULE-010) */
  reversalOf?: string;
  reversedBy?: string;
  cancelReason?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** Deterministic id of the reversal of a posted document: a second reversal cannot be created. */
export const reversalId = (documentId: string): string => `${documentId}~rev`;

// ---- reservations ----------------------------------------------------------------------

export const RESERVATION_SOURCES = ['quote', 'repair-order'] as const;
export type ReservationSourceType = (typeof RESERVATION_SOURCES)[number];
export type ReservationStatus = 'holding' | 'fulfilled' | 'released';

export interface Reservation {
  id: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  partId: string;
  partCode: string;
  sourceType: ReservationSourceType;
  sourceId: string;
  /** the line of the quote/order this hold belongs to */
  lineKey: string;
  /** quantity the source needs in total (issued + still held) */
  qty: number;
  /** currently held in the balance's reserved number */
  heldQty: number;
  issuedQty: number;
  status: ReservationStatus;
  /** number of movements written for this hold (movement ids are reservationId#n) */
  opCount: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** Deterministic: the same (source, line, warehouse) always addresses the same hold, so retries cannot double-reserve. */
export const reservationId = (
  sourceType: string,
  sourceId: string,
  lineKey: string,
  warehouseId: string,
): string => `rsv_${sourceType}~${sourceId}~${lineKey}~${warehouseId}`;

/** How much of a GIN line is returned so far (RTN cannot return more than was issued). */
export const issueReturnId = (documentId: string, lineNo: number): string =>
  `${documentId}~${lineNo}`;

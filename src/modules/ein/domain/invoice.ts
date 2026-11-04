/**
 * E-invoice entities (slice 1.8, FR-EIN-001..013). The invoice is its OWN object with its own state set, separate from the
 * repair order and the payment (RULE-005/007; ba-answers-03 Câu 1): the order never carries an invoice status. Money is integer VND.
 * The invoice NUMBER comes from the provider or the tax authority, never from an internal series; the internal `YH-...`
 * number belongs to the issue REQUEST.
 */

export type InvoicePurpose = 'issue' | 'adjust' | 'replace' | 'cancel';
export const INVOICE_PURPOSES: readonly InvoicePurpose[] = ['issue', 'adjust', 'replace', 'cancel'];

export type InvoiceDocType = 'original' | 'adjustment' | 'replacement';

/**
 * Invoice states (the status of the DOCUMENT, G4-EIN-01 "Chưa xuất / Đã xuất / Hủy"; adjustment and replacement are
 * document TYPES shown as badges). `abandoned` = the issue request was cancelled before the provider created anything.
 */
export type InvoiceStatus = 'not_issued' | 'issued' | 'cancelled' | 'abandoned';
export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'not_issued',
  'issued',
  'cancelled',
  'abandoned',
];

/** The sync indicator shown NEXT to the status (ba-decisions A.2): it is not a sixth badge and not a state of the document. */
export type SyncState = 'queued' | 'sending' | 'waiting_query' | 'failed' | 'synced';

export type BuyerKind = 'retail' | 'business';

/** The buyer as printed on the invoice. Address and e-mail are personal data and live in `InvoicePii`. */
export interface InvoiceBuyer {
  kind: BuyerKind;
  name: string;
  taxCode?: string;
}
export interface InvoicePii {
  /** = invoice id */
  id: string;
  companyId: string;
  branchId: string;
  address?: string;
  email?: string;
}

/** FR-EIN-001: what the order was invoiced from; the tax key and version are those stored on the approved line. */
export interface InvoiceLine {
  no: number;
  description: string;
  /** shown quantity for per-line mode (stored scale applied); absent for aggregated lines */
  quantityText?: string;
  netVnd: number;
  rateBp: number;
  taxKey: string;
  taxVersionId: string;
}

export interface TaxSummaryRow {
  rateBp: number;
  taxKey: string;
  taxVersionId: string;
  netVnd: number;
  taxVnd: number;
}

export interface IssuerSnapshot {
  configVersionId: string;
  providerCode: string;
  environment: 'test' | 'live';
  sellerName: string;
  sellerTaxCode: string;
  sellerAddress?: string;
  /** ký hiệu hóa đơn, e.g. C26TAA */
  symbol: string;
  /** loại hóa đơn: VAT invoice or sales invoice (Phụ lục I Thông tư 91/2026 [Cần kế toán xác nhận]) */
  invoiceType: 'vat' | 'sales';
  templateCode: string;
}

export interface InvoiceHistoryEntry {
  at: Date;
  event: string;
  by: string | null;
  note?: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  plate: string;
  customerId: string;
  docType: InvoiceDocType;
  status: InvoiceStatus;
  sync: SyncState;
  syncError?: { kind: string; code: string; message: string };
  /** adjustment / replacement: the invoice it corrects (never edited, FR-EIN-007) */
  originalInvoiceId?: string;
  requestId: string;
  requestNumber: string;
  issuer: IssuerSnapshot;
  buyer: InvoiceBuyer;
  lineMode: 'per-rate' | 'per-line';
  lines: InvoiceLine[];
  taxSummary: TaxSummaryRow[];
  /** signed for an adjustment that lowers the value */
  netVnd: number;
  taxVnd: number;
  totalVnd: number;
  providerInvoiceId?: string;
  number?: string;
  taxAuthorityCode?: string;
  issuedAt?: Date;
  providerStatus?: string;
  /** originals only: the adjustment invoices made for it, and the replacement */
  adjustedBy: string[];
  replacedBy?: string;
  cancelledAt?: Date;
  cancelReason?: string;
  artifactsReady: boolean;
  /** the buyer asked for a correction by the cashier ("Báo kế toán hóa đơn này có sai") */
  history: InvoiceHistoryEntry[];
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export type RequestStatus =
  | 'pending'
  | 'sending'
  | 'awaiting_provider'
  | 'unknown'
  | 'failed_data'
  | 'failed_provider'
  | 'succeeded'
  | 'cancelled';
export const REQUEST_STATUSES: readonly RequestStatus[] = [
  'pending',
  'sending',
  'awaiting_provider',
  'unknown',
  'failed_data',
  'failed_provider',
  'succeeded',
  'cancelled',
];

export type ErrorKind = 'data' | 'rejected' | 'timeout' | 'unavailable';

export interface RequestAttempt {
  n: number;
  at: Date;
  /** what was done: ask the provider first, or send */
  phase: 'query' | 'send';
  outcome: 'ok' | 'processing' | 'not_found' | ErrorKind;
  code?: string;
  message?: string;
}

export interface InvoiceRequest {
  id: string;
  companyId: string;
  branchId: string;
  /** YH-<BRANCH>-<YYMM>-<seq> (numbering series `invoice-request`, group A) */
  number: string;
  purpose: InvoicePurpose;
  orderId: string;
  orderNumber: string;
  /** the invoice this request creates (issue, adjust, replace) or acts on (cancel) */
  invoiceId: string;
  /** correction requests: the invoice being corrected */
  targetInvoiceId?: string;
  approvalId?: string;
  reasonCode?: string;
  reason?: string;
  /** the stable key sent to the provider with every attempt; the business uniqueness guard (FR-EIN-013), no expiry */
  idempotencyKey: string;
  status: RequestStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: Date;
  /** a `sending` request whose lease ran out is treated as unknown (the process died or the call hung) */
  sendingUntil?: Date;
  lastError?: { kind: ErrorKind; code: string; message: string };
  attempts: RequestAttempt[];
  valueVnd: number;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** One document per order: what the order has been invoiced with (lookup by key, no query, R68). */
export interface OrderInvoiceIndex {
  /** = order id */
  id: string;
  companyId: string;
  branchId: string;
  orderNumber: string;
  /** how many ISSUE requests were opened (a cancelled one allows the next round) */
  rounds: number;
  issueRequestId: string | null;
  /** the effective invoice: the original, or the replacement once it is issued; null after a cancel */
  validInvoiceId: string | null;
  invoiceIds: string[];
  requestIds: string[];
  updatedAt: Date;
  version: number;
}

export const issueRequestId = (orderId: string, round: number): string =>
  `${orderId}__issue__${round}`;
export const correctionRequestId = (
  invoiceId: string,
  purpose: InvoicePurpose,
  approvalId: string,
): string => `${invoiceId}__${purpose}__${approvalId}`;
/** the provider-facing key: opaque, stable, unique per request */
export const idempotencyKeyOf = (companyId: string, requestId: string): string =>
  `gmep:${companyId}:${requestId}`.slice(0, 120);
export const invoiceIdOf = (requestId: string): string => `inv_${requestId}`;

/** Bounded queue document of a branch (R68 rule 3: read by key, never queried). */
export interface QueueItem {
  requestId: string;
  number: string;
  purpose: InvoicePurpose;
  orderId: string;
  orderNumber: string;
  invoiceId: string;
  status: RequestStatus;
  errorKind?: ErrorKind;
  errorCode?: string;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: Date;
  valueVnd: number;
  createdAt: Date;
}
export interface InvoiceQueue {
  /** = branch id */
  id: string;
  companyId: string;
  branchId: string;
  items: Record<string, QueueItem>;
  updatedAt: Date;
  version: number;
}

export interface InvoiceArtifacts {
  /** = invoice id */
  id: string;
  companyId: string;
  branchId: string;
  xmlPath: string;
  pdfPath: string;
  xmlSha256: string;
  pdfSha256: string;
  xmlBytes: number;
  pdfBytes: number;
  storedAt: Date;
}

/** The documents of an order that count as the order's invoice history, oldest first (FR-EIN-007 "xem theo thứ tự"). */
export const sortVersions = <T extends { createdAt: Date; id: string }>(rows: readonly T[]): T[] =>
  [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );

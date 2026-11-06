import type { Page } from '@/platform/pagination/pagination';
import type { Actor } from '@/platform/rbac/rbac';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { PartRequest, PartRequestStatus, RepairItem, RepairOrder } from '../domain/order';
import type { OrderStatus } from '../domain/orderState';
import type {
  Intake,
  IntakeStatus,
  Quote,
  QuoteLink,
  QuoteStatus,
  QuoteVersion,
} from '../domain/entities';
import type { MessageQueue, QuoteDelivery, QuoteOtpRecord } from '../domain/messaging';

type Cursor = { v: string; id: string };
export interface PageQuery {
  limit: number;
  cursor?: Cursor;
}

/** Every read takes a Scope (NFR-ISO-01): intakes, quotes and versions are branch records. */
export interface IntakeRepository {
  list(
    scope: Scope,
    q: PageQuery & {
      status?: IntakeStatus;
      platePrefix?: string;
      numberPrefix?: string;
    },
  ): Promise<Page<Intake>>;
  get(scope: Scope, id: string): Promise<Intake | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Intake | null>;
  /** C17: company-wide (retention gate), no scope: only counts, never returned to a user */
  listByCustomer(
    tenantId: string,
    customerId: string,
    status: IntakeStatus,
    limit: number,
  ): Promise<Intake[]>;
  create(tx: Tx, i: Intake): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface QuoteRepository {
  list(
    scope: Scope,
    q: PageQuery & {
      status?: QuoteStatus;
      platePrefix?: string;
      numberPrefix?: string;
    },
  ): Promise<Page<Quote>>;
  get(scope: Scope, id: string): Promise<Quote | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Quote | null>;
  listByCustomer(
    tenantId: string,
    customerId: string,
    status: QuoteStatus,
    limit: number,
  ): Promise<Quote[]>;
  create(tx: Tx, q: Quote): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface QuoteVersionRepository {
  get(scope: Scope, id: string): Promise<QuoteVersion | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<QuoteVersion | null>;
  /** versions 1..n of one quote, oldest first, inside the scope */
  listByQuote(scope: Scope, quoteId: string, count: number): Promise<QuoteVersion[]>;
  create(tx: Tx, v: QuoteVersion): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

/**
 * FR-REC-008: customer links, keyed by the SHA-256 of the token. `find*` take no Scope on purpose: the
 * token IS the capability and the record names the one branch it grants (the caller then reads the quote
 * with a Scope narrowed to that branch). Staff-side writes (`create`, `update`) happen inside the
 * transaction of a Scope-checked use case.
 */
export interface QuoteLinkRepository {
  find(hash: string): Promise<QuoteLink | null>;
  findInTx(tx: Tx, hash: string): Promise<QuoteLink | null>;
  create(tx: Tx, l: QuoteLink): void;
  update(tx: Tx, hash: string, patch: Record<string, unknown>): void;
}

/**
 * A4: the one-time code of an approval attempt, keyed by the link hash. Like the link, the token is the capability,
 * so reads take no Scope; writes happen in the transaction of a use case that already resolved the link.
 */
export interface QuoteOtpRepository {
  get(linkId: string): Promise<QuoteOtpRecord | null>;
  getInTx(tx: Tx, linkId: string): Promise<QuoteOtpRecord | null>;
  /** upsert: a new code replaces the previous one of the link */
  set(tx: Tx, r: QuoteOtpRecord): void;
  update(tx: Tx, linkId: string, patch: Record<string, unknown>): void;
  delete(tx: Tx, linkId: string): void;
}

/** A4: deliveries of the quote link and the per-branch queue the retry job reads (both by key, Scope-checked). */
export interface QuoteDeliveryRepository {
  get(scope: Scope, id: string): Promise<QuoteDelivery | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<QuoteDelivery | null>;
  create(tx: Tx, d: QuoteDelivery): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
  getQueue(scope: Scope, branchId: string): Promise<MessageQueue | null>;
  getQueueInTx(tx: Tx, scope: Scope, branchId: string): Promise<MessageQueue | null>;
  saveQueue(tx: Tx, q: MessageQueue): void;
}

// ---- slice 1.6: repair orders, items and part requests --------------------------------------------

export interface RepairOrderRepository {
  list(
    scope: Scope,
    q: PageQuery & { status?: OrderStatus; platePrefix?: string; numberPrefix?: string },
  ): Promise<Page<RepairOrder>>;
  /** open orders (not completed, not cancelled) of the scope, oldest first: the dispatch board and the shortage view */
  listOpen(scope: Scope, limit: number): Promise<RepairOrder[]>;
  get(scope: Scope, id: string): Promise<RepairOrder | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<RepairOrder | null>;
  /** by ids, inside the company (advisor lookup for INV notices); missing ids are absent */
  getMany(tenantId: string, ids: readonly string[]): Promise<RepairOrder[]>;
  /** C17: company-wide retention gate, only counts */
  listOpenByCustomer(tenantId: string, customerId: string, limit: number): Promise<RepairOrder[]>;
  create(tx: Tx, o: RepairOrder): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface RepairItemRepository {
  get(scope: Scope, id: string): Promise<RepairItem | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<RepairItem | null>;
  listByOrder(scope: Scope, orderId: string, limit: number): Promise<RepairItem[]>;
  listByOrderInTx(tx: Tx, scope: Scope, orderId: string, limit: number): Promise<RepairItem[]>;
  /** the technician's active items inside the scope */
  listActiveByTechnician(scope: Scope, technicianId: string, limit: number): Promise<RepairItem[]>;
  create(tx: Tx, i: RepairItem): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface PartRequestRepository {
  get(scope: Scope, id: string): Promise<PartRequest | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<PartRequest | null>;
  listByOrder(scope: Scope, orderId: string, limit: number): Promise<PartRequest[]>;
  listByOrderInTx(tx: Tx, scope: Scope, orderId: string, limit: number): Promise<PartRequest[]>;
  /** requests waiting for the storekeeper, oldest first */
  listByStatus(scope: Scope, status: PartRequestStatus, limit: number): Promise<PartRequest[]>;
  create(tx: Tx, r: PartRequest): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

// ---- slice 1.7: payments (ACC) as REC sees them --------------------------------------------------------------

/** What the handover needs to know about the money of an order (R44). REC never computes it: ACC owns it. */
export interface OrderPaymentSnapshot {
  receivableVnd: number;
  receivedVnd: number;
  outstandingVnd: number;
  depositHeldVnd: number;
  /** an approved, still open debt of the order (amount, due date) */
  debt: { id: string; amountVnd: number; dueDate: string; approvalId: string } | null;
}

/**
 * Port to ACC, implemented by the composition root. `balanceInTx` runs INSIDE the handover transaction (the
 * figures are read again at the moment of writing, never trusted from the browser) and throws when ACC cannot answer.
 */
export interface PaymentGate {
  balanceInTx(tx: Tx, scope: Scope, orderId: string): Promise<OrderPaymentSnapshot>;
}

/**
 * R75: "does the order have an effective invoice?" asked of EIN. Implemented by the composition root over EIN's
 * `hasValidInvoice`; this module never imports EIN. Throws when EIN cannot answer: callers then BLOCK (fail closed).
 */
export interface OrderInvoiceGate {
  hasValidInvoice(scope: Scope, orderId: string): Promise<boolean>;
}

// ---- slice 2.6a: technician labor (HRM) as REC sees it ---------------------------------------------------------

/**
 * FR-HRM-007, 008: labor is recorded around the quality check, in REC's own transaction. HRM is never imported by REC:
 * the composition root bridges this port to HRM. Each `prepare*` does its READS and returns a `commit()` that stages the
 * writes, so REC calls every prepare before its first write (Firestore) and then commits (same pattern as stock release).
 * The bridge never refuses a QC for a missing rule: the labor line carries a warning instead.
 */
export interface LaborStaged {
  commit(): void;
}
export interface LaborQcCall {
  tx: Tx;
  scope: Scope;
  actor: Actor;
  ctx: { requestId: string; idempotencyKey?: string };
  order: RepairOrder;
  /** every item of the order */
  items: readonly RepairItem[];
  at: Date;
  businessDate: string;
}
export interface LaborGate {
  /** QC passed: labor of the finished items */
  prepareQcPass(c: LaborQcCall & { qcRun: number }): Promise<LaborStaged>;
  /** QC failed: markers for the returned items (no labor is earned) */
  prepareQcFail(
    c: LaborQcCall & { qcRun: number; returnedItemIds: readonly string[] },
  ): Promise<LaborStaged>;
  /** the order is cancelled: labor already recorded is undone by opposite lines */
  prepareCancel(c: LaborQcCall & { reason: string }): Promise<LaborStaged>;
}

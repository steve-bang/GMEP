import type { Page } from '@/platform/pagination/pagination';
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
    companyId: string,
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
    companyId: string,
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
  getMany(companyId: string, ids: readonly string[]): Promise<RepairOrder[]>;
  /** C17: company-wide retention gate, only counts */
  listOpenByCustomer(companyId: string, customerId: string, limit: number): Promise<RepairOrder[]>;
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

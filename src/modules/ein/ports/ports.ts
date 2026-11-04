import type { Page } from '@/platform/pagination/pagination';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { SourceLine } from '../domain/build';
import type {
  Invoice,
  InvoiceArtifacts,
  InvoicePii,
  InvoiceQueue,
  InvoiceRequest,
  OrderInvoiceIndex,
} from '../domain/invoice';

/** Every read takes a Scope (NFR-ISO-01); out of scope looks exactly like missing. */
export interface InvoiceRepository {
  get(scope: Scope, id: string): Promise<Invoice | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Invoice | null>;
  getMany(scope: Scope, ids: readonly string[]): Promise<Invoice[]>;
  /**
   * Newest first, one branch (equality on the branch, R68 rule 5); the caller filters by status / text in memory over a
   * bounded window (rule 2). `from` inclusive, `to` exclusive.
   */
  listByBranch(
    scope: Scope,
    branchId: string,
    q: { limit: number; cursor?: { v: string; id: string }; from?: Date; to?: Date },
  ): Promise<Page<Invoice>>;
  create(tx: Tx, i: Invoice): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
  getPii(scope: Scope, id: string): Promise<InvoicePii | null>;
  getPiiInTx(tx: Tx, scope: Scope, id: string): Promise<InvoicePii | null>;
  savePii(tx: Tx, p: InvoicePii): void;
  getArtifacts(scope: Scope, id: string): Promise<InvoiceArtifacts | null>;
  saveArtifacts(tx: Tx, a: InvoiceArtifacts): void;
}

export interface InvoiceRequestRepository {
  get(scope: Scope, id: string): Promise<InvoiceRequest | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<InvoiceRequest | null>;
  getMany(scope: Scope, ids: readonly string[]): Promise<InvoiceRequest[]>;
  create(tx: Tx, r: InvoiceRequest): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface OrderInvoiceIndexRepository {
  get(scope: Scope, orderId: string): Promise<OrderInvoiceIndex | null>;
  getInTx(tx: Tx, scope: Scope, orderId: string): Promise<OrderInvoiceIndex | null>;
  getMany(scope: Scope, orderIds: readonly string[]): Promise<OrderInvoiceIndex[]>;
  save(tx: Tx, x: OrderInvoiceIndex): void;
}

export interface InvoiceQueueRepository {
  get(scope: Scope, branchId: string): Promise<InvoiceQueue | null>;
  getInTx(tx: Tx, scope: Scope, branchId: string): Promise<InvoiceQueue | null>;
  save(tx: Tx, q: InvoiceQueue): void;
}

/** The order as the invoice layer needs it. REC owns the order; EIN never recomputes its total (RULE-005). */
export interface InvoiceableOrder {
  id: string;
  companyId: string;
  branchId: string;
  number: string;
  status: string;
  /** the quality check passed (ready for delivery or completed) */
  qcPassed: boolean;
  completed: boolean;
  cancelled: boolean;
  completedAt: Date | null;
  totalVnd: number;
  customerId: string;
  customerName: string;
  plate: string;
  lines: SourceLine[];
}
export interface InvoiceOrderSource {
  get(scope: Scope, orderId: string): Promise<InvoiceableOrder | null>;
  /** completed orders of the scope, newest first, bounded (the warning list) */
  listCompleted(scope: Scope, limit: number): Promise<Omit<InvoiceableOrder, 'lines'>[]>;
}

/** CRM owns the customer; EIN reads the buyer data through this port (PII stays in CRM until it is snapshotted on an invoice). */
export interface BuyerSource {
  get(
    scope: Scope,
    customerId: string,
  ): Promise<{
    kind: 'retail' | 'business';
    name: string;
    taxCode?: string;
    address?: string;
    email?: string;
  } | null>;
}

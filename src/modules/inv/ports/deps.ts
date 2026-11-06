import type { Scope } from '@/platform/scope/scope';
import type { SysDeps } from '@/modules/sys';
import type {
  IssueReturnRepository,
  MovementRepository,
  PartRepository,
  ReservationRepository,
  StockBalanceRepository,
  StockDocumentRepository,
} from './ports';

/** INV configuration: documented defaults, none hard-coded in a use case. */
export interface InvConfig {
  /** lines per document; each line is one balance + one ledger row inside one transaction */
  maxDocLines: number;
  /** FR-INV-005 thresholds when no `inventory-policy` version is in force [Đề xuất dev - chờ xác nhận: Khách] */
  defaultGrnPriceVarianceBp: number;
  defaultGrnQtyVarianceBp: number;
  /** reorder list rows per page */
  lowStockMax: number;
  /** I2: a hold older than this many days appears in the long-held report [Cần xác nhận: Khách] */
  longHeldDays: number;
  /** rows scanned for the shortage and long-held reports */
  openReservationsMax: number;
  /** I16: offer the `transfer-order` source for a goods issue; false everywhere except local/test until the transfer document exists */
  allowTransferOrderSource: boolean;
}

export const DEFAULT_INV_CONFIG: InvConfig = {
  maxDocLines: 100,
  defaultGrnPriceVarianceBp: 500,
  defaultGrnQtyVarianceBp: 0,
  lowStockMax: 200,
  longHeldDays: 14,
  openReservationsMax: 500,
  allowTransferOrderSource: false,
};

/**
 * I15: who owns an order line (the advisor), so INV can tell them when a stocktake cuts their hold.
 * REC implements it when repair orders exist (slice 1.6); until then nobody is returned and only the
 * branch manager is notified.
 */
export interface OrderAdvisorPort {
  advisorsOf(
    tenantId: string,
    sourceType: string,
    sourceIds: readonly string[],
  ): Promise<Map<string, string>>;
}

/**
 * R75: "does the order have an effective invoice?" asked of EIN. Implemented by the composition root over EIN's
 * `hasValidInvoice`; this module never imports EIN. Throws when EIN cannot answer: callers then BLOCK (fail closed).
 */
export interface OrderInvoiceGate {
  hasValidInvoice(scope: Scope, orderId: string): Promise<boolean>;
}

export interface InvDeps {
  sys: SysDeps;
  parts: PartRepository;
  balances: StockBalanceRepository;
  movements: MovementRepository;
  documents: StockDocumentRepository;
  reservations: ReservationRepository;
  returns: IssueReturnRepository;
  inv: InvConfig;
  advisors: OrderAdvisorPort;
  /** R75: stock coming back for an order is blocked while the order has a valid invoice */
  invoices: OrderInvoiceGate;
}

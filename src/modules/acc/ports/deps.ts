import type { Scope } from '@/platform/scope/scope';
import type { SysDeps } from '@/modules/sys';
import type {
  CashRepository,
  DebtRepository,
  OrderAccountRepository,
  OrderSource,
  PaymentRepository,
} from './ports';

/** ACC limits that keep one request inside a bounded transaction or page. */
export interface AccConfig {
  /** payments of one order read for its page */
  maxPaymentsPerOrder: number;
  /** deposits kept on one order account (the aggregate document stays small) */
  maxDepositsPerOrder: number;
  /** rows of a payment / debt list */
  listMax: number;
  /** cash book rows of one day */
  entriesMax: number;
  /** open orders listed at shift / day close */
  openOrdersMax: number;
  /** aging cut-offs in days past due (FR-ACC-006); configuration, not law */
  agingCuts: [number, number];
}

export const DEFAULT_ACC_CONFIG: AccConfig = {
  maxPaymentsPerOrder: 60,
  maxDepositsPerOrder: 20,
  listMax: 200,
  entriesMax: 500,
  openOrdersMax: 300,
  agingCuts: [30, 60],
};

/**
 * R75: "does the order have an effective invoice?" asked of EIN. Implemented by the composition root over EIN's
 * `hasValidInvoice`; this module never imports EIN. Throws when EIN cannot answer: callers then BLOCK (fail closed).
 */
export interface OrderInvoiceGate {
  hasValidInvoice(scope: Scope, orderId: string): Promise<boolean>;
}

export interface AccDeps {
  sys: SysDeps;
  orders: OrderSource;
  payments: PaymentRepository;
  accounts: OrderAccountRepository;
  cash: CashRepository;
  debts: DebtRepository;
  /** R75: payment reversal / deposit refund for an order is blocked while it has a valid invoice */
  invoices: OrderInvoiceGate;
  acc: AccConfig;
}

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

export interface AccDeps {
  sys: SysDeps;
  orders: OrderSource;
  payments: PaymentRepository;
  accounts: OrderAccountRepository;
  cash: CashRepository;
  debts: DebtRepository;
  acc: AccConfig;
}

import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type {
  DailyRollup,
  DebtFact,
  InvoiceFact,
  InvoiceStateFact,
  LinesFact,
  MoneyFact,
  OrderFact,
  PaymentFact,
  QuoteFact,
  ShiftFact,
  StockIssueFact,
} from '../domain/rollup';
import type { BalanceFact, WorkItemFact } from '../domain/reports';

/** Read side of the projection: documents read BY KEY, never queried (R68 rule 3, no composite index). */
export interface RollupRepository {
  get(scope: Scope, branchId: string, date: string): Promise<DailyRollup | null>;
  getInTx(tx: Tx, scope: Scope, branchId: string, date: string): Promise<DailyRollup | null>;
  /** keys outside the scope are absent from the result */
  getMany(
    scope: Scope,
    keys: readonly { branchId: string; date: string }[],
  ): Promise<DailyRollup[]>;
  save(tx: Tx, r: DailyRollup): void;
}

export interface Capped<T> {
  items: T[];
  /** the source had more than the cap: the result is a lower bound */
  truncated: boolean;
}

/**
 * What the rollup reads from REC, ACC, EIN and INV. Implemented in composition from those modules' PUBLIC repositories
 * (the same pattern as EIN reading REC); every call takes the Scope and one branch.
 */
export interface RptSources {
  /** newest created first inside [since, until); orders of the branch only */
  orders(
    scope: Scope,
    branchId: string,
    range: { since: Date; until: Date },
    limit: number,
  ): Promise<Capped<OrderFact>>;
  openOrders(scope: Scope, branchId: string, limit: number): Promise<Capped<OrderFact>>;
  orderLines(scope: Scope, orderIds: readonly string[]): Promise<Map<string, LinesFact>>;
  orderMoney(scope: Scope, orderIds: readonly string[]): Promise<Map<string, MoneyFact>>;
  invoiceStates(scope: Scope, orderIds: readonly string[]): Promise<Map<string, InvoiceStateFact>>;
  payments(
    scope: Scope,
    branchId: string,
    window: { from: Date; to: Date },
    limit: number,
  ): Promise<Capped<PaymentFact>>;
  openDebts(scope: Scope, branchId: string, limit: number): Promise<Capped<DebtFact>>;
  shifts(scope: Scope, branchId: string, date: string, limit: number): Promise<Capped<ShiftFact>>;
  dayClosedAt(scope: Scope, branchId: string, date: string): Promise<Date | null>;
  invoicesIssued(
    scope: Scope,
    branchId: string,
    window: { from: Date; to: Date },
    limit: number,
  ): Promise<Capped<InvoiceFact>>;
  /** stock balances of the branch (the existing scope+code query, newest page first); FR-RPT-005 */
  stockBalances(scope: Scope, branchId: string, limit: number): Promise<Capped<BalanceFact>>;
  /**
   * Repair items of the orders COMPLETED in [from, to) (FR-RPT-006); reads orders by the existing created-at list and
   * the items of each order by key-range, at most `maxOrders` orders. `serviceType` filters orders (FR-RPT-014).
   */
  workItems(
    scope: Scope,
    branchId: string,
    window: { from: Date; to: Date },
    opts: { lookbackDays: number; maxOrders: number; serviceType?: string },
  ): Promise<Capped<WorkItemFact>>;
  /** FR-RPT-016 (slice 2.1): quotes created in [since, until) of the branch, newest first; optional so a source set without REC quotes still works */
  quotes?(
    scope: Scope,
    branchId: string,
    range: { since: Date; until: Date },
    limit: number,
  ): Promise<Capped<QuoteFact>>;
  /** FR-RPT-015 (slice 2.1): creation time of the customers (scope-checked; unknown ids are absent) */
  customerCreated?(scope: Scope, customerIds: readonly string[]): Promise<Map<string, Date>>;
  /** posted goods issues (GIN) of the business date */
  stockIssues(
    scope: Scope,
    branchId: string,
    date: string,
    limit: number,
  ): Promise<Capped<StockIssueFact>>;
}

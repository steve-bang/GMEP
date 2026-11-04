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
  ShiftFact,
  StockIssueFact,
} from '../domain/rollup';

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
  /** posted goods issues (GIN) of the business date */
  stockIssues(
    scope: Scope,
    branchId: string,
    date: string,
    limit: number,
  ): Promise<Capped<StockIssueFact>>;
}

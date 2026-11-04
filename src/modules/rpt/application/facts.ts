import type { Scope } from '@/platform/scope/scope';
import {
  addDays,
  dayWindow,
  type DayFacts,
  type OrderFact,
  type StockIssueFact,
} from '../domain/rollup';
import type { RptDeps } from '../ports/deps';

const DAY_MS = 86_400_000;

/**
 * Reads the facts for several business days of ONE branch with a single order scan (the cost of a refresh is the
 * scan, not the number of days). Every source call carries the Scope; a source never widens it.
 */
export async function loadFacts(
  deps: RptDeps,
  scope: Scope,
  branchId: string,
  dates: readonly string[],
  now: Date,
): Promise<Map<string, DayFacts>> {
  const sorted = [...dates].sort();
  const first = sorted[0]!;
  const last = sorted.at(-1)!;
  const since = new Date(dayWindow(first).from.getTime() - deps.rpt.orderLookbackDays * DAY_MS);
  const until = dayWindow(last).to;
  const [scan, open, debts] = await Promise.all([
    deps.sources.orders(scope, branchId, { since, until }, deps.rpt.ordersScanMax),
    deps.sources.openOrders(scope, branchId, deps.rpt.scanMax),
    deps.sources.openDebts(scope, branchId, deps.rpt.scanMax),
  ]);
  const byId = new Map<string, OrderFact>();
  for (const o of [...scan.items, ...open.items]) {
    if (o.createdAt.getTime() < until.getTime()) byId.set(o.id, o);
  }
  const orders = [...byId.values()];
  const spanFrom = dayWindow(first).from.getTime();
  const spanTo = until.getTime();
  const inSpan = (d?: Date) => !!d && d.getTime() >= spanFrom && d.getTime() < spanTo;
  const closedIds = orders.filter((o) => inSpan(o.completedAt)).map((o) => o.id);
  // invoice state of every completed order of the scan: "completed but not invoiced" is not tied to the day it closed
  const completedIds = orders
    .filter((o) => o.completedAt && o.completedAt.getTime() < spanTo)
    .map((o) => o.id);
  const [lines, money, invoiceStates] = await Promise.all([
    deps.sources.orderLines(scope, closedIds),
    deps.sources.orderMoney(scope, closedIds),
    deps.sources.invoiceStates(scope, completedIds),
  ]);

  const out = new Map<string, DayFacts>();
  for (const date of sorted) {
    const w = dayWindow(date);
    // a reversal posted later into this (then open) day has a later createdAt: read two days past the day, filter on businessDate
    const payWindow = {
      from: w.from,
      to: new Date(Math.min(now.getTime(), w.to.getTime() + 2 * DAY_MS) + 1),
    };
    const [payments, shifts, closedAt, invoices, issues] = await Promise.all([
      deps.sources.payments(scope, branchId, payWindow, deps.rpt.scanMax),
      deps.sources.shifts(scope, branchId, date, deps.rpt.scanMax),
      deps.sources.dayClosedAt(scope, branchId, date),
      deps.sources.invoicesIssued(scope, branchId, w, deps.rpt.scanMax),
      deps.sources.stockIssues(scope, branchId, date, deps.rpt.scanMax),
    ]);
    const truncated = [
      ...(scan.truncated ? ['orders'] : []),
      ...(open.truncated ? ['openOrders'] : []),
      ...(debts.truncated ? ['debts'] : []),
      ...(payments.truncated ? ['payments'] : []),
      ...(shifts.truncated ? ['shifts'] : []),
      ...(invoices.truncated ? ['invoices'] : []),
      ...(issues.truncated ? ['stockIssues'] : []),
    ];
    out.set(date, {
      orders,
      lines,
      money,
      invoiceStates,
      payments: payments.items,
      openDebts: debts.items,
      shifts: shifts.items,
      dayClosedAt: closedAt,
      invoicesIssued: invoices.items,
      stockIssues: issues.items as StockIssueFact[],
      truncated,
    });
  }
  return out;
}

export { addDays };

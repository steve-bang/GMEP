import { dateRange, sumPeriod } from './reports';
import { addDays, type DailyRollup } from './rollup';

/**
 * Dashboard date range (FR-RPT-001, "lọc theo thời gian"): ONE branch's rollups over a list of dates folded into one
 * document-shaped value, so `totalsOf` can add the branches up exactly as it does for one day.
 *  - flows (orders opened/closed/handed over/cancelled, revenue, money, issued invoices, goods issues, cash) are SUMMED
 *    by `sumPeriod`, the same function the monthly report uses;
 *  - stock-like figures (open orders at the end, open debt, completed orders without an invoice, alerts) come from the
 *    LAST day that has a rollup (`date` of the result), never summed over days;
 *  - a date without a rollup is listed in `missingDates` and is NOT counted as zero.
 * A range of one day returns the stored document itself, so the single-day dashboard is unchanged.
 */
export interface PeriodRollup {
  /** null = no rollup at all in the range */
  rollup: DailyRollup | null;
  presentDates: string[];
  missingDates: string[];
  /** every date has a rollup AND every one is official (day closed) */
  official: boolean;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function periodRollup(rows: readonly DailyRollup[], dates: readonly string[]): PeriodRollup {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const present = dates.flatMap((d) => (byDate.has(d) ? [byDate.get(d)!] : []));
  const presentDates = present.map((r) => r.date);
  const missingDates = dates.filter((d) => !byDate.has(d));
  const official = present.length === dates.length && present.every((r) => r.official);
  const last = present.at(-1);
  if (!last) return { rollup: null, presentDates, missingDates, official: false };
  if (dates.length === 1) return { rollup: last, presentDates, missingDates, official };
  const s = sumPeriod('range', rows, dates);
  const rollup: DailyRollup = {
    id: `${last.branchId}_${dates[0]}_${dates.at(-1)}`,
    companyId: last.companyId,
    branchId: last.branchId,
    // the end-of-period date: the day the stock-like figures and the alerts belong to
    date: last.date,
    official,
    schemaVersion: last.schemaVersion,
    computedAt: new Date(Math.max(...present.map((r) => r.computedAt.getTime()))),
    sourceHash: 'range',
    orders: { ...s.orders, openAtEnd: last.orders.openAtEnd },
    revenue: { ...s.revenue },
    money: {
      byMethod: s.money.byMethod,
      receiptCount: sum(present.map((r) => r.money.receiptCount)),
      inflowVnd: s.money.inflowVnd,
      depositVnd: sum(present.map((r) => r.money.depositVnd)),
      expenseVnd: s.money.expenseVnd,
      receivedForClosedVnd: s.money.receivedForClosedVnd,
      debtForClosedVnd: s.money.debtForClosedVnd,
      gapVnd: s.money.gapVnd,
      gapOrders: sum(present.map((r) => r.money.gapOrders)),
    },
    receivables: { ...last.receivables },
    invoices: {
      issuedCount: s.invoices.issuedCount,
      issuedVnd: s.invoices.issuedVnd,
      closedWithoutInvoiceCount: last.invoices.closedWithoutInvoiceCount,
      closedWithoutInvoiceVnd: last.invoices.closedWithoutInvoiceVnd,
    },
    stock: { ...s.stock },
    cash: { ...s.cash },
    alertCounts: last.alertCounts,
    alerts: last.alerts,
    alertsTruncated: last.alertsTruncated,
    refs: last.refs,
    refsTruncated: last.refsTruncated,
    truncated: [...new Set(present.flatMap((r) => r.truncated))].sort(),
  };
  return { rollup, presentDates, missingDates, official };
}

/** The dates of the period of the same length that ends the day before `from` (oldest first). */
export function previousDates(from: string, days: number): string[] {
  return dateRange(addDays(from, -days), addDays(from, -1));
}

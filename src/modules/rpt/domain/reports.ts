/**
 * Phase 1 reports derived from the daily rollups and from read-only source facts (FR-RPT-002/004/005/006/014).
 * Everything here is pure: the monthly report and the four-way reconciliation add up per-day read models that were
 * already limited to the actor's scope and permissions; warehouse and technician reports fold bounded fact lists.
 * Money is integer VND; hours are integer minutes (no floats in stored or summed values). No payroll (BR scope).
 */
import { addDays, type DailyRollup } from './rollup';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Every business date of a `yyyy-MM` month, oldest first. */
export function monthDates(month: string): string[] {
  const first = `${month}-01`;
  const out: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) out.push(d);
  return out;
}

/** Inclusive date list between two business dates (oldest first); caller limits the length. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

// ---- monthly report (FR-RPT-002 / 014) ------------------------------------------------------------------------------

export interface MonthDayRow {
  date: string;
  exTaxVnd: number;
  closed: number;
  inflowVnd: number;
  official: boolean;
}

export interface MonthlyReport {
  month: string;
  days: number;
  /** days with a rollup document; the rest are listed in `missingDates` and are NOT counted as zero */
  present: number;
  official: number;
  missingDates: string[];
  orders: { opened: number; closed: number; handedOver: number; cancelled: number };
  revenue: {
    orderTotalVnd: number;
    laborVnd: number;
    partsVnd: number;
    exTaxVnd: number;
    taxAndOtherVnd: number;
    avgPerOrderVnd: number;
  };
  money: {
    byMethod: Record<string, number>;
    inflowVnd: number;
    expenseVnd: number;
    receivedForClosedVnd: number;
    debtForClosedVnd: number;
    gapVnd: number;
  };
  invoices: { issuedCount: number; issuedVnd: number };
  stock: { issueDocuments: number; issuesWithoutSource: number };
  cash: { shiftsClosed: number; shiftsWithVariance: number; varianceVnd: number };
  /** stock-like figures: taken from the last day that has a rollup, never summed over days */
  endOfPeriod: {
    date: string | null;
    openAtEnd: number;
    openDebtVnd: number;
    openDebtCount: number;
    overdueDebtVnd: number;
    overdueDebtCount: number;
    closedWithoutInvoiceCount: number;
    closedWithoutInvoiceVnd: number;
  };
  series: MonthDayRow[];
}

type Rolled = Pick<
  DailyRollup,
  | 'date'
  | 'official'
  | 'orders'
  | 'revenue'
  | 'money'
  | 'receivables'
  | 'invoices'
  | 'stock'
  | 'cash'
>;

/** Flows are summed over the days; end-of-period figures come from the last present day. Missing days are reported. */
export function computeMonthly(month: string, rows: readonly Rolled[]): MonthlyReport {
  const dates = monthDates(month);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const present = dates.flatMap((d) => (byDate.has(d) ? [byDate.get(d)!] : []));
  const byMethod: Record<string, number> = {};
  for (const r of present)
    for (const [k, v] of Object.entries(r.money.byMethod)) byMethod[k] = (byMethod[k] ?? 0) + v;
  const closed = sum(present.map((r) => r.orders.closed));
  const labor = sum(present.map((r) => r.revenue.laborVnd));
  const parts = sum(present.map((r) => r.revenue.partsVnd));
  const orderTotal = sum(present.map((r) => r.revenue.orderTotalVnd));
  const last = present.at(-1);
  return {
    month,
    days: dates.length,
    present: present.length,
    official: present.filter((r) => r.official).length,
    missingDates: dates.filter((d) => !byDate.has(d)),
    orders: {
      opened: sum(present.map((r) => r.orders.opened)),
      closed,
      handedOver: sum(present.map((r) => r.orders.handedOver)),
      cancelled: sum(present.map((r) => r.orders.cancelled)),
    },
    revenue: {
      orderTotalVnd: orderTotal,
      laborVnd: labor,
      partsVnd: parts,
      exTaxVnd: labor + parts,
      taxAndOtherVnd: orderTotal - labor - parts,
      avgPerOrderVnd: closed > 0 ? Math.round((labor + parts) / closed) : 0,
    },
    money: {
      byMethod,
      inflowVnd: sum(present.map((r) => r.money.inflowVnd)),
      expenseVnd: sum(present.map((r) => r.money.expenseVnd)),
      receivedForClosedVnd: sum(present.map((r) => r.money.receivedForClosedVnd)),
      debtForClosedVnd: sum(present.map((r) => r.money.debtForClosedVnd)),
      gapVnd: sum(present.map((r) => r.money.gapVnd)),
    },
    invoices: {
      issuedCount: sum(present.map((r) => r.invoices.issuedCount)),
      issuedVnd: sum(present.map((r) => r.invoices.issuedVnd)),
    },
    stock: {
      issueDocuments: sum(present.map((r) => r.stock.issueDocuments)),
      issuesWithoutSource: sum(present.map((r) => r.stock.issuesWithoutSource)),
    },
    cash: {
      shiftsClosed: sum(present.map((r) => r.cash.shiftsClosed)),
      shiftsWithVariance: sum(present.map((r) => r.cash.shiftsWithVariance)),
      varianceVnd: sum(present.map((r) => r.cash.varianceVnd)),
    },
    endOfPeriod: {
      date: last?.date ?? null,
      openAtEnd: last?.orders.openAtEnd ?? 0,
      openDebtVnd: last?.receivables.openDebtVnd ?? 0,
      openDebtCount: last?.receivables.openDebtCount ?? 0,
      overdueDebtVnd: last?.receivables.overdueDebtVnd ?? 0,
      overdueDebtCount: last?.receivables.overdueDebtCount ?? 0,
      closedWithoutInvoiceCount: last?.invoices.closedWithoutInvoiceCount ?? 0,
      closedWithoutInvoiceVnd: last?.invoices.closedWithoutInvoiceVnd ?? 0,
    },
    series: present.map((r) => ({
      date: r.date,
      exTaxVnd: r.revenue.exTaxVnd,
      closed: r.orders.closed,
      inflowVnd: r.money.inflowVnd,
      official: r.official,
    })),
  };
}

// ---- four-way reconciliation (FR-RPT-004) -----------------------------------------------------------------------------

/** The four checks: orders vs payments, orders vs invoices, cash (shift variance), stock issues vs source documents. */
export const RECONCILE_CHECKS = ['payments', 'invoices', 'cash', 'stock'] as const;
export type ReconcileCheck = (typeof RECONCILE_CHECKS)[number];

export interface ReconcileVisible {
  payments: boolean;
  invoices: boolean;
  cash: boolean;
  stock: boolean;
}

export interface ReconcileRow {
  date: string;
  official: boolean;
  closed: number;
  orderTotalVnd: number;
  receivedVnd: number;
  debtVnd: number;
  /** orderTotal - received - debt (0 = reconciled) */
  gapVnd: number;
  gapOrders: number;
  issuedCount: number;
  issuedVnd: number;
  notInvoicedCount: number;
  notInvoicedVnd: number;
  shiftsWithVariance: number;
  varianceVnd: number;
  issueDocuments: number;
  withoutSource: number;
  /** checks that failed on the day, only for the sections the actor may see */
  failed: ReconcileCheck[];
}

export interface ReconcileReport {
  from: string;
  to: string;
  rows: ReconcileRow[];
  missingDates: string[];
  totals: Omit<ReconcileRow, 'date' | 'official' | 'failed'>;
  failedDays: number;
  /** all four checks are clean on every present day */
  reconciled: boolean;
}

export function computeReconcile(
  from: string,
  to: string,
  rolls: readonly Rolled[],
  visible: ReconcileVisible,
): ReconcileReport {
  const dates = dateRange(from, to);
  const byDate = new Map(rolls.map((r) => [r.date, r]));
  const rows: ReconcileRow[] = [];
  for (const d of dates) {
    const r = byDate.get(d);
    if (!r) continue;
    const failed: ReconcileCheck[] = [];
    if (visible.payments && r.money.gapVnd !== 0) failed.push('payments');
    if (visible.invoices && r.invoices.closedWithoutInvoiceCount > 0) failed.push('invoices');
    if (visible.cash && r.cash.shiftsWithVariance > 0) failed.push('cash');
    if (visible.stock && r.stock.issuesWithoutSource > 0) failed.push('stock');
    rows.push({
      date: d,
      official: r.official,
      closed: r.orders.closed,
      orderTotalVnd: r.revenue.orderTotalVnd,
      receivedVnd: r.money.receivedForClosedVnd,
      debtVnd: r.money.debtForClosedVnd,
      gapVnd: r.money.gapVnd,
      gapOrders: r.money.gapOrders,
      issuedCount: r.invoices.issuedCount,
      issuedVnd: r.invoices.issuedVnd,
      notInvoicedCount: r.invoices.closedWithoutInvoiceCount,
      notInvoicedVnd: r.invoices.closedWithoutInvoiceVnd,
      shiftsWithVariance: r.cash.shiftsWithVariance,
      varianceVnd: r.cash.varianceVnd,
      issueDocuments: r.stock.issueDocuments,
      withoutSource: r.stock.issuesWithoutSource,
      failed,
    });
  }
  const col = (f: (r: ReconcileRow) => number) => sum(rows.map(f));
  const lastRow = rows.at(-1);
  return {
    from,
    to,
    rows,
    missingDates: dates.filter((d) => !byDate.has(d)),
    totals: {
      closed: col((r) => r.closed),
      orderTotalVnd: col((r) => r.orderTotalVnd),
      receivedVnd: col((r) => r.receivedVnd),
      debtVnd: col((r) => r.debtVnd),
      gapVnd: col((r) => r.gapVnd),
      gapOrders: col((r) => r.gapOrders),
      issuedCount: col((r) => r.issuedCount),
      issuedVnd: col((r) => r.issuedVnd),
      // a stock-like figure (all completed orders still without a valid invoice): the last day, not a sum
      notInvoicedCount: lastRow?.notInvoicedCount ?? 0,
      notInvoicedVnd: lastRow?.notInvoicedVnd ?? 0,
      shiftsWithVariance: col((r) => r.shiftsWithVariance),
      varianceVnd: col((r) => r.varianceVnd),
      issueDocuments: col((r) => r.issueDocuments),
      withoutSource: col((r) => r.withoutSource),
    },
    failedDays: rows.filter((r) => r.failed.length > 0).length,
    reconciled: rows.every((r) => r.failed.length === 0),
  };
}

// ---- warehouse report (FR-RPT-005, no new index: the balances query already exists) --------------------------------------

export interface BalanceFact {
  warehouseId: string;
  partId: string;
  partCode: string;
  partName: string;
  onHand: number;
  reserved: number;
  inTransit: number;
  valueVnd: number;
  minQty: number | null;
  maxQty: number | null;
}

export interface WarehouseLine extends BalanceFact {
  /** RULE-008: onHand - reserved; in-transit stock is not available */
  available: number;
  /** minQty - available when positive: how far below the reorder level the line is */
  shortage: number;
  /** BA-04 Cau 7: max - (available + inTransit); null without a max */
  suggestQty: number | null;
}

export interface WarehouseSummary {
  warehouseId: string;
  lines: number;
  valueVnd: number;
  below: number;
  out: number;
}

export interface WarehouseReport {
  summary: WarehouseSummary[];
  totalValueVnd: number;
  /** reorder is judged on available, not on hand (RULE-008) */
  below: WarehouseLine[];
  lineCount: number;
}

export const availableOf = (b: Pick<BalanceFact, 'onHand' | 'reserved'>): number =>
  b.onHand - b.reserved;

export function computeWarehouse(
  balances: readonly BalanceFact[],
  opts: { showValue: boolean; belowMax: number },
): WarehouseReport {
  const per = new Map<string, WarehouseSummary>();
  const below: WarehouseLine[] = [];
  for (const b of balances) {
    const available = availableOf(b);
    const s = per.get(b.warehouseId) ?? {
      warehouseId: b.warehouseId,
      lines: 0,
      valueVnd: 0,
      below: 0,
      out: 0,
    };
    s.lines++;
    s.valueVnd += opts.showValue ? b.valueVnd : 0;
    if (available <= 0) s.out++;
    if (b.minQty !== null && available <= b.minQty) {
      s.below++;
      below.push({
        ...b,
        valueVnd: opts.showValue ? b.valueVnd : 0,
        available,
        shortage: b.minQty - available,
        suggestQty: b.maxQty !== null ? Math.max(0, b.maxQty - (available + b.inTransit)) : null,
      });
    }
    per.set(b.warehouseId, s);
  }
  below.sort(
    (a, b) =>
      b.shortage - a.shortage ||
      a.partCode.localeCompare(b.partCode) ||
      a.warehouseId.localeCompare(b.warehouseId),
  );
  return {
    summary: [...per.values()].sort((a, b) => a.warehouseId.localeCompare(b.warehouseId)),
    totalValueVnd: sum([...per.values()].map((s) => s.valueVnd)),
    below: below.slice(0, opts.belowMax),
    lineCount: balances.length,
  };
}

// ---- technician report (FR-RPT-006: hours and jobs only, never pay) ------------------------------------------------------

export interface WorkItemFact {
  orderId: string;
  orderNumber: string;
  serviceType: string | null;
  technicianId: string | null;
  technicianName: string | null;
  status: string;
  /** closed worked milliseconds of the item */
  workedMs: number;
  /** labor minutes approved for the customer (standard hours) */
  approvedMinutes: number;
}

export interface TechnicianRow {
  technicianId: string | null;
  technicianName: string | null;
  jobs: number;
  orders: number;
  workedMinutes: number;
  standardMinutes: number;
  /** standardMinutes / workedMinutes in basis points; null when nothing was timed */
  efficiencyBp: number | null;
}

export interface TechnicianReport {
  rows: TechnicianRow[];
  totals: Omit<TechnicianRow, 'technicianId' | 'technicianName' | 'efficiencyBp'> & {
    efficiencyBp: number | null;
  };
  byServiceType: { serviceType: string | null; jobs: number; workedMinutes: number }[];
}

const msToMinutes = (ms: number): number => Math.round(ms / 60_000);
const effBp = (std: number, worked: number): number | null =>
  worked > 0 ? Math.round((std * 10_000) / worked) : null;

/** Counts finished items only (status done); the serviceType filter is applied by the caller before this fold. */
export function computeTechnicians(items: readonly WorkItemFact[]): TechnicianReport {
  const per = new Map<
    string,
    {
      id: string | null;
      name: string | null;
      jobs: number;
      orders: Set<string>;
      ms: number;
      std: number;
    }
  >();
  const svc = new Map<string, { serviceType: string | null; jobs: number; ms: number }>();
  const allOrders = new Set<string>();
  for (const it of items) {
    if (it.status !== 'done') continue;
    const k = it.technicianId ?? '';
    const t = per.get(k) ?? {
      id: it.technicianId,
      name: it.technicianName,
      jobs: 0,
      orders: new Set<string>(),
      ms: 0,
      std: 0,
    };
    t.jobs++;
    t.orders.add(it.orderId);
    t.ms += it.workedMs;
    t.std += it.approvedMinutes;
    per.set(k, t);
    allOrders.add(it.orderId);
    const sk = it.serviceType ?? '';
    const s = svc.get(sk) ?? { serviceType: it.serviceType, jobs: 0, ms: 0 };
    s.jobs++;
    s.ms += it.workedMs;
    svc.set(sk, s);
  }
  const rows: TechnicianRow[] = [...per.values()]
    .map((t) => {
      const worked = msToMinutes(t.ms);
      return {
        technicianId: t.id,
        technicianName: t.name,
        jobs: t.jobs,
        orders: t.orders.size,
        workedMinutes: worked,
        standardMinutes: t.std,
        efficiencyBp: effBp(t.std, worked),
      };
    })
    .sort(
      (a, b) => b.jobs - a.jobs || (a.technicianName ?? '').localeCompare(b.technicianName ?? ''),
    );
  const worked = sum(rows.map((r) => r.workedMinutes));
  const std = sum(rows.map((r) => r.standardMinutes));
  return {
    rows,
    totals: {
      jobs: sum(rows.map((r) => r.jobs)),
      orders: allOrders.size,
      workedMinutes: worked,
      standardMinutes: std,
      efficiencyBp: effBp(std, worked),
    },
    byServiceType: [...svc.values()]
      .map((s) => ({ serviceType: s.serviceType, jobs: s.jobs, workedMinutes: msToMinutes(s.ms) }))
      .sort((a, b) => b.jobs - a.jobs || (a.serviceType ?? '').localeCompare(b.serviceType ?? '')),
  };
}

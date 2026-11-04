/**
 * Phase 1 reports derived from the daily rollups and from read-only source facts (FR-RPT-002/004/005/006/014).
 * Everything here is pure: the monthly report and the four-way reconciliation add up per-day read models that were
 * already limited to the actor's scope and permissions; warehouse and technician reports fold bounded fact lists.
 * Money is integer VND; hours are integer minutes (no floats in stored or summed values). No payroll (BR scope).
 */
import {
  addDays,
  emptyServiceRollup,
  emptyUnlinked,
  type DailyRollup,
  type UnlinkedRollup,
} from './rollup';

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
  /** FR-RPT-002: against the month before, same day range; null = "n/a" (no rollup of the previous month in that range) */
  comparison: MonthComparison | null;
}

/** Percent change in basis points (1 bp = 0.01%), integer; null when the base is 0 (cannot divide) */
export type DeltaBp = number | null;

export interface MonthComparison {
  /** the earlier month compared (`yyyy-MM`) */
  month: string;
  /** the two concrete date ranges compared (inclusive, yyyy-MM-dd); both are shown on screen and in the export */
  currentRange: { from: string; to: string };
  previousRange: { from: string; to: string };
  /** days of the current month inside `currentRange` (can differ from `days` when the months have different length) */
  currentDays: number;
  /** days compared: 1..days of that month, equal to the day range the current month covers (capped by its length) */
  days: number;
  present: number;
  /** days of the range with no rollup: NOT counted as zero, so the change may be understated */
  missingDates: string[];
  orders: { closed: number };
  revenue: { orderTotalVnd: number; exTaxVnd: number; avgPerOrderVnd: number };
  money: { inflowVnd: number };
  invoices: { issuedVnd: number };
  deltaBp: {
    closed: DeltaBp;
    orderTotalVnd: DeltaBp;
    exTaxVnd: DeltaBp;
    avgPerOrderVnd: DeltaBp;
    inflowVnd: DeltaBp;
    invoicesIssuedVnd: DeltaBp;
  };
}

/** The `yyyy-MM` month before `month`. */
export function previousMonth(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 1
    ? `${y - 1}-12`
    : `${String(y).padStart(4, '0')}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * FR-RPT-002: how many days from the 1st of the earlier month are compared: the days elapsed in the running month,
 * the whole length of `month` once it is over (not 31: April is 30 days), nothing for a future month.
 */
export function comparisonDays(month: string, today: string): number {
  const cur = today.slice(0, 7);
  if (month > cur) return 0;
  return month === cur ? Number(today.slice(8, 10)) : monthDates(month).length;
}

/** (current - previous) / previous in basis points, rounded half away from zero; null when previous is 0 (FR-RPT-002). */
export function deltaBp(current: number, previous: number): DeltaBp {
  if (previous === 0) return null;
  const x = ((current - previous) * 10_000) / Math.abs(previous);
  return Math.sign(x) * Math.round(Math.abs(x));
}

/** The earlier period handed to `computeMonthly`: its rollups and how many days from the 1st are compared. */
export interface PreviousPeriod {
  month: string;
  rows: readonly Rolled[];
  throughDay: number;
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
> &
  Partial<Pick<DailyRollup, 'byServiceType' | 'schemaVersion' | 'unlinked'>>;

/** FR-RPT-014: sum of the "không gắn lệnh" lines over the present days. */
export function sumUnlinked(rolls: readonly Rolled[]): UnlinkedRollup {
  const t = emptyUnlinked();
  for (const r of rolls) {
    const u = r.unlinked;
    if (!u) continue;
    for (const [k, v] of Object.entries(u.byMethod)) t.byMethod[k] = (t.byMethod[k] ?? 0) + v;
    t.inflowVnd += u.inflowVnd;
    t.expenseVnd += u.expenseVnd;
    t.invoicesIssuedCount += u.invoicesIssuedCount;
    t.invoicesIssuedVnd += u.invoicesIssuedVnd;
    t.stockIssueDocuments += u.stockIssueDocuments;
  }
  return t;
}

/**
 * FR-RPT-014: narrows daily rollups to ONE service type. Only the order-bound figures are attributable (orders closed,
 * revenue, money received/debt/gap for those orders, orders completed without an invoice) plus the documents that carry
 * an order (receipts by method, invoices issued, goods issues, schema 3). Opened/handed over/cancelled, receivables and
 * cash are not tied to a service type and read zero; documents without an order are in `sumUnlinked`. A rollup before schema version 3 lacks the payment, invoice and stock split: its date is listed in `unavailableDates`, not counted as zero.
 */
export function forServiceType(
  rolls: readonly Rolled[],
  serviceType: string,
): { rolls: Rolled[]; included: Rolled[]; unavailableDates: string[] } {
  const out: Rolled[] = [];
  const included: Rolled[] = [];
  const unavailableDates: string[] = [];
  for (const r of rolls) {
    if (!r.byServiceType || (r.schemaVersion ?? 1) < 3) {
      unavailableDates.push(r.date);
      continue;
    }
    const e =
      r.byServiceType.find((x) => x.serviceType === serviceType) ?? emptyServiceRollup(serviceType);
    included.push(r);
    out.push({
      date: r.date,
      official: r.official,
      orders: { opened: 0, closed: e.closed, handedOver: 0, cancelled: 0, openAtEnd: 0 },
      revenue: {
        orderTotalVnd: e.orderTotalVnd,
        laborVnd: e.laborVnd,
        partsVnd: e.partsVnd,
        exTaxVnd: e.laborVnd + e.partsVnd,
        taxAndOtherVnd: e.orderTotalVnd - e.laborVnd - e.partsVnd,
        avgPerOrderVnd: e.closed > 0 ? Math.round((e.laborVnd + e.partsVnd) / e.closed) : 0,
      },
      money: {
        byMethod: e.byMethod,
        receiptCount: 0,
        inflowVnd: e.inflowVnd,
        depositVnd: 0,
        expenseVnd: 0,
        receivedForClosedVnd: e.receivedVnd,
        debtForClosedVnd: e.debtVnd,
        gapVnd: e.gapVnd,
        gapOrders: e.gapOrders,
      },
      receivables: { openDebtVnd: 0, openDebtCount: 0, overdueDebtVnd: 0, overdueDebtCount: 0 },
      invoices: {
        issuedCount: e.invoicesIssuedCount,
        issuedVnd: e.invoicesIssuedVnd,
        closedWithoutInvoiceCount: e.notInvoicedCount,
        closedWithoutInvoiceVnd: e.notInvoicedVnd,
      },
      stock: { issueDocuments: e.stockIssueDocuments, issuesWithoutSource: 0 },
      cash: { shiftsClosed: 0, shiftsWithVariance: 0, varianceVnd: 0 },
    });
  }
  return { rolls: out, included, unavailableDates };
}

/** Flows are summed over the days; end-of-period figures come from the last present day. Missing days are reported. */
export function computeMonthly(
  month: string,
  rows: readonly Rolled[],
  previous?: PreviousPeriod,
): MonthlyReport {
  const cur = sumMonth(month, rows, monthDates(month));
  return { ...cur, comparison: compare(cur, previous) };
}

/** FR-RPT-002: figures of the same day range of the earlier month; compared with the full current figures. */
function compare(
  c: Omit<MonthlyReport, 'comparison'>,
  prev: PreviousPeriod | undefined,
): MonthComparison | null {
  if (!prev || prev.throughDay < 1) return null;
  const dates = monthDates(prev.month).slice(0, prev.throughDay);
  const p = sumMonth(prev.month, prev.rows, dates);
  if (p.present === 0) return null;
  const curDates = monthDates(c.month).slice(0, prev.throughDay);
  return {
    month: prev.month,
    currentRange: { from: curDates[0] ?? '', to: curDates.at(-1) ?? '' },
    previousRange: { from: dates[0]!, to: dates.at(-1)! },
    currentDays: curDates.length,
    days: dates.length,
    present: p.present,
    missingDates: p.missingDates,
    orders: { closed: p.orders.closed },
    revenue: {
      orderTotalVnd: p.revenue.orderTotalVnd,
      exTaxVnd: p.revenue.exTaxVnd,
      avgPerOrderVnd: p.revenue.avgPerOrderVnd,
    },
    money: { inflowVnd: p.money.inflowVnd },
    invoices: { issuedVnd: p.invoices.issuedVnd },
    deltaBp: {
      closed: deltaBp(c.orders.closed, p.orders.closed),
      orderTotalVnd: deltaBp(c.revenue.orderTotalVnd, p.revenue.orderTotalVnd),
      exTaxVnd: deltaBp(c.revenue.exTaxVnd, p.revenue.exTaxVnd),
      avgPerOrderVnd: deltaBp(c.revenue.avgPerOrderVnd, p.revenue.avgPerOrderVnd),
      inflowVnd: deltaBp(c.money.inflowVnd, p.money.inflowVnd),
      invoicesIssuedVnd: deltaBp(c.invoices.issuedVnd, p.invoices.issuedVnd),
    },
  };
}

function sumMonth(
  month: string,
  rows: readonly Rolled[],
  dates: readonly string[],
): Omit<MonthlyReport, 'comparison'> {
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

/**
 * Daily branch rollup (slice 1.9, FR-RPT-001/003/004/011/012/013/014; BA R68 rule 3). A rollup is a READ MODEL: one
 * document per branch and business day, derived from the source documents by the pure function `computeDaily` and
 * read by key (no query, no index). Nothing here is the book of record: the source documents stay the truth and the
 * rollup is rebuilt from them (idempotent, same facts give the same document and the same `sourceHash`).
 * Money is integer VND. No I/O in this file.
 */

/** Vietnam has no daylight saving time; the business day is Asia/Ho_Chi_Minh (platform DEFAULT_TIME_ZONE). */
const VN_OFFSET = '+07:00';
const DAY_MS = 86_400_000;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** [from, to) of a business date. */
export function dayWindow(date: string): { from: Date; to: Date } {
  const from = new Date(`${date}T00:00:00${VN_OFFSET}`);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

export function addDays(date: string, n: number): string {
  return vnDate(new Date(new Date(`${date}T12:00:00${VN_OFFSET}`).getTime() + n * DAY_MS));
}

/** yyyy-MM-dd of an instant in the business time zone. */
export function vnDate(at: Date): string {
  return new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export const rollupId = (branchId: string, date: string): string =>
  `${branchId}_${date.replace(/-/g, '')}`;

// ---- policy (effective-dated configuration `report-policy`, NFR-MNT-01) -------------------------------------------------

/** Every number is a default [Đề xuất dev - chờ xác nhận: Chủ garage/Quản lý]; none is a legal rule. */
export interface RptPolicy {
  /** an order open longer than this many days raises `order_open_too_long` */
  openOrderMaxDays: number;
  /** a completed order without a valid invoice for more than this many days raises `not_invoiced` */
  uninvoicedAfterDays: number;
  /** a handed-over order with an unpaid, undebted balance older than this many days raises `handover_unpaid` */
  unpaidHandoverGraceDays: number;
  /** a closed shift whose cash variance is larger than this (absolute VND) raises `cash_variance` */
  cashVarianceAlertVnd: number;
}

export const DEFAULT_RPT_POLICY: RptPolicy = {
  openOrderMaxDays: 5,
  uninvoicedAfterDays: 1,
  unpaidHandoverGraceDays: 0,
  cashVarianceAlertVnd: 0,
};

// ---- facts: what the sources (REC, ACC, EIN, INV) hand to the computation ------------------------------------------------

export interface OrderFact {
  id: string;
  number: string;
  plate: string;
  customerName: string;
  status: string;
  createdAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  handedOverAt?: Date;
  /** tax-inclusive total, base plus approved supplements */
  totalVnd: number;
  promisedDate?: string;
}
export interface LinesFact {
  /** approved lines, before tax */
  laborVnd: number;
  partsVnd: number;
}
export interface MoneyFact {
  /** receipts net of reversals, plus deposits applied */
  receivedVnd: number;
  /** an approved debt that is still open (R44) */
  openDebtVnd: number;
}
export interface InvoiceStateFact {
  valid: boolean;
  /** an issue request is still in the queue (not "missing": somebody is on it) */
  requestOpen: boolean;
}
export interface PaymentFact {
  id: string;
  number: string;
  kind: 'receipt' | 'deposit' | 'expense' | 'reversal';
  direction: 'in' | 'out';
  reversesKind?: 'receipt' | 'deposit' | 'expense' | 'reversal';
  orderId: string | null;
  businessDate: string;
  lines: { method: string; amountVnd: number }[];
  totalVnd: number;
}
export interface DebtFact {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  amountVnd: number;
  dueDate: string;
}
export interface ShiftFact {
  id: string;
  status: 'open' | 'closed';
  varianceVnd: number | null;
  varianceStatus: string;
}
export interface InvoiceFact {
  id: string;
  number?: string;
  orderId: string;
  orderNumber: string;
  /** valid for the books: issued and not cancelled */
  valid: boolean;
  totalVnd: number;
  issuedDate?: string;
}
export interface StockIssueFact {
  id: string;
  label: string;
  /** the source document (RULE-007): a repair order id; null = none */
  sourceType: string;
  sourceId: string | null;
}

export interface DayFacts {
  /** every order the scan saw, plus orders still open (deduplicated by id) */
  orders: readonly OrderFact[];
  lines: ReadonlyMap<string, LinesFact>;
  money: ReadonlyMap<string, MoneyFact>;
  invoiceStates: ReadonlyMap<string, InvoiceStateFact>;
  payments: readonly PaymentFact[];
  openDebts: readonly DebtFact[];
  shifts: readonly ShiftFact[];
  /** the day was closed (FR-ACC-004): its numbers are official */
  dayClosedAt: Date | null;
  invoicesIssued: readonly InvoiceFact[];
  stockIssues: readonly StockIssueFact[];
  /** a source list hit its cap: the numbers are a lower bound and the screen says so */
  truncated: readonly string[];
}

// ---- the rollup ----------------------------------------------------------------------------------------------------------

export const ALERT_KINDS = [
  'order_open_too_long',
  'handover_unpaid',
  'debt_overdue',
  'not_invoiced',
  'cash_variance',
  'stock_without_source',
  'reconcile_gap',
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export type RefKind = 'order' | 'payment' | 'invoice' | 'debt' | 'stock-doc' | 'shift';
export interface DocRef {
  kind: RefKind;
  /** the id of the source document (an order id for a debt) */
  id: string;
  label: string;
  note?: string;
  valueVnd?: number;
}

export const REF_METRICS = [
  'opened',
  'closed',
  'handedOver',
  'cancelled',
  'openAtEnd',
  'unpaid',
  'notInvoiced',
  'payments',
  'invoicesIssued',
  'openDebts',
  'stockWithoutSource',
] as const;
export type RefMetric = (typeof REF_METRICS)[number];

export interface AlertItem {
  kind: AlertKind;
  ref: DocRef;
  ageDays: number;
  valueVnd: number;
}

export const PAYMENT_METHOD_KEYS = ['cash', 'transfer', 'card', 'qr'] as const;

export interface DailyRollup {
  id: string;
  companyId: string;
  branchId: string;
  date: string;
  /** FR-RPT-010: the day is closed in ACC, so the numbers are official; otherwise provisional */
  official: boolean;
  schemaVersion: 1;
  computedAt: Date;
  /** hash of everything below except `computedAt` and `sourceHash` (a rebuild that changes nothing writes nothing) */
  sourceHash: string;
  orders: {
    opened: number;
    closed: number;
    handedOver: number;
    cancelled: number;
    openAtEnd: number;
  };
  revenue: {
    /** tax-inclusive total of the orders completed on the date */
    orderTotalVnd: number;
    laborVnd: number;
    partsVnd: number;
    /** laborVnd + partsVnd, approved lines before tax */
    exTaxVnd: number;
    /** orderTotalVnd - exTaxVnd: tax plus rounding and order-level discount */
    taxAndOtherVnd: number;
    avgPerOrderVnd: number;
  };
  money: {
    /** signed: reversals subtract; receipts and deposits, by method */
    byMethod: Record<string, number>;
    receiptCount: number;
    inflowVnd: number;
    depositVnd: number;
    expenseVnd: number;
    /** orders completed on the date: money received for them, approved open debt, and what is left */
    receivedForClosedVnd: number;
    debtForClosedVnd: number;
    /** orderTotal - received - debt for the orders completed on the date (0 = reconciled, FR-RPT-003) */
    gapVnd: number;
    gapOrders: number;
  };
  receivables: {
    openDebtVnd: number;
    openDebtCount: number;
    overdueDebtVnd: number;
    overdueDebtCount: number;
  };
  invoices: {
    issuedCount: number;
    issuedVnd: number;
    closedWithoutInvoiceCount: number;
    closedWithoutInvoiceVnd: number;
  };
  stock: { issueDocuments: number; issuesWithoutSource: number };
  cash: { shiftsClosed: number; shiftsWithVariance: number; varianceVnd: number };
  alertCounts: Record<AlertKind, number>;
  alerts: AlertItem[];
  alertsTruncated: boolean;
  refs: Record<RefMetric, DocRef[]>;
  /** metrics whose reference list was cut at the cap (the count above is still exact) */
  refsTruncated: RefMetric[];
  /** source lists that hit their scan cap: the report says "lower bound" */
  truncated: string[];
}

export interface ComputeLimits {
  refsMax: number;
  alertsMax: number;
}

const inWindow = (d: Date | undefined, w: { from: Date; to: Date }) =>
  !!d && d.getTime() >= w.from.getTime() && d.getTime() < w.to.getTime();

const orderRef = (o: OrderFact, note?: string, valueVnd?: number): DocRef => ({
  kind: 'order',
  id: o.id,
  label: `${o.number} · ${o.plate}`,
  ...(note ? { note } : {}),
  valueVnd: valueVnd ?? o.totalVnd,
});

const ageDaysOf = (from: Date, asOf: Date) =>
  Math.max(0, Math.floor((asOf.getTime() - from.getTime()) / DAY_MS));

/**
 * The daily rollup of one branch. `asOf` is the clock for age based alerts: the end of the day for a past date and
 * the current instant for today, so a rebuild of a past day is repeatable. Pure.
 */
export function computeDaily(
  key: { companyId: string; branchId: string; date: string },
  facts: DayFacts,
  policy: RptPolicy,
  limits: ComputeLimits,
  now: Date,
  hash: (v: unknown) => string,
): DailyRollup {
  const w = dayWindow(key.date);
  const asOf = now.getTime() < w.to.getTime() ? now : w.to;
  const refs = Object.fromEntries(REF_METRICS.map((m) => [m, [] as DocRef[]])) as Record<
    RefMetric,
    DocRef[]
  >;
  const refsTruncated = new Set<RefMetric>();
  const addRef = (m: RefMetric, r: DocRef) => {
    if (refs[m].length < limits.refsMax) refs[m].push(r);
    else refsTruncated.add(m);
  };
  const alerts: AlertItem[] = [];
  const alertCounts = Object.fromEntries(ALERT_KINDS.map((k) => [k, 0])) as Record<
    AlertKind,
    number
  >;
  let alertsTruncated = false;
  const alert = (kind: AlertKind, ref: DocRef, ageDays: number, valueVnd: number) => {
    alertCounts[kind]++;
    if (alerts.length < limits.alertsMax) alerts.push({ kind, ref, ageDays, valueVnd });
    else alertsTruncated = true;
  };

  const orders = [...facts.orders].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );

  let opened = 0;
  let closed = 0;
  let handedOver = 0;
  let cancelled = 0;
  let openAtEnd = 0;
  let orderTotal = 0;
  let labor = 0;
  let parts = 0;
  let receivedClosed = 0;
  let debtClosed = 0;
  let gapVnd = 0;
  let gapOrders = 0;
  let closedWithoutInvoice = 0;
  let closedWithoutInvoiceVnd = 0;

  for (const o of orders) {
    // opened: created inside the day (a cancelled order was still opened that day)
    if (inWindow(o.createdAt, w)) {
      opened++;
      addRef('opened', orderRef(o));
    }
    if (inWindow(o.cancelledAt, w)) {
      cancelled++;
      addRef('cancelled', orderRef(o));
    }
    if (inWindow(o.handedOverAt, w)) {
      handedOver++;
      addRef('handedOver', orderRef(o));
    }
    // open at the end of the day: created by then, not completed and not cancelled by then
    const createdByEnd = o.createdAt.getTime() < w.to.getTime();
    const doneByEnd =
      (o.completedAt && o.completedAt.getTime() < w.to.getTime()) ||
      (o.cancelledAt && o.cancelledAt.getTime() < w.to.getTime());
    if (createdByEnd && !doneByEnd) {
      openAtEnd++;
      addRef('openAtEnd', orderRef(o, o.status));
      const age = ageDaysOf(o.createdAt, asOf);
      if (age > policy.openOrderMaxDays)
        alert('order_open_too_long', orderRef(o, o.status), age, o.totalVnd);
    }
    if (inWindow(o.completedAt, w)) {
      closed++;
      addRef('closed', orderRef(o));
      orderTotal += o.totalVnd;
      const l = facts.lines.get(o.id);
      labor += l?.laborVnd ?? 0;
      parts += l?.partsVnd ?? 0;
      const m = facts.money.get(o.id) ?? { receivedVnd: 0, openDebtVnd: 0 };
      receivedClosed += m.receivedVnd;
      debtClosed += m.openDebtVnd;
      const gap = o.totalVnd - m.receivedVnd - m.openDebtVnd;
      if (gap !== 0) {
        gapVnd += gap;
        gapOrders++;
        addRef('unpaid', orderRef(o, gap > 0 ? 'unpaid' : 'overpaid', gap));
        const age = ageDaysOf(o.completedAt!, asOf);
        if (gap > 0 && age >= policy.unpaidHandoverGraceDays)
          alert('handover_unpaid', orderRef(o, 'unpaid', gap), age, gap);
        else if (gap < 0) alert('reconcile_gap', orderRef(o, 'overpaid', gap), age, -gap);
      }
    }
  }

  // Completed orders without a valid invoice: every completed order inside the scan that is not invoiced and has no
  // open request, not only those completed on the date (an old uninvoiced order is the point of the alert).
  for (const o of orders) {
    if (!o.completedAt || o.completedAt.getTime() >= w.to.getTime()) continue;
    const st = facts.invoiceStates.get(o.id);
    if (st?.valid || st?.requestOpen) continue;
    const age = ageDaysOf(o.completedAt, asOf);
    closedWithoutInvoice++;
    closedWithoutInvoiceVnd += o.totalVnd;
    addRef('notInvoiced', orderRef(o));
    if (age >= policy.uninvoicedAfterDays) alert('not_invoiced', orderRef(o), age, o.totalVnd);
  }

  // payments of the date, by method (reversals subtract; expenses are outflow and kept apart)
  const byMethod: Record<string, number> = Object.fromEntries(
    PAYMENT_METHOD_KEYS.map((k) => [k, 0]),
  );
  let receiptCount = 0;
  let inflow = 0;
  let deposit = 0;
  let expense = 0;
  for (const p of facts.payments) {
    if (p.businessDate !== key.date) continue;
    addRef('payments', {
      kind: 'payment',
      id: p.id,
      label: p.number,
      note: p.kind,
      valueVnd: p.direction === 'in' ? p.totalVnd : -p.totalVnd,
    });
    const sign = p.direction === 'in' ? 1 : -1;
    const moneyIn =
      p.kind === 'receipt' ||
      p.kind === 'deposit' ||
      p.reversesKind === 'receipt' ||
      p.reversesKind === 'deposit';
    if (moneyIn) {
      for (const l of p.lines) byMethod[l.method] = (byMethod[l.method] ?? 0) + sign * l.amountVnd;
      inflow += sign * p.totalVnd;
      if (p.kind === 'receipt') receiptCount++;
      if (p.kind === 'deposit') deposit += p.totalVnd;
      if (p.reversesKind === 'deposit') deposit -= p.totalVnd;
    } else {
      // expense out, or the reversal of an expense (in)
      expense += -sign * p.totalVnd;
    }
  }

  const today = vnDate(asOf);
  let overdueCount = 0;
  let overdueVnd = 0;
  let debtVnd = 0;
  for (const d of facts.openDebts) {
    debtVnd += d.amountVnd;
    addRef('openDebts', {
      kind: 'debt',
      id: d.orderId,
      label: `${d.orderNumber} · ${d.customerName}`,
      note: d.dueDate,
      valueVnd: d.amountVnd,
    });
    if (d.dueDate < today || (key.date < today && d.dueDate < key.date)) {
      overdueCount++;
      overdueVnd += d.amountVnd;
      const due = new Date(`${d.dueDate}T00:00:00${VN_OFFSET}`);
      alert(
        'debt_overdue',
        {
          kind: 'debt',
          id: d.orderId,
          label: `${d.orderNumber} · ${d.customerName}`,
          note: d.dueDate,
          valueVnd: d.amountVnd,
        },
        ageDaysOf(due, asOf),
        d.amountVnd,
      );
    }
  }

  let issuedVnd = 0;
  for (const i of facts.invoicesIssued) {
    if (!i.valid) continue;
    issuedVnd += i.totalVnd;
    addRef('invoicesIssued', {
      kind: 'invoice',
      id: i.id,
      label: `${i.number ?? i.id} · ${i.orderNumber}`,
      valueVnd: i.totalVnd,
    });
  }
  const issuedCount = facts.invoicesIssued.filter((i) => i.valid).length;

  // RULE-007: a goods issue always carries a source document; the expected number is 0
  let withoutSource = 0;
  for (const s of facts.stockIssues) {
    if (s.sourceId) continue;
    withoutSource++;
    const ref: DocRef = { kind: 'stock-doc', id: s.id, label: s.label, note: s.sourceType };
    addRef('stockWithoutSource', ref);
    alert('stock_without_source', ref, 0, 0);
  }

  let shiftsClosed = 0;
  let shiftsWithVariance = 0;
  let varianceVnd = 0;
  for (const s of facts.shifts) {
    if (s.status !== 'closed') continue;
    shiftsClosed++;
    const v = s.varianceVnd ?? 0;
    if (v !== 0) {
      shiftsWithVariance++;
      varianceVnd += v;
    }
    if (Math.abs(v) > policy.cashVarianceAlertVnd && v !== 0)
      alert('cash_variance', { kind: 'shift', id: s.id, label: s.id, valueVnd: v }, 0, Math.abs(v));
  }

  const body = {
    id: rollupId(key.branchId, key.date),
    companyId: key.companyId,
    branchId: key.branchId,
    date: key.date,
    official: facts.dayClosedAt !== null,
    schemaVersion: 1 as const,
    orders: { opened, closed, handedOver, cancelled, openAtEnd },
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
      receiptCount,
      inflowVnd: inflow,
      depositVnd: deposit,
      expenseVnd: expense,
      receivedForClosedVnd: receivedClosed,
      debtForClosedVnd: debtClosed,
      gapVnd,
      gapOrders,
    },
    receivables: {
      openDebtVnd: debtVnd,
      openDebtCount: facts.openDebts.length,
      overdueDebtVnd: overdueVnd,
      overdueDebtCount: overdueCount,
    },
    invoices: {
      issuedCount,
      issuedVnd,
      closedWithoutInvoiceCount: closedWithoutInvoice,
      closedWithoutInvoiceVnd,
    },
    stock: { issueDocuments: facts.stockIssues.length, issuesWithoutSource: withoutSource },
    cash: { shiftsClosed, shiftsWithVariance, varianceVnd },
    alertCounts,
    alerts: alerts.sort(
      (a, b) =>
        ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind) ||
        b.ageDays - a.ageDays ||
        a.ref.id.localeCompare(b.ref.id),
    ),
    alertsTruncated,
    refs,
    refsTruncated: [...refsTruncated].sort(),
    truncated: [...facts.truncated].sort(),
  };
  return { ...body, computedAt: now, sourceHash: hash(body) };
}

// ---- consolidation from per-branch rollups (the owner's view, trivial because every figure adds up) ---------------------------

export interface RollupTotals {
  branches: number;
  official: number;
  orders: DailyRollup['orders'];
  revenue: DailyRollup['revenue'];
  money: Pick<
    DailyRollup['money'],
    'inflowVnd' | 'expenseVnd' | 'gapVnd' | 'receivedForClosedVnd' | 'debtForClosedVnd'
  >;
  byMethod: Record<string, number>;
  receivables: DailyRollup['receivables'];
  invoices: DailyRollup['invoices'];
  stock: DailyRollup['stock'];
  alertCounts: Record<AlertKind, number>;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Sum of the rollups given (already limited to the actor's scope by the caller). Missing days are not counted as zero. */
export function totalsOf(rows: readonly DailyRollup[]): RollupTotals {
  const byMethod: Record<string, number> = {};
  for (const r of rows)
    for (const [k, v] of Object.entries(r.money.byMethod)) byMethod[k] = (byMethod[k] ?? 0) + v;
  const orderTotal = sum(rows.map((r) => r.revenue.orderTotalVnd));
  const closed = sum(rows.map((r) => r.orders.closed));
  const exTax = sum(rows.map((r) => r.revenue.exTaxVnd));
  return {
    branches: rows.length,
    official: rows.filter((r) => r.official).length,
    orders: {
      opened: sum(rows.map((r) => r.orders.opened)),
      closed,
      handedOver: sum(rows.map((r) => r.orders.handedOver)),
      cancelled: sum(rows.map((r) => r.orders.cancelled)),
      openAtEnd: sum(rows.map((r) => r.orders.openAtEnd)),
    },
    revenue: {
      orderTotalVnd: orderTotal,
      laborVnd: sum(rows.map((r) => r.revenue.laborVnd)),
      partsVnd: sum(rows.map((r) => r.revenue.partsVnd)),
      exTaxVnd: exTax,
      taxAndOtherVnd: orderTotal - exTax,
      avgPerOrderVnd: closed > 0 ? Math.round(exTax / closed) : 0,
    },
    money: {
      inflowVnd: sum(rows.map((r) => r.money.inflowVnd)),
      expenseVnd: sum(rows.map((r) => r.money.expenseVnd)),
      gapVnd: sum(rows.map((r) => r.money.gapVnd)),
      receivedForClosedVnd: sum(rows.map((r) => r.money.receivedForClosedVnd)),
      debtForClosedVnd: sum(rows.map((r) => r.money.debtForClosedVnd)),
    },
    byMethod,
    receivables: {
      openDebtVnd: sum(rows.map((r) => r.receivables.openDebtVnd)),
      openDebtCount: sum(rows.map((r) => r.receivables.openDebtCount)),
      overdueDebtVnd: sum(rows.map((r) => r.receivables.overdueDebtVnd)),
      overdueDebtCount: sum(rows.map((r) => r.receivables.overdueDebtCount)),
    },
    invoices: {
      issuedCount: sum(rows.map((r) => r.invoices.issuedCount)),
      issuedVnd: sum(rows.map((r) => r.invoices.issuedVnd)),
      closedWithoutInvoiceCount: sum(rows.map((r) => r.invoices.closedWithoutInvoiceCount)),
      closedWithoutInvoiceVnd: sum(rows.map((r) => r.invoices.closedWithoutInvoiceVnd)),
    },
    stock: {
      issueDocuments: sum(rows.map((r) => r.stock.issueDocuments)),
      issuesWithoutSource: sum(rows.map((r) => r.stock.issuesWithoutSource)),
    },
    alertCounts: Object.fromEntries(
      ALERT_KINDS.map((k) => [k, sum(rows.map((r) => r.alertCounts[k] ?? 0))]),
    ) as Record<AlertKind, number>,
  };
}

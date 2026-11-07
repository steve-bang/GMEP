import { describe, expect, it } from 'vitest';
import { fingerprintOf } from '@/platform/idempotency/idempotency';
import {
  addDays,
  computeDaily,
  dayWindow,
  DEFAULT_RPT_POLICY,
  rollupId,
  totalsOf,
  vnDate,
  type DayFacts,
  type OrderFact,
} from '@/modules/rpt';

/**
 * Slice 1.9 rollup math (FR-RPT-001, 003, 004, 011, 013): pure, no I/O. Amounts are integer VND; the sample figures are
 * NOT accountant sign-off (revenue here is "approved labor + parts before tax", an assumption listed in the open questions).
 */
const key = { tenantId: 'cmp', branchId: 'br_q7', date: '2026-11-03' };
const at = (hhmm: string, day = '2026-11-03') => new Date(`${day}T${hhmm}:00+07:00`);
const NOW = at('18:00', '2026-11-04'); // the next day: the 3rd is a past day, asOf = end of the 3rd
const limits = { refsMax: 60, alertsMax: 100 };

const order = (id: string, p: Partial<OrderFact> = {}): OrderFact => ({
  id,
  number: `RO-${id}`,
  plate: `51A-${id}`,
  customerName: 'Khách',
  status: 'completed',
  createdAt: at('08:00'),
  totalVnd: 1_080_000,
  ...p,
});

const empty: DayFacts = {
  orders: [],
  lines: new Map(),
  money: new Map(),
  invoiceStates: new Map(),
  payments: [],
  openDebts: [],
  shifts: [],
  dayClosedAt: null,
  invoicesIssued: [],
  stockIssues: [],
  truncated: [],
};

const facts = (): DayFacts => ({
  ...empty,
  orders: [
    // completed and handed over on the 3rd, fully paid, invoiced
    order('1', { completedAt: at('15:00'), handedOverAt: at('15:30'), totalVnd: 1_080_000 }),
    // completed on the 3rd, 80k on debt (approved), invoiced
    order('2', { completedAt: at('16:00'), handedOverAt: at('16:10'), totalVnd: 2_160_000 }),
    // completed on the 3rd, nothing collected, no debt, no invoice
    order('3', { completedAt: at('17:00'), handedOverAt: at('17:05'), totalVnd: 540_000 }),
    // still open, opened 8 days before
    order('4', {
      status: 'in_progress',
      createdAt: at('09:00', '2026-10-26'),
      totalVnd: 3_000_000,
    }),
    // opened and cancelled on the 3rd
    order('5', { status: 'cancelled', cancelledAt: at('11:00'), totalVnd: 100_000 }),
  ],
  lines: new Map([
    ['1', { laborVnd: 400_000, partsVnd: 600_000 }],
    ['2', { laborVnd: 1_000_000, partsVnd: 1_000_000 }],
    ['3', { laborVnd: 500_000, partsVnd: 0 }],
  ]),
  money: new Map([
    ['1', { receivedVnd: 1_080_000, openDebtVnd: 0 }],
    ['2', { receivedVnd: 1_660_000, openDebtVnd: 500_000 }],
    ['3', { receivedVnd: 0, openDebtVnd: 0 }],
  ]),
  invoiceStates: new Map([
    ['1', { valid: true, requestOpen: false }],
    ['2', { valid: true, requestOpen: false }],
  ]),
  payments: [
    {
      id: 'p1',
      number: 'PT-1',
      kind: 'receipt',
      direction: 'in',
      orderId: '1',
      businessDate: '2026-11-03',
      lines: [{ method: 'cash', amountVnd: 1_080_000 }],
      totalVnd: 1_080_000,
    },
    {
      id: 'p2',
      number: 'PT-2',
      kind: 'receipt',
      direction: 'in',
      orderId: '2',
      businessDate: '2026-11-03',
      lines: [
        { method: 'transfer', amountVnd: 1_000_000 },
        { method: 'card', amountVnd: 660_000 },
      ],
      totalVnd: 1_660_000,
    },
    {
      id: 'p3',
      number: 'PT-3',
      kind: 'deposit',
      direction: 'in',
      orderId: '4',
      businessDate: '2026-11-03',
      lines: [{ method: 'cash', amountVnd: 300_000 }],
      totalVnd: 300_000,
    },
    {
      // reversal of the deposit: out, subtracts
      id: 'p4',
      number: 'PT-4R',
      kind: 'reversal',
      direction: 'out',
      reversesKind: 'deposit',
      orderId: '4',
      businessDate: '2026-11-03',
      lines: [{ method: 'cash', amountVnd: 100_000 }],
      totalVnd: 100_000,
    },
    {
      id: 'p5',
      number: 'PC-1',
      kind: 'expense',
      direction: 'out',
      orderId: null,
      businessDate: '2026-11-03',
      lines: [{ method: 'cash', amountVnd: 50_000 }],
      totalVnd: 50_000,
    },
    {
      // another business day read by the wider window: ignored
      id: 'p6',
      number: 'PT-X',
      kind: 'receipt',
      direction: 'in',
      orderId: '9',
      businessDate: '2026-11-04',
      lines: [{ method: 'cash', amountVnd: 999 }],
      totalVnd: 999,
    },
  ],
  openDebts: [
    {
      id: 'd1',
      orderId: '2',
      orderNumber: 'RO-2',
      customerName: 'Khách',
      amountVnd: 500_000,
      dueDate: '2026-11-01',
    },
  ],
  shifts: [
    { id: 's1', status: 'closed', varianceVnd: -20_000, varianceStatus: 'approved' },
    { id: 's2', status: 'closed', varianceVnd: 0, varianceStatus: 'none' },
    { id: 's3', status: 'open', varianceVnd: null, varianceStatus: 'none' },
  ],
  invoicesIssued: [
    {
      id: 'i1',
      number: '0000001',
      orderId: '1',
      orderNumber: 'RO-1',
      valid: true,
      totalVnd: 1_080_000,
    },
    {
      id: 'i2',
      number: '0000002',
      orderId: '2',
      orderNumber: 'RO-2',
      valid: true,
      totalVnd: 2_160_000,
    },
  ],
  stockIssues: [
    { id: 'g1', label: 'GIN-1', sourceType: 'repair-order', sourceId: '1' },
    { id: 'g2', label: 'GIN-2', sourceType: 'repair-order', sourceId: null },
  ],
});

// A past day is judged at its end: an order completed that evening is 0 days old. The tests that look at alerts use
// "uninvoiced from day 0" so the order completed on the 3rd is listed.
const P0 = { ...DEFAULT_RPT_POLICY, uninvoicedAfterDays: 0 };
const run = (f: DayFacts, now = NOW, policy = P0) =>
  computeDaily(key, f, policy, limits, now, fingerprintOf);

describe('business days (Asia/Ho_Chi_Minh, no DST)', () => {
  it('window, next day and the local date of an instant', () => {
    const w = dayWindow('2026-11-03');
    expect(w.from.toISOString()).toBe('2026-11-02T17:00:00.000Z');
    expect(w.to.getTime() - w.from.getTime()).toBe(86_400_000);
    expect(addDays('2026-11-03', 1)).toBe('2026-11-04');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(vnDate(new Date('2026-11-02T18:30:00Z'))).toBe('2026-11-03');
    expect(rollupId('br_q7', '2026-11-03')).toBe('br_q7_20261103');
  });
});

describe('FR-RPT-003 daily rollup math', () => {
  const r = run(facts());

  it('orders: opened, closed, handed over, cancelled, open at the end of the day', () => {
    expect(r.orders).toEqual({ opened: 4, closed: 3, handedOver: 3, cancelled: 1, openAtEnd: 1 });
    // order 5 was opened and cancelled the same day: counted as opened (it was created) and as cancelled
    expect(r.refs.opened.map((x) => x.id)).toEqual(['1', '2', '3', '5']);
  });

  it('revenue: labor + parts of the approved lines of orders completed on the date, before tax', () => {
    expect(r.revenue).toEqual({
      orderTotalVnd: 3_780_000,
      laborVnd: 1_900_000,
      partsVnd: 1_600_000,
      exTaxVnd: 3_500_000,
      taxAndOtherVnd: 280_000,
      avgPerOrderVnd: 1_166_667,
    });
  });

  it('money by method: reversals subtract, expenses are kept apart, another business day is ignored', () => {
    expect(r.money.byMethod).toEqual({
      cash: 1_080_000 + 300_000 - 100_000,
      transfer: 1_000_000,
      card: 660_000,
      qr: 0,
    });
    expect(r.money.inflowVnd).toBe(1_080_000 + 1_660_000 + 300_000 - 100_000);
    expect(r.money.depositVnd).toBe(200_000);
    expect(r.money.expenseVnd).toBe(50_000);
    expect(r.money.receiptCount).toBe(2);
    expect(r.refs.payments.map((x) => x.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('FR-RPT-003 reconciliation: total = received + open debt + gap, and the gap names the order', () => {
    expect(r.money.receivedForClosedVnd).toBe(2_740_000);
    expect(r.money.debtForClosedVnd).toBe(500_000);
    expect(r.money.gapVnd).toBe(540_000);
    expect(r.money.gapOrders).toBe(1);
    expect(r.revenue.orderTotalVnd).toBe(
      r.money.receivedForClosedVnd + r.money.debtForClosedVnd + r.money.gapVnd,
    );
    expect(r.refs.unpaid.map((x) => x.id)).toEqual(['3']);
  });

  it('invoices issued vs completed orders without an invoice (RULE-007 / FR-RPT-004 minimum)', () => {
    expect(r.invoices).toEqual({
      issuedCount: 2,
      issuedVnd: 3_240_000,
      closedWithoutInvoiceCount: 1,
      closedWithoutInvoiceVnd: 540_000,
      completedWithoutInvoiceCount: 1,
    });
    expect(r.refs.notInvoiced.map((x) => x.id)).toEqual(['3']);
    expect(r.schemaVersion).toBe(7);
  });

  it('R114: the day flow counts only orders completed ON the date; an older uninvoiced order is backlog, not flow', () => {
    // completed the day before, never invoiced: in the end-of-day backlog, not in the day's flow
    const f: DayFacts = {
      ...facts(),
      orders: [
        ...facts().orders,
        order('6', {
          createdAt: at('08:00', '2026-11-02'),
          completedAt: at('15:00', '2026-11-02'),
          totalVnd: 700_000,
          serviceType: 'maintenance',
        }),
      ],
    };
    const x = run(f);
    expect(x.invoices.closedWithoutInvoiceCount).toBe(2);
    expect(x.invoices.completedWithoutInvoiceCount).toBe(1);
    // the flow is part of the backlog by the same test: an open request or a valid invoice removes it from both
    (f.invoiceStates as Map<string, unknown>).set('3', { valid: false, requestOpen: true });
    expect(run(f).invoices.completedWithoutInvoiceCount).toBe(0);
    expect(run(f).invoices.closedWithoutInvoiceCount).toBe(1);
    // per service type, same definition (R114 with the service-type filter)
    const m = x.byServiceType!.find((s) => s.serviceType === 'maintenance')!;
    expect(m.notInvoicedCount).toBe(1);
    expect(m.completedNotInvoicedCount).toBe(0);
  });

  it('an order whose issue request is still in the queue is not "missing"', () => {
    const f = facts();
    (f.invoiceStates as Map<string, unknown>).set('3', { valid: false, requestOpen: true });
    expect(run(f).invoices.closedWithoutInvoiceCount).toBe(0);
  });

  it('RULE-007: goods issues without a source document are counted (expected 0) and alerted', () => {
    expect(r.stock).toEqual({ issueDocuments: 2, issuesWithoutSource: 1 });
    expect(r.refs.stockWithoutSource.map((x) => x.id)).toEqual(['g2']);
    expect(
      run({ ...facts(), stockIssues: [facts().stockIssues[0]!] }).stock.issuesWithoutSource,
    ).toBe(0);
  });

  it('cash: closed shifts with a variance', () => {
    expect(r.cash).toEqual({ shiftsClosed: 2, shiftsWithVariance: 1, varianceVnd: -20_000 });
  });

  it('receivables: open debt and overdue debt (due before the date)', () => {
    expect(r.receivables).toEqual({
      openDebtVnd: 500_000,
      openDebtCount: 1,
      overdueDebtVnd: 500_000,
      overdueDebtCount: 1,
    });
  });

  it('FR-RPT-010: official only when the day is closed', () => {
    expect(r.official).toBe(false);
    expect(run({ ...facts(), dayClosedAt: at('23:00') }).official).toBe(true);
  });
});

describe('exception alerts (open > 5 days, uninvoiced >= 0 days here, unpaid grace 0, any cash variance)', () => {
  const r = run(facts());
  it('lists each kind with its document and age', () => {
    expect(r.alertCounts).toEqual({
      order_open_too_long: 1,
      handover_unpaid: 1,
      debt_overdue: 1,
      not_invoiced: 1,
      cash_variance: 1,
      stock_without_source: 1,
      reconcile_gap: 0,
    });
    const open = r.alerts.find((a) => a.kind === 'order_open_too_long')!;
    expect(open.ref.id).toBe('4');
    expect(open.ageDays).toBe(8); // 26/10 09:00 to the end of 03/11
  });
  it('the thresholds are policy, not code', () => {
    const lenient = computeDaily(
      key,
      facts(),
      { ...P0, openOrderMaxDays: 30, uninvoicedAfterDays: 5, cashVarianceAlertVnd: 50_000 },
      limits,
      NOW,
      fingerprintOf,
    );
    expect(lenient.alertCounts.order_open_too_long).toBe(0);
    expect(lenient.alertCounts.not_invoiced).toBe(0);
    expect(lenient.alertCounts.cash_variance).toBe(0);
  });
  it('overpaid orders raise reconcile_gap, not handover_unpaid', () => {
    const f = facts();
    (f.money as Map<string, unknown>).set('1', { receivedVnd: 1_180_000, openDebtVnd: 0 });
    const x = run(f);
    expect(x.alertCounts.reconcile_gap).toBe(1);
    expect(x.money.gapVnd).toBe(540_000 - 100_000);
  });
  it('caps are explicit: counts stay exact, lists say they were cut', () => {
    const many: OrderFact[] = Array.from({ length: 5 }, (_, i) =>
      order(`c${i}`, { completedAt: at('12:00') }),
    );
    const x = computeDaily(
      key,
      { ...empty, orders: many },
      P0,
      { refsMax: 2, alertsMax: 2 },
      NOW,
      fingerprintOf,
    );
    expect(x.orders.closed).toBe(5);
    expect(x.refs.closed).toHaveLength(2);
    expect(x.refsTruncated).toContain('closed');
    expect(x.alertCounts.not_invoiced).toBe(5);
    expect(x.alerts).toHaveLength(2);
    expect(x.alertsTruncated).toBe(true);
  });
});

describe('rebuild idempotency: same facts, same document', () => {
  it('the hash ignores computedAt and the order the sources return rows in', () => {
    const a = run(facts(), NOW);
    const f = facts();
    const shuffled: DayFacts = {
      ...f,
      orders: [...f.orders].reverse(),
      payments: [...f.payments].reverse(),
    };
    const b = run(shuffled, new Date(NOW.getTime() + 60_000));
    // refs keep source order for payments, so compare the figures and the hash of the figures
    expect(b.orders).toEqual(a.orders);
    expect(b.revenue).toEqual(a.revenue);
    expect(b.money.byMethod).toEqual(a.money.byMethod);
    expect(b.alertCounts).toEqual(a.alertCounts);
    expect(run(facts(), new Date(NOW.getTime() + 60_000)).sourceHash).toBe(a.sourceHash);
  });
  it('the default policy waits a day before listing an uninvoiced order', () => {
    expect(run(facts(), NOW, DEFAULT_RPT_POLICY).alertCounts.not_invoiced).toBe(0);
    expect(run(facts(), NOW, DEFAULT_RPT_POLICY).invoices.closedWithoutInvoiceCount).toBe(1);
  });
  it('a changed source changes the hash', () => {
    const f = facts();
    (f.money as Map<string, unknown>).set('3', { receivedVnd: 540_000, openDebtVnd: 0 });
    expect(run(f).sourceHash).not.toBe(run(facts()).sourceHash);
  });
});

describe('consolidated owner view is the sum of the per-branch rollups', () => {
  it('totals add up and a missing branch is not counted as zero', () => {
    const a = run(facts());
    const b = computeDaily({ ...key, branchId: 'br_td' }, facts(), P0, limits, NOW, fingerprintOf);
    const t = totalsOf([a, b]);
    expect(t.branches).toBe(2);
    expect(t.revenue.exTaxVnd).toBe(2 * a.revenue.exTaxVnd);
    expect(t.revenue.orderTotalVnd).toBe(2 * a.revenue.orderTotalVnd);
    expect(t.orders.closed).toBe(6);
    expect(t.byMethod.cash).toBe(2 * a.money.byMethod.cash!);
    expect(t.alertCounts.not_invoiced).toBe(2);
    expect(totalsOf([a]).branches).toBe(1);
    expect(totalsOf([]).revenue.exTaxVnd).toBe(0);
  });
});

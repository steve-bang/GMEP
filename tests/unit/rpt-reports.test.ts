import { describe, expect, it } from 'vitest';
import {
  computeMonthly,
  computeReconcile,
  computeTechnicians,
  computeWarehouse,
  monthDates,
  type WorkItemFact,
} from '@/modules/rpt';

type Day = Parameters<typeof computeMonthly>[1][number];

const day = (date: string, o: Partial<Record<string, number>> = {}, official = true): Day => ({
  date,
  official,
  orders: {
    opened: o.opened ?? 0,
    closed: o.closed ?? 0,
    handedOver: 0,
    cancelled: 0,
    openAtEnd: o.openAtEnd ?? 0,
  },
  revenue: {
    orderTotalVnd: o.total ?? 0,
    laborVnd: o.labor ?? 0,
    partsVnd: o.parts ?? 0,
    exTaxVnd: (o.labor ?? 0) + (o.parts ?? 0),
    taxAndOtherVnd: 0,
    avgPerOrderVnd: 0,
  },
  money: {
    byMethod: { cash: o.cash ?? 0 },
    receiptCount: 0,
    inflowVnd: o.cash ?? 0,
    depositVnd: 0,
    expenseVnd: 0,
    receivedForClosedVnd: o.received ?? 0,
    debtForClosedVnd: o.debt ?? 0,
    gapVnd: (o.total ?? 0) - (o.received ?? 0) - (o.debt ?? 0),
    gapOrders: o.gapOrders ?? 0,
  },
  receivables: {
    openDebtVnd: o.openDebt ?? 0,
    openDebtCount: 0,
    overdueDebtVnd: 0,
    overdueDebtCount: 0,
  },
  invoices: {
    issuedCount: o.issued ?? 0,
    issuedVnd: 0,
    closedWithoutInvoiceCount: o.notInv ?? 0,
    closedWithoutInvoiceVnd: 0,
  },
  stock: { issueDocuments: o.gin ?? 0, issuesWithoutSource: o.noSrc ?? 0 },
  cash: { shiftsClosed: 0, shiftsWithVariance: o.shiftVar ?? 0, varianceVnd: 0 },
});

describe('monthly report (FR-RPT-002)', () => {
  it('lists the days of a month, leap February included', () => {
    expect(monthDates('2026-11')).toHaveLength(30);
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthDates('2026-12').at(-1)).toBe('2026-12-31');
  });

  it('sums flows, takes end-of-period figures from the last present day and never counts a missing day as zero', () => {
    const m = computeMonthly('2026-11', [
      day('2026-11-01', {
        closed: 2,
        labor: 1_000_000,
        parts: 500_000,
        total: 1_620_000,
        openDebt: 300,
      }),
      day(
        '2026-11-02',
        { closed: 1, labor: 200_000, parts: 100_000, total: 324_000, openDebt: 100, notInv: 2 },
        false,
      ),
    ]);
    expect(m.present).toBe(2);
    expect(m.official).toBe(1);
    expect(m.missingDates).toHaveLength(28);
    expect(m.revenue.exTaxVnd).toBe(1_800_000);
    expect(m.revenue.taxAndOtherVnd).toBe(1_944_000 - 1_800_000);
    // avg = round(exTax / closed orders)
    expect(m.revenue.avgPerOrderVnd).toBe(600_000);
    // a snapshot, not a sum
    expect(m.endOfPeriod).toMatchObject({
      date: '2026-11-02',
      openDebtVnd: 100,
      closedWithoutInvoiceCount: 2,
    });
    expect(m.money.byMethod.cash).toBe(0);
  });

  it('an empty month is all zeros with every day missing', () => {
    const m = computeMonthly('2026-11', []);
    expect(m.present).toBe(0);
    expect(m.revenue.avgPerOrderVnd).toBe(0);
    expect(m.endOfPeriod.date).toBeNull();
    expect(m.missingDates).toHaveLength(30);
  });
});

describe('four-way reconciliation (FR-RPT-004, RULE-007)', () => {
  const all = { payments: true, invoices: true, cash: true, stock: true };
  it('flags each of the four checks on the day it fails and skips days without a rollup', () => {
    const r = computeReconcile(
      '2026-11-01',
      '2026-11-04',
      [
        day('2026-11-01', { closed: 1, total: 100, received: 100 }),
        day('2026-11-02', {
          closed: 1,
          total: 100,
          received: 40,
          debt: 10,
          gapOrders: 1,
          notInv: 1,
          shiftVar: 1,
          noSrc: 2,
        }),
        day('2026-11-04', { closed: 1, total: 50, received: 50, notInv: 1 }),
      ],
      all,
    );
    expect(r.rows.map((x) => x.failed)).toEqual([
      [],
      ['payments', 'invoices', 'cash', 'stock'],
      ['invoices'],
    ]);
    expect(r.rows[1]!.gapVnd).toBe(50);
    expect(r.missingDates).toEqual(['2026-11-03']);
    expect(r.failedDays).toBe(2);
    expect(r.reconciled).toBe(false);
    expect(r.totals).toMatchObject({
      closed: 3,
      orderTotalVnd: 250,
      receivedVnd: 190,
      gapVnd: 50,
      withoutSource: 2,
    });
    // not-invoiced is a stock-like figure: the last day, not 2
    expect(r.totals.notInvoicedCount).toBe(1);
  });

  it('does not judge a section the viewer may not see', () => {
    const r = computeReconcile(
      '2026-11-02',
      '2026-11-02',
      [day('2026-11-02', { noSrc: 3, total: 10 })],
      {
        ...all,
        stock: false,
        payments: false,
      },
    );
    expect(r.rows[0]!.failed).toEqual([]);
    expect(r.reconciled).toBe(true);
  });
});

describe('warehouse report (FR-RPT-005, RULE-008)', () => {
  const b = (
    partCode: string,
    onHand: number,
    reserved: number,
    minQty: number | null,
    extra = {},
  ) => ({
    warehouseId: 'wh1',
    partId: partCode,
    partCode,
    partName: partCode,
    onHand,
    reserved,
    inTransit: 0,
    valueVnd: onHand * 1000,
    minQty,
    maxQty: null,
    ...extra,
  });
  it('judges the reorder level on AVAILABLE, not on hand, and values the stock', () => {
    const r = computeWarehouse(
      [
        b('A', 10, 8, 3),
        b('B', 10, 0, 3),
        b('C', 0, 0, null),
        b('D', 5, 0, 5, { maxQty: 20, inTransit: 4 }),
      ],
      {
        showValue: true,
        belowMax: 10,
      },
    );
    // A: available 2 <= 3 although 10 on hand; D: available 5 <= 5
    expect(r.below.map((x) => x.partCode)).toEqual(['A', 'D']);
    expect(r.below[0]!.shortage).toBe(1);
    expect(r.below[1]!.suggestQty).toBe(20 - (5 + 4));
    expect(r.totalValueVnd).toBe(25_000);
    expect(r.summary[0]).toMatchObject({ lines: 4, below: 2, out: 1 });
  });
  it('hides the value without the cost permission', () => {
    const r = computeWarehouse([b('A', 1, 0, 5)], { showValue: false, belowMax: 10 });
    expect(r.totalValueVnd).toBe(0);
    expect(r.below[0]!.valueVnd).toBe(0);
  });
});

describe('technician report (FR-RPT-006): hours and jobs, never pay', () => {
  const it1 = (o: Partial<WorkItemFact>): WorkItemFact => ({
    orderId: 'o1',
    orderNumber: 'LSC-1',
    serviceType: 'maintenance',
    technicianId: 't1',
    technicianName: 'An',
    status: 'done',
    workedMs: 30 * 60_000,
    approvedMinutes: 36,
    ...o,
  });
  it('counts only finished items, sums minutes and gives efficiency in basis points', () => {
    const r = computeTechnicians([
      it1({}),
      it1({ orderId: 'o2', workedMs: 90 * 60_000, approvedMinutes: 60 }),
      it1({ status: 'in_progress' }),
      it1({
        technicianId: null,
        technicianName: null,
        serviceType: null,
        workedMs: 0,
        approvedMinutes: 10,
      }),
    ]);
    const an = r.rows.find((x) => x.technicianId === 't1')!;
    expect(an).toMatchObject({ jobs: 2, orders: 2, workedMinutes: 120, standardMinutes: 96 });
    expect(an.efficiencyBp).toBe(8000);
    const none = r.rows.find((x) => x.technicianId === null)!;
    expect(none.efficiencyBp).toBeNull();
    expect(r.totals.jobs).toBe(3);
    expect(r.byServiceType.find((x) => x.serviceType === 'maintenance')!.jobs).toBe(2);
  });
});

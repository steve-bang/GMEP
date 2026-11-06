import { describe, expect, it } from 'vitest';
import {
  computeMonthly,
  computeReconcile,
  computeTechnicians,
  computeWarehouse,
  deltaBp,
  monthDates,
  previousMonth,
  comparisonPeriod,
  COMPARED_METRICS,
  DEFAULT_COMPARISON,
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

describe('monthly comparison with the previous month (FR-RPT-002, AC-RPT-002-1..7, R110..R114)', () => {
  const K = DEFAULT_COMPARISON;
  const mk = (month: string, today: string, rows: Day[]) => {
    const period = comparisonPeriod(K, month, today)!;
    return { period, rows };
  };
  const cur = [
    day('2026-11-01', { closed: 3, labor: 1_000_000, parts: 500_000, cash: 900_000 }),
    day('2026-11-02', { closed: 1, labor: 500_000, parts: 0, cash: 100_000 }),
  ];
  // days 1..2 of October: closed 4, exTax 2_000_000, inflow 1_500_000
  const oct = (): Day[] => [
    day('2026-10-01', { closed: 2, labor: 800_000, parts: 200_000, cash: 1_000_000 }),
    day('2026-10-02', { closed: 2, labor: 700_000, parts: 300_000, cash: 500_000 }),
  ];

  it('R110: the default kind is previous-month-same-days and the compared metrics are declared once (R114)', () => {
    expect(DEFAULT_COMPARISON).toBe('previous-month-same-days');
    expect(COMPARED_METRICS).toEqual(['exTaxVnd', 'closed', 'inflowVnd']);
  });

  it('R112: a running month compares days 1..N with 1..N; a finished month compares whole with whole (April 30, leap February 29)', () => {
    expect(comparisonPeriod(K, '2026-11', '2026-11-02')).toMatchObject({
      month: '2026-10',
      current: { from: '2026-11-01', to: '2026-11-02' },
      previous: { from: '2026-10-01', to: '2026-10-02' },
    });
    expect(comparisonPeriod(K, '2026-05', '2026-06-10')).toMatchObject({
      month: '2026-04',
      current: { from: '2026-05-01', to: '2026-05-31' },
      previous: { from: '2026-04-01', to: '2026-04-30' },
    });
    expect(comparisonPeriod(K, '2026-03', '2026-05-10')).toMatchObject({
      previous: { from: '2026-02-01', to: '2026-02-28' },
    });
    expect(comparisonPeriod(K, '2028-03', '2028-05-10')!.previous.to).toBe('2028-02-29');
    // a running month later than the earlier month is long: the earlier month is taken whole
    expect(comparisonPeriod(K, '2026-03', '2026-03-31')).toMatchObject({
      current: { from: '2026-03-01', to: '2026-03-31' },
      previous: { from: '2026-02-01', to: '2026-02-28' },
    });
    expect(comparisonPeriod(K, '2027-01', '2026-11-04')).toBeNull();
    expect(comparisonPeriod(K, '2026-01', '2026-01-15')!.month).toBe('2025-12');
  });

  it('previousMonth rolls the year over', () => {
    expect(previousMonth('2026-11')).toBe('2026-10');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });

  it('R113: percent in integer basis points, ties away from zero, null when the base is 0', () => {
    expect(deltaBp(150, 100)).toBe(5000);
    expect(deltaBp(80, 100)).toBe(-2000);
    expect(deltaBp(1, 3)).toBe(-6667); // -66.666..% -> -6667 bp
    expect(deltaBp(2, 3)).toBe(-3333);
    expect(deltaBp(1, 8)).toBe(-8750);
    expect(deltaBp(1, 16)).toBe(-9375);
    expect(deltaBp(1, 32)).toBe(-9688); // -96.875% = -9687.5 bp: tie away from zero
    expect(deltaBp(33, 32)).toBe(313); // +3.125% = 312.5 bp
    expect(deltaBp(-1, 8)).toBe(-11250);
    expect(deltaBp(5, 0)).toBeNull();
    expect(deltaBp(0, 0)).toBeNull();
    // exact on large VND amounts (no float drift)
    expect(deltaBp(1_000_000_000_001, 1_000_000_000_000)).toBe(0);
    expect(deltaBp(9_000_000_000_000, 3_000_000_000_000)).toBe(20_000);
  });

  it('AC-002-5 hand example: increase and decrease, absolute change next to the percent', () => {
    const m = computeMonthly('2026-11', cur, mk('2026-11', '2026-11-02', oct()));
    const c = m.comparison!;
    expect(c).toMatchObject({
      month: '2026-10',
      currentDays: 2,
      previousDays: 2,
      lengthDiffers: false,
      previousPresent: 2,
      previousMissingDates: [],
      naReason: null,
    });
    // exTax 2_000_000 vs 2_000_000: same, 0 bp, 0 absolute
    expect(c.metrics.exTaxVnd).toEqual({
      current: 2_000_000,
      previous: 2_000_000,
      deltaAbs: 0,
      deltaBp: 0,
      state: 'ok',
    });
    // closed 4 vs 4
    expect(c.metrics.closed).toMatchObject({ deltaAbs: 0, deltaBp: 0 });
    // inflow 1.0M vs 1.5M = -500_000 = -33.33%
    expect(c.metrics.inflowVnd).toEqual({
      current: 1_000_000,
      previous: 1_500_000,
      deltaAbs: -500_000,
      deltaBp: -3333,
      state: 'ok',
    });
    const up = computeMonthly(
      '2026-11',
      cur,
      mk('2026-11', '2026-11-01', [
        day('2026-10-01', { closed: 2, labor: 600_000, parts: 0, cash: 400_000 }),
      ]),
    );
    // today is day 1, so only day 1 of November counts: exTax 1_500_000 vs 600_000 = +150%; closed 3 vs 2 = +50%
    expect(up.comparison!.metrics.exTaxVnd).toMatchObject({ deltaAbs: 900_000, deltaBp: 15_000 });
    expect(up.comparison!.metrics.closed).toMatchObject({ deltaAbs: 1, deltaBp: 5000 });
  });

  it('rollups outside the compared ranges never count (day 20 of October when the range is days 1..2)', () => {
    const m = computeMonthly(
      '2026-11',
      cur,
      mk('2026-11', '2026-11-02', [
        ...oct(),
        day('2026-10-20', { closed: 50, labor: 9_000_000, cash: 9_000_000 }),
      ]),
    );
    expect(m.comparison!.metrics.closed.previous).toBe(4);
  });

  it('R111: a previous range missing days is n/a with the reason and the number of days, never zero and no percent', () => {
    const m = computeMonthly(
      '2026-11',
      cur,
      mk('2026-11', '2026-11-03', [day('2026-10-02', { closed: 1, labor: 1_000_000 })]),
    );
    const c = m.comparison!;
    expect(c.naReason).toBe('missing');
    expect(c.previousPresent).toBe(1);
    expect(c.previousMissingDates).toEqual(['2026-10-01', '2026-10-03']);
    for (const k of COMPARED_METRICS)
      expect(c.metrics[k]).toMatchObject({
        previous: null,
        deltaAbs: null,
        deltaBp: null,
        state: 'na',
      });
    // the current period still shows normally
    expect(c.metrics.exTaxVnd.current).toBe(2_000_000);
    expect(m.revenue.exTaxVnd).toBe(2_000_000);
  });

  it('R111: no rollup at all in the previous range is n/a with reason no-data; nothing asked gives no comparison', () => {
    const none = computeMonthly('2026-11', cur, mk('2026-11', '2026-11-05', []));
    expect(none.comparison!.naReason).toBe('no-data');
    expect(none.comparison!.metrics.exTaxVnd.state).toBe('na');
    expect(computeMonthly('2026-11', cur).comparison).toBeNull();
  });

  it('R113: previous 0 with data and current > 0 is "new" (no percent, absolute kept); both 0 is "none"; never infinite', () => {
    const zeroPrev = computeMonthly(
      '2026-11',
      cur,
      mk('2026-11', '2026-11-02', [day('2026-10-01'), day('2026-10-02')]),
    );
    expect(zeroPrev.comparison!.metrics.exTaxVnd).toEqual({
      current: 2_000_000,
      previous: 0,
      deltaAbs: 2_000_000,
      deltaBp: null,
      state: 'new',
    });
    expect(zeroPrev.comparison!.metrics.closed).toMatchObject({ deltaAbs: 4, state: 'new' });
    const both = computeMonthly(
      '2026-11',
      [day('2026-11-01'), day('2026-11-02')],
      mk('2026-11', '2026-11-02', [day('2026-10-01'), day('2026-10-02')]),
    );
    expect(both.comparison!.metrics.exTaxVnd).toEqual({
      current: 0,
      previous: 0,
      deltaAbs: 0,
      deltaBp: null,
      state: 'none',
    });
    // current 0, previous > 0: -100.00%
    const gone = computeMonthly(
      '2026-11',
      [day('2026-11-01'), day('2026-11-02')],
      mk('2026-11', '2026-11-02', oct()),
    );
    expect(gone.comparison!.metrics.closed).toMatchObject({ deltaAbs: -4, deltaBp: -10_000 });
  });

  it('R112: both concrete ranges are present; a shorter earlier month is taken whole and labelled (March vs February)', () => {
    const march = cur.map((d) => ({ ...d, date: d.date.replace('2026-11', '2026-03') }));
    const m = computeMonthly('2026-03', march, {
      period: comparisonPeriod(K, '2026-03', '2026-03-31')!,
      rows: [day('2026-02-10', { closed: 1, labor: 100_000 })],
    });
    expect(m.comparison).toMatchObject({
      currentRange: { from: '2026-03-01', to: '2026-03-31' },
      previousRange: { from: '2026-02-01', to: '2026-02-28' },
      currentDays: 31,
      previousDays: 28,
      lengthDiffers: true,
      naReason: 'missing',
    });
    expect(m.comparison!.previousMissingDates).toHaveLength(27);
  });

  it('R108 shape: the figures compared are the same ones the report shows, so type lines + unlinked = unfiltered holds per period', () => {
    // the comparison reads exactly the rows it is given (narrowed or not): no extra source
    const rows = cur;
    const m = computeMonthly('2026-11', rows, mk('2026-11', '2026-11-02', oct()));
    expect(m.comparison!.metrics.exTaxVnd.current).toBe(m.revenue.exTaxVnd);
    expect(m.comparison!.metrics.inflowVnd.current).toBe(m.money.inflowVnd);
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

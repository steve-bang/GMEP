import { describe, expect, it } from 'vitest';
import {
  periodRollup,
  previousDates,
  resolveRange,
  totalsOf,
  type DailyRollup,
  type DashboardDto,
} from '@/modules/rpt';
import { bucketTrend, buildHomeModel } from '../../src/app/(shell)/dashboardModel';
import {
  activePreset,
  addDaysIso,
  daysBetween,
  presetRange,
  pushEnd,
  validateRange,
} from '@/ui/dateRange';

/**
 * Dashboard date range (FR-RPT-001): the range rules, the fold of one branch's days into one document-shaped value, the
 * previous period, weekly buckets of the trend, the filter helpers. Flows add up, stock-like figures come from the last
 * day, a missing day is listed and never counted as zero.
 */

const roll = (
  branchId: string,
  date: string,
  o: Partial<{
    labor: number;
    parts: number;
    closed: number;
    opened: number;
    openAtEnd: number;
    cash: number;
    debt: number;
    official: boolean;
  }> = {},
): DailyRollup =>
  ({
    id: `${branchId}_${date}`,
    companyId: 'cmp',
    branchId,
    date,
    official: o.official ?? true,
    schemaVersion: 4,
    computedAt: new Date(`${date}T10:00:00Z`),
    sourceHash: 'h',
    orders: {
      opened: o.opened ?? 0,
      closed: o.closed ?? 0,
      handedOver: 0,
      cancelled: 0,
      openAtEnd: o.openAtEnd ?? 0,
    },
    revenue: {
      orderTotalVnd: ((o.labor ?? 0) + (o.parts ?? 0)) * 1.1,
      laborVnd: o.labor ?? 0,
      partsVnd: o.parts ?? 0,
      exTaxVnd: (o.labor ?? 0) + (o.parts ?? 0),
      taxAndOtherVnd: ((o.labor ?? 0) + (o.parts ?? 0)) * 0.1,
      avgPerOrderVnd: 0,
    },
    money: {
      byMethod: { cash: o.cash ?? 0 },
      receiptCount: 1,
      inflowVnd: o.cash ?? 0,
      depositVnd: 0,
      expenseVnd: 0,
      receivedForClosedVnd: o.cash ?? 0,
      debtForClosedVnd: 0,
      gapVnd: 0,
      gapOrders: 0,
    },
    receivables: {
      openDebtVnd: o.debt ?? 0,
      openDebtCount: o.debt ? 1 : 0,
      overdueDebtVnd: 0,
      overdueDebtCount: 0,
    },
    invoices: {
      issuedCount: 1,
      issuedVnd: 100,
      closedWithoutInvoiceCount: o.closed ?? 0,
      closedWithoutInvoiceVnd: 0,
    },
    stock: { issueDocuments: 1, issuesWithoutSource: 0 },
    cash: { shiftsClosed: 1, shiftsWithVariance: 0, varianceVnd: 0 },
    alertCounts: {},
    alerts: [],
    alertsTruncated: false,
    refs: {},
    refsTruncated: [],
    truncated: [],
  }) as unknown as DailyRollup;

describe('resolveRange (default today, date = one day, from alone runs to today, limits)', () => {
  const T = '2026-11-05';
  it('defaults to today and takes the old single `date` as a range of one day', () => {
    expect(resolveRange({}, T, 93)).toMatchObject({ from: T, to: T, days: 1, dates: [T] });
    expect(resolveRange({ date: '2026-11-01' }, T, 93)).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-01',
      days: 1,
    });
  });
  it('from alone runs to today; to alone is that one day; from and to win over date', () => {
    expect(resolveRange({ from: '2026-10-30' }, T, 93)).toMatchObject({ to: T, days: 7 });
    expect(resolveRange({ to: '2026-11-02' }, T, 93)).toMatchObject({
      from: '2026-11-02',
      days: 1,
    });
    expect(
      resolveRange({ date: '2026-01-01', from: '2026-11-01', to: '2026-11-03' }, T, 93),
    ).toMatchObject({ from: '2026-11-01', to: '2026-11-03', days: 3 });
  });
  it('from after to is invalid_range; 93 days pass and 94 are range_too_long (both 422)', () => {
    expect(() => resolveRange({ from: '2026-11-04', to: '2026-11-03' }, T, 93)).toThrowError(
      expect.objectContaining({ code: 'invalid_range', status: 422 }),
    );
    expect(resolveRange({ from: addDaysIso(T, -92), to: T }, T, 93).days).toBe(93);
    expect(() => resolveRange({ from: addDaysIso(T, -93), to: T }, T, 93)).toThrowError(
      expect.objectContaining({ code: 'range_too_long', status: 422 }),
    );
  });
  it('crosses a month and a year end without losing a day', () => {
    const r = resolveRange({ from: '2026-12-30', to: '2027-01-02' }, '2027-01-02', 93);
    expect(r.dates).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });
});

describe('previousDates: the period of the same length that ends the day before', () => {
  it('one day -> yesterday; 7 days -> the 7 days before', () => {
    expect(previousDates('2026-11-05', 1)).toEqual(['2026-11-04']);
    expect(previousDates('2026-10-30', 7)).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
    ]);
  });
});

describe('periodRollup (one branch folded over the dates)', () => {
  const dates = ['2026-11-01', '2026-11-02', '2026-11-03'];
  it('one day returns the stored document itself', () => {
    const r = roll('b', '2026-11-01', { labor: 10 });
    const p = periodRollup([r], ['2026-11-01']);
    expect(p.rollup).toBe(r);
    expect(p.missingDates).toEqual([]);
  });
  it('sums the flows and takes the stock-like figures from the last day', () => {
    const p = periodRollup(
      [
        roll('b', dates[0]!, {
          labor: 100,
          parts: 50,
          closed: 2,
          opened: 3,
          cash: 70,
          openAtEnd: 9,
          debt: 500,
        }),
        roll('b', dates[1]!, {
          labor: 200,
          closed: 1,
          opened: 1,
          cash: 30,
          openAtEnd: 8,
          debt: 400,
        }),
        roll('b', dates[2]!, {
          parts: 25,
          closed: 4,
          opened: 2,
          cash: 10,
          openAtEnd: 5,
          debt: 300,
        }),
      ],
      dates,
    );
    const r = p.rollup!;
    expect(r.revenue).toMatchObject({ laborVnd: 300, partsVnd: 75, exTaxVnd: 375 });
    expect(r.orders).toMatchObject({ opened: 6, closed: 7, openAtEnd: 5 }); // opened/closed summed, openAtEnd = last day
    expect(r.money.inflowVnd).toBe(110);
    expect(r.money.byMethod).toEqual({ cash: 110 });
    expect(r.receivables.openDebtVnd).toBe(300); // a state at the end, never summed (900 would be wrong)
    expect(r.invoices.closedWithoutInvoiceCount).toBe(4);
    expect(r.invoices.issuedCount).toBe(3);
    expect(r.date).toBe('2026-11-03'); // the end-of-period date
    expect(p.official).toBe(true);
  });
  it('a missing day is listed, never counted as 0; the range is official only if every day is present and official', () => {
    const p = periodRollup(
      [roll('b', dates[0]!, { labor: 100 }), roll('b', dates[2]!, { labor: 50 })],
      dates,
    );
    expect(p.missingDates).toEqual(['2026-11-02']);
    expect(p.presentDates).toEqual(['2026-11-01', '2026-11-03']);
    expect(p.rollup!.revenue.exTaxVnd).toBe(150);
    expect(p.official).toBe(false);
    const prov = periodRollup(
      dates.map((d, i) => roll('b', d, { labor: 1, official: i !== 1 })),
      dates,
    );
    expect(prov.official).toBe(false);
  });
  it('no rollup at all in the range is null (not a zero document)', () => {
    const p = periodRollup([], dates);
    expect(p.rollup).toBeNull();
    expect(p.missingDates).toEqual(dates);
  });
  it('branches add up through totalsOf: flows summed over days and branches, states over branches at their last day', () => {
    const a = periodRollup(
      [
        roll('a', dates[0]!, { labor: 10, openAtEnd: 4 }),
        roll('a', dates[1]!, { labor: 20, openAtEnd: 3 }),
      ],
      dates.slice(0, 2),
    ).rollup!;
    const b = periodRollup(
      [
        roll('b', dates[0]!, { labor: 1, openAtEnd: 2 }),
        roll('b', dates[1]!, { labor: 2, openAtEnd: 1 }),
      ],
      dates.slice(0, 2),
    ).rollup!;
    const t = totalsOf([a, b]);
    expect(t.revenue.exTaxVnd).toBe(33);
    expect(t.orders.openAtEnd).toBe(4); // 3 + 1
    expect(t.branches).toBe(2);
  });
});

describe('bucketTrend (a column must stay readable)', () => {
  const series = (n: number, holes: number[] = []) =>
    Array.from({ length: n }, (_, i) => ({
      date: addDaysIso('2026-08-01', i),
      exTaxVnd: holes.includes(i) ? null : 10,
      official: i % 10 !== 0,
    }));
  it('up to 31 days: one column per day', () => {
    const t = bucketTrend(series(31));
    expect(t.bucket).toBe('day');
    expect(t.points).toHaveLength(31);
    expect(t.points[3]).toMatchObject({ days: 1, value: 10 });
  });
  it('over 31 days: one column per 7 days, the last one shorter; 93 days = 13 weeks + 2 days', () => {
    const t = bucketTrend(series(93));
    expect(t.bucket).toBe('week');
    expect(t.points).toHaveLength(14);
    expect(t.points[0]).toMatchObject({ date: '2026-08-01', to: '2026-08-07', days: 7, value: 70 });
    expect(t.points.at(-1)).toMatchObject({ days: 2, value: 20 });
    expect(bucketTrend(series(32)).points.map((p) => p.days)).toEqual([7, 7, 7, 7, 4]);
  });
  it('a week sums only the days that have a rollup, says how many are missing, and is a gap when none has one', () => {
    const holes = [1, 2, ...Array.from({ length: 7 }, (_, i) => 7 + i)];
    const t = bucketTrend(series(40, holes));
    expect(t.points[0]).toMatchObject({ value: 50, missingDays: 2 }); // 5 days present, not 70
    expect(t.points[1]).toMatchObject({ value: null, missingDays: 7 }); // a gap, never 0
  });
  it('a week is provisional when any of its days is not official', () => {
    const t = bucketTrend(series(40));
    expect(t.points[0]!.provisional).toBe(true); // day 0 is not official
  });
});

describe('filter helpers (presets, validation, "Từ" pushes "Đến")', () => {
  const T = '2026-11-05';
  it('presets are today, yesterday, the last 7 and the last 30 days counting today', () => {
    expect(presetRange('today', T)).toEqual({ from: T, to: T });
    expect(presetRange('yesterday', T)).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(presetRange('d7', T)).toEqual({ from: '2026-10-30', to: T });
    expect(presetRange('d30', T)).toEqual({ from: '2026-10-07', to: T });
    expect(daysBetween('2026-10-30', T)).toBe(7);
    expect(daysBetween('2026-10-07', T)).toBe(30);
  });
  it('the active preset is found by the range; any other range is custom (null)', () => {
    expect(activePreset(T, T, T)).toBe('today');
    expect(activePreset('2026-10-30', T, T)).toBe('d7');
    expect(activePreset('2026-10-31', T, T)).toBeNull();
  });
  it('validation: format, future, order, too long, and ok at the limit', () => {
    const v = (a: string, b: string) => validateRange(a, b, T, 93);
    expect(v('5/11', '05/11/2026')).toMatchObject({ ok: false, field: 'from', error: 'format' });
    expect(v('31/02/2026', '05/11/2026')).toMatchObject({ ok: false, error: 'format' });
    expect(v('01/11/2026', '06/11/2026')).toMatchObject({
      ok: false,
      field: 'to',
      error: 'future',
    });
    expect(v('06/11/2026', '06/11/2026')).toMatchObject({
      ok: false,
      field: 'from',
      error: 'future',
    });
    expect(v('04/11/2026', '03/11/2026')).toMatchObject({ ok: false, field: 'to', error: 'order' });
    expect(v('01/08/2026', '05/11/2026')).toMatchObject({ ok: false, error: 'tooLong', days: 97 });
    expect(v('05/08/2026', '05/11/2026')).toMatchObject({ ok: true, days: 93 });
    expect(v('05/11/2026', '05/11/2026')).toEqual({ ok: true, from: T, to: T, days: 1 });
  });
  it('"Từ" after "Đến" pushes "Đến" to the same day; otherwise "Đến" is kept', () => {
    expect(pushEnd('2026-11-04', '2026-11-02')).toBe('2026-11-04');
    expect(pushEnd('2026-11-01', '2026-11-02')).toBe('2026-11-02');
  });
});

describe('home model over a range (cards, links, trend)', () => {
  const base = (over: Partial<DashboardDto> = {}) =>
    ({
      date: '2026-11-05',
      from: '2026-10-30',
      to: '2026-11-05',
      days: 7,
      today: '2026-11-05',
      maxDays: 93,
      snapshotDate: '2026-11-04',
      missingDates: [],
      comparison: {} as DashboardDto['comparison'],
      lens: 'manager',
      visible: {
        orders: true,
        revenue: true,
        money: true,
        receivables: true,
        invoices: true,
        stock: true,
        cash: true,
      },
      consolidated: false,
      rows: [{ branchId: 'br_q7', code: 'Q7', name: 'Q7', missing: false, rollup: null }],
      totals: totalsOf([
        roll('br_q7', '2026-11-05', { labor: 10, closed: 1, openAtEnd: 2, debt: 5 }),
      ]),
      allOfficial: true,
      previousExTaxVnd: null,
      series: [{ date: '2026-11-05', exTaxVnd: 10, official: true }],
      lastComputedAt: null,
      truncated: [],
      alertTotal: 0,
      topAlerts: [],
      ...over,
    }) as DashboardDto;
  it('a summed card has no single-day link over several days; a state card links to the day it belongs to and is labelled as of that day', () => {
    const m = buildHomeModel(base());
    expect(m.multi).toBe(true);
    const k = (id: string) => m.kpis.find((x) => x.id === id)!;
    expect(k('closed').href).toBeUndefined();
    expect(k('inflow').href).toBeUndefined();
    expect(k('openAtEnd').href).toContain('date=2026-11-04');
    expect(k('openAtEnd').asOf).toBe(true);
    expect(k('debt').asOf).toBe(true);
    expect(k('revenue').asOf).toBeUndefined();
  });
  it('one day keeps every link and no "as of" label', () => {
    const m = buildHomeModel(base({ days: 1, from: '2026-11-05' }));
    expect(m.multi).toBe(false);
    expect(m.kpis.find((x) => x.id === 'closed')!.href).toContain('date=2026-11-05');
    expect(m.kpis.some((x) => x.asOf)).toBe(false);
  });
});

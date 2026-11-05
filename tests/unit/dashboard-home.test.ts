import { describe, expect, it } from 'vitest';
import type { DashboardDto } from '@/modules/rpt';
import { buildHomeModel, LENS_KPIS } from '../../src/app/(shell)/dashboardModel';
import { compactVnd, niceScale, pctOfAxis } from '@/ui/charts/scale';

const zeroTotals = {
  branches: 1,
  official: 0,
  orders: { opened: 4, closed: 3, handedOver: 2, cancelled: 1, openAtEnd: 5 },
  revenue: {
    orderTotalVnd: 11_000_000,
    laborVnd: 4_000_000,
    partsVnd: 6_000_000,
    exTaxVnd: 10_000_000,
    taxAndOtherVnd: 1_000_000,
    avgPerOrderVnd: 3_333_333,
  },
  money: {
    inflowVnd: 7_000_000,
    expenseVnd: 0,
    gapVnd: 500_000,
    receivedForClosedVnd: 0,
    debtForClosedVnd: 0,
  },
  byMethod: { cash: 3_000_000, transfer: 4_000_000, qr: 0 },
  receivables: {
    openDebtVnd: 2_000_000,
    openDebtCount: 2,
    overdueDebtVnd: 500_000,
    overdueDebtCount: 1,
  },
  invoices: {
    issuedCount: 2,
    issuedVnd: 6_000_000,
    closedWithoutInvoiceCount: 1,
    closedWithoutInvoiceVnd: 1_000_000,
  },
  stock: { issueDocuments: 3, issuesWithoutSource: 0 },
  alertCounts: {},
} as unknown as DashboardDto['totals'];

const dto = (over: Partial<DashboardDto> = {}): DashboardDto => ({
  date: '2026-11-04',
  from: '2026-11-04',
  to: '2026-11-04',
  days: 1,
  today: '2026-11-04',
  maxDays: 93,
  snapshotDate: '2026-11-04',
  missingDates: [],
  comparison: {
    from: '2026-11-03',
    to: '2026-11-03',
    previousDaysComplete: 1,
    currentDaysComplete: 1,
    previousComplete: true,
    currentComplete: true,
  },
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
  rows: [{ branchId: 'br_q7', code: 'Q7', name: 'Quận 7', missing: false, rollup: null }],
  totals: zeroTotals,
  allOfficial: false,
  previousExTaxVnd: 8_000_000,
  series: [
    { date: '2026-11-03', exTaxVnd: 8_000_000, official: true },
    { date: '2026-11-04', exTaxVnd: null, official: false },
  ],
  lastComputedAt: null,
  truncated: [],
  alertTotal: 0,
  topAlerts: [],
  ...over,
});

describe('home dashboard model (FR-RPT-001)', () => {
  it('manager sees revenue with a basis-point change against yesterday and drill links for one branch', () => {
    const m = buildHomeModel(dto());
    expect(m.kpis.map((k) => k.id)).toEqual(LENS_KPIS.manager);
    const rev = m.kpis.find((k) => k.id === 'revenue')!;
    expect(rev.deltaBp).toBe(2500); // (10 - 8) / 8 = +25,00%
    expect(m.kpis.find((k) => k.id === 'closed')!.href).toContain('metric=closed');
    expect(m.kpis.find((k) => k.id === 'debt')).toMatchObject({
      tone: 'danger',
      overdueVnd: 500_000,
    });
    expect(m.trend).toHaveLength(2);
    expect(m.trend![1]).toMatchObject({ value: null, provisional: true }); // a missing day is a gap, not 0
  });

  it('a cut block gives no card and no chart (cashier: no revenue, no orders, no invoices)', () => {
    const m = buildHomeModel(
      dto({
        lens: 'cashier',
        visible: {
          orders: false,
          revenue: false,
          money: true,
          receivables: true,
          invoices: false,
          stock: false,
          cash: true,
        },
        previousExTaxVnd: null,
        series: [],
      }),
    );
    expect(m.kpis.map((k) => k.id)).toEqual(['inflow', 'gap', 'debt']);
    expect(m.trend).toBeNull();
    expect(m.revenueSplit).toBeNull();
    expect(m.orderBars).toBeNull();
    expect(m.methodBars?.map((b) => b.key)).toEqual(['transfer', 'cash']); // zero methods dropped, largest first
  });

  it('no previous day: delta is null, not 0 percent', () => {
    const m = buildHomeModel(dto({ previousExTaxVnd: null }));
    expect(m.kpis.find((k) => k.id === 'revenue')!.deltaBp).toBeNull();
  });

  it('consolidated owner view bars only branches that have a rollup, largest first, and no drill links', () => {
    const roll = (v: number) => ({ revenue: { exTaxVnd: v } }) as never;
    const m = buildHomeModel(
      dto({
        lens: 'owner',
        consolidated: true,
        rows: [
          { branchId: 'a', code: 'A', name: 'A', missing: false, rollup: roll(1) },
          { branchId: 'b', code: 'B', name: 'B', missing: true, rollup: null },
          { branchId: 'c', code: 'C', name: 'C', missing: false, rollup: roll(9) },
        ],
      }),
    );
    expect(m.branchBars?.map((b) => b.branchId)).toEqual(['c', 'a']);
    expect(m.kpis.every((k) => k.href === undefined)).toBe(true);
  });

  it('a role with every block cut reports hasBlocks=false', () => {
    const none = {
      orders: false,
      revenue: false,
      money: false,
      receivables: false,
      invoices: false,
      stock: false,
      cash: false,
    };
    const m = buildHomeModel(dto({ visible: none, lens: 'advisor' }));
    expect(m.hasBlocks).toBe(false);
    expect(m.kpis).toEqual([]);
  });
});

describe('chart scale helpers', () => {
  it('niceScale gives about four round steps and covers the maximum', () => {
    expect(niceScale(0)).toEqual({ top: 4, step: 1 });
    expect(niceScale(68_200_000)).toEqual({ top: 80_000_000, step: 20_000_000 });
    expect(niceScale(7)).toEqual({ top: 8, step: 2 });
    const { top } = niceScale(123_456_789);
    expect(top).toBeGreaterThanOrEqual(123_456_789);
  });
  it('compactVnd uses Vietnamese units and separators', () => {
    expect(compactVnd(458_000_000)).toBe('458 tr ₫');
    expect(compactVnd(1_250_000_000)).toBe('1,3 tỷ ₫');
    expect(compactVnd(820_000)).toBe('820.000 ₫');
    expect(compactVnd(-5_500_000)).toBe('−5,5 tr ₫');
  });
  it('pctOfAxis is clamped and never negative', () => {
    expect(pctOfAxis(50, 200)).toBe(25);
    expect(pctOfAxis(-5, 200)).toBe(0);
    expect(pctOfAxis(500, 200)).toBe(100);
    expect(pctOfAxis(5, 0)).toBe(0);
  });
});

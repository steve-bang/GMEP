import { describe, expect, it } from 'vitest';
import { fingerprintOf } from '@/platform/idempotency/idempotency';
import { buildXlsx, columnName } from '@/platform/files/xlsxWriter';
import { parseTabular } from '@/platform/files/tabular';
import {
  computeDaily,
  computeMonthly,
  computeReconcile,
  DEFAULT_RPT_POLICY,
  forServiceType,
  type DayFacts,
  type OrderFact,
} from '@/modules/rpt';

const key = { companyId: 'cmp', branchId: 'br_q7', date: '2026-11-03' };
const at = (hhmm: string) => new Date(`2026-11-03T${hhmm}:00+07:00`);
const NOW = new Date('2026-11-04T18:00:00+07:00');
const limits = { refsMax: 60, alertsMax: 100 };
const order = (id: string, serviceType: string | null, total: number): OrderFact => ({
  id,
  number: `RO-${id}`,
  plate: `51A-${id}`,
  customerName: 'Khách',
  status: 'completed',
  createdAt: at('08:00'),
  completedAt: at('15:00'),
  totalVnd: total,
  serviceType,
});
const facts: DayFacts = {
  orders: [
    order('1', 'maintenance', 1_080_000),
    order('2', 'maintenance', 540_000),
    order('3', 'tires', 216_000),
    order('4', null, 108_000),
  ],
  lines: new Map([
    ['1', { laborVnd: 400_000, partsVnd: 600_000 }],
    ['2', { laborVnd: 500_000, partsVnd: 0 }],
    ['3', { laborVnd: 100_000, partsVnd: 100_000 }],
    ['4', { laborVnd: 100_000, partsVnd: 0 }],
  ]),
  money: new Map([
    ['1', { receivedVnd: 1_080_000, openDebtVnd: 0 }],
    ['2', { receivedVnd: 0, openDebtVnd: 40_000 }],
    ['3', { receivedVnd: 216_000, openDebtVnd: 0 }],
    ['4', { receivedVnd: 108_000, openDebtVnd: 0 }],
  ]),
  invoiceStates: new Map([
    ['1', { valid: true, requestOpen: false }],
    ['3', { valid: true, requestOpen: false }],
  ]),
  payments: [],
  openDebts: [],
  shifts: [],
  dayClosedAt: null,
  invoicesIssued: [],
  stockIssues: [],
  truncated: [],
};
const roll = () => computeDaily(key, facts, DEFAULT_RPT_POLICY, limits, NOW, fingerprintOf);

describe('FR-RPT-014: byServiceType in the daily rollup', () => {
  it('splits the order-bound figures by type and adds up to the day totals', () => {
    const r = roll();
    expect(r.schemaVersion).toBe(2);
    const by = new Map(r.byServiceType!.map((x) => [x.serviceType, x]));
    expect(by.get('maintenance')).toMatchObject({
      closed: 2,
      orderTotalVnd: 1_620_000,
      laborVnd: 900_000,
      partsVnd: 600_000,
      receivedVnd: 1_080_000,
      debtVnd: 40_000,
      gapVnd: 500_000,
      gapOrders: 1,
      notInvoicedCount: 1,
      notInvoicedVnd: 540_000,
    });
    expect(by.get('tires')!.notInvoicedCount).toBe(0);
    expect(by.get(null)!.closed).toBe(1);
    const sum = (f: (x: NonNullable<typeof r.byServiceType>[number]) => number) =>
      r.byServiceType!.reduce((s, x) => s + f(x), 0);
    expect(sum((x) => x.closed)).toBe(r.orders.closed);
    expect(sum((x) => x.orderTotalVnd)).toBe(r.revenue.orderTotalVnd);
    expect(sum((x) => x.laborVnd)).toBe(r.revenue.laborVnd);
    expect(sum((x) => x.gapVnd)).toBe(r.money.gapVnd);
    expect(sum((x) => x.notInvoicedCount)).toBe(r.invoices.closedWithoutInvoiceCount);
  });

  it('is rebuild-safe: same facts give the same hash; an old (v1) document differs and is replaced once', () => {
    const a = roll();
    const b = roll();
    expect(b.sourceHash).toBe(a.sourceHash);
    const { byServiceType: _drop, ...v1 } = a;
    void _drop;
    expect(fingerprintOf({ ...v1, sourceHash: undefined, computedAt: undefined })).not.toBe(
      fingerprintOf({ ...a, sourceHash: undefined, computedAt: undefined }),
    );
  });

  it('narrows the monthly and reconciliation reports; a version 1 day is listed, not counted as zero', () => {
    const r = roll();
    const old = { ...r, date: '2026-11-04' };
    delete (old as { byServiceType?: unknown }).byServiceType;
    const n = forServiceType([r, old], 'maintenance');
    expect(n.unavailableDates).toEqual(['2026-11-04']);
    const m = computeMonthly('2026-11', n.rolls);
    expect(m.orders.closed).toBe(2);
    expect(m.revenue.exTaxVnd).toBe(1_500_000);
    expect(m.revenue.orderTotalVnd).toBe(1_620_000);
    expect(m.money.gapVnd).toBe(500_000);
    const rc = computeReconcile('2026-11-03', '2026-11-03', n.rolls, {
      payments: true,
      invoices: true,
      cash: false,
      stock: false,
    });
    expect(rc.rows[0]!.failed).toEqual(['payments', 'invoices']);
    // a type with no order that day is zero, not missing
    const none = forServiceType([r], 'body-paint');
    expect(none.unavailableDates).toEqual([]);
    expect(computeMonthly('2026-11', none.rolls).orders.closed).toBe(0);
  });
});

describe('xlsx writer (FR-RPT-009)', () => {
  it('names columns like a spreadsheet', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });

  it('writes a workbook that the reader opens; text keeps its accents and formula text is neutralised', async () => {
    const bytes = buildXlsx(
      'Báo cáo: tháng/11',
      [
        ['Chi nhánh', 'Quận 7 & <Q7>'],
        ['Chỉ tiêu', 'Giá trị'],
        ['=HYPERLINK("http://x")', 1_500_000],
        ['@SUM(1)', -5],
        ['0912345678', null],
      ],
      1,
    );
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    const grid = await parseTabular(bytes, { maxBytes: 1_000_000, maxRows: 100 });
    expect(grid[0]).toEqual(['Chi nhánh', 'Quận 7 & <Q7>']);
    expect(grid[2]![0]).toBe('\'=HYPERLINK("http://x")');
    expect(grid[2]![1]).toBe('1500000');
    expect(grid[3]![0]).toBe("'@SUM(1)");
    expect(grid[3]![1]).toBe('-5');
    expect(grid[4]![0]).toBe('0912345678');
  });
});

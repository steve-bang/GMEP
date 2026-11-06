import { describe, expect, it } from 'vitest';
import {
  computeDaily,
  datesBetween,
  addDays,
  DEFAULT_RPT_POLICY,
  divRound,
  periodOfBranch,
  rankBranches,
  rankOnCommonDays,
  totalOfRows,
  type DailyRollup,
  type DayFacts,
  type OrderFact,
} from '@/modules/rpt';

/**
 * Slice 2.1 consolidation math (FR-RPT-002 ranking, FR-RPT-010, FR-RPT-015, FR-RPT-016; RULE-015): pure functions. The
 * sample figures are NOT accountant sign-off. Ratios are integer basis points, rounded half up; money is integer VND.
 */
const at = (hhmm: string, day = '2026-11-03') => new Date(`${day}T${hhmm}:00+07:00`);
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
const order = (id: string, customerId: string | undefined, createdAt = at('08:00')): OrderFact => ({
  id,
  number: id,
  plate: id,
  customerName: 'K',
  status: 'in_progress',
  createdAt,
  totalVnd: 1,
  ...(customerId ? { customerId } : {}),
});
const run = (facts: DayFacts) =>
  computeDaily(
    { tenantId: 't', branchId: 'b', date: '2026-11-03' },
    facts,
    DEFAULT_RPT_POLICY,
    { refsMax: 5, alertsMax: 5 },
    at('23:00'),
    () => 'h',
  );

describe('rollup schema 6: quotes and customer visits (FR-RPT-016, FR-RPT-015)', () => {
  it('omits both sections when the facts were not read (n/a, never 0)', () => {
    const r = run(empty);
    expect(r.schemaVersion).toBe(6);
    expect(r.quotes).toBeUndefined();
    expect(r.customers).toBeUndefined();
  });

  it('counts quotes created in the day by status now; drafts are not counted', () => {
    const r = run({
      ...empty,
      quotes: [
        { id: '1', createdAt: at('09:00'), status: 'approved_full' },
        { id: '2', createdAt: at('09:00'), status: 'approved_partial' },
        { id: '3', createdAt: at('09:00'), status: 'rejected' },
        { id: '4', createdAt: at('09:00'), status: 'expired' },
        { id: '5', createdAt: at('09:00'), status: 'sent' },
        { id: '6', createdAt: at('09:00'), status: 'draft' },
        { id: '7', createdAt: at('09:00', '2026-11-02'), status: 'approved_full' },
      ],
    });
    expect(r.quotes).toEqual({ created: 5, approved: 2, rejected: 1, expired: 1, pending: 1 });
  });

  it('customer visits: distinct customers of the orders opened that day, new = created that day, returning = before', () => {
    const created = new Map<string, Date>([
      ['new1', at('07:00')],
      ['old1', at('08:00', '2026-10-01')],
      ['old2', at('08:00', '2026-10-02')],
    ]);
    const r = run({
      ...empty,
      orders: [
        order('1', 'new1'),
        order('2', 'new1'), // the same customer twice in a day is one visit
        order('3', 'old1'),
        order('4', 'old2', at('09:00', '2026-11-02')), // opened the day before: not a visit of the 3rd
        order('5', 'ghost'), // unknown customer record: a visit, neither new nor returning
        order('6', undefined),
      ],
      customerCreated: created,
    });
    expect(r.customers).toEqual({ visits: 3, newCount: 1, returningCount: 1 });
  });

  it('the hash changes when a section appears, so a rebuild writes the upgraded document once', () => {
    const a = computeDaily(
      { tenantId: 't', branchId: 'b', date: '2026-11-03' },
      empty,
      DEFAULT_RPT_POLICY,
      { refsMax: 5, alertsMax: 5 },
      at('23:00'),
      (v) => JSON.stringify(v),
    );
    const b = computeDaily(
      { tenantId: 't', branchId: 'b', date: '2026-11-03' },
      { ...empty, quotes: [] },
      DEFAULT_RPT_POLICY,
      { refsMax: 5, alertsMax: 5 },
      at('23:00'),
      (v) => JSON.stringify(v),
    );
    expect(a.sourceHash).not.toBe(b.sourceHash);
  });
});

const roll = (date: string, p: Partial<DailyRollup> & { exTax?: number; closed?: number }) =>
  ({
    date,
    official: true,
    revenue: { exTaxVnd: p.exTax ?? 0, orderTotalVnd: p.exTax ?? 0 },
    orders: { closed: p.closed ?? 0 },
    money: { inflowVnd: 0 },
    ...(p.quotes ? { quotes: p.quotes } : {}),
    ...(p.customers ? { customers: p.customers } : {}),
    ...(p.official === false ? { official: false } : {}),
  }) as unknown as DailyRollup;

describe('ranking (FR-RPT-002, AC-RPT-002-8)', () => {
  const dates = datesBetween('2026-11-01', '2026-11-03', addDays);

  it('lists the dates of the period inclusive and nothing for a reversed range', () => {
    expect(dates).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(datesBetween('2026-11-03', '2026-11-01', addDays)).toEqual([]);
  });

  it('half-up integer division: 2.5 -> 3, 466 666.67 -> 466 667, exact stays exact', () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(7_000_000, 15)).toBe(466_667);
    expect(divRound(10, 5)).toBe(2);
    expect(divRound(0, 7)).toBe(0);
  });

  it('flow metric: sums the present days, lists missing days and provisional days, never counts a missing day as zero', () => {
    const p = periodOfBranch(
      'b1',
      dates,
      [roll('2026-11-01', { exTax: 100 }), roll('2026-11-03', { exTax: 50, official: false })],
      'exTaxVnd',
    );
    expect(p).toMatchObject({
      value: 150,
      presentDays: 2,
      provisionalDays: 1,
      missingDates: ['2026-11-02'],
    });
  });

  it('no document at all is "no value" (null), not zero', () => {
    const p = periodOfBranch('b1', dates, [], 'exTaxVnd');
    expect(p.value).toBeNull();
    expect(p.missingDates).toHaveLength(3);
  });

  it('standard competition ranking: ties share a rank, the next rank skips, branches without a value come last unranked', () => {
    const rows = [
      periodOfBranch('c', dates, [roll('2026-11-01', { exTax: 50 })], 'exTaxVnd'),
      periodOfBranch('a', dates, [roll('2026-11-01', { exTax: 100 })], 'exTaxVnd'),
      periodOfBranch('b', dates, [roll('2026-11-01', { exTax: 100 })], 'exTaxVnd'),
      periodOfBranch('d', dates, [], 'exTaxVnd'),
    ];
    const ranked = rankBranches(rows, (id) => id);
    expect(ranked.map((r) => [r.branchId, r.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
      ['d', null],
    ]);
    expect(totalOfRows('exTaxVnd', rows)).toBe(250);
  });

  it('ratio metrics are recomputed from the summed parts (average per order, quote approval), not averaged', () => {
    const a = periodOfBranch(
      'a',
      dates,
      [roll('2026-11-01', { exTax: 1000, closed: 1 })],
      'avgPerOrderVnd',
    );
    const b = periodOfBranch(
      'b',
      dates,
      [roll('2026-11-01', { exTax: 100, closed: 9 })],
      'avgPerOrderVnd',
    );
    expect([a.value, b.value]).toEqual([1000, 11]);
    expect(totalOfRows('avgPerOrderVnd', [a, b])).toBe(110); // 1100 / 10, not (1000 + 11) / 2
    const none = periodOfBranch(
      'c',
      dates,
      [roll('2026-11-01', { exTax: 0, closed: 0 })],
      'avgPerOrderVnd',
    );
    expect(none.value).toBeNull(); // no order completed: "—", not 0 (AC-RPT-002-9)
  });

  it('a day written before schema 6 cannot answer a quote or customer metric: it is listed as unavailable', () => {
    const p = periodOfBranch(
      'a',
      dates,
      [
        roll('2026-11-01', {
          quotes: { created: 4, approved: 1, rejected: 1, expired: 0, pending: 2 },
        }),
        roll('2026-11-02', {}),
      ],
      'quoteApprovalBp',
    );
    expect(p.value).toBe(5000);
    expect(p.unavailableDates).toEqual(['2026-11-02']);
    expect(p.missingDates).toEqual(['2026-11-03']);
    const c = periodOfBranch(
      'a',
      dates,
      [roll('2026-11-01', { customers: { visits: 3, newCount: 1, returningCount: 2 } })],
      'returningCustomerBp',
    );
    expect(c.value).toBe(6667); // 2 / 3
  });
});

describe('ranking on the common days (AC-RPT-002-10, FR-RPT-002)', () => {
  const days = datesBetween('2026-11-01', '2026-11-10', addDays);
  const all = (ids: string[], rate: number) => ids.map((d) => roll(d, { exTax: rate }));
  const code = (id: string) => id;

  it('hand example: A has 10 days at 100, B misses 3 days and has 7 days at 120; B is NOT pushed down for missing days', () => {
    const missing = new Set(['2026-11-02', '2026-11-05', '2026-11-06']);
    const a = all(days, 100);
    const b = all(
      days.filter((d) => !missing.has(d)),
      120,
    );
    const r = rankOnCommonDays(
      [
        { branchId: 'A', rolls: a },
        { branchId: 'B', rolls: b },
      ],
      days,
      'exTaxVnd',
      code,
    );
    expect(r.commonDates).toHaveLength(7);
    const byId = Object.fromEntries(r.rows.map((x) => [x.branchId, x]));
    // real figures stay: A 1000, B 840 with "thiếu 3 ngày"; the rank uses the 7 common days: B 840 > A 700
    expect([byId.A!.value, byId.B!.value]).toEqual([1000, 840]);
    expect(byId.B!.missingDates).toHaveLength(3);
    expect([byId.B!.rank, byId.A!.rank]).toEqual([1, 2]);
    expect([byId.B!.rankValue, byId.A!.rankValue]).toEqual([840, 700]);
  });

  it('a day before the branch opened or after it closed is not a missing day and does not shrink the common days', () => {
    const open5 = days.filter((d) => d >= '2026-11-05');
    const r = rankOnCommonDays(
      [
        { branchId: 'A', rolls: all(days, 100) },
        { branchId: 'N', rolls: all(open5, 50), active: { from: '2026-11-05' } },
        { branchId: 'C', rolls: all(days.slice(0, 4), 70), active: { to: '2026-11-04' } },
      ],
      days,
      'exTaxVnd',
      code,
    );
    const byId = Object.fromEntries(r.rows.map((x) => [x.branchId, x]));
    expect(byId.N!.missingDates).toEqual([]);
    expect(byId.C!.missingDates).toEqual([]);
    expect(r.commonDates).toEqual(days); // every day has every operating branch
    expect(byId.A!.rank).toBe(1);
  });

  it('no common day: nobody is ranked, real values are still shown; a branch with no data does not shrink the common days', () => {
    const none = rankOnCommonDays(
      [
        { branchId: 'A', rolls: [roll('2026-11-01', { exTax: 10 })] },
        { branchId: 'B', rolls: [roll('2026-11-02', { exTax: 20 })] },
      ],
      days,
      'exTaxVnd',
      code,
    );
    expect(none.commonDates).toEqual([]);
    expect(none.rows.map((x) => [x.branchId, x.value, x.rank])).toEqual([
      ['A', 10, null],
      ['B', 20, null],
    ]);
    const empty = rankOnCommonDays(
      [
        { branchId: 'A', rolls: [roll('2026-11-01', { exTax: 10 })] },
        { branchId: 'Z', rolls: [] },
      ],
      days,
      'exTaxVnd',
      code,
    );
    expect(empty.rows.map((x) => [x.branchId, x.rank])).toEqual([
      ['A', 1],
      ['Z', null],
    ]);
  });

  it('a ratio is recomputed from the numerator and denominator of the common days only', () => {
    const q = (a: number, d: number) => ({ approved: a, rejected: d - a, expired: 0, pending: 0 });
    const r = rankOnCommonDays(
      [
        {
          branchId: 'A',
          rolls: [
            roll('2026-11-01', { quotes: { created: 4, ...q(1, 4) } }),
            roll('2026-11-02', { quotes: { created: 4, ...q(4, 4) } }),
          ],
        },
        { branchId: 'B', rolls: [roll('2026-11-01', { quotes: { created: 2, ...q(1, 2) } })] },
      ],
      days,
      'quoteApprovalBp',
      code,
    );
    const byId = Object.fromEntries(r.rows.map((x) => [x.branchId, x]));
    expect(byId.A!.value).toBe(6250); // 5/8 over its own days
    expect(byId.A!.rankValue).toBe(2500); // 1/4 on the common day 11-01
    expect(byId.B!.rankValue).toBe(5000);
    expect(byId.B!.rank).toBe(1);
  });
});

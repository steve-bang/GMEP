import type { DailyRollup } from './rollup';

/**
 * Consolidation across the branches of ONE tenant (FR-RPT-002 ranking half, FR-RPT-010, 015, 016; RULE-015, RULE-017).
 * Pure functions over daily rollups already limited to the actor's scope: no I/O, no clock, integer arithmetic only.
 * A day without a rollup is listed, never counted as zero (same rule as the monthly report, AC-RPT-002-3).
 */

/** Metrics a ranking may use; all "higher is better". Money is integer VND, rates are basis points (10000 = 100%). */
export const RANK_METRICS = [
  'exTaxVnd',
  'orderTotalVnd',
  'ordersClosed',
  'avgPerOrderVnd',
  'inflowVnd',
  'quoteApprovalBp',
  'returningCustomerBp',
] as const;
export type RankMetric = (typeof RANK_METRICS)[number];

/** Which section of the rollup a metric reads (the viewer must hold the permission of that section, NFR-ISO-01). */
export const RANK_METRIC_SECTION: Record<
  RankMetric,
  'revenue' | 'orders' | 'money' | 'quotes' | 'customers'
> = {
  exTaxVnd: 'revenue',
  orderTotalVnd: 'revenue',
  ordersClosed: 'orders',
  avgPerOrderVnd: 'revenue',
  inflowVnd: 'money',
  quoteApprovalBp: 'quotes',
  returningCustomerBp: 'customers',
};

export const RANK_FORMULA: Record<RankMetric, string> = {
  exTaxVnd: 'sum(laborVnd + partsVnd) of orders completed in the period',
  orderTotalVnd: 'sum(orderTotalVnd) of orders completed in the period (tax included)',
  ordersClosed: 'sum(orders completed)',
  avgPerOrderVnd:
    'round-half-up(sum(exTaxVnd) / sum(orders completed)); n/a when no order was completed',
  inflowVnd: 'sum(receipts + deposits - reversals) by payment date',
  quoteApprovalBp:
    'approved / (approved + rejected + expired) over quotes created in the period, in basis points; n/a when none was decided',
  returningCustomerBp:
    'returning visits / (new + returning visits), in basis points; visits = distinct customers per day (a customer on two days counts twice)',
};

/** round half up of a/b for non-negative integers */
export const divRound = (a: number, b: number): number => Math.floor((2 * a + b) / (2 * b));

export interface RankInputDay {
  branchId: string;
  rollup: DailyRollup;
}

/** Days a branch exists as an operating branch (`YYYY-MM-DD`, inclusive); an open end means "no limit". */
export interface BranchActivity {
  from?: string;
  to?: string;
}
const isInactive = (a: BranchActivity | undefined, d: string): boolean =>
  !!a && ((a.from !== undefined && d < a.from) || (a.to !== undefined && d > a.to));

export interface BranchPeriod {
  branchId: string;
  /** days of the period with a rollup, of which provisional = not yet closed in ACC (FR-RPT-010) */
  presentDays: number;
  provisionalDays: number;
  missingDates: string[];
  /** days present but unable to answer the metric (rollup older than the schema the metric needs) */
  unavailableDates: string[];
  value: number | null;
  /** numerator and denominator of a ratio metric, for the drill-down text */
  parts: { num: number; den: number } | null;
}

/** Per-metric accumulation of one branch's rollups for the dates of the period. */
export function periodOfBranch(
  branchId: string,
  dates: readonly string[],
  rolls: readonly DailyRollup[],
  metric: RankMetric,
  active?: BranchActivity,
): BranchPeriod {
  const byDate = new Map(rolls.map((r) => [r.date, r]));
  const missingDates: string[] = [];
  const unavailableDates: string[] = [];
  let present = 0;
  let provisional = 0;
  let sum = 0;
  let num = 0;
  let den = 0;
  let answered = 0;
  for (const d of dates) {
    const r = byDate.get(d);
    if (!r) {
      // FR-RPT-002 / AC-RPT-002-10: a day before the branch opened or after it closed is not a missing day
      if (!isInactive(active, d)) missingDates.push(d);
      continue;
    }
    present++;
    if (!r.official) provisional++;
    switch (metric) {
      case 'exTaxVnd':
        sum += r.revenue.exTaxVnd;
        answered++;
        break;
      case 'orderTotalVnd':
        sum += r.revenue.orderTotalVnd;
        answered++;
        break;
      case 'ordersClosed':
        sum += r.orders.closed;
        answered++;
        break;
      case 'inflowVnd':
        sum += r.money.inflowVnd;
        answered++;
        break;
      case 'avgPerOrderVnd':
        num += r.revenue.exTaxVnd;
        den += r.orders.closed;
        answered++;
        break;
      case 'quoteApprovalBp':
        if (!r.quotes) {
          unavailableDates.push(d);
          break;
        }
        num += r.quotes.approved;
        den += r.quotes.approved + r.quotes.rejected + r.quotes.expired;
        answered++;
        break;
      case 'returningCustomerBp':
        if (!r.customers) {
          unavailableDates.push(d);
          break;
        }
        num += r.customers.returningCount;
        den += r.customers.returningCount + r.customers.newCount;
        answered++;
        break;
    }
  }
  const ratio =
    metric === 'avgPerOrderVnd' || metric === 'quoteApprovalBp' || metric === 'returningCustomerBp';
  let value: number | null;
  if (answered === 0) value = null;
  else if (!ratio) value = sum;
  else if (den === 0) value = null;
  else value = metric === 'avgPerOrderVnd' ? divRound(num, den) : divRound(num * 10_000, den);
  return {
    branchId,
    presentDays: present,
    provisionalDays: provisional,
    missingDates,
    unavailableDates,
    value,
    parts: ratio ? { num, den } : null,
  };
}

export interface RankedRow extends BranchPeriod {
  /** standard competition rank (1, 2, 2, 4) on the COMMON days; null when the branch has no value to rank */
  rank: number | null;
  /** the value the rank is based on: the same metric over the common days only (null = not ranked) */
  rankValue: number | null;
}

function rankBy<T extends BranchPeriod>(
  rows: readonly T[],
  valueOf: (r: T) => number | null,
  codeOf: (branchId: string) => string,
): (T & { rank: number | null; rankValue: number | null })[] {
  const sorted = [...rows].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av === null && bv === null) return codeOf(a.branchId).localeCompare(codeOf(b.branchId));
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av || codeOf(a.branchId).localeCompare(codeOf(b.branchId));
  });
  let lastValue: number | null = null;
  let lastRank = 0;
  return sorted.map((r, i) => {
    const v = valueOf(r);
    if (v === null) return { ...r, rank: null, rankValue: null };
    if (v !== lastValue) {
      lastRank = i + 1;
      lastValue = v;
    }
    return { ...r, rank: lastRank, rankValue: v };
  });
}

/**
 * Ranks branches on their own `value` (same period for all; kept for callers that already align the days). Equal
 * values share a rank; branches without a value are listed last and are not ranked; ties and the "no value" tail are
 * ordered by branch code so the result is deterministic.
 */
export function rankBranches(
  rows: readonly BranchPeriod[],
  codeOf: (branchId: string) => string,
): RankedRow[] {
  return rankBy(rows, (r) => r.value, codeOf);
}

export interface RankInput {
  branchId: string;
  rolls: readonly DailyRollup[];
  active?: BranchActivity;
}

/**
 * FR-RPT-002 "on the same period", AC-RPT-002-10: the ranking compares branches on the COMMON days = days on which
 * every branch that is operating that day has a rollup. A day before a branch opened or after it closed is not a gap.
 * The real figure of each branch (`value`, `missingDates`) is still shown; only the rank uses the common days, so a
 * branch missing days is not pushed down unfairly. A branch with no rollup at all in the period is listed unranked
 * and does not shrink the common days. No common day = nobody is ranked. Ratios are recomputed from the common-day
 * numerator and denominator. The tenant total stays the sum of every day with a figure (FR-RPT-001).
 */
export function rankOnCommonDays(
  inputs: readonly RankInput[],
  dates: readonly string[],
  metric: RankMetric,
  codeOf: (branchId: string) => string,
): { rows: RankedRow[]; commonDates: string[] } {
  const actual = inputs.map((i) => ({
    i,
    p: periodOfBranch(i.branchId, dates, i.rolls, metric, i.active),
  }));
  const withData = actual.filter((a) => a.p.presentDays > 0).map((a) => a.i);
  const has = new Map(withData.map((i) => [i.branchId, new Set(i.rolls.map((r) => r.date))]));
  const commonDates = dates.filter(
    (d) =>
      withData.some((i) => has.get(i.branchId)!.has(d)) &&
      withData.every((i) => has.get(i.branchId)!.has(d) || isInactive(i.active, d)),
  );
  const common = new Map(
    withData.map((i) => [
      i.branchId,
      commonDates.length
        ? periodOfBranch(i.branchId, commonDates, i.rolls, metric, i.active)
        : null,
    ]),
  );
  const rows = rankBy(
    actual.map((a) => a.p),
    (p) => common.get(p.branchId)?.value ?? null,
    codeOf,
  );
  return { rows, commonDates };
}

/**
 * Tenant total of a flow metric = the sum of the branch values (FR-RPT-001): the same rule the rows obey, so a test can
 * compare it with a tenant-wide figure. Ratios are recomputed from the summed parts, never averaged.
 */
export function totalOfRows(metric: RankMetric, rows: readonly BranchPeriod[]): number | null {
  const withValue = rows.filter((r) => r.value !== null);
  if (withValue.length === 0) return null;
  if (!rows.some((r) => r.parts)) return withValue.reduce((s, r) => s + (r.value ?? 0), 0);
  const num = rows.reduce((s, r) => s + (r.parts?.num ?? 0), 0);
  const den = rows.reduce((s, r) => s + (r.parts?.den ?? 0), 0);
  if (den === 0) return null;
  return metric === 'avgPerOrderVnd' ? divRound(num, den) : divRound(num * 10_000, den);
}

/** Inclusive list of `YYYY-MM-DD` dates from `from` to `to`; empty when `to` is before `from`. */
export function datesBetween(
  from: string,
  to: string,
  add: (d: string, n: number) => string,
): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = add(d, 1)) out.push(d);
  return out;
}

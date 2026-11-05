import { deltaBp, type DashboardDto, type Lens } from '@/modules/rpt';
import { drillHref } from './rpt/rptUi';

/**
 * Home dashboard view model (G1-DSH, FR-RPT-001). Pure: turns the DashboardDto, which the server already cut by the
 * view permission of every source module, into the KPI cards and charts to draw. A block that is missing
 * (`visible.x` false) never produces a card or a chart; nothing here widens what the server sent.
 */

export type KpiId =
  | 'revenue'
  | 'opened'
  | 'closed'
  | 'handed'
  | 'openAtEnd'
  | 'inflow'
  | 'gap'
  | 'debt'
  | 'invoices'
  | 'uninvoiced'
  | 'stock';

export interface KpiModel {
  id: KpiId;
  value: number;
  /** money (integer VND) or a plain count */
  kind: 'vnd' | 'count';
  tone?: 'warning' | 'danger';
  href?: string;
  /** change against yesterday in basis points (revenue only); null = no base to compare */
  deltaBp?: number | null;
  /** sub line facts shown next to the value */
  overdueVnd?: number;
  /** stock-like card of a range of several days: it is the state at the END of the range, not a sum (labelled on screen) */
  asOf?: true;
}

/** Cards that are a state at the end of the period; every other card is summed over the days of the range. */
const SNAPSHOT_KPIS: ReadonlySet<KpiId> = new Set(['openAtEnd', 'debt', 'uninvoiced']);

export interface TrendPoint {
  /** first day of the point (the day itself, or the start of a week bucket) */
  date: string;
  to: string;
  /** days summed in the point (1, or up to 7 for a week bucket) */
  days: number;
  value: number | null;
  provisional: boolean;
  /** days of the point without a rollup: not counted as 0 */
  missingDays: number;
}

/** Up to this many days the trend is one column per day; above it, one per week (a column must stay readable). */
export const TREND_MAX_DAILY = 31;

/**
 * Trend points of a range: one per day up to `maxDaily` days, otherwise one per 7 consecutive days from the start (the last
 * bucket can be shorter). A bucket sums only the days that have a rollup (never 0 for a missing day); it is a gap when none
 * has one, and provisional when any day is not official or is missing.
 */
export function bucketTrend(
  series: DashboardDto['series'],
  maxDaily: number = TREND_MAX_DAILY,
): { bucket: 'day' | 'week'; points: TrendPoint[] } {
  if (series.length <= maxDaily)
    return {
      bucket: 'day',
      points: series.map((s) => ({
        date: s.date,
        to: s.date,
        days: 1,
        value: s.exTaxVnd,
        provisional: !s.official,
        missingDays: s.exTaxVnd === null ? 1 : 0,
      })),
    };
  const points: TrendPoint[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    const have = chunk.filter((x) => x.exTaxVnd !== null);
    points.push({
      date: chunk[0]!.date,
      to: chunk.at(-1)!.date,
      days: chunk.length,
      value: have.length ? have.reduce((a, x) => a + (x.exTaxVnd ?? 0), 0) : null,
      provisional: chunk.some((x) => !x.official),
      missingDays: chunk.length - have.length,
    });
  }
  return { bucket: 'week', points };
}

type Block = keyof DashboardDto['visible'];
const KPI_BLOCK: Record<KpiId, Block> = {
  revenue: 'revenue',
  opened: 'orders',
  closed: 'orders',
  handed: 'orders',
  openAtEnd: 'orders',
  inflow: 'money',
  gap: 'money',
  debt: 'receivables',
  invoices: 'invoices',
  uninvoiced: 'invoices',
  stock: 'stock',
};

/** Which cards a role lens leads with (design G1-DSH-01/03 owner and manager, 04 advisor, 05 storekeeper, 08 cashier). */
export const LENS_KPIS: Record<Lens, KpiId[]> = {
  owner: ['revenue', 'closed', 'openAtEnd', 'inflow', 'debt', 'uninvoiced'],
  manager: ['revenue', 'closed', 'openAtEnd', 'inflow', 'debt', 'uninvoiced'],
  advisor: ['opened', 'openAtEnd', 'handed', 'uninvoiced'],
  cashier: ['inflow', 'gap', 'debt', 'handed'],
  storekeeper: ['stock', 'openAtEnd', 'opened'],
};

export interface HomeModel {
  kpis: KpiModel[];
  trend: TrendPoint[] | null;
  /** how the trend points are cut: one per day, or one per week for a long range */
  trendBucket: 'day' | 'week';
  /** a range of several days: sums, with stock-like cards labelled "as of the end" */
  multi: boolean;
  orderBars:
    { key: 'opened' | 'closed' | 'handedOver' | 'cancelled' | 'openAtEnd'; value: number }[] | null;
  revenueSplit: { key: 'labor' | 'parts'; value: number }[] | null;
  methodBars: { key: string; value: number }[] | null;
  branchBars: { branchId: string; name: string; value: number }[] | null;
  /** nothing at all to draw for this role (all blocks cut, e.g. a role without any report view) */
  hasBlocks: boolean;
}

export function buildHomeModel(d: DashboardDto): HomeModel {
  const t = d.totals;
  const single = d.rows.length === 1 ? d.rows[0]! : null;
  const multi = d.days > 1;
  // a summed card of several days has no single-day document list; a state at the end of the range does (that day)
  const link = (metric: string, snapshot = false) =>
    single && (snapshot || !multi)
      ? drillHref(snapshot ? (d.snapshotDate ?? d.to) : d.to, metric, single.branchId)
      : undefined;
  const val = (id: KpiId): Omit<KpiModel, 'id'> => {
    switch (id) {
      case 'revenue':
        return {
          value: t.revenue.exTaxVnd,
          kind: 'vnd',
          deltaBp:
            d.previousExTaxVnd === null ? null : deltaBp(t.revenue.exTaxVnd, d.previousExTaxVnd),
        };
      case 'opened':
        return { value: t.orders.opened, kind: 'count', ...opt(link('opened')) };
      case 'closed':
        return { value: t.orders.closed, kind: 'count', ...opt(link('closed')) };
      case 'handed':
        return { value: t.orders.handedOver, kind: 'count', ...opt(link('handedOver')) };
      case 'openAtEnd':
        return { value: t.orders.openAtEnd, kind: 'count', ...opt(link('openAtEnd', true)) };
      case 'inflow':
        return { value: t.money.inflowVnd, kind: 'vnd', ...opt(link('payments')) };
      case 'gap':
        return {
          value: t.money.gapVnd,
          kind: 'vnd',
          ...(t.money.gapVnd !== 0 ? { tone: 'warning' as const } : {}),
          ...opt(link('unpaid')),
        };
      case 'debt':
        return {
          value: t.receivables.openDebtVnd,
          kind: 'vnd',
          overdueVnd: t.receivables.overdueDebtVnd,
          ...(t.receivables.overdueDebtCount > 0 ? { tone: 'danger' as const } : {}),
          ...opt(link('openDebts', true)),
        };
      case 'invoices':
        return { value: t.invoices.issuedCount, kind: 'count', ...opt(link('invoicesIssued')) };
      case 'uninvoiced':
        return {
          value: t.invoices.closedWithoutInvoiceCount,
          kind: 'count',
          ...(t.invoices.closedWithoutInvoiceCount > 0 ? { tone: 'warning' as const } : {}),
          ...opt(link('notInvoiced', true)),
        };
      case 'stock':
        return {
          value: t.stock.issuesWithoutSource,
          kind: 'count',
          ...(t.stock.issuesWithoutSource > 0 ? { tone: 'danger' as const } : {}),
          ...opt(link('stockWithoutSource')),
        };
    }
  };
  const kpis = LENS_KPIS[d.lens]
    .filter((id) => d.visible[KPI_BLOCK[id]])
    .map((id) => ({
      id,
      ...val(id),
      ...(multi && SNAPSHOT_KPIS.has(id) ? { asOf: true as const } : {}),
    }));

  const anyData = d.rows.some((r) => !r.missing);
  const hasTrend = d.visible.revenue && d.series.some((s) => s.exTaxVnd !== null);
  const bucketed = hasTrend ? bucketTrend(d.series) : null;
  const orderBars =
    d.visible.orders && anyData
      ? (['opened', 'closed', 'handedOver', 'cancelled', 'openAtEnd'] as const).map((key) => ({
          key,
          value: t.orders[key],
        }))
      : null;
  const revenueSplit =
    d.visible.revenue && t.revenue.laborVnd + t.revenue.partsVnd > 0
      ? [
          { key: 'labor' as const, value: t.revenue.laborVnd },
          { key: 'parts' as const, value: t.revenue.partsVnd },
        ]
      : null;
  const methods = Object.entries(t.byMethod)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const methodBars =
    d.visible.money && methods.length > 0 ? methods.map(([key, value]) => ({ key, value })) : null;
  const branchBars =
    d.consolidated && d.visible.revenue
      ? d.rows
          .filter((r) => r.rollup)
          .map((r) => ({ branchId: r.branchId, name: r.name, value: r.rollup!.revenue.exTaxVnd }))
          .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      : null;
  return {
    kpis,
    trend: bucketed?.points ?? null,
    trendBucket: bucketed?.bucket ?? 'day',
    multi,
    orderBars,
    revenueSplit,
    methodBars,
    branchBars,
    hasBlocks: Object.values(d.visible).some(Boolean),
  };
}

const opt = (href: string | undefined) => (href ? { href } : {});

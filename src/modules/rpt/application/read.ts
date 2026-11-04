import { hasPermission, type Actor, type Permission } from '@/platform/rbac/rbac';
import {
  addDays,
  ALERT_KINDS,
  REF_METRICS,
  totalsOf,
  type AlertItem,
  type AlertKind,
  type DailyRollup,
  type DocRef,
  type RefMetric,
  type RollupTotals,
} from '../domain/rollup';
import type { RptDeps } from '../ports/deps';
import { branchesOf, dateSchema, parseInput, todayOf, z, AppError } from './support';

/** Which permission lets a user see the documents behind a metric or an alert (NFR-ISO-01 + role views, FR-RPT-001). */
export const METRIC_PERMISSION: Record<RefMetric, Permission> = {
  opened: 'repair-order:view',
  closed: 'repair-order:view',
  handedOver: 'repair-order:view',
  cancelled: 'repair-order:view',
  openAtEnd: 'repair-order:view',
  unpaid: 'payment:view',
  notInvoiced: 'invoice:view',
  payments: 'payment:view',
  invoicesIssued: 'invoice:view',
  openDebts: 'debt:view',
  stockWithoutSource: 'stock:view',
};
export const ALERT_PERMISSION: Record<AlertKind, Permission> = {
  order_open_too_long: 'repair-order:view',
  handover_unpaid: 'payment:view',
  debt_overdue: 'debt:view',
  not_invoiced: 'invoice:view',
  cash_variance: 'cashbook:view',
  stock_without_source: 'stock:view',
  reconcile_gap: 'payment:view',
};

export type Lens = 'owner' | 'manager' | 'cashier' | 'storekeeper' | 'advisor';

export interface RollupDto extends Omit<DailyRollup, 'computedAt' | 'refs' | 'alerts'> {
  computedAt: string;
  alerts: AlertItem[];
}

export const toDto = (r: DailyRollup, can: (p: Permission) => boolean): RollupDto => {
  const { refs: _refs, computedAt, alerts, ...rest } = r;
  void _refs;
  return {
    ...rest,
    computedAt: computedAt.toISOString(),
    alerts: alerts.filter((a) => can(ALERT_PERMISSION[a.kind])),
  };
};

/** A section the actor may not see is removed from the document, not hidden in the browser. */
export function redact(r: RollupDto, can: (p: Permission) => boolean): RollupDto {
  const out: Record<string, unknown> = { ...r };
  const zeroMoney = !can('payment:view');
  if (!can('repair-order:view')) {
    out.orders = { opened: 0, closed: 0, handedOver: 0, cancelled: 0, openAtEnd: 0 };
  }
  if (!can('report-daily:view')) {
    out.revenue = {
      orderTotalVnd: 0,
      laborVnd: 0,
      partsVnd: 0,
      exTaxVnd: 0,
      taxAndOtherVnd: 0,
      avgPerOrderVnd: 0,
    };
  }
  if (zeroMoney) {
    out.money = {
      byMethod: {},
      receiptCount: 0,
      inflowVnd: 0,
      depositVnd: 0,
      expenseVnd: 0,
      receivedForClosedVnd: 0,
      debtForClosedVnd: 0,
      gapVnd: 0,
      gapOrders: 0,
    };
  }
  if (!can('debt:view'))
    out.receivables = { openDebtVnd: 0, openDebtCount: 0, overdueDebtVnd: 0, overdueDebtCount: 0 };
  if (!can('invoice:view'))
    out.invoices = {
      issuedCount: 0,
      issuedVnd: 0,
      closedWithoutInvoiceCount: 0,
      closedWithoutInvoiceVnd: 0,
    };
  if (!can('stock:view')) out.stock = { issueDocuments: 0, issuesWithoutSource: 0 };
  if (!can('cashbook:view')) out.cash = { shiftsClosed: 0, shiftsWithVariance: 0, varianceVnd: 0 };
  // FR-RPT-014: the per-service-type figures follow the same section permissions as the totals they break down
  if (r.byServiceType)
    out.byServiceType = r.byServiceType.map((e) => ({
      ...e,
      ...(can('repair-order:view') ? {} : { closed: 0 }),
      ...(can('report-daily:view') ? {} : { orderTotalVnd: 0, laborVnd: 0, partsVnd: 0 }),
      ...(zeroMoney ? { receivedVnd: 0, debtVnd: 0, gapVnd: 0, gapOrders: 0 } : {}),
      ...(can('invoice:view') ? {} : { notInvoicedCount: 0, notInvoicedVnd: 0 }),
    }));
  out.alertCounts = Object.fromEntries(
    ALERT_KINDS.map((k) => [k, can(ALERT_PERMISSION[k]) ? r.alertCounts[k] : 0]),
  );
  return out as unknown as RollupDto;
}

export interface Visible {
  orders: boolean;
  revenue: boolean;
  money: boolean;
  receivables: boolean;
  invoices: boolean;
  stock: boolean;
  cash: boolean;
}

export const canOf = (actor: Actor) => (p: Permission) => hasPermission(actor, p);

export function visibleOf(actor: Actor): Visible {
  const can = canOf(actor);
  return {
    orders: can('repair-order:view'),
    revenue: can('report-daily:view'),
    money: can('payment:view'),
    receivables: can('debt:view'),
    invoices: can('invoice:view'),
    stock: can('stock:view'),
    cash: can('cashbook:view'),
  };
}

export function lensOf(actor: Actor): Lens {
  const can = canOf(actor);
  if (actor.canConsolidate && can('report-daily:view')) return 'owner';
  if (can('report-daily:view')) return 'manager';
  if (can('payment:create')) return 'cashier';
  if (can('stock-doc:create')) return 'storekeeper';
  return 'advisor';
}

// ---- dashboard (FR-RPT-001, one branch or the rollups of the permitted branches) --------------------------------------------

const dashboardQuery = z.object({
  date: dateSchema.optional(),
  branchId: z.string().max(64).optional(),
});

export interface BranchRow {
  branchId: string;
  code: string;
  name: string;
  /** no rollup document for the day yet */
  missing: boolean;
  rollup: RollupDto | null;
}

export interface DashboardDto {
  date: string;
  lens: Lens;
  visible: Visible;
  /** more than one branch: the owner's consolidated view, summed from the per-branch documents */
  consolidated: boolean;
  rows: BranchRow[];
  totals: RollupTotals;
  /** all branches of the view are official (day closed) */
  allOfficial: boolean;
  /** previous day's exTax revenue, for the comparison line; null when not available */
  previousExTaxVnd: number | null;
  lastComputedAt: string | null;
  truncated: string[];
  alertTotal: number;
  topAlerts: (AlertItem & { branchId: string })[];
}

export async function getDashboard(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
): Promise<DashboardDto> {
  const q = parseInput(dashboardQuery, raw ?? {});
  const date = q.date ?? todayOf(deps);
  const { scope, branches } = await branchesOf(deps, actor, 'report-dashboard:view', q.branchId);
  const can = canOf(actor);
  const keys = branches.flatMap((b) => [
    { branchId: b.id, date },
    { branchId: b.id, date: addDays(date, -1) },
  ]);
  const docs = await deps.rollups.getMany(scope, keys);
  const at = (branchId: string, d: string) =>
    docs.find((r) => r.branchId === branchId && r.date === d);
  const rows: BranchRow[] = branches.map((b) => {
    const r = at(b.id, date);
    return {
      branchId: b.id,
      code: b.code,
      name: b.name,
      missing: !r,
      rollup: r ? redact(toDto(r, can), can) : null,
    };
  });
  const present = rows.flatMap((r) => (r.rollup ? [r.rollup] : []));
  const totals = totalsOf(present as unknown as DailyRollup[]);
  const prev = branches.flatMap((b) => {
    const r = at(b.id, addDays(date, -1));
    return r ? [r] : [];
  });
  const topAlerts = rows
    .flatMap((r) => (r.rollup?.alerts ?? []).map((a) => ({ ...a, branchId: r.branchId })))
    .sort(
      (a, b) => ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind) || b.ageDays - a.ageDays,
    )
    .slice(0, 8);
  const computed = present.map((r) => r.computedAt).sort();
  return {
    date,
    lens: lensOf(actor),
    visible: visibleOf(actor),
    consolidated: branches.length > 1,
    rows,
    totals,
    allOfficial:
      present.length > 0 && present.every((r) => r.official) && present.length === rows.length,
    previousExTaxVnd:
      can('report-daily:view') && prev.length > 0
        ? prev.reduce((s, r) => s + r.revenue.exTaxVnd, 0)
        : null,
    lastComputedAt: computed.at(-1) ?? null,
    truncated: [...new Set(present.flatMap((r) => r.truncated))].sort(),
    alertTotal: Object.values(totals.alertCounts).reduce((a, b) => a + b, 0),
    topAlerts,
  };
}

// ---- daily report of one branch (FR-RPT-003) ------------------------------------------------------------------------------

const dailyQuery = z.object({
  date: dateSchema.optional(),
  branchId: z.string().max(64).optional(),
});

export interface DailyDto {
  date: string;
  branchId: string;
  branchName: string;
  rollup: RollupDto | null;
  visible: Visible;
  /** the last seven days, oldest first, for the trend table (FR-RPT-014 time filter is the date) */
  series: { date: string; exTaxVnd: number | null; official: boolean }[];
  mayRun: boolean;
  mayExport: boolean;
  formula: { revenue: string; gap: string };
}

export async function getDaily(deps: RptDeps, actor: Actor, raw: unknown): Promise<DailyDto> {
  const q = parseInput(dailyQuery, raw ?? {});
  const date = q.date ?? todayOf(deps);
  const { scope, branches } = await branchesOf(deps, actor, 'report-daily:view', q.branchId);
  // one branch per daily report (consolidated daily numbers are the dashboard table, not summed here)
  const branch = q.branchId
    ? branches[0]
    : actor.workingBranchId
      ? branches.find((b) => b.id === actor.workingBranchId)
      : branches.length === 1
        ? branches[0]
        : undefined;
  if (!branch) throw new AppError('scope_required', 409);
  const can = canOf(actor);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  const docs = await deps.rollups.getMany(
    scope,
    dates.map((d) => ({ branchId: branch.id, date: d })),
  );
  const cur = docs.find((r) => r.date === date);
  return {
    date,
    branchId: branch.id,
    branchName: branch.name,
    rollup: cur ? redact(toDto(cur, can), can) : null,
    visible: visibleOf(actor),
    series: dates.map((d) => {
      const r = docs.find((x) => x.date === d);
      return { date: d, exTaxVnd: r ? r.revenue.exTaxVnd : null, official: !!r?.official };
    }),
    mayRun: can('report-job:manage'),
    mayExport: can('report-daily:export'),
    // FR-RPT-013: the formula is printed with the figure
    formula: {
      revenue: 'laborPlusParts',
      gap: 'totalMinusReceivedMinusDebt',
    },
  };
}

// ---- drill-down (FR-RPT-011) --------------------------------------------------------------------------------------------

const drillQuery = z.object({
  date: dateSchema,
  metric: z.enum(REF_METRICS as unknown as [RefMetric, ...RefMetric[]]),
  branchId: z.string().max(64).optional(),
});

export interface DrillDto {
  date: string;
  metric: RefMetric;
  branchId: string;
  branchName: string;
  refs: DocRef[];
  /** the rollup keeps the first `refsMax` references; the count on the dashboard is exact */
  truncated: boolean;
  official: boolean;
}

export async function getDrill(deps: RptDeps, actor: Actor, raw: unknown): Promise<DrillDto> {
  const q = parseInput(drillQuery, raw);
  const needed = METRIC_PERMISSION[q.metric];
  if (!hasPermission(actor, needed)) throw new AppError('forbidden', 403);
  const { scope, branches } = await branchesOf(deps, actor, 'report-dashboard:view', q.branchId);
  const branch = q.branchId
    ? branches[0]
    : actor.workingBranchId
      ? branches.find((b) => b.id === actor.workingBranchId)
      : branches.length === 1
        ? branches[0]
        : undefined;
  if (!branch) throw new AppError('scope_required', 409);
  const r = await deps.rollups.get(scope, branch.id, q.date);
  return {
    date: q.date,
    metric: q.metric,
    branchId: branch.id,
    branchName: branch.name,
    refs: r?.refs[q.metric] ?? [],
    truncated: !!r?.refsTruncated.includes(q.metric),
    official: !!r?.official,
  };
}

// ---- exception alerts (FR-RPT-008 minimum, G4-RPT-09) ---------------------------------------------------------------------

export interface AlertRow extends AlertItem {
  branchId: string;
  branchName: string;
}
export interface AlertsDto {
  date: string;
  items: AlertRow[];
  counts: Record<AlertKind, number>;
  truncated: boolean;
}

export async function listAlerts(deps: RptDeps, actor: Actor, raw: unknown): Promise<AlertsDto> {
  const q = parseInput(dashboardQuery, raw ?? {});
  const date = q.date ?? todayOf(deps);
  const { scope, branches } = await branchesOf(deps, actor, 'report-alert:view', q.branchId);
  const can = canOf(actor);
  const docs = await deps.rollups.getMany(
    scope,
    branches.map((b) => ({ branchId: b.id, date })),
  );
  const counts = Object.fromEntries(ALERT_KINDS.map((k) => [k, 0])) as Record<AlertKind, number>;
  const items: AlertRow[] = [];
  let truncated = false;
  for (const r of docs) {
    const name = branches.find((b) => b.id === r.branchId)?.name ?? r.branchId;
    for (const k of ALERT_KINDS) if (can(ALERT_PERMISSION[k])) counts[k] += r.alertCounts[k] ?? 0;
    truncated ||= r.alertsTruncated;
    for (const a of r.alerts)
      if (can(ALERT_PERMISSION[a.kind]))
        items.push({ ...a, branchId: r.branchId, branchName: name });
  }
  items.sort(
    (a, b) =>
      ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind) ||
      b.ageDays - a.ageDays ||
      a.ref.id.localeCompare(b.ref.id),
  );
  return { date, items, counts, truncated };
}

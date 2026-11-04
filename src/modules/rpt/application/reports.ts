import { hasPermission, type Actor } from '@/platform/rbac/rbac';
import {
  computeMonthly,
  forServiceType,
  computeReconcile,
  computeTechnicians,
  computeWarehouse,
  MONTH_RE,
  monthDates,
  type MonthlyReport,
  type ReconcileReport,
  type ReconcileVisible,
  type TechnicianReport,
  type WarehouseReport,
} from '../domain/reports';
import { addDays, dayWindow } from '../domain/rollup';
import type { RptDeps } from '../ports/deps';
import { canOf, redact, toDto, visibleOf, type Visible } from './read';
import {
  AppError,
  branchesOf,
  dateSchema,
  forbidden,
  parseInput,
  singleBranch,
  todayOf,
  z,
} from './support';

/** The rollups of one branch for the dates, read BY KEY, with sections the actor may not see removed (NFR-ISO-01). */
async function redactedRollups(
  deps: RptDeps,
  actor: Actor,
  scope: Parameters<RptDeps['rollups']['getMany']>[0],
  branchId: string,
  dates: readonly string[],
) {
  const can = canOf(actor);
  const docs = await deps.rollups.getMany(
    scope,
    dates.map((date) => ({ branchId, date })),
  );
  return docs.map((r) => redact(toDto(r, can), can));
}

const monthSchema = z.object({
  month: z.string().regex(MONTH_RE),
  branchId: z.string().trim().max(64).optional(),
  serviceType: z.string().trim().min(1).max(64).optional(),
});

export interface MonthlyDto {
  branchId: string;
  branchName: string;
  /** FR-RPT-014: set when the figures are narrowed to one service type (order-bound figures only) */
  serviceType: string | null;
  /** days whose rollup predates the service-type breakdown (rebuild them); empty without a filter */
  breakdownUnavailableDates: string[];
  report: MonthlyReport;
  visible: Visible;
  mayExport: boolean;
  formula: { revenue: string; avg: string; endOfPeriod: string };
}

/** FR-RPT-002 / 014: monthly report of ONE branch, summed from the daily rollups (no new query, no new index). */
export async function getMonthly(deps: RptDeps, actor: Actor, raw: unknown): Promise<MonthlyDto> {
  const q = parseInput(monthSchema, raw);
  const { scope, branches } = await branchesOf(deps, actor, 'report-daily:view', q.branchId);
  const branch = singleBranch(actor, branches, q.branchId);
  const all = await redactedRollups(deps, actor, scope, branch.id, monthDates(q.month));
  const narrowed = q.serviceType ? forServiceType(all, q.serviceType) : null;
  return {
    branchId: branch.id,
    branchName: branch.name,
    serviceType: q.serviceType ?? null,
    breakdownUnavailableDates: narrowed?.unavailableDates ?? [],
    report: computeMonthly(q.month, narrowed ? narrowed.rolls : all),
    // FR-RPT-014: narrowed to a service type, money by method, receivables and stock are not attributable and not shown
    visible: q.serviceType
      ? { ...visibleOf(actor), money: false, receivables: false, stock: false, cash: false }
      : visibleOf(actor),
    mayExport: hasPermission(actor, 'report-daily:export'),
    // FR-RPT-013: the formulas are printed with the figures
    formula: {
      revenue: 'sumOfDailyLaborPlusParts',
      avg: 'exTaxDividedByClosedOrders',
      endOfPeriod: 'lastDayWithRollup',
    },
  };
}

const rangeSchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  branchId: z.string().trim().max(64).optional(),
  serviceType: z.string().trim().min(1).max(64).optional(),
});

function rangeOf(
  deps: RptDeps,
  raw: unknown,
  defaults: (today: string) => string,
): { from: string; to: string; branchId?: string; serviceType?: string } {
  const q = parseInput(rangeSchema, raw ?? {});
  const to = q.to ?? todayOf(deps);
  const from = q.from ?? defaults(to);
  if (from > to) throw new AppError('invalid_range', 422);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days > deps.rpt.reconcileMaxDays) throw new AppError('range_too_long', 422);
  return {
    from,
    to,
    ...(q.branchId ? { branchId: q.branchId } : {}),
    ...(q.serviceType ? { serviceType: q.serviceType } : {}),
  };
}

export interface ReconcileDto {
  branchId: string;
  branchName: string;
  serviceType: string | null;
  breakdownUnavailableDates: string[];
  report: ReconcileReport;
  visible: ReconcileVisible;
  mayExport: boolean;
  formula: { payments: string; invoices: string; cash: string; stock: string };
}

/**
 * FR-RPT-004: four-way reconciliation of ONE branch over a date range: orders vs payments (and approved debt), orders vs
 * invoices, cash shifts, stock issues vs source documents (RULE-007). Built from the rollups, so each failed cell links to
 * the existing drill-down (FR-RPT-011) of that day; a section the actor may not see is neither shown nor judged.
 */
export async function getReconcile(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
): Promise<ReconcileDto> {
  const q = rangeOf(deps, raw, (t) => addDays(t, -6));
  const { scope, branches } = await branchesOf(deps, actor, 'report-daily:view', q.branchId);
  const branch = singleBranch(actor, branches, q.branchId);
  const v = visibleOf(actor);
  // FR-RPT-014: cash shifts and stock issues are not tied to a service type, so a filtered view neither shows nor judges them
  const visible: ReconcileVisible = {
    payments: v.money,
    invoices: v.invoices,
    cash: v.cash && !q.serviceType,
    stock: v.stock && !q.serviceType,
  };
  const dates: string[] = [];
  for (let d = q.from; d <= q.to; d = addDays(d, 1)) dates.push(d);
  const all = await redactedRollups(deps, actor, scope, branch.id, dates);
  const narrowed = q.serviceType ? forServiceType(all, q.serviceType) : null;
  return {
    branchId: branch.id,
    branchName: branch.name,
    serviceType: q.serviceType ?? null,
    breakdownUnavailableDates: narrowed?.unavailableDates ?? [],
    report: computeReconcile(q.from, q.to, narrowed ? narrowed.rolls : all, visible),
    visible,
    mayExport: hasPermission(actor, 'report-daily:export'),
    formula: {
      payments: 'totalMinusReceivedMinusDebt',
      invoices: 'completedOrdersWithoutValidInvoice',
      cash: 'closedShiftsWithVariance',
      stock: 'issuesWithoutSourceDocument',
    },
  };
}

const warehouseSchema = z.object({
  branchId: z.string().trim().max(64).optional(),
  warehouseId: z.string().trim().max(128).optional(),
});

export interface WarehouseDto {
  branchId: string;
  branchName: string;
  report: WarehouseReport;
  warehouses: Record<string, string>;
  /** stock value is shown only with stock-cost:view */
  showValue: boolean;
  /** goods issues of the last seven days, from the daily rollups (documents, and those without a source) */
  issues: { date: string; documents: number; withoutSource: number }[];
  truncated: boolean;
  mayExport: boolean;
  formula: { below: string; available: string };
}

/** FR-RPT-005: stock value, below-reorder lines judged on AVAILABLE (RULE-008) and recent movements, of one branch. */
export async function getWarehouse(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
): Promise<WarehouseDto> {
  const q = parseInput(warehouseSchema, raw ?? {});
  const { scope, branches } = await branchesOf(deps, actor, 'stock:view', q.branchId);
  const branch = singleBranch(actor, branches, q.branchId);
  const showValue = hasPermission(actor, 'stock-cost:view');
  const cap = await deps.sources.stockBalances(scope, branch.id, deps.rpt.balancesScanMax);
  const facts = q.warehouseId
    ? cap.items.filter((b) => b.warehouseId === q.warehouseId)
    : cap.items;
  const report = computeWarehouse(facts, { showValue, belowMax: deps.rpt.belowReorderMax });
  const names: Record<string, string> = {};
  for (const s of report.summary) {
    const w = await deps.sys.warehouses.get(scope, s.warehouseId);
    names[s.warehouseId] = w?.name ?? s.warehouseId;
  }
  const today = todayOf(deps);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const rolls = await redactedRollups(deps, actor, scope, branch.id, dates);
  return {
    branchId: branch.id,
    branchName: branch.name,
    report,
    warehouses: names,
    showValue,
    issues: dates.flatMap((date) => {
      const r = rolls.find((x) => x.date === date);
      return r
        ? [{ date, documents: r.stock.issueDocuments, withoutSource: r.stock.issuesWithoutSource }]
        : [];
    }),
    truncated: cap.truncated,
    mayExport: hasPermission(actor, 'report-daily:export'),
    formula: { below: 'availableAtOrBelowMin', available: 'onHandMinusReserved' },
  };
}

export interface TechniciansDto {
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  serviceType: string | null;
  report: TechnicianReport;
  truncated: boolean;
  mayExport: boolean;
  formula: { hours: string; efficiency: string };
}

/**
 * FR-RPT-006: hours and finished jobs per technician for orders completed in the period, optionally one service type
 * (FR-RPT-014). Hours and standard minutes only: no commission, no pay (payroll is out of scope).
 */
export async function getTechnicians(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
): Promise<TechniciansDto> {
  const q = rangeOf(deps, raw, (t) => `${t.slice(0, 8)}01`);
  const { scope, branches } = await branchesOf(deps, actor, 'report-daily:view', q.branchId);
  if (!hasPermission(actor, 'repair-order:view')) throw forbidden();
  const branch = singleBranch(actor, branches, q.branchId);
  const cap = await deps.sources.workItems(
    scope,
    branch.id,
    { from: dayWindow(q.from).from, to: dayWindow(q.to).to },
    {
      lookbackDays: deps.rpt.technicianLookbackDays,
      maxOrders: deps.rpt.technicianOrdersMax,
      ...(q.serviceType ? { serviceType: q.serviceType } : {}),
    },
  );
  return {
    branchId: branch.id,
    branchName: branch.name,
    from: q.from,
    to: q.to,
    serviceType: q.serviceType ?? null,
    report: computeTechnicians(cap.items),
    truncated: cap.truncated,
    mayExport: hasPermission(actor, 'report-daily:export'),
    formula: {
      hours: 'closedWorkedTimeOfDoneItems',
      efficiency: 'standardMinutesOverWorkedMinutes',
    },
  };
}

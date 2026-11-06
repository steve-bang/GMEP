import { hasPermission, type Actor, type Permission } from '@/platform/rbac/rbac';
import {
  datesBetween,
  periodOfBranch,
  rankOnCommonDays,
  RANK_FORMULA,
  RANK_METRICS,
  RANK_METRIC_SECTION,
  totalOfRows,
  type BranchPeriod,
  type RankedRow,
  type RankMetric,
} from '../domain/consolidation';
import { addDays, type DailyRollup } from '../domain/rollup';
import type { RptDeps } from '../ports/deps';
import {
  AppError,
  branchGroupsOf,
  type BranchRef,
  consolidatedBranches,
  dateSchema,
  forbidden,
  parseInput,
  z,
} from './support';

/**
 * Consolidation inside ONE tenant (slice 2.1): branch ranking (FR-RPT-002 second half), customer visits (FR-RPT-015
 * without receivables) and the extra indicators (FR-RPT-016 without stock accuracy). Everything is read from the daily
 * rollups BY KEY (branch x day), so there is no new query shape and no index (index-budget). A report never crosses a
 * tenant (RULE-017): the tenant is the scope's outermost key and the rollup repository drops foreign documents.
 */

/** the view permission each rollup section needs, on top of the report permission (a figure is cut on the server) */
const SECTION_PERMISSION: Record<(typeof RANK_METRIC_SECTION)[RankMetric], Permission> = {
  revenue: 'report-daily:view',
  orders: 'repair-order:view',
  money: 'payment:view',
  quotes: 'quote:view',
  customers: 'customer:view',
};

const periodQuery = z.object({
  from: dateSchema,
  to: dateSchema,
  groupId: z
    .string()
    .regex(/^[a-z][a-z0-9_-]{0,29}$/)
    .optional(),
});
const rankingQuery = periodQuery.extend({
  metric: z.enum(RANK_METRICS).default('exTaxVnd'),
});

interface PeriodRead {
  dates: string[];
  branches: BranchRef[];
  byBranch: Map<string, DailyRollup[]>;
  /** documents read, for the load measurement */
  keys: number;
}

async function readPeriod(
  deps: RptDeps,
  actor: Actor,
  permission: Permission,
  q: z.infer<typeof periodQuery>,
): Promise<PeriodRead> {
  if (q.to < q.from) throw new AppError('validation_failed', 422);
  const dates = datesBetween(q.from, q.to, addDays);
  if (dates.length > deps.rpt.reconcileMaxDays) throw new AppError('period_too_long', 422);
  const { scope, branches } = await consolidatedBranches(deps, actor, permission, q.groupId);
  const keys = branches.flatMap((b) => dates.map((d) => ({ branchId: b.id, date: d })));
  const docs = await deps.rollups.getMany(scope, keys);
  const byBranch = new Map<string, DailyRollup[]>(branches.map((b) => [b.id, []]));
  for (const r of docs) byBranch.get(r.branchId)?.push(r);
  return { dates, branches, byBranch, keys: keys.length };
}

// ---- groups (Q84: configuration, never a hard-coded role) -------------------------------------------------------------------

export interface GroupDto {
  code: string;
  name: string;
  /** branches of the group that the actor may read (the others are not revealed) */
  branchCount: number;
}

/** Groups that contain at least one branch the actor may read; a group never widens the scope. */
export async function listBranchGroups(
  deps: RptDeps,
  actor: Actor,
): Promise<{ items: GroupDto[] }> {
  const { branches } = await consolidatedBranches(deps, actor, 'report-dashboard:view');
  const mine = new Set(branches.map((b) => b.id));
  const groups = await branchGroupsOf(deps, actor.tenantId);
  return {
    items: groups
      .map((g) => ({
        code: g.code,
        name: g.name,
        branchCount: g.branchIds.filter((id) => mine.has(id)).length,
      }))
      .filter((g) => g.branchCount > 0),
  };
}

// ---- ranking (FR-RPT-002 second half, FR-RPT-010) -----------------------------------------------------------------------------

export interface RankingRowDto extends Omit<RankedRow, 'branchId'> {
  branchId: string;
  code: string;
  name: string;
  /** FR-RPT-010: some of the days are provisional (not closed in ACC yet): the figure is labelled, never silently official */
  provisional: boolean;
  /** "thiếu n ngày": days of its operating period without a figure; its real value is still shown (AC-RPT-002-10) */
  missingDays: number;
}

export interface RankingDto {
  from: string;
  to: string;
  metric: RankMetric;
  groupId: string | null;
  rows: RankingRowDto[];
  /** days the rank is based on: every operating branch has a figure; empty = nobody is ranked (AC-RPT-002-10) */
  commonDates: string[];
  /** sum (or recomputed ratio) over the branches listed; equals the tenant figure when no group is chosen and every branch is in scope */
  total: number | null;
  /** every day of every branch is present and closed */
  allOfficial: boolean;
  provisionalDays: number;
  missingDays: number;
  formula: string;
  /** documents read (branches x days), shown by the load measurement */
  documentsRead: number;
}

export async function getRanking(deps: RptDeps, actor: Actor, raw: unknown): Promise<RankingDto> {
  const q = parseInput(rankingQuery, raw ?? {});
  // Q85 default: ranking is for the roles holding `report-ranking:view` (owner and regional manager); branch managers see only their own reports
  const need = SECTION_PERMISSION[RANK_METRIC_SECTION[q.metric]];
  if (!hasPermission(actor, need)) throw forbidden();
  const read = await readPeriod(deps, actor, 'report-ranking:view', q);
  const info = new Map(read.branches.map((b) => [b.id, b]));
  const { rows: ranked, commonDates } = rankOnCommonDays(
    read.branches.map((b) => ({
      branchId: b.id,
      rolls: read.byBranch.get(b.id) ?? [],
      active: { from: b.activeFrom, ...(b.activeTo ? { to: b.activeTo } : {}) },
    })),
    read.dates,
    q.metric,
    (id) => info.get(id)?.code ?? id,
  );
  const periods: BranchPeriod[] = ranked;
  const rows: RankingRowDto[] = ranked.map((r) => ({
    ...r,
    code: info.get(r.branchId)!.code,
    name: info.get(r.branchId)!.name,
    provisional: r.provisionalDays > 0,
    missingDays: r.missingDates.length,
  }));
  const provisionalDays = periods.reduce((s, p) => s + p.provisionalDays, 0);
  const missingDays = periods.reduce((s, p) => s + p.missingDates.length, 0);
  return {
    from: q.from,
    to: q.to,
    metric: q.metric,
    groupId: q.groupId ?? null,
    rows,
    commonDates,
    total: totalOfRows(q.metric, periods),
    allOfficial: provisionalDays === 0 && missingDays === 0 && periods.length > 0,
    provisionalDays,
    missingDays,
    formula: RANK_FORMULA[q.metric],
    documentsRead: read.keys,
  };
}

// ---- customers (FR-RPT-015 without receivables) and indicators (FR-RPT-016 without stock accuracy) -----------------------------

export interface CustomerReportDto {
  from: string;
  to: string;
  groupId: string | null;
  rows: {
    branchId: string;
    code: string;
    name: string;
    visits: number;
    newCount: number;
    returningCount: number;
    /** returning / (new + returning) in basis points; null when there is no known visit */
    returningBp: number | null;
    /** days present but written before schema 6: not counted, listed */
    unavailableDates: string[];
    missingDates: string[];
  }[];
  total: { visits: number; newCount: number; returningCount: number; returningBp: number | null };
  provisionalDays: number;
  /** debt per customer is NOT here: it depends on the receivables slice (2.7) */
  receivablesIncluded: false;
  formula: string;
}

export async function getCustomerReport(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
): Promise<CustomerReportDto> {
  const q = parseInput(periodQuery, raw ?? {});
  if (!hasPermission(actor, 'customer:view')) throw forbidden();
  const read = await readPeriod(deps, actor, 'report-daily:view', q);
  let provisionalDays = 0;
  const rows = read.branches.map((b) => {
    const rolls = read.byBranch.get(b.id) ?? [];
    const present = new Set(rolls.map((r) => r.date));
    let visits = 0;
    let newCount = 0;
    let returningCount = 0;
    const unavailableDates: string[] = [];
    for (const r of rolls) {
      if (!r.official) provisionalDays++;
      if (!r.customers) {
        unavailableDates.push(r.date);
        continue;
      }
      visits += r.customers.visits;
      newCount += r.customers.newCount;
      returningCount += r.customers.returningCount;
    }
    const known = newCount + returningCount;
    return {
      branchId: b.id,
      code: b.code,
      name: b.name,
      visits,
      newCount,
      returningCount,
      returningBp:
        known > 0 ? Math.floor((2 * returningCount * 10_000 + known) / (2 * known)) : null,
      unavailableDates,
      missingDates: read.dates.filter((d) => !present.has(d)),
    };
  });
  const t = rows.reduce(
    (a, r) => ({
      visits: a.visits + r.visits,
      newCount: a.newCount + r.newCount,
      returningCount: a.returningCount + r.returningCount,
    }),
    { visits: 0, newCount: 0, returningCount: 0 },
  );
  const known = t.newCount + t.returningCount;
  return {
    from: q.from,
    to: q.to,
    groupId: q.groupId ?? null,
    rows,
    total: {
      ...t,
      returningBp:
        known > 0 ? Math.floor((2 * t.returningCount * 10_000 + known) / (2 * known)) : null,
    },
    provisionalDays,
    receivablesIncluded: false,
    formula: RANK_FORMULA.returningCustomerBp,
  };
}

export interface IndicatorsDto {
  from: string;
  to: string;
  groupId: string | null;
  /** only the indicators that do not need a stocktake: stock accuracy, shrinkage and turnover wait for slice 2.3 */
  indicators: {
    metric: 'avgPerOrderVnd' | 'quoteApprovalBp';
    formula: string;
    total: number | null;
    rows: { branchId: string; code: string; value: number | null; num: number; den: number }[];
    unavailableDates: number;
    missingDates: number;
  }[];
  provisionalDays: number;
}

export async function getIndicators(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
): Promise<IndicatorsDto> {
  const q = parseInput(periodQuery, raw ?? {});
  const read = await readPeriod(deps, actor, 'report-daily:view', q);
  const out: IndicatorsDto['indicators'] = [];
  let provisionalDays = 0;
  for (const metric of ['avgPerOrderVnd', 'quoteApprovalBp'] as const) {
    if (!hasPermission(actor, SECTION_PERMISSION[RANK_METRIC_SECTION[metric]])) continue;
    const periods = read.branches.map((b) =>
      periodOfBranch(b.id, read.dates, read.byBranch.get(b.id) ?? [], metric, {
        from: b.activeFrom,
        ...(b.activeTo ? { to: b.activeTo } : {}),
      }),
    );
    if (metric === 'avgPerOrderVnd')
      provisionalDays = periods.reduce((s, p) => s + p.provisionalDays, 0);
    const code = new Map(read.branches.map((b) => [b.id, b.code]));
    out.push({
      metric,
      formula: RANK_FORMULA[metric],
      total: totalOfRows(metric, periods),
      rows: periods.map((p) => ({
        branchId: p.branchId,
        code: code.get(p.branchId) ?? p.branchId,
        value: p.value,
        num: p.parts?.num ?? 0,
        den: p.parts?.den ?? 0,
      })),
      unavailableDates: periods.reduce((s, p) => s + p.unavailableDates.length, 0),
      missingDates: periods.reduce((s, p) => s + p.missingDates.length, 0),
    });
  }
  return { from: q.from, to: q.to, groupId: q.groupId ?? null, indicators: out, provisionalDays };
}

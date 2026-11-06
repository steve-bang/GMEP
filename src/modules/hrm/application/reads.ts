import { businessDate } from '@/platform/format/date';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows } from '@/platform/scope/scope';
import {
  netOf,
  statusOf,
  type LaborLine,
  type LaborLineKind,
  type LaborLineStatus,
  type LaborLineWarning,
  type LaborMethodKind,
  type LaborSheet,
} from '../domain/labor';
import type { HrmDeps } from '../ports/deps';
import { AppError, notFound, parseInput, z } from './support';

/**
 * Reads of technician labor (FR-HRM-020, G3-HRM-07). `labor:view` sees every technician of the scope; a technician
 * with only `labor-own:view` is cut to their own lines on the SERVER (G3-HRM-07 "Bạn chỉ thấy công của mình"). The
 * amount is the summed quantity; commission is not here (slice 2.6b).
 */

export interface LaborLineDto {
  id: string;
  orderId: string;
  orderNumber: string;
  itemId: string;
  itemNo: number;
  itemName: string;
  serviceType: string;
  kind: LaborLineKind;
  status: LaborLineStatus;
  technicianId: string | null;
  technicianName: string | null;
  positionCode: string | null;
  qcRun: number | null;
  actualMinutes: number;
  standardMinutes: number;
  convertedMinutes: number | null;
  amountVnd: number;
  method: LaborMethodKind | null;
  ruleVersionId: string | null;
  ruleScopeKey: string | null;
  ruleEffectiveFrom: string | null;
  warnings: LaborLineWarning[];
  reversesLineId: string | null;
  adjustsLineId: string | null;
  reworkOfLineId: string | null;
  approvalId: string | null;
  reason: string | null;
  at: string;
  businessDate: string;
}

export interface LaborTotals {
  amountVnd: number;
  convertedMinutes: number;
  actualMinutes: number;
  standardMinutes: number;
}

export interface LaborListDto {
  branchId: string;
  from: string;
  to: string;
  items: LaborLineDto[];
  totals: LaborTotals;
  /** the sheet cap was reached: the list is a minimum, say so on screen */
  truncated: boolean;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const laborListSchema = z.object({
  branchId: z.string().trim().min(1).max(64).optional(),
  from: date.optional(),
  to: date.optional(),
  technicianId: z.string().trim().min(1).max(128).optional(),
  status: z.enum(['recorded', 'qc_returned', 'reversed']).optional(),
});

function viewScope(deps: HrmDeps, actor: Actor) {
  void deps;
  const all = hasPermission(actor, 'labor:view');
  return { scope: resolveScope(actor, all ? 'labor:view' : 'labor-own:view'), own: !all };
}

async function names(deps: HrmDeps, tenantId: string, ids: readonly string[]) {
  const out = new Map<string, string>();
  for (const id of new Set(ids)) {
    const u = await deps.sys.users.getById(tenantId, id);
    if (u) out.set(id, u.displayName);
  }
  return out;
}

function toDto(sheet: LaborSheet, l: LaborLine, who: Map<string, string>): LaborLineDto {
  return {
    id: l.id,
    orderId: l.orderId,
    orderNumber: l.orderNumber,
    itemId: l.itemId,
    itemNo: l.itemNo,
    itemName: l.itemName,
    serviceType: l.serviceType,
    kind: l.kind,
    status: statusOf(sheet, l),
    technicianId: l.technicianId,
    technicianName: l.technicianId ? (who.get(l.technicianId) ?? null) : null,
    positionCode: l.positionCode,
    qcRun: l.qcRun,
    actualMinutes: l.actualMinutes,
    standardMinutes: l.standardMinutes,
    convertedMinutes: l.convertedMinutes,
    amountVnd: l.amountVnd,
    method: l.method,
    ruleVersionId: l.rule?.versionId ?? null,
    ruleScopeKey: l.rule?.scopeKey ?? null,
    ruleEffectiveFrom: l.rule?.effectiveFrom ?? null,
    warnings: l.warnings,
    reversesLineId: l.reversesLineId ?? null,
    adjustsLineId: l.adjustsLineId ?? null,
    reworkOfLineId: l.reworkOfLineId ?? null,
    approvalId: l.approvalId ?? null,
    reason: l.reason ?? null,
    at: l.at.toISOString(),
    businessDate: l.businessDate,
  };
}

function totalsOf(lines: readonly LaborLine[]): LaborTotals {
  const n = netOf(lines);
  return {
    ...n,
    // standard minutes are counted once per earned line group of an item: the sum of the earned lines
    standardMinutes: lines
      .filter((l) => l.kind === 'earned')
      .reduce((s, l) => s + l.standardMinutes, 0),
  };
}

export async function listLaborLines(
  deps: HrmDeps,
  actor: Actor,
  raw: unknown,
): Promise<LaborListDto> {
  const { scope, own } = viewScope(deps, actor);
  const q = parseInput(laborListSchema, raw);
  const branchId = q.branchId ?? actor.workingBranchId;
  if (!branchId) throw new AppError('scope_merged', 409);
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw notFound();
  // a branch id of another tenant is "not found" too (an 'all' scope would otherwise accept any id)
  if (!(await deps.sys.branches.get(scope, branchId))) throw notFound();
  const today = businessDate(deps.sys.clock.now());
  const to = q.to ?? today;
  const from =
    q.from ?? businessDate(new Date(new Date(`${to}T00:00:00Z`).getTime() - 6 * 86_400_000));
  if (from > to)
    throw new AppError('validation_failed', 422, [{ field: 'from', message: 'from > to' }]);
  const sheets = await deps.sheets.listByBranch(
    scope,
    branchId,
    new Date(new Date(`${from}T00:00:00Z`).getTime() - 86_400_000),
    deps.hrm.sheetsMax,
  );
  const technician = own ? actor.userId : q.technicianId;
  const rows: { sheet: LaborSheet; line: LaborLine }[] = [];
  for (const sheet of sheets)
    for (const line of sheet.lines)
      if (
        line.businessDate >= from &&
        line.businessDate <= to &&
        (!technician || line.technicianId === technician) &&
        (!q.status || statusOf(sheet, line) === q.status)
      )
        rows.push({ sheet, line });
  rows.sort(
    (a, b) => b.line.at.getTime() - a.line.at.getTime() || (a.line.id < b.line.id ? -1 : 1),
  );
  const who = await names(
    deps,
    actor.tenantId,
    rows.flatMap((r) => (r.line.technicianId ? [r.line.technicianId] : [])),
  );
  return {
    branchId,
    from,
    to,
    items: rows.map((r) => toDto(r.sheet, r.line, who)),
    totals: totalsOf(rows.map((r) => r.line)),
    truncated: sheets.length >= deps.hrm.sheetsMax,
  };
}

export interface PendingItemDto {
  itemId: string;
  itemNo: number;
  itemName: string;
  technicianId: string | null;
  technicianName: string | null;
  standardMinutes: number;
  /** finished by the technician and waiting for the quality check (labor is not yet recorded) */
  status: 'pending_qc';
}

export interface OrderLaborDto {
  orderId: string;
  orderNumber: string;
  branchId: string;
  lines: LaborLineDto[];
  pending: PendingItemDto[];
  totals: LaborTotals;
}

/** Labor of one order: its lines and the finished items still waiting for QC ("chờ QC", HRM-07). */
export async function getOrderLabor(
  deps: HrmDeps,
  actor: Actor,
  orderId: string,
): Promise<OrderLaborDto> {
  const { scope, own } = viewScope(deps, actor);
  const order = await deps.orders.get(scope, orderId);
  if (!order) throw notFound();
  const sheet = await deps.sheets.get(scope, orderId);
  const keep = (l: LaborLine) => !own || l.technicianId === actor.userId;
  const lines = (sheet?.lines ?? []).filter(keep);
  const recorded = new Set(
    (sheet?.lines ?? []).filter((l) => l.kind === 'earned').map((l) => l.itemId),
  );
  const pendingItems = order.items.filter(
    (i) =>
      i.status === 'done' && !recorded.has(i.itemId) && (!own || i.technicianId === actor.userId),
  );
  const who = await names(deps, actor.tenantId, [
    ...lines.flatMap((l) => (l.technicianId ? [l.technicianId] : [])),
    ...pendingItems.flatMap((i) => (i.technicianId ? [i.technicianId] : [])),
  ]);
  return {
    orderId,
    orderNumber: order.number,
    branchId: order.branchId,
    lines: lines.map((l) => toDto(sheet!, l, who)),
    pending: pendingItems.map((i) => ({
      itemId: i.itemId,
      itemNo: i.no,
      itemName: i.name,
      technicianId: i.technicianId,
      technicianName: i.technicianId ? (who.get(i.technicianId) ?? null) : null,
      standardMinutes: i.standardMinutes,
      status: 'pending_qc' as const,
    })),
    totals: totalsOf(lines),
  };
}

import type { Actor } from '@/platform/rbac/rbac';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { positionOn, type Employee } from '../domain/employee';
import {
  UNASSIGNED,
  computeItemLabor,
  earnedLineId,
  liveEarned,
  returnedLineId,
  reverseLine,
  workedMsByTechnician,
  type LaborLine,
  type LaborLineWarning,
  type LaborSheet,
  type TechShare,
} from '../domain/labor';
import type { HrmDeps } from '../ports/deps';
import type { LaborItemFacts } from '../ports/ports';
import {
  AppError,
  auditEntry,
  laborMethodAt,
  laborPolicyAt,
  positionFactorAt,
  type RequestCtx,
} from './support';

/**
 * Recording of labor around the QC of a repair order (FR-HRM-007, 008, 020; RULE-010, RULE-038). REC calls these from
 * inside its own transactions through its `LaborGate` port (bridged in the composition root): each `prepare*` does all
 * its READS first (Firestore: reads before the first write) and returns a `commit()` that stages the writes, so the
 * lines commit or fail together with the QC result, the audit entry in the same transaction.
 *
 *  - QC passes: every finished item that has no live labor yet gets its lines, one per technician, id fixed by
 *    (order, item, QC run, technician): a replayed QC can only meet the same ids and writes nothing twice.
 *  - QC fails: the returned items get a zero "qc_returned" marker; no labor is created. Labor an item already had is
 *    kept or reversed by the effective-dated `labor-policy.reworkMode`; the next pass links to the earlier line.
 *  - the order is cancelled: every live line is undone by an opposite line (never an edit, never a delete).
 */

export interface LaborOrderRef {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  serviceType: string;
}

export interface LaborCall {
  tx: Tx;
  scope: Scope;
  actor: Actor;
  ctx: RequestCtx;
  order: LaborOrderRef;
  items: readonly LaborItemFacts[];
  at: Date;
  businessDate: string;
}

export interface StagedLabor {
  /** lines that `commit` will append */
  lines: number;
  commit(): void;
}

interface Share extends TechShare {
  employee: Employee | null;
  positionCode: string | null;
  /** version of the `labor-position` row used (kept on the line, RULE-038) */
  factorVersionId: string | null;
}

const NOTHING: StagedLabor = { lines: 0, commit: () => undefined };

function emptySheet(c: LaborCall): LaborSheet {
  return {
    id: c.order.id,
    tenantId: c.order.tenantId,
    branchId: c.order.branchId,
    orderId: c.order.id,
    orderNumber: c.order.number,
    lines: [],
    recordedAt: c.at,
    version: 0,
  };
}

/** Appends lines to the sheet and audits the change in the same transaction. */
function stage(
  deps: HrmDeps,
  c: LaborCall,
  sheet: LaborSheet | null,
  lines: LaborLine[],
  action: 'labor.record' | 'labor.return' | 'labor.reverse',
  extra: Record<string, unknown>,
): StagedLabor {
  if (lines.length === 0) return NOTHING;
  const base = sheet ?? emptySheet(c);
  if (base.lines.length + lines.length > deps.hrm.linesPerSheetMax)
    throw new AppError('labor_sheet_full', 409);
  return {
    lines: lines.length,
    commit() {
      deps.sheets.save(c.tx, {
        ...base,
        lines: [...base.lines, ...lines],
        recordedAt: c.at,
        version: base.version + 1,
      });
      deps.sys.audit.record(
        c.tx,
        auditEntry(deps.sys, c.actor, c.ctx, {
          branchId: c.order.branchId,
          entityType: 'laborSheet',
          entityId: c.order.id,
          action,
          after: {
            order: c.order.number,
            lines: lines.length,
            amountVnd: lines.reduce((s, l) => s + l.amountVnd, 0),
            ...extra,
          },
        }),
      );
    },
  };
}

async function profileOf(
  deps: HrmDeps,
  cache: Map<string, Employee | null>,
  tenantId: string,
  userId: string,
): Promise<Employee | null> {
  if (!cache.has(userId)) cache.set(userId, await deps.employees.getByUser(tenantId, userId));
  return cache.get(userId) ?? null;
}

/** QC passed (FR-HRM-007): labor of the finished items. Never throws for a missing rule: the line carries a warning. */
export async function prepareQcPass(
  deps: HrmDeps,
  c: LaborCall & { qcRun: number },
): Promise<StagedLabor> {
  const sheet = await deps.sheets.getInTx(c.tx, c.scope, c.order.id);
  const { policy, versionId: policyVersionId } = await laborPolicyAt(
    deps,
    c.order.tenantId,
    c.order.branchId,
    c.businessDate,
  );
  const profiles = new Map<string, Employee | null>();
  const have = new Set((sheet?.lines ?? []).map((l) => l.id));
  const out: LaborLine[] = [];
  for (const item of c.items) {
    if (item.status !== 'done') continue;
    if (liveEarned(sheet, item.itemId).length > 0) continue; // already recorded (rework "keep", or a replay)
    const worked = workedMsByTechnician(item.events, item.assignments);
    const keys = [...worked.keys()].sort(
      (a, b) => worked.get(b)! - worked.get(a)! || (a < b ? -1 : 1),
    );
    if (keys.length === 0) keys.push(item.technicianId ?? UNASSIGNED);
    const shares: Share[] = [];
    for (const key of keys) {
      const employee =
        key === UNASSIGNED ? null : await profileOf(deps, profiles, c.order.tenantId, key);
      const positionCode = employee ? positionOn(employee, c.businessDate) : null;
      const f = await positionFactorAt(deps, c.order.tenantId, positionCode, c.businessDate);
      shares.push({
        key,
        actualMs: worked.get(key) ?? 0,
        coefficientBp: f.coefficientBp,
        employee,
        positionCode,
        factorVersionId: f.versionId,
      });
    }
    // the rule is chosen by the position of the technician with the most worked time (documented assumption, Q for BA)
    const lead = shares[0]!;
    const rule = await laborMethodAt(deps, {
      tenantId: c.order.tenantId,
      branchId: c.order.branchId,
      serviceType: c.order.serviceType,
      positionCode: lead.positionCode,
      date: c.businessDate,
    });
    const computed = rule
      ? computeItemLabor({
          method: rule.payload,
          policy,
          standardMinutes: item.standardMinutes,
          laborAmountVnd: item.laborAmountVnd,
          techs: shares,
        })
      : shares.map((s) => ({
          key: s.key,
          actualMinutes: 0,
          convertedMinutes: null as number | null,
          amountVnd: 0,
        }));
    const prior = [...(sheet?.lines ?? [])].reverse().find((l) => l.itemId === item.itemId);
    for (const [i, r] of computed.entries()) {
      const s = shares[i]!;
      const id = earnedLineId(c.order.id, item.no, c.qcRun, s.key);
      if (have.has(id)) continue;
      const warnings: LaborLineWarning[] = [];
      if (!rule) warnings.push('no_rule');
      if (s.key === UNASSIGNED) warnings.push('no_technician');
      else if (!s.employee) warnings.push('no_profile');
      out.push({
        id,
        tenantId: c.order.tenantId,
        branchId: c.order.branchId,
        orderId: c.order.id,
        orderNumber: c.order.number,
        itemId: item.itemId,
        itemNo: item.no,
        itemName: item.name,
        serviceType: c.order.serviceType,
        kind: 'earned',
        technicianId: s.key === UNASSIGNED ? null : s.key,
        employeeId: s.employee?.id ?? null,
        positionCode: s.positionCode,
        qcRun: c.qcRun,
        actualMinutes: r.actualMinutes,
        standardMinutes: item.standardMinutes,
        convertedMinutes: r.convertedMinutes,
        amountVnd: r.amountVnd,
        method: rule?.payload.method ?? null,
        rule,
        positionVersionId: s.factorVersionId,
        policyVersionId,
        hoursVersionIds: item.hoursVersionIds,
        warnings,
        ...(prior ? { reworkOfLineId: prior.id } : {}),
        at: c.at,
        businessDate: c.businessDate,
        createdBy: c.actor.userId,
      });
    }
  }
  return stage(deps, c, sheet, out, 'labor.record', { qcRun: c.qcRun });
}

/** QC failed (FR-HRM-007, 008): the returned items earn nothing; markers and (by policy) reversals are written. */
export async function prepareQcFail(
  deps: HrmDeps,
  c: LaborCall & { qcRun: number; returnedItemIds: readonly string[] },
): Promise<StagedLabor> {
  if (c.returnedItemIds.length === 0) return NOTHING;
  const sheet = await deps.sheets.getInTx(c.tx, c.scope, c.order.id);
  const { policy, versionId: policyVersionId } = await laborPolicyAt(
    deps,
    c.order.tenantId,
    c.order.branchId,
    c.businessDate,
  );
  const have = new Set((sheet?.lines ?? []).map((l) => l.id));
  const out: LaborLine[] = [];
  for (const item of c.items.filter((i) => c.returnedItemIds.includes(i.itemId))) {
    const live = liveEarned(sheet, item.itemId);
    const markerId = returnedLineId(c.order.id, item.no, c.qcRun);
    if (!have.has(markerId))
      out.push({
        id: markerId,
        tenantId: c.order.tenantId,
        branchId: c.order.branchId,
        orderId: c.order.id,
        orderNumber: c.order.number,
        itemId: item.itemId,
        itemNo: item.no,
        itemName: item.name,
        serviceType: c.order.serviceType,
        kind: 'qc_returned',
        technicianId: item.technicianId,
        employeeId: null,
        positionCode: null,
        qcRun: c.qcRun,
        actualMinutes: 0,
        standardMinutes: item.standardMinutes,
        convertedMinutes: null,
        amountVnd: 0,
        method: null,
        rule: null,
        positionVersionId: null,
        policyVersionId,
        hoursVersionIds: item.hoursVersionIds,
        warnings: [],
        ...(live[0] ? { reworkOfLineId: live[0].id } : {}),
        at: c.at,
        businessDate: c.businessDate,
        createdBy: c.actor.userId,
      });
    if (policy.reworkMode === 'reverse_original')
      for (const l of live)
        if (!have.has(`${l.id}__rev`))
          out.push(
            reverseLine(l, {
              at: c.at,
              businessDate: c.businessDate,
              by: c.actor.userId,
              reason: 'qc_returned',
            }),
          );
  }
  return stage(deps, c, sheet, out, 'labor.return', {
    qcRun: c.qcRun,
    reworkMode: policy.reworkMode,
  });
}

/** The order is cancelled after labor was recorded: every live line is undone by an opposite line (FR-HRM-008). */
export async function prepareCancel(
  deps: HrmDeps,
  c: LaborCall & { reason: string },
): Promise<StagedLabor> {
  const sheet = await deps.sheets.getInTx(c.tx, c.scope, c.order.id);
  if (!sheet) return NOTHING;
  const have = new Set(sheet.lines.map((l) => l.id));
  const live = sheet.lines.filter(
    (l) =>
      l.kind === 'earned' &&
      !have.has(`${l.id}__rev`) &&
      !sheet.lines.some((x) => x.reversesLineId === l.id),
  );
  const adjustments = sheet.lines.filter((l) => l.kind === 'adjustment');
  const out = [...live, ...adjustments]
    .filter((l) => !sheet.lines.some((x) => x.reversesLineId === l.id))
    .map((l) =>
      reverseLine(l, {
        at: c.at,
        businessDate: c.businessDate,
        by: c.actor.userId,
        reason: c.reason.slice(0, 300),
      }),
    );
  return stage(deps, c, sheet, out, 'labor.reverse', { reason: 'order_cancelled' });
}

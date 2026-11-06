import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { branchesScope, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { approvalLimitsOf, openApprovalInTx, type ApprovalHandler } from '@/modules/sys';
import {
  adjustmentNeedsOwner,
  liveEarned,
  netOf,
  type LaborLine,
  type LaborSheet,
} from '../domain/labor';
import type { HrmDeps } from '../ports/deps';
import {
  AppError,
  assertWritable,
  auditEntry,
  hrBranch,
  idemOf,
  laborPolicyAt,
  notFound,
  parseInput,
  z,
  type RequestCtx,
} from './support';

/**
 * Manual labor adjustment (FR-HRM-020, G3-HRM-07 "Điều chỉnh công"). The original line is never edited (RULE-010): an
 * adjustment is a new line that points at it. Above the effective-dated `labor-policy` threshold (hours or VND) it
 * needs the OWNER through the SYS approval workflow (kind `labor_adjustment`, level 2, requester never decides:
 * RULE-036); at or under it the manager records it directly with a reason. Both leave an audit entry.
 */

export const adjustSchema = z.object({
  orderId: z.string().trim().min(1).max(128),
  /** the earned line being corrected */
  lineId: z.string().trim().min(1).max(200),
  /** signed whole minutes of converted hours */
  deltaMinutes: z
    .number()
    .int()
    .min(-24 * 60)
    .max(24 * 60),
  /** signed whole VND */
  deltaVnd: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  reason: z.string().trim().min(5).max(300),
});

const adjustmentId = (lineId: string, key: string): string => `${lineId}__adj__${key}`;

/** Pure: builds the adjustment line from the line it corrects. */
function adjustmentLine(
  base: LaborLine,
  v: {
    id: string;
    deltaMinutes: number;
    deltaVnd: number;
    reason: string;
    approvalId?: string;
    at: Date;
    businessDate: string;
    by: string;
  },
): LaborLine {
  return {
    ...base,
    id: v.id,
    kind: 'adjustment',
    actualMinutes: 0,
    convertedMinutes: v.deltaMinutes,
    amountVnd: v.deltaVnd,
    warnings: [],
    adjustsLineId: base.id,
    ...(v.approvalId ? { approvalId: v.approvalId } : {}),
    reason: v.reason,
    at: v.at,
    businessDate: v.businessDate,
    createdBy: v.by,
  };
}

function checkTarget(
  sheet: LaborSheet | null,
  lineId: string,
  dMin: number,
  dVnd: number,
): LaborLine {
  const line = sheet?.lines.find((l) => l.id === lineId);
  if (!sheet || !line || line.kind !== 'earned') throw notFound();
  if (!liveEarned(sheet, line.itemId).some((l) => l.id === lineId))
    throw new AppError('labor_line_reversed', 409);
  // the corrected labor of this technician on the item must not drop below zero
  const same = sheet.lines.filter(
    (l) => l.itemId === line.itemId && l.technicianId === line.technicianId,
  );
  const live = liveEarned(sheet, line.itemId).filter((l) => l.technicianId === line.technicianId);
  const adjustments = same.filter(
    (l) => l.kind === 'adjustment' && !sheet.lines.some((x) => x.reversesLineId === l.id),
  );
  const net = netOf([...live, ...adjustments]);
  if (net.amountVnd + dVnd < 0 || net.convertedMinutes + dMin < 0)
    throw new AppError('adjustment_below_zero', 409);
  return line;
}

function stageAdjustment(
  deps: HrmDeps,
  tx: Tx,
  actor: Actor,
  ctx: RequestCtx,
  sheet: LaborSheet,
  line: LaborLine,
): void {
  if (sheet.lines.length + 1 > deps.hrm.linesPerSheetMax)
    throw new AppError('labor_sheet_full', 409);
  deps.sheets.save(tx, {
    ...sheet,
    lines: [...sheet.lines, line],
    recordedAt: line.at,
    version: sheet.version + 1,
  });
  deps.sys.audit.record(
    tx,
    auditEntry(deps.sys, actor, ctx, {
      branchId: sheet.branchId,
      entityType: 'laborSheet',
      entityId: sheet.id,
      action: 'labor.adjust',
      after: {
        order: sheet.orderNumber,
        adjusts: line.adjustsLineId,
        deltaMinutes: line.convertedMinutes,
        deltaVnd: line.amountVnd,
        approval: line.approvalId ?? null,
      },
      reason: line.reason ?? '',
    }),
  );
}

export async function adjustLabor(
  deps: HrmDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'labor-adjustment:create');
  const branchId = hrBranch(actor, scope);
  const data = parseInput(adjustSchema, input);
  const date = businessDate(deps.sys.clock.now());
  const { policy } = await laborPolicyAt(deps, actor.tenantId, branchId, date);
  const needsOwner = adjustmentNeedsOwner(policy, data.deltaMinutes, data.deltaVnd);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/hrm/labor/adjustments',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const sheet = await deps.sheets.getInTx(tx, scope, data.orderId);
      if (!sheet || sheet.branchId !== branchId) throw notFound();
      const base = checkTarget(sheet, data.lineId, data.deltaMinutes, data.deltaVnd);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const now = deps.sys.clock.now();
      if (!needsOwner) {
        stageAdjustment(
          deps,
          tx,
          actor,
          ctx,
          sheet,
          adjustmentLine(base, {
            id: adjustmentId(base.id, ctx.idempotencyKey),
            deltaMinutes: data.deltaMinutes,
            deltaVnd: data.deltaVnd,
            reason: data.reason,
            at: now,
            businessDate: businessDate(now),
            by: actor.userId,
          }),
        );
        return {
          status: 201,
          body: { applied: true, lineId: adjustmentId(base.id, ctx.idempotencyKey) },
        };
      }
      const limits = await approvalLimitsOf(deps.sys, actor.tenantId, 'labor_adjustment', date);
      const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
        kind: 'labor_adjustment',
        level: 2,
        limits,
        branch,
        subjectType: 'laborLine',
        subjectId: base.id,
        subjectLabel: `${sheet.orderNumber} / ${base.itemName}`.slice(0, 120),
        valueVnd: Math.abs(data.deltaVnd),
        reason: data.reason,
        payload: {
          orderId: data.orderId,
          lineId: base.id,
          deltaMinutes: data.deltaMinutes,
          deltaVnd: data.deltaVnd,
        },
        link: `/hrm/labor?order=${data.orderId}`,
      });
      return {
        status: 202,
        body: { applied: false, approvalId: req.id, number: req.number, level: req.level },
      };
    },
  );
}

/**
 * Effect of the owner's decision, run by SYS inside the decision transaction (same pattern as ACC's handlers): an
 * approved request appends the adjustment line once (id fixed by the request), a rejection does nothing.
 */
export function hrmApprovalHandlers(getDeps: () => HrmDeps): Record<string, ApprovalHandler> {
  return {
    labor_adjustment: {
      async onDecided({ tx, request: r, decision, actor, ctx }) {
        if (decision !== 'approved') return;
        const deps = getDeps();
        const scope: Scope = branchesScope(r.tenantId, [r.branchId]);
        const p = r.payload as {
          orderId: string;
          lineId: string;
          deltaMinutes: number;
          deltaVnd: number;
        };
        const sheet = await deps.sheets.getInTx(tx, scope, p.orderId);
        const id = adjustmentId(p.lineId, r.id);
        if (sheet?.lines.some((l) => l.id === id)) return; // already applied (replay)
        let base: LaborLine;
        try {
          base = checkTarget(sheet, p.lineId, p.deltaMinutes, p.deltaVnd);
        } catch {
          // the line was reversed (order cancelled) or the figures no longer fit: the request is stale
          throw new AppError('approval_stale', 409);
        }
        const now = deps.sys.clock.now();
        stageAdjustment(
          deps,
          tx,
          actor,
          ctx,
          sheet!,
          adjustmentLine(base, {
            id,
            deltaMinutes: p.deltaMinutes,
            deltaVnd: p.deltaVnd,
            reason: r.reason,
            approvalId: r.id,
            at: now,
            businessDate: businessDate(now),
            by: actor.userId,
          }),
        );
      },
    },
  };
}

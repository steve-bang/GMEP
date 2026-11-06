import { z } from 'zod';
import { AppError, forbidden, notFound, validationFailed } from '@/platform/errors/errors';
import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import {
  hasPermission,
  requireWorkingBranch,
  resolveScope,
  type Actor,
} from '@/platform/rbac/rbac';
import { branchesScope, scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  APPROVAL_KIND_DEFS,
  approvalSlotId,
  approverPermissionFor,
  INVOICE_APPROVER_PERMISSION,
  checkDecision,
  isApprovalExpired,
  isApprovalKind,
  REAUTH_ON_APPROVE,
  isOverdue,
  requiredLevel,
  type ApprovalKind,
  type ApprovalLevel,
  type ApprovalLimits,
  type ApprovalRequest,
} from '../domain/approval';
import type { Branch } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { reauthenticate, resolveConfigAt } from './config';
import { allocateDocumentNumber } from './numbering';
import { notifyUsers, usersWithRole } from './notifications';
import { auditEntry, parseInput, roleCodesOf, type RequestCtx } from './support';

/**
 * Minimal approval workflow (FR-SYS-004, G4-APR-01..03). Domain modules open a request INSIDE their own transaction
 * (`openApprovalInTx`), a person other than the requester decides it (`decideApproval`), and the effect is either
 * run by a registered handler in the same transaction as the decision (debt, cash variance) or run later by the
 * requester's use case, which consumes the approved request exactly once (`consumeApprovalInTx`: reversal, expense).
 */

const idem = (deps: SysDeps) => ({
  uow: deps.uow,
  store: deps.idempotency,
  now: () => deps.clock.now(),
  ttlMs: deps.config.idempotencyTtlMs,
});

/** The limits in force for a kind on a date: the effective-dated config version, else the documented fallback. */
export async function approvalLimitsOf(
  deps: SysDeps,
  tenantId: string,
  kind: ApprovalKind,
  date: string,
): Promise<ApprovalLimits> {
  const snap = await resolveConfigAt(deps, {
    tenantId,
    type: 'approval-limit',
    scopeKey: kind,
    date,
  });
  return snap ? (snap.payload as unknown as ApprovalLimits) : APPROVAL_KIND_DEFS[kind].defaults;
}

/** Which level must decide `valueVnd` of `kind` (0 = no approval needed). Reads the effective-dated limits. */
export async function approvalLevelFor(
  deps: SysDeps,
  tenantId: string,
  kind: ApprovalKind,
  valueVnd: number,
): Promise<{ level: 0 | ApprovalLevel; limits: ApprovalLimits }> {
  const limits = await approvalLimitsOf(deps, tenantId, kind, businessDate(deps.clock.now()));
  return { level: requiredLevel(kind, valueVnd, limits), limits };
}

export interface OpenApprovalInput {
  kind: ApprovalKind;
  level: ApprovalLevel;
  limits: ApprovalLimits;
  branch: Branch;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  valueVnd: number;
  reason: string;
  payload: Record<string, unknown>;
  /** links the request to a REC/ACC page the approver opens */
  link?: string;
}

/**
 * Opens a request inside the caller's transaction (call after the caller's own reads). One pending request per
 * (kind, subject): a second one is a 409 `approval_already_pending`. Approvers of the branch are notified.
 */
export async function openApprovalInTx(
  deps: SysDeps,
  tx: Tx,
  actor: Actor,
  ctx: RequestCtx,
  i: OpenApprovalInput,
): Promise<ApprovalRequest> {
  if (!isApprovalKind(i.kind)) throw new AppError('approval_kind_unknown', 422);
  const slotId = approvalSlotId(i.kind, i.subjectId);
  const slot = await deps.approvals.getSlotInTx(tx, slotId);
  if (slot?.open) {
    // an APPROVED request that outlived its `validHours` can never be used again (the use case answers
    // approval_expired): it must not keep the slot closed to a new request
    const old = await deps.approvals.getInTx(
      tx,
      branchesScope(actor.tenantId, [i.branch.id]),
      slot.requestId,
    );
    const dead =
      !!old &&
      old.status === 'approved' &&
      !old.consumedAt &&
      isApprovalExpired(
        old.decidedAt ?? old.requestedAt,
        deps.clock.now(),
        i.limits.validHours ?? APPROVAL_KIND_DEFS[i.kind].defaults.validHours,
      );
    if (!dead) throw new AppError('approval_already_pending', 409);
  }
  const approvers = await approversOf(deps, actor.tenantId, i.branch.id, i.level, i.kind);
  const now = deps.clock.now();
  const id = `ap_${deps.newId()}`;
  const num = await allocateDocumentNumber(deps, tx, {
    branch: i.branch,
    docType: 'approval-request',
    businessDate: businessDate(now),
    stage: 'create',
    documentId: id,
    ...(ctx.idempotencyKey ? { requestKey: `${ctx.idempotencyKey}:approval` } : {}),
  });
  const r: ApprovalRequest = {
    id,
    tenantId: actor.tenantId,
    branchId: i.branch.id,
    number: num.number!,
    kind: i.kind,
    level: i.level,
    subjectType: i.subjectType,
    subjectId: i.subjectId,
    subjectLabel: i.subjectLabel,
    valueVnd: i.valueVnd,
    reason: i.reason,
    payload: i.payload,
    status: 'pending',
    requestedBy: actor.userId,
    requestedByName: actor.displayName,
    requestedByRole: roleCodesOf(actor).join(','),
    requestedAt: now,
    dueAt: new Date(now.getTime() + i.limits.dueHours * 3_600_000),
    createdAt: now,
    createdBy: actor.userId,
    updatedAt: now,
    updatedBy: actor.userId,
    version: 1,
  };
  deps.approvals.create(tx, r);
  deps.approvals.setSlot(tx, slotId, { requestId: id, open: true, tenantId: actor.tenantId });
  deps.audit.record(
    tx,
    auditEntry(deps, actor, ctx, {
      branchId: i.branch.id,
      entityType: 'approval',
      entityId: id,
      action: 'approval.request',
      after: {
        number: r.number,
        kind: r.kind,
        level: r.level,
        subject: i.subjectLabel,
        valueVnd: i.valueVnd,
      },
      reason: i.reason,
    }),
  );
  notifyUsers(deps, tx, {
    tenantId: actor.tenantId,
    userIds: approvers.filter((u) => u !== actor.userId),
    kind: 'approval',
    titleKey: 'notifications.approvalRequested',
    params: { number: r.number, kind: r.kind },
    link: '/approvals',
    branchId: i.branch.id,
  });
  return r;
}

/** People who may decide a request of `level` at the branch (level 2 holders also see level 1, but only the owner role is listed). */
async function approversOf(
  deps: SysDeps,
  tenantId: string,
  branchId: string,
  level: ApprovalLevel,
  kind: ApprovalKind,
): Promise<string[]> {
  const roles = (await deps.roles.list()).filter((r) =>
    r.permissions.includes(approverPermissionFor(kind, level)),
  );
  return usersWithRole(
    deps,
    tenantId,
    roles.map((r) => r.code),
    branchId,
  );
}

export const decideSchema = z.object({
  version: z.number().int().min(1),
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(300).optional(),
  /** R106: password of the decider, required to approve a `day_reopen` request; never stored or put in the idempotency fingerprint */
  reauthPassword: z.string().max(256).optional(),
});

/**
 * Approves or rejects. The decider holds the permission of the request's level at the request's branch, is a
 * different person from the requester, and a rejection needs a note. The kind's handler (if any) runs inside this
 * transaction, so the effect and the decision commit together or not at all.
 */
export async function decideApproval(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const data = parseInput(decideSchema, input);
  if (data.decision === 'reject' && (data.note ?? '').length < 5)
    throw validationFailed([{ field: 'note', message: 'Ghi lý do từ chối (tối thiểu 5 ký tự).' }]);
  const viewScope = resolveScope(actor, 'approval:view');
  const r0 = await deps.approvals.get(viewScope, id);
  if (!r0) throw notFound();
  // BA §25 F-1(3): deciding is a write, fenced to the working branch; say so instead of a bare 403
  if (
    actor.workingBranchId &&
    r0.branchId !== actor.workingBranchId &&
    hasPermission(actor, approverPermissionFor(r0.kind, r0.level))
  )
    throw new AppError('switch_branch_required', 409);
  const decideScope = resolveScope(actor, approverPermissionFor(r0.kind, r0.level));
  if (!scopeAllows(decideScope, actor.tenantId, r0.branchId)) throw forbidden();
  // R106: approving the reopening of a closed day needs the password again (a left-open session cannot do it)
  if (data.decision === 'approve' && REAUTH_ON_APPROVE.includes(r0.kind))
    await reauthenticate(deps, actor, data.reauthPassword);
  const { reauthPassword: _pw, ...decision } = data;
  void _pw;
  return runIdempotent(
    idem(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/sys/approvals/${id}/decide`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...decision }),
    },
    async (tx) => {
      const r = await deps.approvals.getInTx(tx, decideScope, id);
      if (!r) throw notFound();
      if (r.version !== data.version) throw new AppError('version_conflict', 409);
      const ok = checkDecision(r, actor.userId);
      if (!ok.ok) throw new AppError(ok.reason, 409);
      const now = deps.clock.now();
      const approved = data.decision === 'approve';
      const handler = deps.approvalHandlers.get(r.kind);
      if (handler)
        await handler.onDecided({
          tx,
          request: r,
          decision: approved ? 'approved' : 'rejected',
          ...(data.note ? { note: data.note } : {}),
          actor,
          ctx,
        });
      // a request with a handler has already had its effect; without one the requester's use case consumes it later
      const consumed = !!handler && approved;
      deps.approvals.update(tx, r.id, {
        status: approved ? 'approved' : 'rejected',
        decidedBy: actor.userId,
        decidedByName: actor.displayName,
        decidedAt: now,
        ...(data.note ? { decisionNote: data.note } : {}),
        ...(consumed ? { consumedAt: now, consumedBy: actor.userId } : {}),
        updatedAt: now,
        updatedBy: actor.userId,
        version: r.version + 1,
      });
      if (!approved || consumed)
        deps.approvals.setSlot(tx, approvalSlotId(r.kind, r.subjectId), {
          requestId: r.id,
          open: false,
          tenantId: r.tenantId,
        });
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: r.branchId,
          entityType: 'approval',
          entityId: r.id,
          action: approved ? 'approval.approve' : 'approval.reject',
          before: { status: r.status },
          after: { status: approved ? 'approved' : 'rejected', kind: r.kind, valueVnd: r.valueVnd },
          ...(data.note ? { reason: data.note } : {}),
        }),
      );
      notifyUsers(deps, tx, {
        tenantId: r.tenantId,
        userIds: [r.requestedBy],
        kind: 'approval',
        titleKey: approved ? 'notifications.approvalApproved' : 'notifications.approvalRejected',
        params: { number: r.number },
        link: '/approvals',
        branchId: r.branchId,
      });
      return { status: 200, body: { id: r.id, status: approved ? 'approved' : 'rejected' } };
    },
  );
}

export const withdrawSchema = z.object({ version: z.number().int().min(1) });

/** The requester takes a pending request back (e.g. the amount was wrong). */
export async function withdrawApproval(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const data = parseInput(withdrawSchema, input);
  const scope = resolveScope(actor, 'approval:view');
  return runIdempotent(
    idem(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/sys/approvals/${id}/withdraw`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const r = await deps.approvals.getInTx(tx, scope, id);
      if (!r) throw notFound();
      if (r.requestedBy !== actor.userId) throw forbidden();
      if (r.version !== data.version) throw new AppError('version_conflict', 409);
      if (r.status !== 'pending') throw new AppError('approval_not_pending', 409);
      const now = deps.clock.now();
      deps.approvals.update(tx, r.id, {
        status: 'withdrawn',
        updatedAt: now,
        updatedBy: actor.userId,
        version: r.version + 1,
      });
      deps.approvals.setSlot(tx, approvalSlotId(r.kind, r.subjectId), {
        requestId: r.id,
        open: false,
        tenantId: r.tenantId,
      });
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: r.branchId,
          entityType: 'approval',
          entityId: r.id,
          action: 'approval.withdraw',
          before: { status: 'pending' },
          after: { status: 'withdrawn' },
        }),
      );
      return { status: 200, body: { id: r.id, status: 'withdrawn' } };
    },
  );
}

/**
 * Uses an approved request exactly once, in two steps because a Firestore transaction must finish ALL its reads
 * before its first write. (1) `loadApprovalForUse` READS and validates: approved, not yet used, of the expected
 * kind, branch and (when given) subject. (2) `consumeApprovalInTx` only STAGES the writes (marks it used, closes the
 * slot, audits); call it after the executing use case's own reads. A second execution is a 409 `approval_already_used`.
 */
export async function loadApprovalForUse(
  deps: SysDeps,
  tx: Tx,
  scope: Scope,
  c: { id: string; kind: ApprovalKind; branchId: string; subjectId?: string },
): Promise<ApprovalRequest> {
  const r = await deps.approvals.getInTx(tx, scope, c.id);
  if (!r || r.kind !== c.kind || r.branchId !== c.branchId) throw notFound();
  if (c.subjectId !== undefined && r.subjectId !== c.subjectId) throw notFound();
  if (r.status === 'pending') throw new AppError('approval_pending', 409);
  if (r.status !== 'approved') throw new AppError('approval_not_approved', 409);
  if (r.consumedAt) throw new AppError('approval_already_used', 409);
  return r;
}

export function consumeApprovalInTx(
  deps: SysDeps,
  tx: Tx,
  actor: Actor,
  ctx: RequestCtx,
  r: ApprovalRequest,
  resultId?: string,
): void {
  const now = deps.clock.now();
  deps.approvals.update(tx, r.id, {
    consumedAt: now,
    consumedBy: actor.userId,
    ...(resultId ? { resultId } : {}),
    updatedAt: now,
    updatedBy: actor.userId,
    version: r.version + 1,
  });
  deps.approvals.setSlot(tx, approvalSlotId(r.kind, r.subjectId), {
    requestId: r.id,
    open: false,
    tenantId: r.tenantId,
  });
  deps.audit.record(
    tx,
    auditEntry(deps, actor, ctx, {
      branchId: r.branchId,
      entityType: 'approval',
      entityId: r.id,
      action: 'approval.consume',
      after: { kind: r.kind, resultId: resultId ?? null },
    }),
  );
}

// ---- reading ------------------------------------------------------------------------------------------

export interface ApprovalDto {
  id: string;
  number: string;
  kind: ApprovalKind;
  level: ApprovalLevel;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  valueVnd: number;
  reason: string;
  status: ApprovalRequest['status'];
  requestedByName: string;
  requestedAt: string;
  dueAt: string;
  overdue: boolean;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  consumed: boolean;
  version: number;
  payload: Record<string, unknown>;
  actions: Record<'decide' | 'withdraw', { allowed: boolean; reasonCode?: string }>;
}

function toDto(deps: SysDeps, actor: Actor, r: ApprovalRequest): ApprovalDto {
  const may = hasPermission(actor, approverPermissionFor(r.kind, r.level));
  const otherBranch = !!actor.workingBranchId && r.branchId !== actor.workingBranchId;
  const decide = !may
    ? { allowed: false, reasonCode: 'no_permission' }
    : otherBranch && r.status === 'pending'
      ? { allowed: false, reasonCode: 'switch_branch_required' }
      : checkDecision(r, actor.userId).ok
        ? { allowed: true }
        : {
            allowed: false,
            reasonCode:
              r.requestedBy === actor.userId ? 'approval_self_decision' : 'approval_not_pending',
          };
  return {
    id: r.id,
    number: r.number,
    kind: r.kind,
    level: r.level,
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    subjectLabel: r.subjectLabel,
    valueVnd: r.valueVnd,
    reason: r.reason,
    status: r.status,
    requestedByName: r.requestedByName,
    requestedAt: r.requestedAt.toISOString(),
    dueAt: r.dueAt.toISOString(),
    overdue: isOverdue(r, deps.clock.now()),
    decidedByName: r.decidedByName ?? null,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decisionNote: r.decisionNote ?? null,
    consumed: !!r.consumedAt,
    version: r.version,
    payload: r.payload,
    actions: {
      decide,
      withdraw:
        r.status === 'pending' && r.requestedBy === actor.userId
          ? { allowed: true }
          : { allowed: false, reasonCode: 'not_requester' },
    },
  };
}

export type ApprovalTab = 'toDecide' | 'mine' | 'done';
const LIST_MAX = 100;

/**
 * Queue of the working branch (G4-APR-01). "toDecide" = pending requests the actor may decide (own requests are
 * listed but flagged); "mine" = what the actor asked for; "done" = approved or rejected, newest first.
 */
export async function listApprovals(
  deps: SysDeps,
  actor: Actor,
  q: { tab: ApprovalTab; kind?: string },
): Promise<{ items: ApprovalDto[]; counts: { toDecide: number; mine: number } }> {
  const scope = resolveScope(actor, 'approval:view');
  const branchId = requireWorkingBranch(actor);
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw forbidden();
  const canDecide =
    hasPermission(actor, 'approval-l1:approve') ||
    hasPermission(actor, INVOICE_APPROVER_PERMISSION);
  const pending = canDecide
    ? await deps.approvals.listByBranchStatus(scope, branchId, 'pending', LIST_MAX)
    : [];
  const decidable = pending.filter((r) =>
    hasPermission(actor, approverPermissionFor(r.kind, r.level)),
  );
  const mine = await deps.approvals.listByRequester(scope, actor.userId, LIST_MAX);
  let rows: ApprovalRequest[];
  if (q.tab === 'toDecide') rows = decidable;
  else if (q.tab === 'mine') rows = mine.filter((r) => r.branchId === branchId);
  else {
    rows = canDecide
      ? [
          ...(await deps.approvals.listByBranchStatus(scope, branchId, 'approved', LIST_MAX)),
          ...(await deps.approvals.listByBranchStatus(scope, branchId, 'rejected', LIST_MAX)),
        ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      : mine.filter((r) => r.branchId === branchId && r.status !== 'pending');
  }
  if (q.kind) rows = rows.filter((r) => r.kind === q.kind);
  return {
    items: rows.slice(0, LIST_MAX).map((r) => toDto(deps, actor, r)),
    counts: {
      toDecide: decidable.filter((r) => r.requestedBy !== actor.userId).length,
      mine: mine.filter((r) => r.status === 'pending').length,
    },
  };
}

export async function getApproval(deps: SysDeps, actor: Actor, id: string): Promise<ApprovalDto> {
  const scope = resolveScope(actor, 'approval:view');
  const r = await deps.approvals.get(scope, id);
  if (!r) throw notFound();
  // a requester sees their own; a decider sees the branch's; nobody else
  if (
    r.requestedBy !== actor.userId &&
    !hasPermission(actor, approverPermissionFor(r.kind, r.level))
  )
    throw notFound();
  return toDto(deps, actor, r);
}

/**
 * The request of the kind for the subject that is still live: pending, or approved and not yet used. A pending one
 * is visible to every viewer of the branch; an approved-unused one only to its requester (who executes it).
 */
export async function findActiveApprovalFor(
  deps: SysDeps,
  actor: Actor,
  q: { kind: ApprovalKind; subjectId: string; branchId: string },
): Promise<ApprovalDto | null> {
  const scope = resolveScope(actor, 'approval:view');
  const limits = await approvalLimitsOf(
    deps,
    actor.tenantId,
    q.kind,
    businessDate(deps.clock.now()),
  );
  const [pending, mine] = await Promise.all([
    deps.approvals.listByBranchStatus(scope, q.branchId, 'pending', LIST_MAX),
    deps.approvals.listByRequester(scope, actor.userId, LIST_MAX),
  ]);
  const r = [...pending, ...mine].find(
    (x) =>
      x.kind === q.kind &&
      x.subjectId === q.subjectId &&
      x.branchId === q.branchId &&
      (x.status === 'pending' ||
        (x.status === 'approved' &&
          !x.consumedAt &&
          // an approval past its validity is dead: the screen offers a new request instead
          !isApprovalExpired(
            x.decidedAt ?? x.requestedAt,
            deps.clock.now(),
            limits.validHours ?? APPROVAL_KIND_DEFS[q.kind].defaults.validHours,
          ))),
  );
  return r ? toDto(deps, actor, r) : null;
}

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
  APPROVAL_KINDS,
  approvalSlotId,
  approverPermissionFor,
  INVOICE_APPROVER_PERMISSION,
  checkDecision,
  delegationCovers,
  isApprovalExpired,
  isApprovalKind,
  escalationAction,
  isOverdue,
  reauthRequired,
  requiredLevel,
  type ApprovalKind,
  type ApprovalLevel,
  type ApprovalLimits,
  type ApprovalRequest,
  type WorkSchedule,
  unconfiguredLimits,
  workingMinutesBetween,
} from '../domain/approval';
import { TENANT_ACCESS } from '../domain/tenant';
import type { Branch } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { reauthenticate, resolveConfigAt } from './config';
import { delegationsOfDelegate, findDelegationFor } from './delegations';
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

/**
 * The limits in force for a kind on a date: the effective-dated config version of the TENANT. None in force =
 * `unconfiguredLimits` (RULE-036, FR-SYS-033): the request goes to the highest level and nothing passes alone.
 */
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
  return snap ? (snap.payload as unknown as ApprovalLimits) : unconfiguredLimits(kind);
}

/** Which level must decide `valueVnd` of `kind` (0 = no approval needed). Reads the effective-dated limits. */
export async function approvalLevelFor(
  deps: SysDeps,
  tenantId: string,
  kind: ApprovalKind,
  valueVnd: number,
  /** RULE-036: what the kind's accumulator already counted in its window (slice 2.7 supplies it); default 0 */
  accumulatedVnd = 0,
): Promise<{ level: 0 | ApprovalLevel; limits: ApprovalLimits }> {
  const limits = await approvalLimitsOf(deps, tenantId, kind, businessDate(deps.clock.now()));
  return { level: requiredLevel(kind, valueVnd, limits, accumulatedVnd), limits };
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
  let level = i.level;
  let approvers = await approversOf(deps, actor.tenantId, i.branch.id, level, i.kind);
  // FR-SYS-034: when the only person with the level-1 right is the requester, the request goes to level 2
  const noOther = level === 1 && approvers.filter((u) => u !== actor.userId).length === 0;
  if (noOther) {
    level = 2;
    approvers = await approversOf(deps, actor.tenantId, i.branch.id, 2, i.kind);
  }
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
    level,
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
    ...(noOther
      ? {
          escalatedAt: now,
          escalatedFrom: 1 as ApprovalLevel,
          escalationReason: 'no_eligible_approver',
        }
      : {}),
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
        ...(noOther ? { escalatedFrom: 1, escalationReason: 'no_eligible_approver' } : {}),
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
  const roles = (await deps.roles.list(tenantId)).filter((r) =>
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
  const perm = approverPermissionFor(r0.kind, r0.level);
  // BA §25 F-1(3): deciding is a write, fenced to the working branch; say so instead of a bare 403
  if (actor.workingBranchId && r0.branchId !== actor.workingBranchId)
    if (hasPermission(actor, perm) || (await delegationsOfDelegate(deps, actor)).length > 0)
      throw new AppError('switch_branch_required', 409);
  // own right first; otherwise a delegation in force (FR-SYS-033, RULE-036)
  let decideScope = viewScope;
  let via: Awaited<ReturnType<typeof findDelegationFor>> = null;
  const ownScope = hasPermission(actor, perm) ? resolveScope(actor, perm) : null;
  if (ownScope && scopeAllows(ownScope, actor.tenantId, r0.branchId)) decideScope = ownScope;
  else {
    via = await findDelegationFor(deps, actor, r0, await delegationsOfDelegate(deps, actor));
    if (!via) throw forbidden();
  }
  const limits = await approvalLimitsOf(
    deps,
    actor.tenantId,
    r0.kind,
    businessDate(deps.clock.now()),
  );
  // R106: approving the reopening of a closed day needs the password again (a left-open session cannot do it);
  // which kinds need it is configuration (`reauthOnApprove`), the legacy list only when the config is silent
  if (data.decision === 'approve' && reauthRequired(r0.kind, limits))
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
      // the level may have changed (escalation) after the checks above: the right must still fit the request
      if (r.level !== r0.level) throw new AppError('version_conflict', 409);
      // the delegation is read again inside the transaction: revoked or expired a moment ago means no right
      if (via) {
        const dd = await deps.delegations.getInTx(tx, actor.tenantId, via.id);
        if (!dd || !delegationCovers(dd, r, deps.clock.now())) throw forbidden();
      }
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
        ...(via ? { decidedOnBehalfOf: via.delegatorId, delegationId: via.id } : {}),
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
          after: {
            status: approved ? 'approved' : 'rejected',
            kind: r.kind,
            valueVnd: r.valueVnd,
            ...(via ? { onBehalfOf: via.delegatorId, delegationId: via.id } : {}),
          },
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
  /** FR-SYS-034: moved up a level (still pending); `escalatedFrom` is the level it came from */
  escalated: boolean;
  escalatedFrom: ApprovalLevel | null;
  escalationReason: string | null;
  reminded: boolean;
  /** FR-SYS-033: the request was decided by a delegate for this person, or the viewer may decide it by delegation */
  decidedOnBehalfOf: string | null;
  viaDelegation: boolean;
  /** R106: approving needs the password again (configuration, else the legacy list) */
  reauth: boolean;
  version: number;
  payload: Record<string, unknown>;
  actions: Record<'decide' | 'withdraw', { allowed: boolean; reasonCode?: string }>;
}

function toDto(
  deps: SysDeps,
  actor: Actor,
  r: ApprovalRequest,
  delegated = false,
  reauth = false,
): ApprovalDto {
  const may = hasPermission(actor, approverPermissionFor(r.kind, r.level)) || delegated;
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
    escalated: !!r.escalatedAt,
    escalatedFrom: r.escalatedFrom ?? null,
    escalationReason: r.escalationReason ?? null,
    reminded: !!r.remindedAt,
    decidedOnBehalfOf: r.decidedOnBehalfOf ?? null,
    reauth,
    viaDelegation: delegated && !hasPermission(actor, approverPermissionFor(r.kind, r.level)),
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
): Promise<{
  items: ApprovalDto[];
  counts: { toDecide: number; mine: number };
  warnings: ApprovalQueueWarnings;
}> {
  const scope = resolveScope(actor, 'approval:view');
  const branchId = requireWorkingBranch(actor);
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw forbidden();
  const myDelegations = await delegationsOfDelegate(deps, actor);
  const canDecide =
    hasPermission(actor, 'approval-l1:approve') ||
    hasPermission(actor, INVOICE_APPROVER_PERMISSION) ||
    myDelegations.length > 0;
  const pending = canDecide
    ? await deps.approvals.listByBranchStatus(scope, branchId, 'pending', LIST_MAX)
    : [];
  // a request the actor may decide: by own right at its level, or by a delegation in force (RULE-036)
  const cache = new Map<string, boolean>();
  const viaOf = new Map<string, boolean>();
  const decidable: ApprovalRequest[] = [];
  for (const r of pending) {
    if (hasPermission(actor, approverPermissionFor(r.kind, r.level))) decidable.push(r);
    else if (await findDelegationFor(deps, actor, r, myDelegations, cache)) {
      viaOf.set(r.id, true);
      decidable.push(r);
    }
  }
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
  const reauthOf = new Map<ApprovalKind, boolean>();
  for (const k of new Set(rows.map((r) => r.kind)))
    reauthOf.set(
      k,
      reauthRequired(
        k,
        await approvalLimitsOf(deps, actor.tenantId, k, businessDate(deps.clock.now())),
      ),
    );
  return {
    items: rows
      .slice(0, LIST_MAX)
      .map((r) => toDto(deps, actor, r, viaOf.get(r.id) === true, reauthOf.get(r.kind) === true)),
    counts: {
      toDecide: decidable.filter((r) => r.requestedBy !== actor.userId).length,
      mine: mine.filter((r) => r.status === 'pending').length,
    },
    warnings: await queueWarnings(deps, actor.tenantId, branchId),
  };
}

/**
 * 2.5-2, 2.5-7: two configuration gaps the approvers must see. No `work-hours` = reminders and escalation count wall
 * clock hours ("đang tính theo giờ đồng hồ"); no approval limit in force for a kind = every request of that kind goes to
 * the highest level (RULE-036). Data only: the banner on G4-APR-03 is the designer's.
 */
export interface ApprovalQueueWarnings {
  workHoursUnconfigured: boolean;
  limitsUnissuedKinds: ApprovalKind[];
}

async function queueWarnings(
  deps: SysDeps,
  tenantId: string,
  branchId: string,
): Promise<ApprovalQueueWarnings> {
  const date = businessDate(deps.clock.now());
  const unissued: ApprovalKind[] = [];
  for (const kind of APPROVAL_KINDS) {
    const snap = await resolveConfigAt(deps, {
      tenantId,
      type: 'approval-limit',
      scopeKey: kind,
      date,
    });
    if (!snap) unissued.push(kind);
  }
  return {
    workHoursUnconfigured: (await workScheduleOf(deps, tenantId, branchId, date)) === null,
    limitsUnissuedKinds: unissued,
  };
}

export async function getApproval(deps: SysDeps, actor: Actor, id: string): Promise<ApprovalDto> {
  const scope = resolveScope(actor, 'approval:view');
  const r = await deps.approvals.get(scope, id);
  if (!r) throw notFound();
  // a requester sees their own; a decider (own right or delegation) sees the branch's; nobody else
  const own = hasPermission(actor, approverPermissionFor(r.kind, r.level));
  const delegated =
    !own && r.requestedBy !== actor.userId
      ? !!(await findDelegationFor(deps, actor, r, await delegationsOfDelegate(deps, actor)))
      : false;
  if (r.requestedBy !== actor.userId && !own && !delegated) throw notFound();
  const limits = await approvalLimitsOf(
    deps,
    actor.tenantId,
    r.kind,
    businessDate(deps.clock.now()),
  );
  return toDto(deps, actor, r, delegated, reauthRequired(r.kind, limits));
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

// ---- reminders and escalation by working time (FR-SYS-015, FR-SYS-034) --------------------------------

/** Working time of the branch on a date: the branch override, else the tenant default; none = wall-clock time. */
async function workScheduleOf(
  deps: SysDeps,
  tenantId: string,
  branchId: string,
  date: string,
): Promise<WorkSchedule | null> {
  const snap = await resolveConfigAt(deps, {
    tenantId,
    type: 'work-hours',
    scopeKey: 'tenant',
    date,
    branchId,
  });
  return snap ? (snap.payload as unknown as WorkSchedule) : null;
}

export interface EscalationRunResult {
  skipped?: 'tenant_read_only';
  scanned: number;
  reminded: number;
  escalated: number;
}

/**
 * Background job for ONE tenant (the caller's), safe to run any number of times: a reminder or an escalation is
 * decided from the request document INSIDE its own transaction (`remindedAt`, `escalatedAt` and `status` are re-read),
 * so a repeat or a concurrent run changes nothing (idempotent per tenant, request and level). A tenant that is read
 * only (suspended, terminating) is skipped. An escalated request stays `pending` at level 2. No scheduler yet: Cloud
 * Scheduler or the approval screen calls the route. Needs the level-2 right (owner).
 */
export async function runApprovalEscalation(
  deps: SysDeps,
  actor: Actor,
  ctx: RequestCtx,
): Promise<EscalationRunResult> {
  if (!hasPermission(actor, 'approval-l2:approve')) throw forbidden();
  const out: EscalationRunResult = { scanned: 0, reminded: 0, escalated: 0 };
  const tenant = await deps.tenants.get(actor.tenantId);
  if (!tenant || !TENANT_ACCESS[tenant.status].write)
    return { ...out, skipped: 'tenant_read_only' };
  const scope = resolveScope(actor, 'approval:view');
  const date = businessDate(deps.clock.now());
  const limitsCache = new Map<ApprovalKind, ApprovalLimits>();
  for (const branch of await deps.branches.list(scope)) {
    const schedule = await workScheduleOf(deps, actor.tenantId, branch.id, date);
    const pending = await deps.approvals.listByBranchStatus(scope, branch.id, 'pending', LIST_MAX);
    for (const r of pending) {
      out.scanned++;
      let limits = limitsCache.get(r.kind);
      if (!limits) {
        limits = await approvalLimitsOf(deps, actor.tenantId, r.kind, date);
        limitsCache.set(r.kind, limits);
      }
      const lim = limits;
      const decide = (x: ApprovalRequest) =>
        escalationAction(x, lim, workingMinutesBetween(x.requestedAt, deps.clock.now(), schedule));
      if (decide(r) === 'none') continue;
      const action = await deps.uow.run(async (tx) => {
        const cur = await deps.approvals.getInTx(tx, scope, r.id);
        if (!cur) return 'none' as const;
        const act = decide(cur);
        if (act === 'none') return act;
        const now = deps.clock.now();
        const toLevel: ApprovalLevel = act === 'escalate' ? 2 : cur.level;
        const approvers = (
          await approversOf(deps, actor.tenantId, cur.branchId, toLevel, cur.kind)
        ).filter((u) => u !== cur.requestedBy);
        deps.approvals.update(tx, cur.id, {
          remindedAt: cur.remindedAt ?? now,
          ...(act === 'escalate'
            ? { level: 2, escalatedAt: now, escalatedFrom: cur.level, escalationReason: 'overdue' }
            : {}),
          updatedAt: now,
          updatedBy: actor.userId,
          version: cur.version + 1,
        });
        deps.audit.record(
          tx,
          auditEntry(deps, actor, ctx, {
            branchId: cur.branchId,
            entityType: 'approval',
            entityId: cur.id,
            action: act === 'escalate' ? 'approval.escalate' : 'approval.remind',
            before: { status: 'pending', level: cur.level },
            after: { status: 'pending', level: toLevel },
            reason: act === 'escalate' ? 'overdue' : 'reminder',
          }),
        );
        notifyUsers(deps, tx, {
          tenantId: actor.tenantId,
          userIds: approvers,
          kind: 'approval',
          titleKey:
            act === 'escalate'
              ? 'notifications.approvalEscalated'
              : 'notifications.approvalReminder',
          params: { number: cur.number, kind: cur.kind },
          link: '/approvals',
          branchId: cur.branchId,
        });
        return act;
      });
      if (action === 'remind') out.reminded++;
      if (action === 'escalate') out.escalated++;
    }
  }
  return out;
}

// ---- bulk decision (FR-SYS-034) ----------------------------------------------------------------------

const BULK_MAX = 50;
export const bulkDecideSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(300).optional(),
  items: z
    .array(z.object({ id: z.string().min(1).max(80), version: z.number().int().min(1) }))
    .min(1)
    .max(BULK_MAX),
});

export interface BulkDecideResult {
  results: { id: string; ok: boolean; code?: string }[];
}

/**
 * Decides several requests of the SAME kind, only for kinds whose limit config has `bulkAllowed` and that do not
 * ask for the password again. The whole call is refused (422) for a mix of kinds or a kind that does not allow it;
 * otherwise each request is decided on its own (own transaction, own checks: right, branch, not one's own, version),
 * and the answer lists the outcome of each. A repeated call with the same Idempotency-Key replays each item.
 */
export async function bulkDecideApprovals(
  deps: SysDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<BulkDecideResult> {
  const data = parseInput(bulkDecideSchema, input);
  if (data.decision === 'reject' && (data.note ?? '').length < 5)
    throw validationFailed([{ field: 'note', message: 'Ghi lý do từ chối (tối thiểu 5 ký tự).' }]);
  const ids = [...new Set(data.items.map((i) => i.id))];
  if (ids.length !== data.items.length)
    throw validationFailed([{ field: 'items', message: 'bulk_duplicate_items' }]);
  const scope = resolveScope(actor, 'approval:view');
  const rows = await Promise.all(ids.map((id) => deps.approvals.get(scope, id)));
  if (rows.some((r) => !r)) throw notFound();
  const kinds = new Set(rows.map((r) => r!.kind));
  if (kinds.size !== 1) throw new AppError('bulk_mixed_kinds', 422);
  const kind = [...kinds][0]!;
  const limits = await approvalLimitsOf(deps, actor.tenantId, kind, businessDate(deps.clock.now()));
  if (!limits.bulkAllowed || reauthRequired(kind, limits))
    throw new AppError('bulk_not_allowed', 422);
  const results: BulkDecideResult['results'] = [];
  for (const it of data.items) {
    try {
      await decideApproval(
        deps,
        actor,
        it.id,
        { version: it.version, decision: data.decision, ...(data.note ? { note: data.note } : {}) },
        { requestId: ctx.requestId, idempotencyKey: `${ctx.idempotencyKey}:${it.id}` },
      );
      results.push({ id: it.id, ok: true });
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      results.push({ id: it.id, ok: false, code: e.code });
    }
  }
  return { results };
}

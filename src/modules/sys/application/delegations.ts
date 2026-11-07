import { z } from 'zod';
import { AppError, forbidden, notFound, validationFailed } from '@/platform/errors/errors';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows } from '@/platform/scope/scope';
import {
  APPROVAL_KINDS,
  approverPermissionFor,
  checkNewDelegation,
  delegationCovers,
  delegationInForce,
  type ApprovalDelegation,
  type ApprovalRequest,
} from '../domain/approval';
import type { SysDeps } from '../ports/deps';
import { auditEntry, parseInput, type RequestCtx } from './support';

/**
 * Approval delegation (FR-SYS-033, RULE-036). Off by default: a delegation exists only when the owner creates one
 * (`approval-delegation:update`), with a period, kinds and branches. It lends the DELEGATOR's approval right, so it
 * is checked again whenever the delegate decides: the delegator must still be active and hold the right at the
 * request's branch, and the delegate must be able to view the branch's data themselves (no data beyond their own
 * view right). A delegate never decides their own request, nor one the delegator raised.
 */
const LIST_MAX = 200;

/** Field messages of a refused delegation (Vietnamese, shown by the form). */
const MSG: Record<string, string> = {
  delegation_self: 'Người nhận ủy quyền phải khác người ủy quyền.',
  delegation_kinds_required: 'Chọn ít nhất một loại yêu cầu.',
  delegation_branches_required: 'Chọn ít nhất một chi nhánh.',
  delegation_period_invalid: 'Thời hạn phải kết thúc sau thời điểm bắt đầu và sau hiện tại.',
  branch_not_found: 'Chi nhánh không tồn tại hoặc ngoài phạm vi của bạn.',
  delegator_lacks_right: 'Người ủy quyền không có quyền duyệt loại yêu cầu này tại chi nhánh.',
  delegate_cannot_view:
    'Người nhận không có quyền xem dữ liệu của chi nhánh này nên không nhận ủy quyền được.',
};

const idem = (deps: SysDeps) => ({
  uow: deps.uow,
  store: deps.idempotency,
  now: () => deps.clock.now(),
  ttlMs: deps.config.idempotencyTtlMs,
});

/** Does the user hold `permission` at the branch (any of their active role assignments in the tenant)? */
export async function userHoldsAt(
  deps: SysDeps,
  tenantId: string,
  userId: string,
  permission: string,
  branchId: string,
): Promise<boolean> {
  const user = await deps.users.getById(tenantId, userId);
  if (!user || user.tenantId !== tenantId || user.status !== 'active') return false;
  const rows = (await deps.assignments.listForUser(userId)).filter(
    (a) => a.tenantId === tenantId && (a.branchId === '*' || a.branchId === branchId),
  );
  if (rows.length === 0) return false;
  const roles = await deps.roles.getMany(tenantId, [...new Set(rows.map((a) => a.roleCode))]);
  return roles.some((r) => (r.permissions as readonly string[]).includes(permission));
}

/** Delegations in force that name the actor as delegate (tenant-bound read, filtered in memory). */
export async function delegationsOfDelegate(
  deps: SysDeps,
  actor: Actor,
): Promise<ApprovalDelegation[]> {
  const now = deps.clock.now();
  return (await deps.delegations.listByTenant(actor.tenantId, LIST_MAX)).filter(
    (d) => d.delegateId === actor.userId && delegationInForce(d, now),
  );
}

/**
 * The delegation that lets the actor decide `r`, or null. Checks, in order: the delegation covers the kind and
 * branch and is in force; the actor can view the branch themselves (RULE-036); the delegator still holds the right of
 * the request's CURRENT level at the branch (an escalated request needs a delegator of the higher level).
 */
export async function findDelegationFor(
  deps: SysDeps,
  actor: Actor,
  r: ApprovalRequest,
  mine: readonly ApprovalDelegation[],
  cache: Map<string, boolean> = new Map(),
): Promise<ApprovalDelegation | null> {
  if (mine.length === 0 || !hasPermission(actor, 'approval:view')) return null;
  const view = resolveScope(actor, 'approval:view');
  if (!scopeAllows(view, actor.tenantId, r.branchId)) return null;
  const now = deps.clock.now();
  const perm = approverPermissionFor(r.kind, r.level);
  for (const d of mine) {
    if (!delegationCovers(d, r, now)) continue;
    const k = `${d.delegatorId}|${perm}|${r.branchId}`;
    let holds = cache.get(k);
    if (holds === undefined) {
      holds = await userHoldsAt(deps, actor.tenantId, d.delegatorId, perm, r.branchId);
      cache.set(k, holds);
    }
    if (holds) return d;
  }
  return null;
}

export const createDelegationSchema = z
  .object({
    delegatorId: z.string().trim().min(1).max(80),
    delegateId: z.string().trim().min(1).max(80),
    kinds: z.array(z.enum(APPROVAL_KINDS)).min(1).max(APPROVAL_KINDS.length),
    branchIds: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    reason: z.string().trim().min(5).max(300),
  })
  .strict();

export interface DelegationDto {
  id: string;
  delegatorId: string;
  delegateId: string;
  kinds: string[];
  branchIds: string[];
  validFrom: string;
  validUntil: string;
  status: 'active' | 'revoked' | 'expired' | 'scheduled';
  reason: string;
  version: number;
}

function toDto(deps: SysDeps, d: ApprovalDelegation): DelegationDto {
  const now = deps.clock.now();
  const status =
    d.status === 'revoked'
      ? 'revoked'
      : now.getTime() >= d.validUntil.getTime()
        ? 'expired'
        : now.getTime() < d.validFrom.getTime()
          ? 'scheduled'
          : 'active';
  return {
    id: d.id,
    delegatorId: d.delegatorId,
    delegateId: d.delegateId,
    kinds: d.kinds,
    branchIds: d.branchIds,
    validFrom: d.validFrom.toISOString(),
    validUntil: d.validUntil.toISOString(),
    status,
    reason: d.reason,
    version: d.version,
  };
}

/** FR-SYS-033: only the owner (`approval-delegation:update`) creates one; audited in the same transaction. */
export async function createDelegation(
  deps: SysDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const data = parseInput(createDelegationSchema, input);
  const scope = resolveScope(actor, 'approval-delegation:update');
  const now = deps.clock.now();
  const chk = checkNewDelegation(data, now);
  if (!chk.ok)
    throw validationFailed([
      { field: chk.field ?? 'delegateId', message: MSG[chk.code] ?? chk.code },
    ]);
  const branchIds = [...new Set(data.branchIds)];
  const kinds = [...new Set(data.kinds)];
  for (const b of branchIds)
    if (!scopeAllows(scope, actor.tenantId, b) || !(await deps.branches.get(scope, b)))
      throw validationFailed([{ field: 'branchIds', message: MSG.branch_not_found! }]);
  // the delegator lends a right they hold at every branch and kind; the delegate must see the branch's data (RULE-036)
  for (const b of branchIds) {
    for (const k of kinds) {
      const holds =
        (await userHoldsAt(
          deps,
          actor.tenantId,
          data.delegatorId,
          approverPermissionFor(k, 1),
          b,
        )) ||
        (await userHoldsAt(deps, actor.tenantId, data.delegatorId, approverPermissionFor(k, 2), b));
      if (!holds)
        throw validationFailed([{ field: 'delegatorId', message: MSG.delegator_lacks_right! }]);
    }
    if (!(await userHoldsAt(deps, actor.tenantId, data.delegateId, 'approval:view', b)))
      throw validationFailed([{ field: 'delegateId', message: MSG.delegate_cannot_view! }]);
  }
  return runIdempotent(
    idem(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/sys/approvals/delegations',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const id = `dlg_${deps.newId()}`;
      const d: ApprovalDelegation = {
        id,
        tenantId: actor.tenantId,
        delegatorId: data.delegatorId,
        delegateId: data.delegateId,
        kinds,
        branchIds,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        status: 'active',
        reason: data.reason,
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.delegations.create(tx, d);
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: null,
          entityType: 'approval-delegation',
          entityId: id,
          action: 'approval.delegation.create',
          after: {
            delegatorId: d.delegatorId,
            delegateId: d.delegateId,
            kinds,
            branchIds,
            validFrom: d.validFrom.toISOString(),
            validUntil: d.validUntil.toISOString(),
          },
          reason: d.reason,
        }),
      );
      return { status: 201, body: toDto(deps, d) };
    },
  );
}

export const revokeDelegationSchema = z.object({ version: z.number().int().min(1) }).strict();

/** The right is lost at once (the next decision reads the status again inside its transaction). */
export async function revokeDelegation(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const data = parseInput(revokeDelegationSchema, input);
  resolveScope(actor, 'approval-delegation:update');
  return runIdempotent(
    idem(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/sys/approvals/delegations/${id}/revoke`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const d = await deps.delegations.getInTx(tx, actor.tenantId, id);
      if (!d) throw notFound();
      if (d.version !== data.version) throw new AppError('version_conflict', 409);
      if (d.status !== 'active') throw new AppError('delegation_not_active', 409);
      const now = deps.clock.now();
      deps.delegations.update(tx, id, {
        status: 'revoked',
        revokedAt: now,
        revokedBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: d.version + 1,
      });
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: null,
          entityType: 'approval-delegation',
          entityId: id,
          action: 'approval.delegation.revoke',
          before: { status: 'active' },
          after: { status: 'revoked' },
        }),
      );
      return { status: 200, body: { id, status: 'revoked' } };
    },
  );
}

/** The owner reads the tenant's delegations; a delegate or delegator reads only their own. */
export async function listDelegations(deps: SysDeps, actor: Actor): Promise<DelegationDto[]> {
  const seeAll = hasPermission(actor, 'approval-delegation:view');
  if (!seeAll && !hasPermission(actor, 'approval:view')) throw forbidden();
  const all = await deps.delegations.listByTenant(actor.tenantId, LIST_MAX);
  return all
    .filter((d) => seeAll || d.delegateId === actor.userId || d.delegatorId === actor.userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((d) => toDto(deps, d));
}

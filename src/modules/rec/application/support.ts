import { z } from 'zod';
import { AppError, forbidden, notFound, validationFailed } from '@/platform/errors/errors';
import { type StoredResponse } from '@/platform/idempotency/idempotency';
import { requireWorkingBranch, type Actor, type Permission } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  assertBranchWritable,
  auditEntry,
  parseInput,
  roleCodesOf,
  type Branch,
  type RequestCtx,
  type WriteKind,
} from '@/modules/sys';
import type { RecDeps } from '../ports/deps';

export {
  auditEntry,
  parseInput,
  roleCodesOf,
  notFound,
  forbidden,
  AppError,
  validationFailed,
  requireWorkingBranch,
  z,
};
export type { RequestCtx, StoredResponse };

export const idemOf = (deps: RecDeps) => ({
  uow: deps.sys.uow,
  store: deps.sys.idempotency,
  now: () => deps.sys.clock.now(),
  ttlMs: deps.sys.config.idempotencyTtlMs,
});

export const versionConflict = (): AppError => new AppError('version_conflict', 409);

/** The record's branch must be writable in its state (FR-SYS-011): `new_order` for new intakes and quotes, `edit_open_order` after. */
export async function assertWritable(
  deps: RecDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  branchId: string,
  kind: WriteKind,
): Promise<Branch> {
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw forbidden();
  const branch = await deps.sys.branches.getInTx(tx, scope, branchId);
  if (!branch) throw notFound();
  assertBranchWritable(branch.status, kind, roleCodesOf(actor), deps.sys.config.branchStateRules);
  return branch;
}

/** Adds `days` calendar days to an ISO business date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** R29: the role (among those granting `permission` at the branch) the actor acts in; managers before advisors. */
export function roleAtBranch(actor: Actor, permission: Permission, branchId: string): string {
  const roles = actor.assignments
    .filter(
      (a) =>
        (a.branchId === branchId || a.branchId === '*') &&
        actor.rolePermissions[a.roleCode]?.includes(permission),
    )
    .map((a) => a.roleCode);
  return ['QL', 'CH', 'CV'].find((r) => roles.includes(r)) ?? roles[0] ?? 'unknown';
}

import { z } from 'zod';
import { AppError, forbidden, notFound, validationFailed } from '@/platform/errors/errors';
import { requireWorkingBranch, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { PiiAccessEntry } from '@/platform/pii/pii';
import {
  assertBranchWritable,
  auditEntry,
  parseInput,
  roleCodesOf,
  type Branch,
  type RequestCtx,
} from '@/modules/sys';
import type { EinDeps } from '../ports/deps';

export { AppError, auditEntry, forbidden, notFound, parseInput, roleCodesOf, validationFailed, z };
export type { RequestCtx };

export const idemOf = (deps: EinDeps) => ({
  uow: deps.sys.uow,
  store: deps.sys.idempotency,
  now: () => deps.sys.clock.now(),
  ttlMs: deps.sys.config.idempotencyTtlMs,
});

export const versionConflict = (): AppError => new AppError('version_conflict', 409);

/** Invoices are issued and queued in the session's working branch, which the scope must cover (NFR-ISO-01). */
export function einBranch(actor: Actor, scope: Scope): string {
  const branchId = requireWorkingBranch(actor);
  if (!scopeAllows(scope, actor.companyId, branchId)) throw forbidden();
  return branchId;
}

/** Issuing for an open order is `edit_open_order`: allowed while the branch is closing, refused when locked (FR-SYS-011). */
export async function assertWritable(
  deps: EinDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  branchId: string,
): Promise<Branch> {
  if (!scopeAllows(scope, actor.companyId, branchId)) throw forbidden();
  const branch = await deps.sys.branches.getInTx(tx, scope, branchId);
  if (!branch) throw notFound();
  assertBranchWritable(
    branch.status,
    'edit_open_order',
    roleCodesOf(actor),
    deps.sys.config.branchStateRules,
  );
  return branch;
}

export function accessEntry(
  deps: EinDeps,
  actor: Actor,
  requestId: string,
  e: Pick<PiiAccessEntry, 'entityType' | 'entityId' | 'purpose' | 'fields'> &
    Partial<PiiAccessEntry>,
): PiiAccessEntry {
  return {
    id: deps.sys.newId(),
    at: deps.sys.clock.now(),
    requestId,
    actorId: actor.userId,
    actorRoles: roleCodesOf(actor),
    companyId: actor.companyId,
    branchId: null,
    result: 'allowed',
    ...e,
  };
}

import { z } from 'zod';
import { AppError, forbidden, notFound } from '@/platform/errors/errors';
import { type StoredResponse } from '@/platform/idempotency/idempotency';
import type { PiiAccessEntry, PiiField } from '@/platform/pii/pii';
import { requireWorkingBranch, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { assertBranchWritable, auditEntry, parseInput, roleCodesOf } from '@/modules/sys';
import type { RequestCtx } from '@/modules/sys';
import type { CrmDeps } from '../ports/deps';

export { auditEntry, parseInput, roleCodesOf, notFound, forbidden, AppError, z };
export type { RequestCtx, StoredResponse };

export const idemOf = (deps: CrmDeps) => ({
  uow: deps.sys.uow,
  store: deps.sys.idempotency,
  now: () => deps.sys.clock.now(),
  ttlMs: deps.sys.config.idempotencyTtlMs,
});

/**
 * Creating a business record needs exactly one working branch the actor may write to (state-copy §3);
 * the branch state table (FR-SYS-011) is consulted inside the transaction.
 */
export async function writableWorkingBranch(
  deps: CrmDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  kind: 'new_master' | 'edit_master' = 'new_master',
) {
  const branchId = requireWorkingBranch(actor);
  if (!scopeAllows(scope, actor.companyId, branchId)) throw forbidden();
  const branch = await deps.sys.branches.getInTx(tx, scope, branchId);
  if (!branch) throw notFound();
  assertBranchWritable(branch.status, kind, roleCodesOf(actor), deps.sys.config.branchStateRules);
  return branch;
}

/** Access-log entry for personal data (never contains the value). */
export function accessEntry(
  deps: CrmDeps,
  actor: Actor,
  sessionId: string | undefined,
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
    ...(sessionId ? { sessionId } : {}),
    ...e,
  };
}

export const PII_FIELDS: readonly PiiField[] = ['phone', 'email', 'address'];

export function versionConflict(): AppError {
  return new AppError('version_conflict', 409);
}

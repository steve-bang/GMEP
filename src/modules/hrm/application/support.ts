import { z } from 'zod';
import { AppError, forbidden, notFound, validationFailed } from '@/platform/errors/errors';
import { requireWorkingBranch, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  assertBranchWritable,
  auditEntry,
  parseInput,
  resolveConfigAt,
  roleCodesOf,
  type Branch,
  type RequestCtx,
  type WriteKind,
} from '@/modules/sys';
import {
  DEFAULT_LABOR_POLICY,
  NEUTRAL_COEFFICIENT_BP,
  methodScopeKeys,
  positionScopeKey,
  type LaborMethod,
  type LaborPolicy,
  type RuleRef,
} from '../domain/labor';
import type { HrmDeps } from '../ports/deps';

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
export type { RequestCtx };

export const idemOf = (deps: HrmDeps) => ({
  uow: deps.sys.uow,
  store: deps.sys.idempotency,
  now: () => deps.sys.clock.now(),
  ttlMs: deps.sys.config.idempotencyTtlMs,
});

export const versionConflict = (): AppError => new AppError('version_conflict', 409);

/** The branch the HR screens write in: the session's working branch, which the scope must cover (NFR-ISO-01). */
export function hrBranch(actor: Actor, scope: Scope): string {
  const branchId = requireWorkingBranch(actor);
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw forbidden();
  return branchId;
}

/** Writes in a branch follow its state (FR-SYS-011). */
export async function assertWritable(
  deps: HrmDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  branchId: string,
  kind: WriteKind = 'edit_open_order',
): Promise<Branch> {
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw forbidden();
  const branch = await deps.sys.branches.getInTx(tx, scope, branchId);
  if (!branch) throw notFound();
  assertBranchWritable(branch.status, kind, roleCodesOf(actor), deps.sys.config.branchStateRules);
  return branch;
}

/** Effective-dated labor policy of the branch (branch override, then the tenant, then the neutral fallback). */
export async function laborPolicyAt(
  deps: HrmDeps,
  tenantId: string,
  branchId: string,
  date: string,
): Promise<{ policy: LaborPolicy; versionId: string | null }> {
  const snap = await resolveConfigAt(deps.sys, {
    tenantId,
    type: 'labor-policy',
    scopeKey: 'tenant',
    date,
    branchId,
  });
  return snap
    ? {
        policy: { ...DEFAULT_LABOR_POLICY, ...(snap.payload as Partial<LaborPolicy>) },
        versionId: snap.versionId,
      }
    : { policy: DEFAULT_LABOR_POLICY, versionId: null };
}

/**
 * The method in force for (branch, service type, position) on `date`, by the FR-HRM-020 priority: branch with service
 * and position, branch with service, tenant with service and position, tenant with service. No rule = null (the line
 * is then recorded with a `no_rule` warning and zero labor, never guessed).
 */
export async function laborMethodAt(
  deps: HrmDeps,
  q: {
    tenantId: string;
    branchId: string;
    serviceType: string;
    positionCode: string | null;
    date: string;
  },
): Promise<RuleRef | null> {
  for (const scopeKey of methodScopeKeys(q.branchId, q.serviceType, q.positionCode)) {
    const snap = await resolveConfigAt(deps.sys, {
      tenantId: q.tenantId,
      type: 'labor-method',
      scopeKey,
      date: q.date,
    });
    if (snap)
      return {
        versionId: snap.versionId,
        scopeKey,
        effectiveFrom: snap.effectiveFrom,
        payload: snap.payload as unknown as LaborMethod,
      };
  }
  return null;
}

/** Coefficient of a position on `date` (neutral 1.0 when the position has no row). */
export async function positionFactorAt(
  deps: HrmDeps,
  tenantId: string,
  positionCode: string | null,
  date: string,
): Promise<{ coefficientBp: number; versionId: string | null }> {
  if (!positionCode) return { coefficientBp: NEUTRAL_COEFFICIENT_BP, versionId: null };
  const snap = await resolveConfigAt(deps.sys, {
    tenantId,
    type: 'labor-position',
    scopeKey: positionScopeKey(positionCode),
    date,
  });
  return snap
    ? {
        coefficientBp: (snap.payload as { coefficientBp: number }).coefficientBp,
        versionId: snap.versionId,
      }
    : { coefficientBp: NEUTRAL_COEFFICIENT_BP, versionId: null };
}

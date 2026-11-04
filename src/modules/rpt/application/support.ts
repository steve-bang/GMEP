import { z } from 'zod';
import { AppError, forbidden, validationFailed } from '@/platform/errors/errors';
import { fingerprintOf } from '@/platform/idempotency/idempotency';
import { businessDate } from '@/platform/format/date';
import { resolveWorkingScope, type Actor, type Permission } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import { auditEntry, csvCell, parseInput, resolveConfigAt, type RequestCtx } from '@/modules/sys';
import { DATE_RE, DEFAULT_RPT_POLICY, type RptPolicy } from '../domain/rollup';
import type { RptDeps } from '../ports/deps';

export { AppError, auditEntry, csvCell, forbidden, parseInput, validationFailed, z, fingerprintOf };
export type { RequestCtx };

export const dateSchema = z
  .string()
  .regex(DATE_RE)
  .refine((d) => !Number.isNaN(Date.parse(d)));

/** Effective-dated policy (NFR-MNT-01); a missing version falls back to the documented defaults. */
export async function rptPolicyOf(
  deps: RptDeps,
  companyId: string,
  branchId: string,
  date: string,
): Promise<RptPolicy> {
  const snap = await resolveConfigAt(deps.sys, {
    companyId,
    type: 'report-policy',
    scopeKey: 'company',
    date,
    branchId,
  });
  return snap
    ? { ...DEFAULT_RPT_POLICY, ...(snap.payload as Partial<RptPolicy>) }
    : DEFAULT_RPT_POLICY;
}

export const todayOf = (deps: RptDeps): string => businessDate(deps.sys.clock.now());

/**
 * The branches a read covers: the working branch when one is chosen, otherwise the permitted scope (consolidating
 * roles see every branch of their scope, each from its own rollup document read by key). NFR-ISO-01.
 */
export async function branchesOf(
  deps: RptDeps,
  actor: Actor,
  permission: Permission,
  requested?: string,
): Promise<{ scope: Scope; branches: { id: string; name: string; code: string }[] }> {
  const scope = resolveWorkingScope(actor, permission);
  const all = await deps.sys.branches.list(scope);
  const branches = all
    .filter((b) => !requested || b.id === requested)
    .map((b) => ({ id: b.id, name: b.name, code: b.code }));
  if (requested && branches.length === 0) throw forbidden();
  return { scope, branches };
}

export function assertBranchInScope(scope: Scope, actor: Actor, branchId: string): void {
  if (!scopeAllows(scope, actor.companyId, branchId)) throw forbidden();
}

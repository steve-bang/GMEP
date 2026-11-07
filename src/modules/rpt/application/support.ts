import { z } from 'zod';
import { AppError, forbidden, validationFailed } from '@/platform/errors/errors';
import { fingerprintOf } from '@/platform/idempotency/idempotency';
import { businessDate } from '@/platform/format/date';
import {
  resolveScope,
  resolveWorkingScope,
  type Actor,
  type Permission,
} from '@/platform/rbac/rbac';
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
  tenantId: string,
  branchId: string,
  date: string,
): Promise<RptPolicy> {
  const snap = await resolveConfigAt(deps.sys, {
    tenantId,
    type: 'report-policy',
    scopeKey: 'tenant',
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
  groupId?: string,
): Promise<{ scope: Scope; branches: BranchRef[] }> {
  const scope = resolveWorkingScope(actor, permission);
  return narrowToBranches(deps, actor, scope, requested, groupId);
}

export interface BranchRef {
  id: string;
  name: string;
  code: string;
  /** first and last business day the branch operates: opened = created, locked = last update (AC-RPT-002-10) */
  activeFrom: string;
  activeTo?: string;
}

/** A group is a FILTER over the branches already in scope (never a grant). */
async function narrowToBranches(
  deps: RptDeps,
  actor: Actor,
  scope: Scope,
  requested?: string,
  groupId?: string,
): Promise<{ scope: Scope; branches: BranchRef[] }> {
  const all = await deps.sys.branches.list(scope);
  const members = groupId
    ? new Set((await groupOf(deps, actor.tenantId, groupId)).branchIds)
    : null;
  const branches = all
    .filter((b) => !requested || b.id === requested)
    .filter((b) => !members || members.has(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      activeFrom: businessDate(b.createdAt),
      ...(b.status === 'locked' ? { activeTo: businessDate(b.updatedAt) } : {}),
    }));
  if ((requested || groupId) && branches.length === 0) throw forbidden();
  return { scope, branches };
}

/**
 * Consolidated reads (ranking, customers, indicators) cover the whole permission scope: the working branch does not
 * narrow a comparison between branches (a "ranking" of one branch would be meaningless). NFR-ISO-01 still holds because
 * the scope comes from the actor's assignments for THIS permission.
 */
export async function consolidatedBranches(
  deps: RptDeps,
  actor: Actor,
  permission: Permission,
  groupId?: string,
): Promise<{ scope: Scope; branches: BranchRef[] }> {
  return narrowToBranches(deps, actor, resolveScope(actor, permission), undefined, groupId);
}

export interface BranchGroup {
  code: string;
  name: string;
  branchIds: string[];
}

/** Q84 [Cần xác nhận]: groups come from the effective-dated `branch-groups` config; none configured = no regions. */
export async function branchGroupsOf(
  deps: RptDeps,
  tenantId: string,
  date: string = todayOf(deps),
): Promise<BranchGroup[]> {
  const snap = await resolveConfigAt(deps.sys, {
    tenantId,
    type: 'branch-groups',
    scopeKey: 'tenant',
    date,
  });
  return ((snap?.payload as { groups?: BranchGroup[] } | undefined)?.groups ?? []).map((g) => ({
    code: g.code,
    name: g.name,
    branchIds: [...g.branchIds],
  }));
}

async function groupOf(deps: RptDeps, tenantId: string, code: string): Promise<BranchGroup> {
  const g = (await branchGroupsOf(deps, tenantId)).find((x) => x.code === code);
  if (!g) throw new AppError('unknown_group', 422);
  return g;
}

/** One branch per report: the requested one, else the working branch, else the only branch in scope; otherwise 409. */
export function singleBranch(
  actor: Actor,
  branches: { id: string; name: string; code: string }[],
  requested?: string,
): { id: string; name: string; code: string } {
  const b = requested
    ? branches[0]
    : actor.workingBranchId
      ? branches.find((x) => x.id === actor.workingBranchId)
      : branches.length === 1
        ? branches[0]
        : undefined;
  if (!b) throw new AppError('scope_required', 409);
  return b;
}

export function assertBranchInScope(scope: Scope, actor: Actor, branchId: string): void {
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw forbidden();
}

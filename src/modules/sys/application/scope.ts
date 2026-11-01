import { z } from 'zod';
import { AppError, forbidden } from '@/platform/errors/errors';
import { allBranchesScope } from '@/platform/scope/scope';
import type { Actor } from '@/platform/rbac/rbac';
import type { BranchStatus } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { invalidateUser } from './auth';
import { parseInput } from './support';

export interface ScopeOption {
  branchId: string;
  name: string;
  status: BranchStatus;
  roles: string[];
}

export interface ScopeInfo {
  /** UI shape (design G5-SCP-01/02): `static` = single branch, no picker; `picker` = dropdown */
  mode: 'static' | 'picker' | 'none';
  /** current choice: a branch id, 'all' (consolidated) or null (not chosen yet) */
  current: string | 'all' | null;
  canConsolidate: boolean;
  /** true when the user must pick a branch before branch-bound pages work (non CH/QV, several branches) */
  mustChoose: boolean;
  options: ScopeOption[];
}

/**
 * Scope picker data (BA §4, G5-SCP-01/02, FR-SYS-032 proposal). The working branch lives in the
 * server-side session; this only describes what the user may choose. ASSUMPTIONS taken from the
 * designer: one branch -> static chip, no picker; several branches -> dropdown "Một chi nhánh"
 * plus "Hợp nhất" only for roles that may consolidate.
 */
export async function getScopeInfo(deps: SysDeps, actor: Actor): Promise<ScopeInfo> {
  const rolesByBranch = new Map<string, Set<string>>();
  let allRoles: Set<string> | null = null;
  for (const a of actor.assignments) {
    if (a.branchId === '*') (allRoles ??= new Set()).add(a.roleCode);
    else
      (
        rolesByBranch.get(a.branchId) ?? rolesByBranch.set(a.branchId, new Set()).get(a.branchId)!
      ).add(a.roleCode);
  }
  if (actor.assignments.length === 0)
    return { mode: 'none', current: null, canConsolidate: false, mustChoose: false, options: [] };

  const branches = await deps.branches.list(allBranchesScope(actor.companyId));
  const options: ScopeOption[] = branches
    .filter((b) => allRoles || rolesByBranch.has(b.id))
    .map((b) => ({
      branchId: b.id,
      name: b.name,
      status: b.status,
      roles: [...new Set([...(allRoles ?? []), ...(rolesByBranch.get(b.id) ?? [])])],
    }));
  const single = options.length === 1 && !actor.canConsolidate;
  return {
    mode: single ? 'static' : 'picker',
    current: actor.workingBranchId ?? (actor.canConsolidate ? 'all' : null),
    canConsolidate: actor.canConsolidate,
    mustChoose: !single && !actor.canConsolidate && !actor.workingBranchId,
    options,
  };
}

export const setScopeSchema = z.object({
  /** a branch id, or 'all' for the consolidated view (CH, QV only) */
  branchId: z.string().trim().min(1).max(64),
});

/**
 * Changes the working branch of THIS session. The server verifies the choice against the actor's
 * assignments; the value is never trusted from the browser (NFR-ISO-01). Unsaved drafts are the
 * client's job (UnsavedDraftDialog) and are not lost server-side.
 */
export async function setWorkingScope(
  deps: SysDeps,
  actor: Actor,
  sessionId: string,
  input: unknown,
): Promise<ScopeInfo> {
  const { branchId } = parseInput(setScopeSchema, input);
  const info = await getScopeInfo(deps, actor);
  if (branchId === 'all') {
    if (!actor.canConsolidate) throw new AppError('scope_merged_not_allowed', 403);
    await deps.sessions.setWorkingBranch(sessionId, null);
  } else {
    if (!info.options.some((o) => o.branchId === branchId)) throw forbidden();
    await deps.sessions.setWorkingBranch(sessionId, branchId);
    await deps.users.setLastWorkingBranch(actor.userId, branchId);
  }
  invalidateUser(deps, actor.userId);
  return getScopeInfo(deps, {
    ...actor,
    workingBranchId: branchId === 'all' ? null : branchId,
  });
}

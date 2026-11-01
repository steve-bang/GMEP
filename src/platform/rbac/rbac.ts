import { AppError, forbidden } from '../errors/errors';
import {
  ALL_BRANCHES,
  allBranchesScope,
  branchesScope,
  narrowScope,
  type Scope,
} from '../scope/scope';

/**
 * Permissions are `resource:action` (FR-SYS-013): view, create, update, archive, approve,
 * reject, export, manage. Roles and their permission sets are DATA (roles collection),
 * roleAssignments are user x role x branch (FR-SYS-012).
 */
export const ACTIONS = [
  'view',
  'create',
  'update',
  'archive',
  'approve',
  'reject',
  'export',
  'manage',
] as const;
export type Action = (typeof ACTIONS)[number];
export type Permission = `${string}:${Action}`;

export interface RoleAssignment {
  roleCode: string;
  /** A branch id, or ALL_BRANCHES ('*') for company-wide. */
  branchId: string;
}

export interface Actor {
  userId: string;
  companyId: string;
  displayName: string;
  assignments: readonly RoleAssignment[];
  /** roleCode -> permissions, loaded from the roles collection. */
  rolePermissions: Readonly<Record<string, readonly Permission[]>>;
  /** True when one of the actor's roles may view consolidated data (CH, QV by default; BA §4). */
  canConsolidate: boolean;
  /** Working branch from the scope picker (server-side, per session); null = consolidated or not chosen. */
  workingBranchId: string | null;
}

/**
 * Union (FR-SYS-012) of the branches where the actor holds a role granting `permission`.
 * Throws 403 when the actor has the permission nowhere.
 */
export function resolveScope(actor: Actor, permission: Permission): Scope {
  const branchIds = new Set<string>();
  let all = false;
  for (const a of actor.assignments) {
    if (!actor.rolePermissions[a.roleCode]?.includes(permission)) continue;
    if (a.branchId === ALL_BRANCHES) all = true;
    else branchIds.add(a.branchId);
  }
  if (all) return allBranchesScope(actor.companyId);
  return branchesScope(actor.companyId, [...branchIds]); // throws forbidden() when empty
}

/**
 * Permission scope narrowed by the working branch (BA §4, D-06):
 *  - a working branch is chosen  -> only that branch (403 when the permission is not held there);
 *  - none chosen, consolidating role (CH, QV) -> the whole permitted scope (view only);
 *  - none chosen, company-wide assignment ('*') or exactly one branch -> that scope;
 *  - none chosen, an explicit list of several branches -> 409 `scope_required` (pick one, no merged view).
 * The working branch is server-side session state; a value sent by the browser is never trusted.
 */
export function resolveWorkingScope(actor: Actor, permission: Permission): Scope {
  const base = resolveScope(actor, permission);
  if (actor.workingBranchId) {
    const narrowed = narrowScope(base, actor.workingBranchId);
    if (!narrowed) throw forbidden();
    return narrowed;
  }
  // an explicit company-wide assignment ('*', e.g. system admin, accountant) is consolidated by nature;
  // only an explicit list of several branches forces the choice [Cần xác nhận: BA §4 names only CH/QV]
  if (actor.canConsolidate || base.kind === 'all' || base.branchIds.length === 1) return base;
  throw new AppError('scope_required', 409);
}

/**
 * Creating business documents needs exactly one working branch (`SCOPE_MERGED`, state-copy §3);
 * the server checks the target branch against the session, never against a request field alone.
 */
export function requireWorkingBranch(actor: Actor): string {
  if (!actor.workingBranchId) throw new AppError('scope_merged', 409);
  return actor.workingBranchId;
}

/**
 * Union of every branch the actor is assigned to, whatever the permission (for the shell's
 * visible scope indicator only; data access always goes through resolveScope(actor, permission)).
 */
export function assignedScope(actor: Actor): Scope | null {
  if (actor.assignments.length === 0) return null;
  if (actor.assignments.some((a) => a.branchId === ALL_BRANCHES))
    return allBranchesScope(actor.companyId);
  return branchesScope(
    actor.companyId,
    actor.assignments.map((a) => a.branchId),
  );
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  try {
    resolveScope(actor, permission);
    return true;
  } catch {
    return false;
  }
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!hasPermission(actor, permission)) throw forbidden();
}

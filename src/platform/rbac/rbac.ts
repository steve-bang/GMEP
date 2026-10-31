import { forbidden } from '../errors/errors';
import { ALL_BRANCHES, allBranchesScope, branchesScope, type Scope } from '../scope/scope';

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

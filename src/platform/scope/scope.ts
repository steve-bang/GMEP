import { forbidden } from '../errors/errors';

/**
 * Data scope (NFR-ISO-01, ADR §6.3). Every repository function takes a Scope as a required
 * parameter, so a query cannot be written without deciding which branches it may see.
 * The brand makes accidental object literals a type error; Scopes are created only here
 * (production code reaches them through resolveScope).
 */
declare const scopeBrand: unique symbol;

export type Scope = Readonly<
  { companyId: string; [scopeBrand]: true } & (
    { kind: 'all' } | { kind: 'branches'; branchIds: readonly string[] }
  )
>;

/** Wildcard used by roleAssignments.branchId meaning "every branch of the company". */
export const ALL_BRANCHES = '*';

export function allBranchesScope(companyId: string): Scope {
  return Object.freeze({ companyId, kind: 'all' }) as Scope;
}

export function branchesScope(companyId: string, branchIds: readonly string[]): Scope {
  const unique = [...new Set(branchIds)].sort();
  if (unique.length === 0) throw forbidden(); // an empty scope is "no permission", never "see nothing silently"
  return Object.freeze({ companyId, kind: 'branches', branchIds: Object.freeze(unique) }) as Scope;
}

export function scopeAllows(scope: Scope, companyId: string, branchId: string | null): boolean {
  if (scope.companyId !== companyId) return false;
  if (scope.kind === 'all') return true;
  return branchId !== null && scope.branchIds.includes(branchId);
}

/** Narrow a scope to a user-requested branch filter. Result may exclude everything (returns null). */
export function narrowScope(scope: Scope, requestedBranchId: string | undefined): Scope | null {
  if (!requestedBranchId) return scope;
  if (!scopeAllows(scope, scope.companyId, requestedBranchId)) return null;
  return branchesScope(scope.companyId, [requestedBranchId]);
}

/** Human readable summary for the shell's visible scope indicator. */
export function describeScope(scope: Scope): { kind: 'all' | 'single' | 'many'; count: number } {
  if (scope.kind === 'all') return { kind: 'all', count: 0 };
  return scope.branchIds.length === 1
    ? { kind: 'single', count: 1 }
    : { kind: 'many', count: scope.branchIds.length };
}

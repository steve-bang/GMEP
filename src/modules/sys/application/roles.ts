import { z } from 'zod';
import { AppError, notFound } from '@/platform/errors/errors';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { knownPermissions, PERMISSION_TOPUPS } from '../domain/permissions';
import type { Role } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { invalidateRole } from './auth';
import { auditEntry, parseInput, type RequestCtx } from './support';

/** Roles are data (FR-SYS-013): this is the administration API over the `roles` collection. */
export interface RoleDto {
  code: string;
  name: string;
  permissions: string[];
  canConsolidate: boolean;
}
const toDto = (r: Role): RoleDto => ({
  code: r.code,
  name: r.name,
  permissions: [...r.permissions],
  canConsolidate: r.canConsolidate,
});

export async function listRoles(deps: SysDeps, actor: Actor): Promise<RoleDto[]> {
  resolveScope(actor, 'role:view');
  return (await deps.roles.list(actor.tenantId))
    .map(toDto)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export const updateRoleSchema = z.object({
  permissions: z.array(z.string().regex(/^[a-z-]+:[a-z]+$/)).max(400),
  canConsolidate: z.boolean().optional(),
});

/**
 * FR-SYS-013 role edit. Guard rails: only known `resource:action` strings; an actor can only GRANT
 * permissions they hold themselves (no escalation through role editing); the owner role (CH) can
 * only be edited by someone holding `role:approve`. Dedicated approval workflow for role changes
 * is not built yet (open question), the change is audited and the permission cache dropped.
 */
export async function updateRole(
  deps: SysDeps,
  actor: Actor,
  code: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<RoleDto> {
  resolveScope(actor, 'role:update');
  const data = parseInput(updateRoleSchema, input);
  const known = knownPermissions();
  const unknown = data.permissions.filter((p) => !known.has(p));
  if (unknown.length)
    throw new AppError(
      'validation_failed',
      422,
      unknown.map((p) => ({ field: 'permissions', message: p })),
    );
  const mine = new Set<string>(Object.values(actor.rolePermissions).flat());
  const [role] = await deps.roles.getMany(actor.tenantId, [code]);
  if (!role) throw notFound();
  if (role.code === 'CH' && !mine.has('role:approve')) throw new AppError('forbidden', 403);
  const added = data.permissions.filter((p) => !role.permissions.includes(p));
  if (added.some((p) => !mine.has(p))) throw new AppError('grant_exceeds_own', 403);

  const next: Role = {
    ...role,
    permissions: [...new Set(data.permissions)].sort(),
    canConsolidate: data.canConsolidate ?? role.canConsolidate,
  };
  await deps.uow.run(async (tx) => {
    deps.roles.upsert(tx, actor.tenantId, next, { at: deps.clock.now(), by: actor.userId });
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: null,
        entityType: 'role',
        entityId: code,
        action: 'role.update',
        before: { permissions: role.permissions, canConsolidate: role.canConsolidate },
        after: { permissions: next.permissions, canConsolidate: next.canConsolidate },
      }),
    );
  });
  invalidateRole(deps, code);
  return toDto(next);
}

export interface TopUpResult {
  /** role code -> permissions added by this call */
  added: Record<string, string[]>;
  /** top-up ids applied to at least one role */
  applied: string[];
}

/**
 * R30 / R21: gives roles that already exist the permissions added to the default matrix after they were
 * created (`PERMISSION_TOPUPS`). Idempotent: each role remembers the top-ups it received, so a second call
 * changes nothing and a permission an administrator removed on purpose is not put back. Only ADDS
 * (nothing is ever taken away). Owner only (`role:approve`); one audit line per changed role, in the same
 * transaction as the change.
 */
export async function applyPermissionTopUps(
  deps: SysDeps,
  actor: Actor,
  ctx: RequestCtx,
): Promise<TopUpResult> {
  resolveScope(actor, 'role:approve');
  const roles = await deps.roles.list(actor.tenantId);
  const result: TopUpResult = { added: {}, applied: [] };
  const changed: string[] = [];
  await deps.uow.run(async (tx) => {
    for (const role of roles) {
      const done = new Set(role.appliedTopUps ?? []);
      const perms = new Set(role.permissions);
      const addedHere: string[] = [];
      const ids: string[] = [];
      for (const t of PERMISSION_TOPUPS) {
        if (done.has(t.id)) continue;
        for (const p of (t.grants as Record<string, readonly string[] | undefined>)[role.code] ??
          [])
          if (!perms.has(p)) {
            perms.add(p);
            addedHere.push(p);
          }
        done.add(t.id);
        ids.push(t.id);
      }
      if (ids.length === 0) continue;
      const next: Role = {
        ...role,
        permissions: [...perms].sort(),
        appliedTopUps: [...done].sort(),
      };
      deps.roles.upsert(tx, actor.tenantId, next, { at: deps.clock.now(), by: actor.userId });
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: null,
          entityType: 'role',
          entityId: role.code,
          action: 'role.topup',
          before: { permissions: role.permissions },
          after: { added: addedHere, topUps: ids },
        }),
      );
      if (addedHere.length) result.added[role.code] = addedHere;
      for (const id of ids) if (!result.applied.includes(id)) result.applied.push(id);
      changed.push(role.code);
    }
  });
  for (const code of changed) invalidateRole(deps, code);
  return result;
}

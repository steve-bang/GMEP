import { z } from 'zod';
import { AppError, notFound } from '@/platform/errors/errors';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { knownPermissions } from '../domain/permissions';
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
  return (await deps.roles.list()).map(toDto).sort((a, b) => a.code.localeCompare(b.code));
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
  const [role] = await deps.roles.getMany([code]);
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
    deps.roles.upsert(tx, next, { at: deps.clock.now(), by: actor.userId });
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

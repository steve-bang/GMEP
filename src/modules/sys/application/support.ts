import type { z } from 'zod';
import type { AuditEntry } from '@/platform/audit/audit';
import { validationFailed } from '@/platform/errors/errors';
import type { Actor } from '@/platform/rbac/rbac';
import type { SysDeps } from '../ports/deps';

export interface RequestCtx {
  requestId: string;
  idempotencyKey?: string;
}

/** Parses untrusted input with zod and maps failures to the RFC 9457 422 error. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success)
    throw validationFailed(
      r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  return r.data;
}

export const roleCodesOf = (actor: Pick<Actor, 'assignments'>): string[] => [
  ...new Set(actor.assignments.map((a) => a.roleCode)),
];

/** Builds an audit entry for the actor; personal fields are reduced by the AuditLog implementation. */
export function auditEntry(
  deps: SysDeps,
  actor: Actor,
  ctx: RequestCtx,
  e: {
    branchId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string;
  },
): AuditEntry {
  return {
    id: deps.newId(),
    at: deps.clock.now(),
    companyId: actor.companyId,
    branchId: e.branchId,
    actorId: actor.userId,
    actorRoles: roleCodesOf(actor),
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    before: e.before ?? null,
    after: e.after ?? null,
    ...(e.reason ? { reason: e.reason } : {}),
    requestId: ctx.requestId,
  };
}

/** Normalised login name: lower-case, trimmed, no inner whitespace for employee codes. */
export function normalizeLoginName(identifier: string): string {
  const t = identifier.trim().toLowerCase();
  return t.includes('@') ? t : t.replace(/\s+/g, '');
}

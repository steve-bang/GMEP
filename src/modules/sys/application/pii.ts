import { z } from 'zod';
import { AppError, notFound } from '@/platform/errors/errors';
import { PII_REVEAL_REASONS, type PiiAccessEntry, type PiiField } from '@/platform/pii/pii';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { SysDeps } from '../ports/deps';
import { parseInput, roleCodesOf } from './support';

/**
 * The "Hiện" (reveal) action (NFR-SEC-03, PDPL 2025, ba-answers-for-dev §7.2/7.3). The full value
 * leaves the server only here, only for roles whose PiiPolicy level allows reveal, only inside the
 * actor's scope, always with an access-log entry (also for denials) that never contains the value.
 */
export const revealSchema = z.object({
  entityType: z.string().trim().min(1).max(40),
  entityId: z.string().trim().min(1).max(128),
  field: z.enum(['phone', 'email', 'address']),
  reasonCode: z.enum(PII_REVEAL_REASONS).optional(),
  reasonText: z.string().trim().max(300).optional(),
});

export async function revealPii(
  deps: SysDeps,
  actor: Actor,
  sessionId: string,
  input: unknown,
  ctx: { requestId: string },
): Promise<{ field: PiiField; value: string }> {
  const data = parseInput(revealSchema, input);
  await deps.limiter.hit('reveal', actor.userId);
  const field = data.field as PiiField;
  const base = (): Omit<PiiAccessEntry, 'result' | 'purpose' | 'branchId'> => ({
    id: deps.newId(),
    at: deps.clock.now(),
    requestId: ctx.requestId,
    actorId: actor.userId,
    actorRoles: roleCodesOf(actor),
    companyId: actor.companyId,
    entityType: data.entityType,
    entityId: data.entityId,
    fields: [field],
    sessionId,
    ...(data.reasonCode ? { reasonCode: data.reasonCode } : {}),
    // free text can itself contain personal data typed by the user: only its presence is logged
    ...(data.reasonText ? { reasonText: '[có ghi chú]' } : {}),
  });
  const deny = async (error: AppError, branchId: string | null = null): Promise<never> => {
    await deps.piiLog.record({ ...base(), branchId, purpose: 'denied', result: 'denied' });
    throw error;
  };

  const requirement = deps.pii.revealRequirement(actor, field);
  if (requirement === 'none') return deny(new AppError('pii_reveal_denied', 403));
  if (requirement === 'reason' && (!data.reasonCode || (data.reasonText ?? '').length < 5))
    return deny(
      new AppError('validation_failed', 422, [
        { field: 'reasonText', message: 'Cần chọn lý do và ghi chú tối thiểu 5 ký tự.' },
      ]),
    );

  const source = deps.piiSources[data.entityType];
  if (!source) return deny(notFound());
  const scope = resolveScope(actor, source.permission);
  const loaded = await source.load(deps, scope, data.entityId);
  const value = loaded?.values[field];
  if (!loaded || !value) return deny(notFound(), null); // out of scope looks exactly like missing

  await deps.piiLog.record({
    ...base(),
    branchId: loaded.branchId,
    purpose: 'reveal',
    result: 'allowed',
  });
  return { field, value };
}

/** Built-in source: staff contact data (the only personal data in SYS today). CRM adds `customer`. */
export const userPiiSource = {
  permission: 'user:view' as const,
  async load(rawDeps: unknown, scope: import('@/platform/scope/scope').Scope, id: string) {
    const deps = rawDeps as SysDeps;
    const u = await deps.users.getById(id);
    if (!u || u.companyId !== scope.companyId) return null;
    if (scope.kind === 'branches' && (await deps.assignments.listInScope(scope, id)).length === 0)
      return null;
    return { branchId: null, values: { ...(u.phone ? { phone: u.phone } : {}) } };
  },
};

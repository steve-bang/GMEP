import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { SysDeps } from '../ports/deps';
import { auditEntry, type RequestCtx } from './support';
import { visibleUser } from './users';

/** FR-SYS-014 */
export interface LoginHistoryRow {
  at: string;
  /** device text kept at sign-in (sanitised, 80 chars); never an IP address (open question to the client's lawyer) */
  device: string;
  /** `active` = still valid, `ended` = signed out or revoked, `expired` = lifetime passed */
  state: 'active' | 'ended' | 'expired';
  lastSeenAt: string;
}

/**
 * Sign-ins of one account, newest first (FR-SYS-014: time, device, result). Everyone reads their OWN history; another
 * person's needs `login-history:view` inside the permission scope and is audited as an access to personal data (PDPL).
 * Failed attempts are not stored per account (a per-account failure record would reveal which emails exist, and a write on
 * the failure path would break the uniform timing of login) [Cần xác nhận BA].
 */
export async function listLoginHistory(
  deps: SysDeps,
  actor: Actor,
  targetId: string | undefined,
  ctx: RequestCtx,
): Promise<{ userId: string; items: LoginHistoryRow[] }> {
  const id = targetId ?? actor.userId;
  const foreign = id !== actor.userId;
  if (foreign) await visibleUser(deps, resolveScope(actor, 'login-history:view'), id);
  const now = deps.clock.now().getTime();
  const rows = (await deps.sessions.listForUser(id))
    .filter((s) => s.tenantId === undefined || s.tenantId === actor.tenantId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50);
  if (foreign)
    await deps.uow.run(async (tx) => {
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: null,
          entityType: 'user',
          entityId: id,
          action: 'user.login_history_viewed',
        }),
      );
    });
  return {
    userId: id,
    items: rows.map((s) => ({
      at: s.createdAt.toISOString(),
      device: s.device,
      state: s.revokedAt ? 'ended' : s.expiresAt.getTime() <= now ? 'expired' : 'active',
      lastSeenAt: s.lastSeenAt.toISOString(),
    })),
  };
}

import { createHash } from 'node:crypto';
import { AppError, invalidCredentials, unauthenticated } from '@/platform/errors/errors';
import type { Actor } from '@/platform/rbac/rbac';
import { sessionLimitsFor } from '../domain/sessionPolicy';
import type { User } from '../domain/entities';
import type { CachedSession, SysDeps } from '../ports/deps';
import { IdentityUnavailableError, InvalidCredentialsError } from '../ports/ports';
import { normalizeLoginName } from './support';

/**
 * Cookie value = `<sid>.<provider session cookie>`. `sid` is our own random session id (record
 * in sessions/{sid}), independent of the provider token: two logins within the same second yield
 * byte-identical provider cookies, so the token cannot identify a session. Leaking the sid alone
 * is useless without a valid provider cookie, and revoking a sid kills exactly one session.
 */
function packCookie(sid: string, token: string): string {
  return `${sid}.${token}`;
}
function unpackCookie(cookie: string): { sid: string; token: string } | null {
  const i = cookie.indexOf('.');
  if (i < 8) return null;
  return { sid: cookie.slice(0, i), token: cookie.slice(i + 1) };
}
const cacheKey = (cookie: string) => createHash('sha256').update(cookie).digest('hex');

export interface LoginInput {
  identifier: string;
  password: string;
  requestId: string;
  /** random id from the device cookie (lockout counter A) */
  deviceId: string;
  /** client network address as determined by the edge (hashed in the throttle) */
  address: string;
  userAgent?: string;
}

export interface LoginResult {
  sessionCookie: string;
  maxAgeSeconds: number;
  user: { id: string; displayName: string };
}

/**
 * Builds the Actor from the stored assignments and role data. Roles are data (FR-SYS-013);
 * permissions of multi-role users are the union (FR-SYS-012).
 */
export async function loadActor(
  deps: SysDeps,
  user: User,
  workingBranchId: string | null,
): Promise<{ actor: Actor; roleCodes: string[] }> {
  const assignments = (await deps.assignments.listForUser(user.id)).filter(
    (a) => a.companyId === user.companyId,
  );
  const codes = [...new Set(assignments.map((a) => a.roleCode))];
  const roles = await deps.roles.getMany(codes);
  const rolePermissions: Record<string, readonly string[]> = {};
  for (const r of roles) rolePermissions[r.code] = r.permissions;
  return {
    roleCodes: codes,
    actor: {
      userId: user.id,
      companyId: user.companyId,
      displayName: user.displayName,
      assignments: assignments.map(({ roleCode, branchId }) => ({ roleCode, branchId })),
      rolePermissions: rolePermissions as Actor['rolePermissions'],
      // roles that consolidate (CH, QV) or an explicit company-wide assignment ('*', e.g. system admin)
      canConsolidate:
        roles.some((r) => r.canConsolidate) || assignments.some((a) => a.branchId === '*'),
      workingBranchId,
    },
  };
}

/**
 * Initial working branch (BA §4, D-06): a single assigned branch is used without a picker;
 * consolidating roles start consolidated; multi-branch users resume their last branch if still
 * assigned, otherwise they must choose.
 */
async function initialWorkingBranch(
  deps: SysDeps,
  user: User,
  actor: Actor,
): Promise<string | null> {
  const ids = [...new Set(actor.assignments.map((a) => a.branchId))];
  const concrete = ids.filter((b) => b !== '*');
  if (ids.length === 1 && concrete.length === 1) return concrete[0]!;
  if (actor.canConsolidate) return null;
  const last = await deps.users.getLastWorkingBranch(user.id);
  return last && concrete.includes(last) ? last : null;
}

/**
 * FR-SYS-001 (password step). Flow: throttle check (3 counters, BA §1.4) -> verify password
 * server-side -> user must exist and be active -> StrongAuthPort hook (no-op: MFA deferred by the
 * owner) -> mint session cookie + server-side session record -> audit entry (FR-SYS-003).
 * Failure messages are generic so they do not reveal which part was wrong; unknown names feed the
 * same counters as known ones.
 */
export async function login(deps: SysDeps, input: LoginInput): Promise<LoginResult> {
  const name = normalizeLoginName(input.identifier);
  if (!name || !input.password) throw invalidCredentials();
  const subject = { deviceId: input.deviceId, name, address: input.address };
  await deps.throttle.assertAllowed(subject);

  const fail = async (): Promise<never> => {
    await deps.throttle.recordFailure(subject);
    throw invalidCredentials();
  };

  const byLogin = await deps.users.findByLogin(input.identifier.trim());
  if (!byLogin || byLogin.status !== 'active') return fail();

  let signedIn: { uid: string; idToken: string };
  try {
    signedIn = await deps.identity.signInWithPassword(byLogin.email, input.password);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) return fail();
    if (err instanceof IdentityUnavailableError)
      throw new AppError('unavailable', 503, [], { cause: err });
    throw err;
  }
  // the provider's uid and our user id are the same by convention
  if (signedIn.uid !== byLogin.id) return fail();

  // ---- hook point for the owner-provided strong authentication (A2); MFA is deferred ----
  const requirement = await deps.strongAuth.requirementFor(byLogin);
  if (requirement !== 'none') throw new AppError('strong_auth_required', 401);

  await deps.throttle.recordSuccess(subject);
  const now = deps.clock.now();
  const { actor, roleCodes } = await loadActor(deps, byLogin, null);
  const limits = sessionLimitsFor(deps.config.sessionPolicy, roleCodes);
  const token = await deps.identity.createSessionCookie(signedIn.idToken, limits.absoluteMs);
  const sessionId = deps.newId();
  const working = await initialWorkingBranch(deps, byLogin, actor);
  await deps.sessions.create({
    id: sessionId,
    userId: byLogin.id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + limits.absoluteMs),
    lastSeenAt: now,
    revokedAt: null,
    workingBranchId: working,
    device: (input.userAgent ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 80),
  });
  await deps.uow.run(async (tx) => {
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      companyId: byLogin.companyId,
      branchId: null,
      actorId: byLogin.id,
      actorRoles: roleCodes,
      entityType: 'session',
      entityId: sessionId,
      action: 'auth.login',
      before: null,
      after: null,
      requestId: input.requestId,
    });
  });
  return {
    sessionCookie: packCookie(sessionId, token),
    maxAgeSeconds: Math.floor(limits.absoluteMs / 1000),
    user: { id: byLogin.id, displayName: byLogin.displayName },
  };
}

export interface Session {
  actor: Actor;
  user: User;
  sessionId: string;
}

const toSession = (c: CachedSession): Session => ({
  actor: c.actor,
  user: c.user,
  sessionId: c.session.id,
});

/**
 * Resolves the cookie to an Actor on every request.
 * H1: a verified session (provider signature/revocation + session record + user + assignments +
 * roles) is cached for `authCacheTtlMs`. The cache is invalidated immediately in THIS process on
 * logout, revoke, role/assignment change and user disable; other instances serve a stale entry for
 * at most authCacheTtlMs (default 30 s) = the maximum staleness of a revocation or permission
 * change. Idle and absolute timeouts are still evaluated on every request from the cached state.
 */
export async function resolveSession(
  deps: SysDeps,
  cookie: string | null | undefined,
): Promise<Session> {
  const parts = cookie ? unpackCookie(cookie) : null;
  if (!parts || !cookie) throw unauthenticated();
  const key = cacheKey(cookie);
  const now = deps.clock.now();

  const hit = deps.caches.auth.get(key);
  if (hit) {
    const s = hit.session;
    if (s.revokedAt || s.expiresAt <= now || now.getTime() - s.lastSeenAt.getTime() > hit.idleMs) {
      deps.caches.auth.delete(key);
      throw unauthenticated();
    }
    s.lastSeenAt = now;
    await touchIfDue(deps, hit, now);
    return toSession(hit);
  }

  const verified = await deps.identity.verifySessionCookie(parts.token);
  if (!verified) throw unauthenticated();
  const session = await deps.sessions.find(parts.sid);
  if (!session || session.userId !== verified.uid || session.revokedAt || session.expiresAt <= now)
    throw unauthenticated();
  const user = await deps.users.getById(verified.uid);
  if (!user || user.status !== 'active') throw unauthenticated();
  const { actor, roleCodes } = await loadActor(deps, user, session.workingBranchId);
  const limits = sessionLimitsFor(deps.config.sessionPolicy, roleCodes);
  if (now.getTime() - session.lastSeenAt.getTime() > limits.idleMs) throw unauthenticated();

  const entry: CachedSession = {
    session,
    user,
    actor,
    idleMs: limits.idleMs,
    touchedAt: session.lastSeenAt.getTime(),
  };
  entry.session.lastSeenAt = now;
  await touchIfDue(deps, entry, now);
  deps.caches.auth.set(key, entry, [
    `user:${user.id}`,
    `session:${session.id}`,
    ...roleCodes.map((r) => `role:${r}`),
  ]);
  return toSession(entry);
}

async function touchIfDue(deps: SysDeps, c: CachedSession, now: Date): Promise<void> {
  if (now.getTime() - c.touchedAt >= deps.config.sessionTouchIntervalMs) {
    c.touchedAt = now.getTime();
    await deps.sessions.touch(c.session.id, now);
  }
}

/** Drops cached sessions of a user (permissions, status or sessions changed). */
export function invalidateUser(deps: SysDeps, userId: string): void {
  deps.caches.auth.invalidateTag(`user:${userId}`);
}
/** Drops cached sessions of everybody holding a role (role definition changed). */
export function invalidateRole(deps: SysDeps, roleCode: string): void {
  deps.caches.auth.invalidateTag(`role:${roleCode}`);
}

/** Revokes THIS session (server side), so a stolen copy of the cookie is dead too. */
export async function logout(
  deps: SysDeps,
  cookie: string | null | undefined,
  requestId: string,
): Promise<void> {
  const parts = cookie ? unpackCookie(cookie) : null;
  if (!parts || !cookie) return;
  deps.caches.auth.delete(cacheKey(cookie));
  const session = await deps.sessions.find(parts.sid);
  if (!session || session.revokedAt) return;
  deps.caches.auth.invalidateTag(`session:${session.id}`);
  const now = deps.clock.now();
  await deps.sessions.revoke(session.id, now);
  const user = await deps.users.getById(session.userId);
  if (user) {
    await deps.uow.run(async (tx) => {
      deps.audit.record(tx, {
        id: deps.newId(),
        at: now,
        companyId: user.companyId,
        branchId: null,
        actorId: user.id,
        actorRoles: [],
        entityType: 'session',
        entityId: session.id,
        action: 'auth.logout',
        before: null,
        after: null,
        requestId,
      });
    });
  }
}

/** Security action: kill every session of a user (provider tokens + our records) and the cache. */
export async function revokeAllSessions(deps: SysDeps, userId: string): Promise<void> {
  const now = deps.clock.now();
  await deps.sessions.revokeAllForUser(userId, now);
  await deps.identity.revokeUserTokens(userId);
  invalidateUser(deps, userId);
}

import { AppError, invalidCredentials, unauthenticated } from '@/platform/errors/errors';
import type { Actor } from '@/platform/rbac/rbac';
import type { SysDeps } from '../ports/deps';
import { IdentityUnavailableError, InvalidCredentialsError } from '../ports/ports';
import type { User } from '../domain/entities';

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

export interface LoginInput {
  identifier: string;
  password: string;
  requestId: string;
}

export interface LoginResult {
  sessionCookie: string;
  maxAgeSeconds: number;
  user: { id: string; displayName: string };
}

/**
 * FR-SYS-001 (password step). Flow: verify password server-side -> user must exist and be
 * active -> StrongAuthPort hook (A2: TOTP/PIN supplied later by the owner) -> mint session
 * cookie + server-side session record -> audit entry (FR-SYS-003).
 * Failure messages are generic so they do not reveal which part was wrong.
 * NOT done here (slice 1.1): lockout after repeated failures, password policy, rate limiting.
 */
export async function login(deps: SysDeps, input: LoginInput): Promise<LoginResult> {
  const identifier = input.identifier.trim();
  if (!identifier || !input.password) throw invalidCredentials();

  const byLogin = await deps.users.findByLogin(identifier);
  if (!byLogin || byLogin.status !== 'active') throw invalidCredentials();

  let signedIn: { uid: string; idToken: string };
  try {
    signedIn = await deps.identity.signInWithPassword(byLogin.email, input.password);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) throw invalidCredentials();
    if (err instanceof IdentityUnavailableError)
      throw new AppError('unavailable', 503, [], { cause: err });
    throw err;
  }
  // the provider's uid and our user id are the same by convention
  if (signedIn.uid !== byLogin.id) throw invalidCredentials();

  // ---- hook point for the owner-provided strong authentication (A2) ----
  const requirement = await deps.strongAuth.requirementFor(byLogin);
  if (requirement !== 'none') throw new AppError('strong_auth_required', 401);

  const now = deps.clock.now();
  const token = await deps.identity.createSessionCookie(signedIn.idToken, deps.config.sessionTtlMs);
  const sessionId = deps.newId();
  const sessionCookie = packCookie(sessionId, token);
  await deps.sessions.create({
    id: sessionId,
    userId: byLogin.id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + deps.config.sessionTtlMs),
    lastSeenAt: now,
    revokedAt: null,
  });
  await deps.uow.run(async (tx) => {
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      companyId: byLogin.companyId,
      branchId: null,
      actorId: byLogin.id,
      actorRoles: [],
      entityType: 'session',
      entityId: sessionId,
      action: 'auth.login',
      before: null,
      after: null,
      requestId: input.requestId,
    });
  });
  return {
    sessionCookie,
    maxAgeSeconds: Math.floor(deps.config.sessionTtlMs / 1000),
    user: { id: byLogin.id, displayName: byLogin.displayName },
  };
}

export interface Session {
  actor: Actor;
  user: User;
  sessionId: string;
}

/** Cheap-to-mock single touch interval: lastSeenAt is written at most once per minute (ADR §6.3). */
const TOUCH_INTERVAL_MS = 60_000;

/**
 * Resolves the cookie to an Actor on every request: provider signature/revocation check,
 * our own session record (revoked / absolute expiry / idle timeout), user still active,
 * then role assignments (loaded per request; caching is added with measurement later).
 */
export async function resolveSession(
  deps: SysDeps,
  cookie: string | null | undefined,
): Promise<Session> {
  const parts = cookie ? unpackCookie(cookie) : null;
  if (!parts) throw unauthenticated();
  const verified = await deps.identity.verifySessionCookie(parts.token);
  if (!verified) throw unauthenticated();

  const sessionId = parts.sid;
  const session = await deps.sessions.find(sessionId);
  const now = deps.clock.now();
  if (
    !session ||
    session.userId !== verified.uid ||
    session.revokedAt ||
    session.expiresAt <= now ||
    now.getTime() - session.lastSeenAt.getTime() > deps.config.sessionIdleMs
  ) {
    throw unauthenticated();
  }
  const user = await deps.users.getById(verified.uid);
  if (!user || user.status !== 'active') throw unauthenticated();

  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await deps.sessions.touch(sessionId, now);
  }

  const assignments = (await deps.assignments.listForUser(user.id)).filter(
    (a) => a.companyId === user.companyId,
  );
  const roles = await deps.roles.getMany([...new Set(assignments.map((a) => a.roleCode))]);
  const rolePermissions: Record<string, readonly string[]> = {};
  for (const r of roles) rolePermissions[r.code] = r.permissions;
  return {
    sessionId,
    user,
    actor: {
      userId: user.id,
      companyId: user.companyId,
      displayName: user.displayName,
      assignments: assignments.map(({ roleCode, branchId }) => ({ roleCode, branchId })),
      rolePermissions: rolePermissions as Actor['rolePermissions'],
    },
  };
}

/** Revokes THIS session (server side), so a stolen copy of the cookie is dead too. */
export async function logout(
  deps: SysDeps,
  cookie: string | null | undefined,
  requestId: string,
): Promise<void> {
  const parts = cookie ? unpackCookie(cookie) : null;
  if (!parts) return;
  const sessionId = parts.sid;
  const session = await deps.sessions.find(sessionId);
  if (!session || session.revokedAt) return;
  const now = deps.clock.now();
  await deps.sessions.revoke(sessionId, now);
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
        entityId: sessionId,
        action: 'auth.logout',
        before: null,
        after: null,
        requestId,
      });
    });
  }
}

/** Admin/security action: kill every session of a user (provider tokens + our records). S5 "revoke". */
export async function revokeAllSessions(deps: SysDeps, userId: string): Promise<void> {
  const now = deps.clock.now();
  await deps.sessions.revokeAllForUser(userId, now);
  await deps.identity.revokeUserTokens(userId);
}

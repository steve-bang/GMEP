import { createHash } from 'node:crypto';
import { AppError, invalidCredentials, unauthenticated } from '@/platform/errors/errors';
import type { Actor } from '@/platform/rbac/rbac';
import { sessionLimitsFor } from '../domain/sessionPolicy';
import { identityOf, type User } from '../domain/entities';
import { TENANT_ACCESS, type TenantStatus } from '../domain/tenant';
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

/** One entry of the "Chọn công ty" step: only the signed-in person's own active memberships (FR-TEN-016). */
export interface TenantChoice {
  tenantId: string;
  tenantName: string;
}

export interface LoginResult {
  sessionCookie: string;
  maxAgeSeconds: number;
  /** null while the person still has to choose a tenant (two or more active memberships) */
  user: { id: string; displayName: string } | null;
  /** present exactly when `user` is null */
  tenants?: TenantChoice[];
}

/** Active memberships of a person whose tenant is still allowed to sign in (suspended, terminated... are not offered). */
async function usableMemberships(
  deps: SysDeps,
  memberships: readonly User[],
): Promise<{ user: User; tenantName: string }[]> {
  const out: { user: User; tenantName: string }[] = [];
  for (const m of memberships) {
    if (m.status !== 'active') continue;
    const t = await deps.tenants.get(m.tenantId);
    // a tenant record that does not exist yet (data created before MT-0) counts as a live tenant
    if (t && !TENANT_ACCESS[t.status].signIn) continue;
    out.push({ user: m, tenantName: t?.name ?? m.tenantId });
  }
  return out;
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
    (a) => a.tenantId === user.tenantId,
  );
  const codes = [...new Set(assignments.map((a) => a.roleCode))];
  const roles = await deps.roles.getMany(user.tenantId, codes);
  const rolePermissions: Record<string, readonly string[]> = {};
  for (const r of roles) rolePermissions[r.code] = r.permissions;
  return {
    roleCodes: codes,
    actor: {
      userId: user.id,
      tenantId: user.tenantId,
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

  // FR-TEN-016: the identity is the email (unique platform-wide); an employee code is not a login name because it is
  // unique per tenant only (RULE-018). Unknown email, wrong password and an unusable tenant all end in the same answer.
  const email = input.identifier.trim().toLowerCase();
  if (!email.includes('@')) return fail();
  const all = await deps.users.findMembershipsByEmail(email);
  const usable = await usableMemberships(deps, all);
  if (usable.length === 0) return fail();
  const identityId = identityOf(usable[0]!.user);
  if (usable.some((m) => identityOf(m.user) !== identityId)) return fail(); // inconsistent data: refuse, never guess

  let signedIn: { uid: string; idToken: string };
  try {
    signedIn = await deps.identity.signInWithPassword(email, input.password);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) return fail();
    if (err instanceof IdentityUnavailableError)
      throw new AppError('unavailable', 503, [], { cause: err });
    throw err;
  }
  if (signedIn.uid !== identityId) return fail();

  // ---- hook point for the owner-provided strong authentication (A2); MFA is deferred ----
  const requirement = await deps.strongAuth.requirementFor(usable[0]!.user);
  if (requirement !== 'none') throw new AppError('strong_auth_required', 401);

  await deps.throttle.recordSuccess(subject);
  const now = deps.clock.now();
  const memberships = usable.map((m) => m.user.id);
  const base = { identityId, memberships };
  const device = (input.userAgent ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 80);

  if (usable.length > 1) {
    // two or more tenants: a session that reads no business data until "Chọn công ty" (RULE-026)
    const limits = sessionLimitsFor(deps.config.sessionPolicy, []);
    const token = await deps.identity.createSessionCookie(signedIn.idToken, limits.absoluteMs);
    const sessionId = deps.newId();
    await deps.sessions.create({
      id: sessionId,
      userId: '',
      ...base,
      tenantId: null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + limits.absoluteMs),
      lastSeenAt: now,
      revokedAt: null,
      workingBranchId: null,
      device,
    });
    return {
      sessionCookie: packCookie(sessionId, token),
      maxAgeSeconds: Math.floor(limits.absoluteMs / 1000),
      user: null,
      tenants: usable.map((m) => ({ tenantId: m.user.tenantId, tenantName: m.tenantName })),
    };
  }

  const byLogin = usable[0]!.user;
  const { actor, roleCodes } = await loadActor(deps, byLogin, null);
  const limits = sessionLimitsFor(deps.config.sessionPolicy, roleCodes);
  const token = await deps.identity.createSessionCookie(signedIn.idToken, limits.absoluteMs);
  const sessionId = deps.newId();
  const working = await initialWorkingBranch(deps, byLogin, actor);
  await deps.sessions.create({
    id: sessionId,
    userId: byLogin.id,
    ...base,
    tenantId: byLogin.tenantId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + limits.absoluteMs),
    lastSeenAt: now,
    revokedAt: null,
    workingBranchId: working,
    device,
  });
  // a failed write of the display-only "last login" must never block a valid sign-in
  await deps.users.recordLogin(byLogin.id, now).catch(() => undefined);
  await deps.uow.run(async (tx) => {
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      tenantId: byLogin.tenantId,
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
  /** lifecycle state of the session's tenant: `suspended` and `terminating` are read-only (analysis 5.1) */
  tenantStatus: TenantStatus;
}

const toSession = (c: CachedSession): Session => ({
  actor: c.actor,
  user: c.user,
  sessionId: c.session.id,
  tenantStatus: c.tenantStatus,
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
  if (
    !session ||
    (session.identityId ?? session.userId) !== verified.uid ||
    session.revokedAt ||
    session.expiresAt <= now
  )
    throw unauthenticated();
  // RULE-026: signed in but no tenant chosen yet = no business data at all
  if (session.tenantId === null) throw new AppError('tenant_selection_required', 403);
  const user = await deps.users.getAnyById(session.userId);
  if (!user || user.status !== 'active') throw unauthenticated();
  // the tenant of the session is the tenant of the membership, never anything the client sent (FR-TEN-010)
  if (session.tenantId !== undefined && session.tenantId !== user.tenantId) throw unauthenticated();
  const tenant = await deps.tenants.get(user.tenantId);
  const tenantStatus: TenantStatus = tenant?.status ?? 'active';
  if (!TENANT_ACCESS[tenantStatus].signIn) throw unauthenticated();
  const { actor, roleCodes } = await loadActor(deps, user, session.workingBranchId);
  const limits = sessionLimitsFor(deps.config.sessionPolicy, roleCodes);
  if (now.getTime() - session.lastSeenAt.getTime() > limits.idleMs) throw unauthenticated();

  const entry: CachedSession = {
    session,
    user,
    actor,
    tenantStatus,
    idleMs: limits.idleMs,
    touchedAt: session.lastSeenAt.getTime(),
  };
  entry.session.lastSeenAt = now;
  await touchIfDue(deps, entry, now);
  deps.caches.auth.set(key, entry, [
    `user:${user.id}`,
    `tenant:${user.tenantId}`,
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
  const user = session.userId ? await deps.users.getAnyById(session.userId) : null;
  if (user) {
    await deps.uow.run(async (tx) => {
      deps.audit.record(tx, {
        id: deps.newId(),
        at: now,
        tenantId: user.tenantId,
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

/**
 * Security action: ends every session of ONE membership (FR-TEN-017: revoking in tenant A never signs the person out of
 * tenant B). Provider tokens are identity-wide, so they are NOT touched here; the session record is what counts.
 */
export async function revokeAllSessions(deps: SysDeps, membershipId: string): Promise<void> {
  const now = deps.clock.now();
  await deps.sessions.revokeAllForUser(membershipId, now);
  invalidateUser(deps, membershipId);
}

/**
 * Password changes belong to the identity (Q41 a, proposal): every membership's sessions and the provider tokens are
 * revoked, so a pending "Chọn công ty" session dies too.
 */
export async function revokeIdentitySessions(deps: SysDeps, user: User): Promise<void> {
  const identityId = identityOf(user);
  const all = await deps.users.findMembershipsByEmail(user.email);
  const ids = new Set([
    user.id,
    ...all.filter((m) => identityOf(m) === identityId).map((m) => m.id),
  ]);
  for (const id of ids) await revokeAllSessions(deps, id);
  await deps.identity.revokeUserTokens(identityId);
}

// ---- choosing and switching the tenant (FR-TEN-016, 017; RULE-026) -------------------------------------------------

/** Provider-verified, not revoked, not expired session of a person, whether or not a tenant is chosen. */
async function identitySession(deps: SysDeps, cookie: string | null | undefined) {
  const parts = cookie ? unpackCookie(cookie) : null;
  if (!parts || !cookie) throw unauthenticated();
  const verified = await deps.identity.verifySessionCookie(parts.token);
  if (!verified) throw unauthenticated();
  const session = await deps.sessions.find(parts.sid);
  const now = deps.clock.now();
  if (
    !session ||
    (session.identityId ?? session.userId) !== verified.uid ||
    session.revokedAt ||
    session.expiresAt <= now
  )
    throw unauthenticated();
  return { parts, cookie, session };
}

async function choicesOf(deps: SysDeps, session: { memberships?: string[]; userId: string }) {
  const ids = session.memberships ?? (session.userId ? [session.userId] : []);
  const members = (await Promise.all(ids.map((id) => deps.users.getAnyById(id)))).flatMap((m) =>
    m ? [m] : [],
  );
  return usableMemberships(deps, members);
}

/** The signed-in person's own tenants, and nobody else's (FR-TEN-016). */
export async function listTenantChoices(
  deps: SysDeps,
  cookie: string | null | undefined,
): Promise<TenantChoice[]> {
  const { session } = await identitySession(deps, cookie);
  return (await choicesOf(deps, session)).map((m) => ({
    tenantId: m.user.tenantId,
    tenantName: m.tenantName,
  }));
}

/**
 * Chooses or switches the tenant: a NEW session is created from the target membership alone (Scope recomputed, working
 * branch, permissions and caches of the previous tenant dropped; permissions never add up across tenants, RULE-026) and the
 * previous session is revoked. The new session does not outlive the sign-in it came from. A tenant that is not one of the
 * person's usable memberships answers exactly like an unknown one.
 */
export async function selectTenant(
  deps: SysDeps,
  cookie: string | null | undefined,
  tenantId: string,
  requestId: string,
): Promise<LoginResult & { user: { id: string; displayName: string } }> {
  const { parts, cookie: raw, session } = await identitySession(deps, cookie);
  const target = (await choicesOf(deps, session)).find((m) => m.user.tenantId === tenantId);
  if (!target) throw new AppError('not_found', 404);
  const now = deps.clock.now();
  const { actor, roleCodes } = await loadActor(deps, target.user, null);
  const working = await initialWorkingBranch(deps, target.user, actor);
  const sessionId = deps.newId();
  await deps.sessions.create({
    id: sessionId,
    userId: target.user.id,
    identityId: identityOf(target.user),
    memberships: session.memberships ?? [target.user.id],
    tenantId: target.user.tenantId,
    createdAt: now,
    expiresAt: session.expiresAt,
    lastSeenAt: now,
    revokedAt: null,
    workingBranchId: working,
    device: session.device,
  });
  deps.caches.auth.delete(cacheKey(raw));
  deps.caches.auth.invalidateTag(`session:${session.id}`);
  await deps.sessions.revoke(session.id, now);
  await deps.users.recordLogin(target.user.id, now).catch(() => undefined);
  await deps.uow.run(async (tx) => {
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      tenantId: target.user.tenantId,
      branchId: null,
      actorId: target.user.id,
      actorRoles: roleCodes,
      entityType: 'session',
      entityId: sessionId,
      action: 'auth.tenant_select',
      before: null,
      after: null,
      requestId,
    });
  });
  return {
    sessionCookie: packCookie(sessionId, parts.token),
    maxAgeSeconds: Math.max(1, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000)),
    user: { id: target.user.id, displayName: target.user.displayName },
  };
}

/** Writes are refused in read-only tenant states (suspended, terminating); sign-out and choosing a tenant stay open. */
export function assertTenantWritable(status: TenantStatus): void {
  if (!TENANT_ACCESS[status].write) throw new AppError('tenant_read_only', 403);
}

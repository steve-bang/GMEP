import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  AppError,
  invalidCredentials,
  unauthenticated,
  validationFailed,
} from '@/platform/errors/errors';
import { translate } from '@/platform/i18n/messages';
import { checkPasswordPolicy, hashForHistory } from '../domain/passwordPolicy';
import type { Actor } from '@/platform/rbac/rbac';
import { sessionLimitsFor } from '../domain/sessionPolicy';
import {
  EMPLOYEE_CODE_PATTERN,
  identityOf,
  isReservedLoginEmail,
  loginAddressOf,
  normalizeCompanyCode,
  normalizeEmployeeCode,
  type User,
} from '../domain/entities';
import { TENANT_ACCESS, TENANT_ID_PATTERN, type TenantStatus } from '../domain/tenant';
import type { CachedSession, SysDeps } from '../ports/deps';
import { IdentityUnavailableError, InvalidCredentialsError } from '../ports/ports';
import { normalizeLoginName, parseInput } from './support';

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
  /** email sign-in (FR-TEN-016) */
  identifier?: string;
  /** P2-C employee-code sign-in: company code (= tenant code) + employee code; used when either is present */
  companyCode?: string;
  employeeCode?: string;
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
  /** P2-C: signed in with a temporary password; the session only allows changing it */
  passwordChangeRequired?: true;
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
/** Address used for the decoy password check when the input is not an email (never an existing account). */
const DECOY_EMAIL = 'no-such-person@gmep.invalid';

export async function login(deps: SysDeps, input: LoginInput): Promise<LoginResult> {
  if (input.companyCode !== undefined || input.employeeCode !== undefined)
    return loginByEmployeeCode(deps, input);
  const name = normalizeLoginName(input.identifier ?? '');
  if (!name || !input.password) throw invalidCredentials();
  const subject = { deviceId: input.deviceId, name, address: input.address };
  await deps.throttle.assertAllowed(subject);

  const fail = async (): Promise<never> => {
    await deps.throttle.recordFailure(subject);
    throw invalidCredentials();
  };

  // FR-TEN-016: the identity is the email (unique platform-wide); an employee code is not a login name because it is
  // unique per tenant only (RULE-018). Unknown email, wrong password and an unusable tenant all end in the same answer.
  const email = (input.identifier ?? '').trim().toLowerCase();
  // P2-C: the internal address of an employee-code account is never a login name (no door around the company code)
  const isEmail = email.includes('@') && !isReservedLoginEmail(email);
  const all = isEmail ? await deps.users.findMembershipsByEmail(email) : [];
  const usable = await usableMemberships(deps, all);
  const identityId = usable[0] ? identityOf(usable[0].user) : null;
  const known = identityId !== null && usable.every((m) => identityOf(m.user) === identityId);

  // UAT-TEN-21 (a): the password check at the identity provider runs for EVERY attempt, also for an unknown email, an
  // unusable tenant or an input that is not an email (a decoy address), so the answer time does not tell the cases
  // apart. Whatever it returns is ignored unless the membership exists; the answer is the same neutral one.
  let signedIn: { uid: string; idToken: string } | null = null;
  try {
    signedIn = await passwordCheck(deps, isEmail ? email : DECOY_EMAIL, input.password);
  } catch (err) {
    if (!(err instanceof InvalidCredentialsError)) throw err;
  }
  if (!known || !signedIn || signedIn.uid !== identityId) return fail();

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

  return startTenantSession(deps, usable[0]!.user, signedIn.idToken, {
    memberships,
    device,
    requestId: input.requestId,
    audit: true,
  });
}

/** Password check at the identity provider; a provider outage is a 503, never a neutral "wrong password". */
async function passwordCheck(deps: SysDeps, address: string, password: string) {
  try {
    return await deps.identity.signInWithPassword(address, password);
  } catch (err) {
    if (err instanceof IdentityUnavailableError)
      throw new AppError('unavailable', 503, [], { cause: err });
    throw err;
  }
}

/** Full session bound to exactly ONE membership (RULE-026), with its audit line in a transaction (FR-SYS-003). */
async function startTenantSession(
  deps: SysDeps,
  user: User,
  idToken: string,
  o: { memberships: string[]; device: string; requestId: string; audit: boolean },
): Promise<LoginResult> {
  const now = deps.clock.now();
  const { actor, roleCodes } = await loadActor(deps, user, null);
  const limits = sessionLimitsFor(deps.config.sessionPolicy, roleCodes);
  const token = await deps.identity.createSessionCookie(idToken, limits.absoluteMs);
  const sessionId = deps.newId();
  const working = await initialWorkingBranch(deps, user, actor);
  await deps.sessions.create({
    id: sessionId,
    userId: user.id,
    identityId: identityOf(user),
    memberships: o.memberships,
    tenantId: user.tenantId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + limits.absoluteMs),
    lastSeenAt: now,
    revokedAt: null,
    workingBranchId: working,
    device: o.device,
  });
  // a failed write of the display-only "last login" must never block a valid sign-in
  await deps.users.recordLogin(user.id, now).catch(() => undefined);
  // the first password change writes its own audit line inside its own transaction
  if (o.audit)
    await deps.uow.run(async (tx) => {
      deps.audit.record(tx, {
        id: deps.newId(),
        at: now,
        tenantId: user.tenantId,
        branchId: null,
        actorId: user.id,
        actorRoles: roleCodes,
        entityType: 'session',
        entityId: sessionId,
        action: 'auth.login',
        before: null,
        after: user.loginKind === 'employee_code' ? { method: 'employee_code' } : null,
        requestId: o.requestId,
      });
    });
  return {
    sessionCookie: packCookie(sessionId, token),
    maxAgeSeconds: Math.floor(limits.absoluteMs / 1000),
    user: { id: user.id, displayName: user.displayName },
  };
}

// ---- employee-code sign-in (P2-C, phase-2-plan 14.4; owner decision 07/11/2026) ---------------------------------------

/** Never a tenant code (TENANT_ID_PATTERN starts with a letter) nor an employee code: lookups with them find nothing. */
const COMPANY_DECOY = '_none_';
const CODE_DECOY = '_NONE_';
/** a session waiting for the password change lives at most this long */
const PASSWORD_CHANGE_SESSION_MS = 15 * 60_000;

/** Lockout name of an employee-code sign-in (counters A and B); also what an unlock clears. */
export const employeeLoginName = (companyCode: string, employeeCode: string): string =>
  `emp:${normalizeCompanyCode(companyCode).slice(0, 64)}|${normalizeEmployeeCode(employeeCode).slice(0, 32).toLowerCase()}`;

/**
 * P2-C: company code + employee code + password, next to the email sign-in. The company code is the immutable tenant
 * code (unique platform-wide, case-insensitive); only `employee_code` accounts sign in this way and the session is bound
 * to that one membership (no "Chọn công ty"). Anti-enumeration (UAT-TEN-21 a): unknown company, unknown employee code,
 * wrong password, disabled account, unusable tenant and expired temporary password all end in the same neutral answer,
 * after the same reads and exactly one password check (a decoy address when nothing matched). Counters: device + pair
 * (A, hard lock), pair (B), address (C), company (D), all fed by unknown pairs exactly like known ones.
 */
async function loginByEmployeeCode(deps: SysDeps, input: LoginInput): Promise<LoginResult> {
  const rawCompany = normalizeCompanyCode(input.companyCode ?? '').slice(0, 64);
  const rawCode = normalizeEmployeeCode(input.employeeCode ?? '').slice(0, 32);
  if (!rawCompany || !rawCode || !input.password) throw invalidCredentials();
  const subject = {
    deviceId: input.deviceId,
    name: employeeLoginName(rawCompany, rawCode),
    address: input.address,
    group: `emp:${rawCompany}`,
  };
  await deps.throttle.assertAllowed(subject);
  const fail = async (): Promise<never> => {
    await deps.throttle.recordFailure(subject);
    throw invalidCredentials();
  };

  const company = TENANT_ID_PATTERN.test(rawCompany) ? rawCompany : COMPANY_DECOY;
  const code = EMPLOYEE_CODE_PATTERN.test(rawCode) ? rawCode : CODE_DECOY;
  const [member, tenant] = await Promise.all([
    deps.users.findByEmployeeCode(company, code),
    deps.tenants.get(company),
  ]);
  const now = deps.clock.now();
  const usable =
    member !== null &&
    member.loginKind === 'employee_code' &&
    member.status === 'active' &&
    // a tenant record that does not exist yet (data created before MT-0) counts as a live tenant, as for email
    (tenant === null || TENANT_ACCESS[tenant.status].signIn);
  const tempExpired =
    usable &&
    member.mustChangePassword === true &&
    !(member.tempPasswordExpiresAt && member.tempPasswordExpiresAt > now);

  let signedIn: { uid: string; idToken: string } | null = null;
  try {
    signedIn = await passwordCheck(
      deps,
      usable ? loginAddressOf(member) : DECOY_EMAIL,
      input.password,
    );
  } catch (err) {
    if (!(err instanceof InvalidCredentialsError)) throw err;
  }
  if (!usable || !signedIn || signedIn.uid !== identityOf(member) || tempExpired) return fail();

  const requirement = await deps.strongAuth.requirementFor(member);
  if (requirement !== 'none') throw new AppError('strong_auth_required', 401);
  await deps.throttle.recordSuccess(subject);
  const device = (input.userAgent ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 80);
  if (!member.mustChangePassword)
    return startTenantSession(deps, member, signedIn.idToken, {
      memberships: [member.id],
      device,
      requestId: input.requestId,
      audit: true,
    });

  // temporary password: a session that reads no business data until the password is changed (like "Chọn công ty")
  const ttl = Math.min(
    PASSWORD_CHANGE_SESSION_MS,
    sessionLimitsFor(deps.config.sessionPolicy, []).absoluteMs,
  );
  const token = await deps.identity.createSessionCookie(signedIn.idToken, ttl);
  const sessionId = deps.newId();
  await deps.sessions.create({
    id: sessionId,
    userId: member.id,
    identityId: identityOf(member),
    memberships: [member.id],
    tenantId: member.tenantId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttl),
    lastSeenAt: now,
    revokedAt: null,
    workingBranchId: null,
    device,
    passwordChangeRequired: true,
  });
  await deps.uow.run(async (tx) => {
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      tenantId: member.tenantId,
      branchId: null,
      actorId: member.id,
      actorRoles: [],
      entityType: 'session',
      entityId: sessionId,
      action: 'auth.login_temporary',
      before: null,
      after: { method: 'employee_code' },
      requestId: input.requestId,
    });
  });
  return {
    sessionCookie: packCookie(sessionId, token),
    maxAgeSeconds: Math.floor(ttl / 1000),
    user: { id: member.id, displayName: member.displayName },
    passwordChangeRequired: true,
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
  // P2-C: signed in with a temporary password = no business data until it is changed
  if (session.passwordChangeRequired) throw new AppError('password_change_required', 403);
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
  // an employee-code account (P2-C) has no email and exactly one membership
  const all =
    user.loginKind === 'employee_code' ? [] : await deps.users.findMembershipsByEmail(user.email);
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
  if (session.passwordChangeRequired) throw new AppError('password_change_required', 403);
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
  // P2-C: a temporary-password session cannot become a full one by choosing its tenant
  if (session.passwordChangeRequired) throw new AppError('password_change_required', 403);
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

// ---- first password change after a temporary password (P2-C) ---------------------------------------------------------

export const changeTemporaryPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
  /** RULE-034: the staff member accepts the tenant's usage rules here (there is no invitation for this account kind) */
  consent: z.literal(true),
});

/**
 * P2-C: the session opened with a temporary password changes it. Order: current password verified at the provider ->
 * password policy (length, not one of the last N, so not the temporary one) -> new password at the provider -> flag
 * cleared, consent and audit in one transaction -> every session and provider token of the identity revoked -> a fresh
 * full session (no second sign-in needed). The password itself is never stored here (only the salted history hash).
 */
export async function changeTemporaryPassword(
  deps: SysDeps,
  cookie: string | null | undefined,
  input: unknown,
  ctx: { address: string; requestId: string },
): Promise<LoginResult & { user: { id: string; displayName: string } }> {
  await deps.limiter.hit('token', ctx.address);
  const data = parseInput(changeTemporaryPasswordSchema, input);
  const { session } = await identitySession(deps, cookie);
  if (!session.passwordChangeRequired || !session.userId) throw new AppError('state_invalid', 409);
  const user = await deps.users.getAnyById(session.userId);
  if (
    !user ||
    user.status !== 'active' ||
    !user.mustChangePassword ||
    (session.tenantId !== undefined && session.tenantId !== user.tenantId)
  )
    throw unauthenticated();
  const address = loginAddressOf(user);
  let current: { uid: string } | null = null;
  try {
    current = await passwordCheck(deps, address, data.currentPassword);
  } catch (err) {
    if (!(err instanceof InvalidCredentialsError)) throw err;
  }
  if (!current || current.uid !== identityOf(user))
    throw validationFailed([
      { field: 'currentPassword', message: translate('policy.password.current_wrong') },
    ]);
  const history = await deps.users.passwordHistory(identityOf(user));
  const violations = checkPasswordPolicy(data.newPassword, history, deps.config.passwordPolicy);
  if (violations.length)
    throw validationFailed(
      violations.map((code) => ({
        field: 'newPassword',
        message: translate(code, { min: deps.config.passwordPolicy.minLength }),
      })),
    );
  try {
    await deps.identity.setPassword(identityOf(user), data.newPassword);
  } catch (e) {
    if (e instanceof IdentityUnavailableError)
      throw new AppError('unavailable', 503, [], { cause: e });
    throw e;
  }
  const now = deps.clock.now();
  await deps.uow.run(async (tx) => {
    const u = await deps.users.getByIdInTx(tx, user.tenantId, user.id);
    if (!u) throw unauthenticated();
    // Firestore: every read of the transaction (user, history) happens before the first write
    await deps.users.appendPasswordHistory(
      tx,
      identityOf(u),
      hashForHistory(data.newPassword),
      deps.config.passwordPolicy.historyDepth,
    );
    deps.users.update(tx, u.id, {
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
      policyConsent: { acceptedAt: now, policyVersion: deps.config.consentPolicyVersion },
      updatedAt: now,
      updatedBy: u.id,
      version: u.version + 1,
    });
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      tenantId: u.tenantId,
      branchId: null,
      actorId: u.id,
      actorRoles: [],
      entityType: 'user',
      entityId: u.id,
      action: 'auth.password_changed_first',
      before: { mustChangePassword: true },
      after: { mustChangePassword: false, policyVersion: deps.config.consentPolicyVersion },
      requestId: ctx.requestId,
    });
  });
  await revokeIdentitySessions(deps, user);
  const signedIn = await passwordCheck(deps, address, data.newPassword);
  const r = await startTenantSession(
    deps,
    { ...user, mustChangePassword: false },
    signedIn.idToken,
    { memberships: [user.id], device: session.device, requestId: ctx.requestId, audit: true },
  );
  return { ...r, user: r.user! };
}

/** Writes are refused in read-only tenant states (suspended, terminating); sign-out and choosing a tenant stay open. */
export function assertTenantWritable(status: TenantStatus): void {
  if (!TENANT_ACCESS[status].write) throw new AppError('tenant_read_only', 403);
}

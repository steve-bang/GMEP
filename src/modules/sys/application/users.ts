import { z } from 'zod';
import { AppError, forbidden, notFound } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import {
  fingerprintOf,
  runIdempotent,
  type StoredResponse,
} from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import { assertBranchWritable } from '../domain/branchState';
import { normalizeSearch } from '@/platform/text/normalize';
import { OWNER_APPROVED_ROLES, ROLE_CODES } from '../domain/permissions';
import { newOpaqueToken } from '../domain/passwordPolicy';
import {
  normalizeEmployeeCode,
  roleAssignmentId,
  type RoleAssignmentRecord,
  type SessionRecord,
  type User,
} from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { AlreadyExistsError } from '../ports/ports';
import { invalidateUser, revokeAllSessions } from './auth';
import { auditEntry, parseInput, roleCodesOf, type RequestCtx } from './support';

/**
 * User and role-assignment administration (FR-SYS-001, 002, 012, G4-SYS-01..04). Rules from
 * ba-answers-for-dev §2.3 (all [Đề xuất BA - chờ xác nhận]): management roles (CH, QV, QL, KT, AD)
 * can only be granted or changed by the owner (`user:approve`); a branch manager works inside
 * their own branch; nobody changes their own assignments.
 */
const idem = (deps: SysDeps) => ({
  uow: deps.uow,
  store: deps.idempotency,
  now: () => deps.clock.now(),
  ttlMs: deps.config.idempotencyTtlMs,
});

export interface AssignmentDto {
  id: string;
  roleCode: string;
  branchId: string;
}
export interface UserDto {
  id: string;
  employeeCode: string;
  displayName: string;
  email: string;
  /** masked per PiiPolicy; `phoneReveal` tells the UI whether a "Hiện" button exists */
  phone?: string;
  phoneReveal: 'none' | 'plain' | 'reason';
  status: string;
  /** ISO instant of the last successful sign-in, null before the first one */
  lastLoginAt: string | null;
  version: number;
  assignments?: AssignmentDto[];
}

function toUserDto(
  deps: SysDeps,
  actor: Actor,
  u: User,
  assignments?: RoleAssignmentRecord[],
): UserDto {
  const phone = deps.pii.present(actor, 'phone', u.phone);
  return {
    id: u.id,
    employeeCode: u.employeeCode,
    displayName: u.displayName,
    email: u.email,
    ...(phone.value !== undefined ? { phone: phone.value } : {}),
    phoneReveal: phone.reveal,
    status: u.status,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    version: u.version,
    ...(assignments
      ? {
          assignments: assignments.map((a) => ({
            id: a.id,
            roleCode: a.roleCode,
            branchId: a.branchId,
          })),
        }
      : {}),
  };
}

export const userListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
});

export async function listUsers(deps: SysDeps, actor: Actor, raw: unknown): Promise<Page<UserDto>> {
  const scope = resolveWorkingScope(actor, 'user:view');
  const q = parseInput(userListSchema, raw);
  const page = await deps.users.list(scope, {
    sort: 'employeeCode',
    direction: 'asc',
    limit: q.limit,
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  const items = await Promise.all(
    page.items.map(async (u) =>
      toUserDto(deps, actor, u, await deps.assignments.listInScope(scope, u.id)),
    ),
  );
  return { items, nextCursor: page.nextCursor };
}

export const USER_PAGE_SIZE = 25;
const USER_SCAN_CAP = 2000; // 80-300 users planned; a hard stop instead of an unbounded scan

export const userSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  roleCode: z.enum(ROLE_CODES).optional(),
  branchId: z.string().trim().min(1).max(64).optional(),
  status: z.enum(['active', 'invited', 'disabled']).optional(),
  sort: z.enum(['name', 'code', 'lastLogin']).default('lastLogin'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export interface UserSearchResult {
  items: UserDto[];
  total: number;
  /** counts over the filtered set, shown in the list summary (G4-SYS-01) */
  invited: number;
  disabled: number;
  page: number;
  pageCount: number;
}

/**
 * G4-SYS-01 list: filter by name/email (diacritics-insensitive), role, branch and status, sort by
 * name, code or last login, numbered pages. Scope is applied by the repositories (NFR-ISO-01); the
 * filters then run over the in-scope set, which is small (one company, up to a few hundred users).
 */
export async function searchUsers(
  deps: SysDeps,
  actor: Actor,
  raw: unknown,
): Promise<UserSearchResult> {
  const scope = resolveWorkingScope(actor, 'user:view');
  const q = parseInput(userSearchSchema, raw);
  const users: User[] = [];
  let cursor: string | undefined;
  do {
    const page = await deps.users.list(scope, {
      sort: 'employeeCode',
      direction: 'asc',
      limit: MAX_LIMIT,
      ...(cursor ? { cursor: decodeCursor(cursor)! } : {}),
    });
    users.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && users.length < USER_SCAN_CAP);

  const byUser = new Map<string, RoleAssignmentRecord[]>();
  for (const a of await deps.assignments.listAllInScope(scope))
    byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);

  const needle = q.q ? normalizeSearch(q.q) : '';
  const matches = users.filter((u) => {
    const mine = byUser.get(u.id) ?? [];
    return (
      (!q.status || u.status === q.status) &&
      (!q.roleCode || mine.some((a) => a.roleCode === q.roleCode)) &&
      (!q.branchId || mine.some((a) => a.branchId === q.branchId)) &&
      (!needle || normalizeSearch(`${u.displayName} ${u.email}`).includes(needle))
    );
  });
  const sign = q.dir === 'asc' ? 1 : -1;
  const key = (u: User): string | number =>
    q.sort === 'name'
      ? normalizeSearch(u.displayName)
      : q.sort === 'code'
        ? u.employeeCode
        : (u.lastLoginAt?.getTime() ?? 0);
  matches.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return (ka < kb ? -1 : ka > kb ? 1 : a.employeeCode.localeCompare(b.employeeCode)) * sign;
  });
  const pageCount = Math.max(1, Math.ceil(matches.length / USER_PAGE_SIZE));
  const page = Math.min(q.page, pageCount);
  const slice = matches.slice((page - 1) * USER_PAGE_SIZE, page * USER_PAGE_SIZE);
  return {
    items: slice.map((u) => toUserDto(deps, actor, u, byUser.get(u.id))),
    total: matches.length,
    invited: matches.filter((u) => u.status === 'invited').length,
    disabled: matches.filter((u) => u.status === 'disabled').length,
    page,
    pageCount,
  };
}

async function visibleUser(deps: SysDeps, scope: Scope, id: string): Promise<User> {
  const u = await deps.users.getById(id);
  if (!u || u.companyId !== scope.companyId) throw notFound();
  if (scope.kind === 'branches' && (await deps.assignments.listInScope(scope, id)).length === 0)
    throw notFound(); // outside the scope == missing (NFR-ISO-01)
  return u;
}

export async function getUser(deps: SysDeps, actor: Actor, id: string): Promise<UserDto> {
  const scope = resolveScope(actor, 'user:view');
  const u = await visibleUser(deps, scope, id);
  return toUserDto(deps, actor, u, await deps.assignments.listInScope(scope, id));
}

/** A manager may only touch users who hold no owner-approved role; the owner may touch anyone. */
async function assertManageable(deps: SysDeps, actor: Actor, target: User): Promise<void> {
  if (target.id === actor.userId) throw new AppError('self_change', 403);
  if (hasPermission(actor, 'user:approve')) return;
  const roles = (await deps.assignments.listForUser(target.id)).map((a) => a.roleCode);
  if (roles.some((r) => OWNER_APPROVED_ROLES.includes(r)))
    throw new AppError('approval_required', 403);
}

async function assertAssignable(
  deps: SysDeps,
  actor: Actor,
  scope: Scope,
  a: { roleCode: string; branchId: string },
): Promise<void> {
  if (a.branchId === '*' ? scope.kind !== 'all' : !scopeAllows(scope, actor.companyId, a.branchId))
    throw forbidden();
  if (OWNER_APPROVED_ROLES.includes(a.roleCode) && !hasPermission(actor, 'user:approve'))
    throw new AppError('approval_required', 403); // needs the owner (BA §2.3)
  const [role] = await deps.roles.getMany([a.roleCode]);
  if (!role)
    throw new AppError('validation_failed', 422, [{ field: 'roleCode', message: 'unknown role' }]);
  if (a.branchId !== '*') {
    const branch = await deps.branches.get(scope, a.branchId);
    if (!branch) throw notFound();
    assertBranchWritable(
      branch.status,
      'new_master',
      roleCodesOf(actor),
      deps.config.branchStateRules,
    );
  }
}

const assignmentInput = z.object({
  roleCode: z.string().trim().min(1).max(8),
  branchId: z.string().trim().min(1).max(64),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  employeeCode: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .transform(normalizeEmployeeCode)
    .pipe(z.string().regex(/^[A-Z0-9._-]{2,20}$/)),
  displayName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional(),
  assignments: z.array(assignmentInput).min(1).max(20),
});

/**
 * Creates the user in `invited` status and sends the 72 h invitation (single-use link). The
 * account cannot log in before activation. Idempotent; email/identity side effects run after the
 * transaction and are retried by "resend invitation".
 */
export async function inviteUser(
  deps: SysDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  const scope = resolveScope(actor, 'user:create');
  const data = parseInput(inviteUserSchema, input);
  for (const a of data.assignments) await assertAssignable(deps, actor, scope, a);
  const { raw, id: tokenId } = newOpaqueToken();
  const userId = deps.newId();
  let created: User | null = null;
  try {
    const result = await runIdempotent(
      idem(deps),
      {
        userId: actor.userId,
        route: 'POST /api/v1/sys/users',
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf(data),
      },
      async (tx) => {
        // friendly early answer; the unique key documents enforce it atomically at commit
        if (
          (await deps.users.findByLogin(data.email)) ||
          (await deps.users.findByLogin(data.employeeCode))
        )
          throw new AppError('user_exists', 409);
        const now = deps.clock.now();
        const user: User = {
          id: userId,
          companyId: actor.companyId,
          email: data.email,
          employeeCode: data.employeeCode,
          displayName: data.displayName,
          ...(data.phone ? { phone: data.phone } : {}),
          status: 'invited',
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        deps.users.create(tx, user);
        const recs: RoleAssignmentRecord[] = data.assignments.map((a) => ({
          id: roleAssignmentId(userId, a.roleCode, a.branchId),
          userId,
          companyId: actor.companyId,
          roleCode: a.roleCode,
          branchId: a.branchId,
          employeeCode: data.employeeCode,
          createdAt: now,
          createdBy: actor.userId,
        }));
        for (const r of recs) deps.assignments.add(tx, { ...r });
        deps.tokens.create(tx, {
          id: tokenId,
          kind: 'invite',
          userId,
          companyId: actor.companyId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + deps.config.inviteTokenTtlMs),
          usedAt: null,
          revokedAt: null,
        });
        deps.audit.record(
          tx,
          auditEntry(deps, actor, ctx, {
            branchId: null,
            entityType: 'user',
            entityId: userId,
            action: 'user.invite',
            after: {
              employeeCode: user.employeeCode,
              email: user.email,
              phone: user.phone,
              status: 'invited',
              assignments: data.assignments,
            },
          }),
        );
        created = user;
        return { status: 201, body: toUserDto(deps, actor, user, recs) };
      },
    );
    if (!result.replayed && created) {
      const u = created as User;
      await deps.identity.createUser({ uid: u.id, email: u.email, displayName: u.displayName });
      await sendInvite(deps, u, raw, tokenId);
    }
    return result;
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('user_exists', 409);
    throw e;
  }
}

async function sendInvite(deps: SysDeps, u: User, raw: string, tokenId: string): Promise<void> {
  await deps.email.send({
    id: `invite-${tokenId.slice(0, 24)}`,
    to: u.email,
    template: 'invitation',
    vars: {
      link: `${deps.config.appBaseUrl}/activate?token=${encodeURIComponent(raw)}`,
      expiresHours: String(Math.round(deps.config.inviteTokenTtlMs / 3_600_000)),
    },
  });
}

/** New 72 h link; revokes the previous one. Also re-creates the identity account if the first attempt failed. */
export async function resendInvite(
  deps: SysDeps,
  actor: Actor,
  id: string,
  ctx: RequestCtx,
): Promise<void> {
  const scope = resolveScope(actor, 'user:manage');
  const u = await visibleUser(deps, scope, id);
  await assertManageable(deps, actor, u);
  if (u.status !== 'invited') throw new AppError('state_invalid', 409);
  const { raw, id: tokenId } = newOpaqueToken();
  const now = deps.clock.now();
  await deps.uow.run(async (tx) => {
    await deps.tokens.revokeOpenForUser(tx, u.id, 'invite', now);
    deps.tokens.create(tx, {
      id: tokenId,
      kind: 'invite',
      userId: u.id,
      companyId: u.companyId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + deps.config.inviteTokenTtlMs),
      usedAt: null,
      revokedAt: null,
    });
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: null,
        entityType: 'user',
        entityId: u.id,
        action: 'user.invite_resend',
      }),
    );
  });
  await deps.identity
    .createUser({ uid: u.id, email: u.email, displayName: u.displayName })
    .catch(() => undefined); // exists already: fine
  await sendInvite(deps, u, raw, tokenId);
}

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  version: z.number().int().min(1),
});

/** Name and phone only. The employee code is immutable (BA §1.6); the email changes through its own flow (later). */
export async function updateUser(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<UserDto> {
  const scope = resolveScope(actor, 'user:update');
  const data = parseInput(updateUserSchema, input);
  const target = await visibleUser(deps, scope, id);
  if (target.id !== actor.userId) await assertManageable(deps, actor, target);
  return deps.uow.run(async (tx) => {
    const u = await deps.users.getByIdInTx(tx, id);
    if (!u) throw notFound();
    if (u.version !== data.version) throw new AppError('version_conflict', 409);
    const now = deps.clock.now();
    const displayName = data.displayName ?? u.displayName;
    const phone = data.phone === undefined ? u.phone : (data.phone ?? undefined);
    deps.users.update(tx, id, {
      displayName,
      ...(phone !== undefined ? { phone } : {}),
      updatedAt: now,
      updatedBy: actor.userId,
      version: u.version + 1,
    });
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: null,
        entityType: 'user',
        entityId: id,
        action: 'user.update',
        before: { displayName: u.displayName, phone: u.phone },
        after: { displayName, phone },
      }),
    );
    invalidateUser(deps, id);
    return toUserDto(deps, actor, {
      ...u,
      displayName,
      ...(phone !== undefined ? { phone } : {}),
      version: u.version + 1,
    });
  });
}

export const userStatusSchema = z.object({
  status: z.enum(['active', 'disabled']),
  version: z.number().int().min(1),
});

/** Disable (block) or re-enable. Disabling kills every session immediately (FR-SYS-001). */
export async function setUserStatus(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<UserDto> {
  const scope = resolveScope(actor, 'user:archive');
  const data = parseInput(userStatusSchema, input);
  const target = await visibleUser(deps, scope, id);
  await assertManageable(deps, actor, target);
  const dto = await deps.uow.run(async (tx) => {
    const u = await deps.users.getByIdInTx(tx, id);
    if (!u) throw notFound();
    if (u.version !== data.version) throw new AppError('version_conflict', 409);
    if (u.status === 'invited' || u.status === data.status)
      throw new AppError('state_invalid', 409);
    deps.users.update(tx, id, {
      status: data.status,
      updatedAt: deps.clock.now(),
      updatedBy: actor.userId,
      version: u.version + 1,
    });
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: null,
        entityType: 'user',
        entityId: id,
        action: data.status === 'disabled' ? 'user.disable' : 'user.enable',
        before: { status: u.status },
        after: { status: data.status },
      }),
    );
    return toUserDto(deps, actor, { ...u, status: data.status, version: u.version + 1 });
  });
  await deps.identity.setDisabled(id, data.status === 'disabled');
  if (data.status === 'disabled') await revokeAllSessions(deps, id);
  else invalidateUser(deps, id);
  return dto;
}

export const assignmentSchema = assignmentInput;

/** FR-SYS-012: adds a (role, branch) assignment; permissions are the union of all assignments. */
export async function addAssignment(
  deps: SysDeps,
  actor: Actor,
  userId: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<AssignmentDto> {
  const scope = resolveScope(actor, 'user:update');
  const a = parseInput(assignmentSchema, input);
  const target = await visibleUser(deps, scope, userId);
  await assertManageable(deps, actor, target);
  await assertAssignable(deps, actor, scope, a);
  const id = roleAssignmentId(userId, a.roleCode, a.branchId);
  try {
    await deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      deps.assignments.add(tx, {
        id,
        userId,
        companyId: actor.companyId,
        roleCode: a.roleCode,
        branchId: a.branchId,
        employeeCode: target.employeeCode,
        createdAt: now,
        createdBy: actor.userId,
      });
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: a.branchId === '*' ? null : a.branchId,
          entityType: 'roleAssignment',
          entityId: id,
          action: 'assignment.add',
          after: { userId, roleCode: a.roleCode, branchId: a.branchId },
        }),
      );
    });
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('assignment_exists', 409);
    throw e;
  }
  invalidateUser(deps, userId);
  return { id, roleCode: a.roleCode, branchId: a.branchId };
}

export async function removeAssignment(
  deps: SysDeps,
  actor: Actor,
  userId: string,
  assignmentId: string,
  ctx: RequestCtx,
): Promise<void> {
  const scope = resolveScope(actor, 'user:update');
  const target = await visibleUser(deps, scope, userId);
  await assertManageable(deps, actor, target);
  await deps.uow.run(async (tx) => {
    const a = await deps.assignments.getInTx(tx, assignmentId);
    if (!a || a.userId !== userId) throw notFound();
    if (a.branchId === '*' ? scope.kind !== 'all' : !scopeAllows(scope, a.companyId, a.branchId))
      throw notFound();
    deps.assignments.remove(tx, assignmentId);
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: a.branchId === '*' ? null : a.branchId,
        entityType: 'roleAssignment',
        entityId: assignmentId,
        action: 'assignment.remove',
        before: { userId, roleCode: a.roleCode, branchId: a.branchId },
      }),
    );
  });
  invalidateUser(deps, userId);
}

/** `user:manage`: clear lockout counters (re-enter allowed immediately). */
export async function unlockUser(
  deps: SysDeps,
  actor: Actor,
  id: string,
  ctx: RequestCtx,
): Promise<void> {
  const scope = resolveScope(actor, 'user:manage');
  const u = await visibleUser(deps, scope, id);
  await assertManageable(deps, actor, u);
  for (const name of [u.email.toLowerCase(), u.employeeCode.toLowerCase()])
    await deps.throttle.unlockName(name);
  await deps.uow.run(async (tx) => {
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: null,
        entityType: 'user',
        entityId: id,
        action: 'user.unlock',
      }),
    );
  });
}

export interface SessionDto {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revoked: boolean;
  device: string;
}
const toSessionDto = (s: SessionRecord): SessionDto => ({
  id: s.id,
  createdAt: s.createdAt.toISOString(),
  lastSeenAt: s.lastSeenAt.toISOString(),
  expiresAt: s.expiresAt.toISOString(),
  revoked: s.revokedAt !== null,
  device: s.device,
});

/** Admin session list (`user:manage`); session ids are random and not usable as credentials. */
export async function listUserSessions(
  deps: SysDeps,
  actor: Actor,
  id: string,
): Promise<SessionDto[]> {
  const scope = resolveScope(actor, 'user:manage');
  const u = await visibleUser(deps, scope, id);
  await assertManageable(deps, actor, u);
  return (await deps.sessions.listForUser(id)).map(toSessionDto);
}

/** Forced logout of every session of a user. */
export async function revokeUserSessions(
  deps: SysDeps,
  actor: Actor,
  id: string,
  ctx: RequestCtx,
): Promise<void> {
  const scope = resolveScope(actor, 'user:manage');
  const u = await visibleUser(deps, scope, id);
  await assertManageable(deps, actor, u);
  await revokeAllSessions(deps, id);
  await deps.uow.run(async (tx) => {
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: null,
        entityType: 'user',
        entityId: id,
        action: 'user.sessions_revoked',
      }),
    );
  });
}

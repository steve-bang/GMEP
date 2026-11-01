import { sanitizeAuditValues } from '@/platform/audit/sanitize';
import type { AuditEntry, AuditFilter, AuditLog } from '@/platform/audit/audit';
import type { IdempotencyRecord, IdempotencyStore } from '@/platform/idempotency/idempotency';
import { encodeCursor, type Page } from '@/platform/pagination/pagination';
import type { PiiAccessEntry, PiiAccessLog } from '@/platform/pii/pii';
import type { RoleAssignment } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  normalizeEmployeeCode,
  type AuthToken,
  type Branch,
  type Company,
  type ConfigVersion,
  type ListQuery,
  type Notification,
  type PriceListHeader,
  type PriceListRepository,
  type Role,
  type RoleAssignmentRecord,
  type ServiceItem,
  type SessionRecord,
  type User,
  type Warehouse,
  type WarehouseListQuery,
  type AuthTokenRepository,
  type BranchRepository,
  type CompanyRepository,
  type ConfigRepository,
  type NotificationRepository,
  type RoleAssignmentRepository,
  type RoleRepository,
  type ServiceRepository,
  type SessionRepository,
  type UserRepository,
  type WarehouseRepository,
} from '@/modules/sys';
import type { HashedPassword } from '@/modules/sys';
import { COL, Q } from './queries';

type Cur = { v: string; id: string } | undefined;
const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};

/** limit+1 look-ahead page builder; `keyOf` yields the sort value stored in the cursor. */
function toPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  keyOf: (t: T) => string,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor({ v: keyOf(last), id: last.id }) : null,
  };
}

const scopeParams = (scope: Scope) =>
  scope.kind === 'branches' ? { scopeBranches: scope.branchIds } : {};

// ---- audit / idempotency / access log ----------------------------------------

export class DocAuditLog implements AuditLog {
  constructor(private readonly store: DocStore) {}
  record(tx: Tx, entry: AuditEntry): void {
    const { id, before, after, ...rest } = entry;
    const clean = sanitizeAuditValues(before, after);
    this.store.create(tx, COL.auditLogs, id, {
      ...rest,
      before: clean.before,
      after: clean.after,
      ...(clean.piiChanged.length ? { piiChanged: clean.piiChanged } : {}),
    });
  }
  async list(
    scope: Scope,
    f: AuditFilter,
    page: { limit: number; cursor?: Cur },
  ): Promise<Page<AuditEntry>> {
    const optional = (['entityType', 'entityId', 'actorId', 'action'] as const).filter((k) => f[k]);
    const shape = Q.audit.pick(optional, scope.kind === 'branches');
    const rows = await this.store.query(shape, {
      eq: { companyId: scope.companyId, ...Object.fromEntries(optional.map((k) => [k, f[k]!])) },
      ...scopeParams(scope),
      ...(f.from || f.to
        ? { range: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } }
        : {}),
      ...(page.cursor ? { cursor: page.cursor } : {}),
      limit: page.limit + 1,
    });
    return toPage(rows.map(auditFromDoc), page.limit, (e) => e.at.toISOString());
  }
}

const auditFromDoc = ({ id, data: x }: StoredDoc): AuditEntry => ({
  id,
  at: x.at,
  companyId: x.companyId,
  branchId: x.branchId ?? null,
  actorId: x.actorId,
  actorRoles: x.actorRoles ?? [],
  entityType: x.entityType,
  entityId: x.entityId,
  action: x.action,
  before: x.before ?? null,
  after: x.after ?? null,
  ...(x.reason ? { reason: x.reason } : {}),
  requestId: x.requestId,
});

export class DocIdempotencyStore implements IdempotencyStore {
  constructor(private readonly store: DocStore) {}
  async find(tx: Tx, id: string): Promise<IdempotencyRecord | null> {
    const d = await this.store.getInTx(tx, COL.idempotencyKeys, id);
    return d ? { id, ...(d.data as Omit<IdempotencyRecord, 'id'>) } : null;
  }
  create(tx: Tx, record: IdempotencyRecord, opts?: { overwrite?: boolean }): void {
    const { id, ...data } = record;
    // `expiresAt` is the Firestore TTL-policy field (infra/firestore-ttl.md); an expired record whose
    // deletion has not run yet is overwritten instead of failing the create
    if (opts?.overwrite) this.store.set(tx, COL.idempotencyKeys, id, data);
    else this.store.create(tx, COL.idempotencyKeys, id, data);
  }
}

export class DocPiiAccessLog implements PiiAccessLog {
  constructor(private readonly store: DocStore) {}
  async record(entry: PiiAccessEntry): Promise<void> {
    const { id, ...data } = entry;
    await this.store.createNow(COL.accessLogs, id, data);
  }
}

// ---- users ---------------------------------------------------------------------

const userFromDoc = ({ id, data: x }: StoredDoc): User => ({
  id,
  companyId: x.companyId,
  email: x.email,
  employeeCode: x.employeeCode,
  displayName: x.displayName,
  ...(x.phone ? { phone: x.phone } : {}),
  status: x.status,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export const userToDoc = (u: User): DocData => ({
  ...without(u, 'id'),
  nameNorm: u.displayName.toLowerCase(),
});

export class DocUserRepository implements UserRepository {
  constructor(private readonly store: DocStore) {}
  async getById(id: string) {
    const d = await this.store.get(COL.users, id);
    return d ? userFromDoc(d) : null;
  }
  async getByIdInTx(tx: Tx, id: string) {
    const d = await this.store.getInTx(tx, COL.users, id);
    return d ? userFromDoc(d) : null;
  }
  async findByLogin(identifier: string): Promise<User | null> {
    const shape = identifier.includes('@') ? Q.userByEmail : Q.userByCode;
    const field = identifier.includes('@') ? 'email' : 'employeeCode';
    const value = identifier.includes('@')
      ? identifier.trim().toLowerCase()
      : normalizeEmployeeCode(identifier);
    const rows = await this.store.query(shape.pick([], false), {
      eq: { [field]: value },
      limit: 2,
    });
    // an employee code used in several companies is ambiguous at login: use the email instead
    return rows.length === 1 ? userFromDoc(rows[0]!) : null;
  }
  async list(scope: Scope, q: ListQuery<'employeeCode' | 'name'>): Promise<Page<User>> {
    if (scope.kind === 'all') {
      const rows = await this.store.query(Q.usersByCompany.pick([], false), {
        eq: { companyId: scope.companyId },
        ...(q.cursor ? { cursor: q.cursor } : {}),
        limit: q.limit + 1,
      });
      return toPage(rows.map(userFromDoc), q.limit, (u) => u.employeeCode);
    }
    // branch scopes: walk role assignments (ordered by employee code), de-duplicating users
    const order: string[] = [];
    const lastAssignmentOf = new Map<string, { v: string; id: string }>();
    let cursor: Cur = q.cursor;
    let exhausted = false;
    while (order.length <= q.limit && !exhausted) {
      const rows = await this.store.query(Q.assignmentsByBranch.pick([], true), {
        eq: { companyId: scope.companyId },
        scopeBranches: scope.branchIds,
        ...(cursor ? { cursor } : {}),
        limit: 100,
      });
      for (const r of rows) {
        const uid = r.data.userId as string;
        if (!lastAssignmentOf.has(uid)) order.push(uid);
        lastAssignmentOf.set(uid, { v: r.data.employeeCode, id: r.id });
      }
      exhausted = rows.length < 100;
      const tail = rows.at(-1);
      if (tail) cursor = { v: tail.data.employeeCode, id: tail.id };
    }
    const pageIds = order.slice(0, q.limit);
    const users = (await this.store.getMany(COL.users, pageIds)).map(userFromDoc);
    const byId = new Map(users.map((u) => [u.id, u]));
    const items = pageIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const lastId = pageIds.at(-1);
    const next = order.length > q.limit && lastId ? lastAssignmentOf.get(lastId)! : null;
    return { items, nextCursor: next ? encodeCursor(next) : null };
  }
  create(tx: Tx, user: User): void {
    // unique keys: create() fails at commit when the email or the code (per company) exists
    this.store.create(tx, COL.userKeys, `email__${user.email.toLowerCase()}`, { userId: user.id });
    this.store.create(tx, COL.userKeys, `code__${user.companyId}__${user.employeeCode}`, {
      userId: user.id,
    });
    this.store.create(tx, COL.users, user.id, userToDoc(user));
  }
  update(tx: Tx, id: string, patch: Parameters<UserRepository['update']>[2]): void {
    const extra = patch.displayName ? { nameNorm: patch.displayName.toLowerCase() } : {};
    this.store.update(tx, COL.users, id, { ...patch, ...extra });
  }
  async setLastWorkingBranch(userId: string, branchId: string | null) {
    await this.store.updateNow(COL.users, userId, { lastWorkingBranchId: branchId });
  }
  async getLastWorkingBranch(userId: string) {
    const d = await this.store.get(COL.users, userId);
    return (d?.data.lastWorkingBranchId as string | null | undefined) ?? null;
  }
  async passwordHistory(userId: string): Promise<HashedPassword[]> {
    const d = await this.store.get(COL.userSecurity, userId);
    return (d?.data.history as HashedPassword[] | undefined) ?? [];
  }
  async appendPasswordHistory(
    tx: Tx,
    userId: string,
    entry: HashedPassword,
    keep: number,
    extra?: Record<string, unknown>,
  ) {
    const d = await this.store.getInTx(tx, COL.userSecurity, userId);
    const history = [entry, ...((d?.data.history as HashedPassword[] | undefined) ?? [])].slice(
      0,
      keep,
    );
    this.store.set(tx, COL.userSecurity, userId, { ...(d?.data ?? {}), ...(extra ?? {}), history });
  }
}

// ---- roles / assignments ------------------------------------------------------

export class DocRoleRepository implements RoleRepository {
  constructor(private readonly store: DocStore) {}
  private from = ({ id, data: x }: StoredDoc): Role => ({
    code: id,
    name: x.name,
    permissions: x.permissions ?? [],
    canConsolidate: x.canConsolidate === true,
  });
  async getMany(codes: readonly string[]) {
    return (await this.store.getMany(COL.roles, codes)).map(this.from);
  }
  async list() {
    const rows = await this.store.query(Q.roles.pick([], false), { limit: 200 });
    return rows.map(this.from);
  }
  upsert(tx: Tx, role: Role, meta: { at: Date; by: string }) {
    this.store.set(tx, COL.roles, role.code, {
      name: role.name,
      permissions: [...role.permissions],
      canConsolidate: role.canConsolidate,
      updatedAt: meta.at,
      updatedBy: meta.by,
    });
  }
}

const assignmentFromDoc = ({ id, data: x }: StoredDoc): RoleAssignmentRecord => ({
  id,
  userId: x.userId,
  companyId: x.companyId,
  roleCode: x.roleCode,
  branchId: x.branchId,
  employeeCode: x.employeeCode ?? '',
  createdAt: x.createdAt ?? new Date(0),
  createdBy: x.createdBy ?? 'seed',
});

export class DocRoleAssignmentRepository implements RoleAssignmentRepository {
  constructor(private readonly store: DocStore) {}
  async listForUser(userId: string): Promise<(RoleAssignment & { companyId: string })[]> {
    const rows = await this.store.query(Q.assignmentsByUser.pick([], false), {
      eq: { userId },
      limit: 200,
    });
    return rows.map((r) => ({
      roleCode: r.data.roleCode,
      branchId: r.data.branchId,
      companyId: r.data.companyId,
    }));
  }
  async listForUserInTx(_tx: Tx, userId: string) {
    // queries are not transactional here; assignments are re-validated by deterministic ids on write
    const rows = await this.store.query(Q.assignmentsByUser.pick([], false), {
      eq: { userId },
      limit: 200,
    });
    return rows.map(assignmentFromDoc);
  }
  async listInScope(scope: Scope, userId: string) {
    const rows = await this.store.query(Q.assignmentsByUser.pick([], false), {
      eq: { userId },
      limit: 200,
    });
    return rows
      .map(assignmentFromDoc)
      .filter((a) =>
        a.branchId === '*' ? scope.kind === 'all' : scopeAllows(scope, a.companyId, a.branchId),
      );
  }
  async listByRole(companyId: string, roleCode: string, limit: number) {
    const rows = await this.store.query(Q.assignmentsByRole.pick([], false), {
      eq: { companyId, roleCode },
      limit,
    });
    return rows.map(assignmentFromDoc);
  }
  add(tx: Tx, a: RoleAssignmentRecord) {
    this.store.create(tx, COL.roleAssignments, a.id, { ...without(a, 'id') });
  }
  remove(tx: Tx, id: string) {
    this.store.delete(tx, COL.roleAssignments, id);
  }
  async getInTx(tx: Tx, id: string) {
    const d = await this.store.getInTx(tx, COL.roleAssignments, id);
    return d ? assignmentFromDoc(d) : null;
  }
}

// ---- org ---------------------------------------------------------------------------

const branchFromDoc = ({ id, data: x }: StoredDoc): Branch => ({
  id,
  companyId: x.companyId,
  code: x.code,
  name: x.name,
  status: x.status,
  ...(x.hours ? { hours: x.hours } : {}),
  ...(x.contact ? { contact: x.contact } : {}),
  createdAt: x.createdAt ?? new Date(0),
  createdBy: x.createdBy ?? 'seed',
  updatedAt: x.updatedAt ?? new Date(0),
  updatedBy: x.updatedBy ?? 'seed',
  version: x.version ?? 1,
});

export class DocBranchRepository implements BranchRepository {
  constructor(private readonly store: DocStore) {}
  async list(scope: Scope): Promise<Branch[]> {
    const rows =
      scope.kind === 'all'
        ? await this.store.query(Q.branchesByCompany.pick([], false), {
            eq: { companyId: scope.companyId },
            limit: 500,
          })
        : await this.store.getMany(COL.branches, scope.branchIds);
    return rows
      .map(branchFromDoc)
      .filter((b) => scopeAllows(scope, b.companyId, b.id))
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.branches, id);
    const b = d ? branchFromDoc(d) : null;
    return b && scopeAllows(scope, b.companyId, b.id) ? b : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.branches, id);
    const b = d ? branchFromDoc(d) : null;
    return b && scopeAllows(scope, b.companyId, b.id) ? b : null;
  }
  create(tx: Tx, branch: Branch) {
    this.store.create(tx, COL.branches, branch.id, without(branch, 'id'));
    this.store.create(tx, 'branchCodes', `${branch.companyId}__${branch.code}`, {
      branchId: branch.id,
    });
  }
  update(tx: Tx, id: string, patch: Parameters<BranchRepository['update']>[2]) {
    this.store.update(tx, COL.branches, id, patch);
  }
  async hasNumbering(companyId: string, branchId: string) {
    const rows = await this.store.query(Q.countersByBranch.pick([], false), {
      eq: { companyId, branchId },
      limit: 1,
    });
    return rows.length > 0;
  }
}

/** The company document lists its branch ids (a few tens at most, NFR-SCA-01). */
export class DocCompanyRepository implements CompanyRepository {
  constructor(private readonly store: DocStore) {}
  async get(id: string): Promise<Company | null> {
    const d = await this.store.get(COL.companies, id);
    return d ? { id, name: d.data.name, legalEntityIds: d.data.legalEntityIds ?? [] } : null;
  }
}

const warehouseFromDoc = ({ id, data: x }: StoredDoc): Warehouse => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  code: x.code,
  name: x.name,
  nameNorm: x.nameNorm,
  status: x.status,
  ...(x.note ? { note: x.note } : {}),
  isDefault: x.isDefault === true,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export const warehouseToDoc = (w: Warehouse): DocData => without(w, 'id');

export class DocWarehouseRepository implements WarehouseRepository {
  constructor(private readonly store: DocStore) {}
  async list(scope: Scope, q: WarehouseListQuery): Promise<Page<Warehouse>> {
    const key = `${q.sort}.${q.direction}`;
    const shape = Q.warehouses[key]!.pick([], scope.kind === 'branches');
    const field = q.sort === 'name' ? 'nameNorm' : 'code';
    const rows = await this.store.query(shape, {
      eq: { companyId: scope.companyId },
      ...scopeParams(scope),
      ...(q.namePrefix ? { range: { gte: q.namePrefix, lt: `${q.namePrefix}` } } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    return toPage(rows.map(warehouseFromDoc), q.limit, (w) =>
      field === 'nameNorm' ? w.nameNorm : w.code,
    );
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.warehouses, id);
    const w = d ? warehouseFromDoc(d) : null;
    return w && scopeAllows(scope, w.companyId, w.branchId) ? w : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.warehouses, id);
    const w = d ? warehouseFromDoc(d) : null;
    return w && scopeAllows(scope, w.companyId, w.branchId) ? w : null;
  }
  create(tx: Tx, scope: Scope, w: Warehouse) {
    if (!scopeAllows(scope, w.companyId, w.branchId)) throw new Error('create outside scope');
    this.store.create(tx, COL.warehouses, w.id, warehouseToDoc(w));
  }
  update(tx: Tx, _scope: Scope, id: string, patch: Parameters<WarehouseRepository['update']>[3]) {
    this.store.update(tx, COL.warehouses, id, patch);
  }
}

// ---- sessions / tokens ---------------------------------------------------------

const sessionFromDoc = ({ id, data: x }: StoredDoc): SessionRecord => ({
  id,
  userId: x.userId,
  createdAt: x.createdAt,
  expiresAt: x.expiresAt,
  lastSeenAt: x.lastSeenAt,
  revokedAt: x.revokedAt ?? null,
  workingBranchId: x.workingBranchId ?? null,
  device: x.device ?? '',
});

export class DocSessionRepository implements SessionRepository {
  constructor(private readonly store: DocStore) {}
  async find(id: string) {
    const d = await this.store.get(COL.sessions, id);
    return d ? sessionFromDoc(d) : null;
  }
  create(s: SessionRecord) {
    return this.store.createNow(COL.sessions, s.id, without(s, 'id'));
  }
  touch(id: string, at: Date) {
    return this.store.updateNow(COL.sessions, id, { lastSeenAt: at });
  }
  revoke(id: string, at: Date) {
    return this.store.updateNow(COL.sessions, id, { revokedAt: at });
  }
  async revokeAllForUser(userId: string, at: Date) {
    for (const s of await this.listForUser(userId))
      if (!s.revokedAt) await this.store.updateNow(COL.sessions, s.id, { revokedAt: at });
  }
  setWorkingBranch(id: string, branchId: string | null) {
    return this.store.updateNow(COL.sessions, id, { workingBranchId: branchId });
  }
  async listForUser(userId: string) {
    const rows = await this.store.query(Q.sessionsByUser.pick([], false), {
      eq: { userId },
      limit: 100,
    });
    return rows.map(sessionFromDoc);
  }
}

const tokenFromDoc = ({ id, data: x }: StoredDoc): AuthToken => ({
  id,
  kind: x.kind,
  userId: x.userId,
  companyId: x.companyId,
  createdAt: x.createdAt,
  expiresAt: x.expiresAt,
  usedAt: x.usedAt ?? null,
  revokedAt: x.revokedAt ?? null,
});

export class DocAuthTokenRepository implements AuthTokenRepository {
  constructor(private readonly store: DocStore) {}
  create(tx: Tx, t: AuthToken) {
    this.store.create(tx, COL.authTokens, t.id, without(t, 'id'));
  }
  async find(id: string) {
    const d = await this.store.get(COL.authTokens, id);
    return d ? tokenFromDoc(d) : null;
  }
  async findInTx(tx: Tx, id: string) {
    const d = await this.store.getInTx(tx, COL.authTokens, id);
    return d ? tokenFromDoc(d) : null;
  }
  markUsed(tx: Tx, id: string, at: Date) {
    this.store.update(tx, COL.authTokens, id, { usedAt: at });
  }
  unmarkUsed(tx: Tx, id: string) {
    this.store.update(tx, COL.authTokens, id, { usedAt: null });
  }
  async revokeOpenForUser(tx: Tx, userId: string, kind: AuthToken['kind'], at: Date) {
    const rows = await this.store.query(Q.tokensByUserKind.pick([], false), {
      eq: { userId, kind },
      limit: 20,
    });
    for (const r of rows) {
      const t = tokenFromDoc(r);
      if (!t.usedAt && !t.revokedAt) this.store.update(tx, COL.authTokens, t.id, { revokedAt: at });
    }
  }
}

// ---- config ----------------------------------------------------------------------

const configFromDoc = ({ id, data: x }: StoredDoc): ConfigVersion => ({
  id,
  companyId: x.companyId,
  type: x.type,
  scopeKey: x.scopeKey,
  effectiveFrom: x.effectiveFrom,
  status: x.status,
  payload: x.payload,
  proposedBy: x.proposedBy,
  proposedAt: x.proposedAt,
  reason: x.reason,
  decidedBy: x.decidedBy ?? null,
  decidedAt: x.decidedAt ?? null,
  decisionNote: x.decisionNote ?? null,
  version: x.version,
});

export class DocConfigRepository implements ConfigRepository {
  constructor(private readonly store: DocStore) {}
  async listVersions(companyId: string, type: string, scopeKey: string) {
    const rows = await this.store.query(Q.configScope.pick([], false), {
      eq: { companyId, type, scopeKey },
      limit: 200,
    });
    return rows.map(configFromDoc);
  }
  async listByType(
    companyId: string,
    type: string,
    status: ConfigVersion['status'] | undefined,
    limit: number,
    cursor?: Cur,
  ) {
    const shape = Q.configType.pick(status ? ['status'] : [], false);
    const rows = await this.store.query(shape, {
      eq: { companyId, type, ...(status ? { status } : {}) },
      ...(cursor ? { cursor } : {}),
      limit: limit + 1,
    });
    return toPage(rows.map(configFromDoc), limit, (v) => v.effectiveFrom);
  }
  async get(id: string) {
    const d = await this.store.get(COL.configVersions, id);
    return d ? configFromDoc(d) : null;
  }
  async getInTx(tx: Tx, id: string) {
    const d = await this.store.getInTx(tx, COL.configVersions, id);
    return d ? configFromDoc(d) : null;
  }
  create(tx: Tx, v: ConfigVersion) {
    // a rejected proposal frees its slot: callers use set() semantics through `overwrite`
    this.store.set(tx, COL.configVersions, v.id, without(v, 'id'));
  }
  decide(
    tx: Tx,
    v: ConfigVersion,
    patch: Pick<ConfigVersion, 'status' | 'decidedBy' | 'decidedAt' | 'decisionNote'>,
  ) {
    this.store.update(tx, COL.configVersions, v.id, { ...patch, version: v.version + 1 });
  }
}

// ---- notifications --------------------------------------------------------------

const notificationFromDoc = ({ id, data: x }: StoredDoc): Notification => ({
  id,
  companyId: x.companyId,
  userId: x.userId,
  branchId: x.branchId ?? null,
  kind: x.kind,
  titleKey: x.titleKey,
  params: x.params ?? {},
  link: x.link ?? null,
  createdAt: x.createdAt,
  readAt: x.readAt ?? null,
  expiresAt: x.expiresAt,
});

export class DocNotificationRepository implements NotificationRepository {
  constructor(private readonly store: DocStore) {}
  create(tx: Tx, n: Notification) {
    this.store.create(tx, COL.notifications, n.id, without(n, 'id'));
  }
  async listForUser(userId: string, limit: number, cursor?: Cur) {
    const rows = await this.store.query(Q.notificationsByUser.pick([], false), {
      eq: { userId },
      ...(cursor ? { cursor } : {}),
      limit: limit + 1,
    });
    return toPage(rows.map(notificationFromDoc), limit, (n) => n.createdAt.toISOString());
  }
  async unreadCount(userId: string, limit: number) {
    const page = await this.listForUser(userId, limit);
    return page.items.filter((n) => !n.readAt).length;
  }
  async markRead(userId: string, id: string, at: Date) {
    const d = await this.store.get(COL.notifications, id);
    if (!d || d.data.userId !== userId) return false; // another user's notification looks missing
    if (!d.data.readAt) await this.store.updateNow(COL.notifications, id, { readAt: at });
    return true;
  }
}

// ---- catalog --------------------------------------------------------------------

const serviceFromDoc = ({ id, data: x }: StoredDoc): ServiceItem => ({
  id,
  companyId: x.companyId,
  code: x.code,
  name: x.name,
  nameNorm: x.nameNorm,
  group: x.group,
  status: x.status,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocServiceRepository implements ServiceRepository {
  constructor(private readonly store: DocStore) {}
  async list(companyId: string, q: ListQuery<'code' | 'name'> & { group?: string }) {
    const shape = Q.services[`${q.sort}.${q.direction}`]!.pick(q.group ? ['group'] : [], false);
    const field = q.sort === 'name' ? 'nameNorm' : 'code';
    const rows = await this.store.query(shape, {
      eq: { companyId, ...(q.group ? { group: q.group } : {}) },
      ...(q.namePrefix ? { range: { gte: q.namePrefix, lt: `${q.namePrefix}` } } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    return toPage(rows.map(serviceFromDoc), q.limit, (s) =>
      field === 'nameNorm' ? s.nameNorm : s.code,
    );
  }
  async get(companyId: string, id: string) {
    const d = await this.store.get(COL.services, id);
    const s = d ? serviceFromDoc(d) : null;
    return s && s.companyId === companyId ? s : null;
  }
  async getInTx(tx: Tx, companyId: string, id: string) {
    const d = await this.store.getInTx(tx, COL.services, id);
    const s = d ? serviceFromDoc(d) : null;
    return s && s.companyId === companyId ? s : null;
  }
  create(tx: Tx, s: ServiceItem) {
    this.store.create(tx, COL.services, s.id, without(s, 'id'));
  }
  update(tx: Tx, id: string, patch: Parameters<ServiceRepository['update']>[2]) {
    this.store.update(tx, COL.services, id, patch);
  }
}

const priceListFromDoc = ({ id, data: x }: StoredDoc): PriceListHeader => ({
  id,
  companyId: x.companyId,
  code: x.code,
  name: x.name,
  nameNorm: x.nameNorm,
  status: x.status,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocPriceListRepository implements PriceListRepository {
  constructor(private readonly store: DocStore) {}
  async list(companyId: string, q: ListQuery<'code' | 'name'>) {
    const shape = Q.priceLists[`${q.sort}.${q.direction}`]!.pick([], false);
    const field = q.sort === 'name' ? 'nameNorm' : 'code';
    const rows = await this.store.query(shape, {
      eq: { companyId },
      ...(q.namePrefix ? { range: { gte: q.namePrefix, lt: `${q.namePrefix}` } } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    return toPage(rows.map(priceListFromDoc), q.limit, (p) =>
      field === 'nameNorm' ? p.nameNorm : p.code,
    );
  }
  async get(companyId: string, id: string) {
    const d = await this.store.get(COL.priceLists, id);
    const p = d ? priceListFromDoc(d) : null;
    return p && p.companyId === companyId ? p : null;
  }
  async getInTx(tx: Tx, companyId: string, id: string) {
    const d = await this.store.getInTx(tx, COL.priceLists, id);
    const p = d ? priceListFromDoc(d) : null;
    return p && p.companyId === companyId ? p : null;
  }
  create(tx: Tx, p: PriceListHeader) {
    this.store.create(tx, COL.priceLists, p.id, without(p, 'id'));
  }
  update(tx: Tx, id: string, patch: Parameters<PriceListRepository['update']>[2]) {
    this.store.update(tx, COL.priceLists, id, patch);
  }
}

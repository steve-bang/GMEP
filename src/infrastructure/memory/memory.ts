/**
 * IN-MEMORY adapters. TEST / LOCAL USE ONLY - not a substitute for Firestore.
 * Semantics deliberately mirror Firestore transactions where it matters for the tests:
 * writes are staged and applied atomically at commit, a thrown error discards all staged writes,
 * reads see only committed state, `create` fails when the document exists, and transactions are
 * serialised (stronger than Firestore, which retries on contention).
 * It does NOT model indexes, query limits, latency or contention retries.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { AuditEntry, AuditLog } from '@/platform/audit/audit';
import type { IdempotencyRecord, IdempotencyStore } from '@/platform/idempotency/idempotency';
import { encodeCursor, type Page } from '@/platform/pagination/pagination';
import type { RoleAssignment } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx, UnitOfWork } from '@/platform/tx/unitOfWork';
import {
  AlreadyExistsError,
  InvalidCredentialsError,
  type Branch,
  type BranchRepository,
  type IdentityProvider,
  type Role,
  type RoleAssignmentRepository,
  type RoleRepository,
  type SessionRecord,
  type SessionRepository,
  type User,
  type UserRepository,
  type Warehouse,
  type WarehouseListQuery,
  type WarehouseRepository,
} from '@/modules/sys';

export class MemoryDb {
  private readonly cols = new Map<string, Map<string, unknown>>();
  col<T>(name: string): Map<string, T> {
    let c = this.cols.get(name);
    if (!c) this.cols.set(name, (c = new Map()));
    return c as Map<string, T>;
  }
}

class MemoryTx {
  readonly staged: { check: () => void; apply: () => void }[] = [];
  constructor(readonly db: MemoryDb) {}
  stage(check: () => void, apply: () => void) {
    this.staged.push({ check, apply });
  }
}

function asTx(tx: Tx): MemoryTx {
  if (!(tx instanceof MemoryTx))
    throw new Error('Transaction handle does not belong to the memory adapter');
  return tx;
}

export class MemoryUnitOfWork implements UnitOfWork {
  private chain: Promise<void> = Promise.resolve();
  constructor(private readonly db: MemoryDb) {}
  async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const previous = this.chain;
    let release!: () => void;
    this.chain = new Promise<void>((r) => (release = r));
    await previous;
    try {
      const tx = new MemoryTx(this.db);
      const result = await fn(tx as unknown as Tx);
      // commit: like Firestore, conflicts surface here (not at stage time) and are all-or-nothing
      for (const w of tx.staged) w.check();
      for (const w of tx.staged) w.apply();
      return result;
    } finally {
      release();
    }
  }
}

function stageCreate<T>(tx: MemoryTx, colName: string, id: string, value: T, what: string) {
  const col = tx.db.col<T>(colName);
  tx.stage(
    () => {
      if (col.has(id)) throw new AlreadyExistsError(what);
    },
    () => col.set(id, value),
  );
}

export class MemoryAuditLog implements AuditLog {
  constructor(private readonly db: MemoryDb) {}
  record(tx: Tx, entry: AuditEntry): void {
    stageCreate(asTx(tx), 'auditLogs', entry.id, structuredClone(entry), 'audit entry');
  }
  async list(
    scope: Scope,
    filter: { entityType?: string; entityId?: string },
    limit: number,
  ): Promise<AuditEntry[]> {
    return [...this.db.col<AuditEntry>('auditLogs').values()]
      .filter((e) => e.companyId === scope.companyId)
      .filter((e) =>
        scope.kind === 'all' ? true : e.branchId !== null && scope.branchIds.includes(e.branchId),
      )
      .filter((e) => (filter.entityType ? e.entityType === filter.entityType : true))
      .filter((e) => (filter.entityId ? e.entityId === filter.entityId : true))
      .sort((x, y) => y.at.getTime() - x.at.getTime())
      .slice(0, limit);
  }
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: MemoryDb) {}
  async find(tx: Tx, id: string): Promise<IdempotencyRecord | null> {
    return asTx(tx).db.col<IdempotencyRecord>('idempotencyKeys').get(id) ?? null;
  }
  create(tx: Tx, record: IdempotencyRecord): void {
    stageCreate(asTx(tx), 'idempotencyKeys', record.id, structuredClone(record), 'idempotency key');
  }
}

export class MemoryUserRepository implements UserRepository {
  constructor(private readonly db: MemoryDb) {}
  async getById(id: string) {
    return this.db.col<User>('users').get(id) ?? null;
  }
  async findByLogin(identifier: string) {
    const users = [...this.db.col<User>('users').values()];
    if (identifier.includes('@'))
      return users.find((u) => u.email === identifier.toLowerCase()) ?? null;
    return users.find((u) => u.employeeCode === identifier.toUpperCase()) ?? null;
  }
}

export class MemoryRoleRepository implements RoleRepository {
  constructor(private readonly db: MemoryDb) {}
  async getMany(codes: readonly string[]): Promise<Role[]> {
    const col = this.db.col<Role>('roles');
    return codes.map((c) => col.get(c)).filter((r): r is Role => !!r);
  }
}

export class MemoryRoleAssignmentRepository implements RoleAssignmentRepository {
  constructor(private readonly db: MemoryDb) {}
  async listForUser(userId: string) {
    return [
      ...this.db
        .col<RoleAssignment & { companyId: string; userId: string }>('roleAssignments')
        .values(),
    ]
      .filter((a) => a.userId === userId)
      .map(({ roleCode, branchId, companyId }) => ({ roleCode, branchId, companyId }));
  }
}

export class MemoryBranchRepository implements BranchRepository {
  constructor(private readonly db: MemoryDb) {}
  async list(scope: Scope): Promise<Branch[]> {
    return [...this.db.col<Branch>('branches').values()]
      .filter((b) => scopeAllows(scope, b.companyId, b.id))
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  async getInTx(tx: Tx, scope: Scope, id: string): Promise<Branch | null> {
    const b = asTx(tx).db.col<Branch>('branches').get(id);
    return b && scopeAllows(scope, b.companyId, b.id) ? b : null;
  }
}

export class MemoryWarehouseRepository implements WarehouseRepository {
  constructor(private readonly db: MemoryDb) {}
  async list(scope: Scope, q: WarehouseListQuery): Promise<Page<Warehouse>> {
    const keyOf = (w: Warehouse) => (q.sort === 'name' ? w.nameNorm : w.code);
    const dir = q.direction === 'asc' ? 1 : -1;
    const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    let rows = [...this.db.col<Warehouse>('warehouses').values()].filter((w) =>
      scopeAllows(scope, w.companyId, w.branchId),
    );
    if (q.namePrefix) rows = rows.filter((w) => w.nameNorm.startsWith(q.namePrefix!));
    rows.sort((a, b) => dir * (cmp(keyOf(a), keyOf(b)) || cmp(a.id, b.id)));
    if (q.cursor) {
      const c = q.cursor;
      rows = rows.filter((w) => dir * (cmp(keyOf(w), c.v) || cmp(w.id, c.id)) > 0);
    }
    const items = rows.slice(0, q.limit).map((w) => structuredClone(w));
    const hasMore = rows.length > q.limit;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor({ v: keyOf(last), id: last.id }) : null,
    };
  }
  async get(scope: Scope, id: string): Promise<Warehouse | null> {
    const w = this.db.col<Warehouse>('warehouses').get(id);
    return w && scopeAllows(scope, w.companyId, w.branchId) ? structuredClone(w) : null;
  }
  create(tx: Tx, scope: Scope, warehouse: Warehouse): void {
    if (!scopeAllows(scope, warehouse.companyId, warehouse.branchId))
      throw new Error('create outside scope');
    stageCreate(asTx(tx), 'warehouses', warehouse.id, structuredClone(warehouse), 'warehouse');
  }
}

export class MemorySessionRepository implements SessionRepository {
  constructor(private readonly db: MemoryDb) {}
  async find(id: string) {
    const s = this.db.col<SessionRecord>('sessions').get(id);
    return s ? { ...s } : null;
  }
  async create(s: SessionRecord) {
    this.db.col<SessionRecord>('sessions').set(s.id, { ...s });
  }
  async touch(id: string, at: Date) {
    const s = this.db.col<SessionRecord>('sessions').get(id);
    if (s) s.lastSeenAt = at;
  }
  async revoke(id: string, at: Date) {
    const s = this.db.col<SessionRecord>('sessions').get(id);
    if (s && !s.revokedAt) s.revokedAt = at;
  }
  async revokeAllForUser(userId: string, at: Date) {
    for (const s of this.db.col<SessionRecord>('sessions').values()) {
      if (s.userId === userId && !s.revokedAt) s.revokedAt = at;
    }
  }
}

/** Fake identity store with passwords in memory (tests only). */
export class MemoryIdentityProvider implements IdentityProvider {
  private readonly accounts = new Map<string, { uid: string; password: string }>();
  private readonly revokedBefore = new Map<string, number>();
  private seq = 0; // monotonic counter: avoids same-millisecond ambiguity between issue and revoke
  private readonly cookies = new Map<
    string,
    { uid: string; issuedAt: number; expiresAt: number }
  >();
  addAccount(email: string, uid: string, password: string) {
    this.accounts.set(email.toLowerCase(), { uid, password });
  }
  async signInWithPassword(email: string, password: string) {
    const acc = this.accounts.get(email.toLowerCase());
    if (!acc || acc.password !== password) throw new InvalidCredentialsError();
    return { uid: acc.uid, idToken: `idtoken.${acc.uid}` };
  }
  async createSessionCookie(idToken: string, ttlMs: number) {
    const uid = idToken.replace(/^idtoken\./, '');
    const cookie = `mem.${randomUUID()}.${createHash('sha1').update(uid).digest('hex').slice(0, 6)}`;
    this.cookies.set(cookie, { uid, issuedAt: ++this.seq, expiresAt: Date.now() + ttlMs });
    return cookie;
  }
  async verifySessionCookie(cookie: string) {
    const c = this.cookies.get(cookie);
    if (!c || c.expiresAt <= Date.now()) return null;
    if (c.issuedAt < (this.revokedBefore.get(c.uid) ?? 0)) return null;
    return { uid: c.uid };
  }
  async revokeUserTokens(uid: string) {
    this.revokedBefore.set(uid, ++this.seq);
  }
}

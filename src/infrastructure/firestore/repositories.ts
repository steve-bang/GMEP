import { FieldPath, type Firestore, type Query, type Transaction } from 'firebase-admin/firestore';
import { AppError } from '@/platform/errors/errors';
import type { AuditEntry, AuditLog } from '@/platform/audit/audit';
import type { IdempotencyRecord, IdempotencyStore } from '@/platform/idempotency/idempotency';
import { encodeCursor, type Page } from '@/platform/pagination/pagination';
import type { RoleAssignment } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx, UnitOfWork } from '@/platform/tx/unitOfWork';
import {
  AlreadyExistsError,
  type Branch,
  type BranchRepository,
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
import {
  auditFromDoc,
  branchFromDoc,
  roleFromDoc,
  sessionFromDoc,
  userFromDoc,
  warehouseFromDoc,
  warehouseToDoc,
} from './mappers';

/** Firestore `in` accepts at most 30 values (to be re-verified against current docs, ADR §13). */
export const FIRESTORE_IN_LIMIT = 30;

class FirestoreTx {
  constructor(readonly t: Transaction) {}
}

function asTx(tx: Tx): Transaction {
  if (!(tx instanceof FirestoreTx))
    throw new Error('Transaction handle does not belong to the Firestore adapter');
  return tx.t;
}

export const COLLECTIONS = {
  users: 'users',
  roles: 'roles',
  roleAssignments: 'roleAssignments',
  branches: 'branches',
  warehouses: 'warehouses',
  sessions: 'sessions',
  auditLogs: 'auditLogs',
  idempotencyKeys: 'idempotencyKeys',
} as const;

/** gRPC ALREADY_EXISTS (code 6) from the Admin SDK. */
const isAlreadyExists = (e: unknown) =>
  (e as { code?: number | string })?.code === 6 ||
  (e as { code?: string })?.code === 'already-exists';

export class FirestoreUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Firestore) {}
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    // Admin SDK transactions are pessimistic and retried on contention; fn must be re-runnable.
    return this.db
      .runTransaction(async (t) => fn(new FirestoreTx(t) as unknown as Tx), { maxAttempts: 10 })
      .catch((e: unknown) => {
        // create() conflicts only surface at commit; translate to the port-level error
        if (isAlreadyExists(e)) throw new AlreadyExistsError('document');
        throw e;
      });
  }
}

export class FirestoreAuditLog implements AuditLog {
  constructor(private readonly db: Firestore) {}
  record(tx: Tx, entry: AuditEntry): void {
    const { id, ...data } = entry;
    asTx(tx).create(this.db.collection(COLLECTIONS.auditLogs).doc(id), data);
  }
  async list(
    scope: Scope,
    filter: { entityType?: string; entityId?: string },
    limit: number,
  ): Promise<AuditEntry[]> {
    let q: Query = this.db
      .collection(COLLECTIONS.auditLogs)
      .where('companyId', '==', scope.companyId);
    if (scope.kind === 'branches') {
      if (scope.branchIds.length > FIRESTORE_IN_LIMIT) throw new AppError('scope_too_wide', 400);
      q = q.where('branchId', 'in', [...scope.branchIds]);
    }
    if (filter.entityType) q = q.where('entityType', '==', filter.entityType);
    if (filter.entityId) q = q.where('entityId', '==', filter.entityId);
    const snap = await q.orderBy('at', 'desc').limit(limit).get();
    return snap.docs.map((doc) => auditFromDoc(doc.id, doc.data()));
  }
}

export class FirestoreIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: Firestore) {}
  async find(tx: Tx, id: string): Promise<IdempotencyRecord | null> {
    const snap = await asTx(tx).get(this.db.collection(COLLECTIONS.idempotencyKeys).doc(id));
    if (!snap.exists) return null;
    const x = snap.data()!;
    return {
      id,
      userId: x.userId,
      route: x.route,
      fingerprint: x.fingerprint,
      response: x.response,
      createdAt: x.createdAt.toDate(),
      expiresAt: x.expiresAt.toDate(),
    };
  }
  create(tx: Tx, record: IdempotencyRecord): void {
    const { id, ...data } = record;
    asTx(tx).create(this.db.collection(COLLECTIONS.idempotencyKeys).doc(id), data); // `expiresAt` is the TTL-policy field
  }
}

export class FirestoreUserRepository implements UserRepository {
  constructor(private readonly db: Firestore) {}
  async getById(id: string): Promise<User | null> {
    const s = await this.db.collection(COLLECTIONS.users).doc(id).get();
    return s.exists ? userFromDoc(s.id, s.data()!) : null;
  }
  async findByLogin(identifier: string): Promise<User | null> {
    const col = this.db.collection(COLLECTIONS.users);
    const q = identifier.includes('@')
      ? col.where('email', '==', identifier.toLowerCase())
      : col.where('employeeCode', '==', identifier.toUpperCase());
    const s = await q.limit(1).get();
    const doc = s.docs[0];
    return doc ? userFromDoc(doc.id, doc.data()) : null;
  }
}

export class FirestoreRoleRepository implements RoleRepository {
  constructor(private readonly db: Firestore) {}
  async getMany(codes: readonly string[]): Promise<Role[]> {
    if (codes.length === 0) return [];
    const snaps = await this.db.getAll(
      ...codes.map((c) => this.db.collection(COLLECTIONS.roles).doc(c)),
    );
    return snaps.filter((s) => s.exists).map((s) => roleFromDoc(s.id, s.data()!));
  }
}

export class FirestoreRoleAssignmentRepository implements RoleAssignmentRepository {
  constructor(private readonly db: Firestore) {}
  async listForUser(userId: string): Promise<(RoleAssignment & { companyId: string })[]> {
    const s = await this.db
      .collection(COLLECTIONS.roleAssignments)
      .where('userId', '==', userId)
      .get();
    return s.docs.map((d) => ({
      roleCode: d.data().roleCode as string,
      branchId: d.data().branchId as string,
      companyId: d.data().companyId as string,
    }));
  }
}

export class FirestoreBranchRepository implements BranchRepository {
  constructor(private readonly db: Firestore) {}
  async list(scope: Scope): Promise<Branch[]> {
    let branches: Branch[];
    if (scope.kind === 'all') {
      const s = await this.db
        .collection(COLLECTIONS.branches)
        .where('companyId', '==', scope.companyId)
        .get();
      branches = s.docs.map((d) => branchFromDoc(d.id, d.data()));
    } else {
      const snaps = await this.db.getAll(
        ...scope.branchIds.map((id) => this.db.collection(COLLECTIONS.branches).doc(id)),
      );
      branches = snaps.filter((s) => s.exists).map((s) => branchFromDoc(s.id, s.data()!));
    }
    return branches
      .filter((b) => scopeAllows(scope, b.companyId, b.id))
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  async getInTx(tx: Tx, scope: Scope, id: string): Promise<Branch | null> {
    const s = await asTx(tx).get(this.db.collection(COLLECTIONS.branches).doc(id));
    if (!s.exists) return null;
    const b = branchFromDoc(s.id, s.data()!);
    return scopeAllows(scope, b.companyId, b.id) ? b : null;
  }
}

export class FirestoreWarehouseRepository implements WarehouseRepository {
  constructor(private readonly db: Firestore) {}

  async list(scope: Scope, q: WarehouseListQuery): Promise<Page<Warehouse>> {
    const field = q.sort === 'name' ? 'nameNorm' : 'code';
    let query: Query = this.db
      .collection(COLLECTIONS.warehouses)
      .where('companyId', '==', scope.companyId);
    if (scope.kind === 'branches') {
      if (scope.branchIds.length > FIRESTORE_IN_LIMIT) throw new AppError('scope_too_wide', 400);
      query =
        scope.branchIds.length === 1
          ? query.where('branchId', '==', scope.branchIds[0])
          : query.where('branchId', 'in', [...scope.branchIds]);
    }
    if (q.namePrefix) {
      query = query
        .where('nameNorm', '>=', q.namePrefix)
        .where('nameNorm', '<', `${q.namePrefix}`);
    }
    // keep in sync with warehouseListSpec() in queries.ts (index check S8)
    query = query.orderBy(field, q.direction).orderBy(FieldPath.documentId(), q.direction);
    if (q.cursor) query = query.startAfter(q.cursor.v, q.cursor.id);
    const snap = await query.limit(q.limit + 1).get();
    const all = snap.docs.map((d) => warehouseFromDoc(d.id, d.data()));
    const items = all.slice(0, q.limit);
    const last = items.at(-1);
    const keyOf = (w: Warehouse) => (field === 'nameNorm' ? w.nameNorm : w.code);
    return {
      items,
      nextCursor:
        all.length > q.limit && last ? encodeCursor({ v: keyOf(last), id: last.id }) : null,
    };
  }

  async get(scope: Scope, id: string): Promise<Warehouse | null> {
    const s = await this.db.collection(COLLECTIONS.warehouses).doc(id).get();
    if (!s.exists) return null;
    const w = warehouseFromDoc(s.id, s.data()!);
    return scopeAllows(scope, w.companyId, w.branchId) ? w : null;
  }

  create(tx: Tx, scope: Scope, warehouse: Warehouse): void {
    if (!scopeAllows(scope, warehouse.companyId, warehouse.branchId))
      throw new Error('create outside scope');
    asTx(tx).create(
      this.db.collection(COLLECTIONS.warehouses).doc(warehouse.id),
      warehouseToDoc(warehouse),
    );
  }
}

export class FirestoreSessionRepository implements SessionRepository {
  constructor(private readonly db: Firestore) {}
  async find(id: string): Promise<SessionRecord | null> {
    const s = await this.db.collection(COLLECTIONS.sessions).doc(id).get();
    return s.exists ? sessionFromDoc(s.id, s.data()!) : null;
  }
  async create(s: SessionRecord): Promise<void> {
    const { id, ...data } = s;
    await this.db.collection(COLLECTIONS.sessions).doc(id).create(data);
  }
  async touch(id: string, at: Date): Promise<void> {
    await this.db.collection(COLLECTIONS.sessions).doc(id).update({ lastSeenAt: at });
  }
  async revoke(id: string, at: Date): Promise<void> {
    await this.db.collection(COLLECTIONS.sessions).doc(id).update({ revokedAt: at });
  }
  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    const s = await this.db.collection(COLLECTIONS.sessions).where('userId', '==', userId).get();
    const batch = this.db.batch();
    for (const d of s.docs) if (!d.data().revokedAt) batch.update(d.ref, { revokedAt: at });
    await batch.commit();
  }
}

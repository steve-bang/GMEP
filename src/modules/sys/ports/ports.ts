import type { Page } from '@/platform/pagination/pagination';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { RoleAssignment } from '@/platform/rbac/rbac';
import type { HashedPassword } from '../domain/passwordPolicy';
import type {
  AuthToken,
  Branch,
  Company,
  Notification,
  PriceListHeader,
  Role,
  RoleAssignmentRecord,
  ServiceItem,
  SessionRecord,
  User,
  Warehouse,
} from '../domain/entities';
import type { ConfigVersion } from '../domain/config';
import type { ApprovalRequest, ApprovalStatus } from '../domain/approval';
import type { Actor } from '@/platform/rbac/rbac';
import type {
  ColumnMapping,
  ImportColumn,
  ImportKind,
  ImportStatus,
  RawRow,
  RowIssue,
} from '../domain/dataImport';

export { AlreadyExistsError } from '@/platform/store/docStore';

export interface ListQuery<S extends string = string> {
  sort: S;
  direction: 'asc' | 'desc';
  /** normalised (diacritics-free, lower-case) name prefix */
  namePrefix?: string;
  limit: number;
  cursor?: { v: string; id: string };
}

/**
 * Pre-authentication lookups (login) cannot be scoped: they are the only unscoped reads and
 * return identity data only, never business records.
 */
export interface UserRepository {
  getById(id: string): Promise<User | null>;
  getByIdInTx(tx: Tx, id: string): Promise<User | null>;
  findByLogin(identifier: string): Promise<User | null>;
  /**
   * Users visible in the scope: those holding a role assignment in a scoped branch (or all users
   * of the company for 'all' scopes).
   */
  list(scope: Scope, q: ListQuery<'employeeCode' | 'name'>): Promise<Page<User>>;
  /** Records the last successful sign-in outside any business transaction (not audited, not versioned). */
  recordLogin(userId: string, at: Date): Promise<void>;
  /** Stages the create plus the unique keys (email, employee code per company); AlreadyExistsError on duplicates. */
  create(tx: Tx, user: User): void;
  update(
    tx: Tx,
    id: string,
    patch: Partial<Pick<User, 'displayName' | 'phone' | 'status'>> & {
      updatedAt: Date;
      updatedBy: string;
      version: number;
    },
  ): void;
  /** non-transactional, best effort convenience data (not business data) */
  setLastWorkingBranch(userId: string, branchId: string | null): Promise<void>;
  getLastWorkingBranch(userId: string): Promise<string | null>;
  passwordHistory(userId: string): Promise<HashedPassword[]>;
  appendPasswordHistory(
    tx: Tx,
    userId: string,
    entry: HashedPassword,
    keep: number,
    extra?: Record<string, unknown>,
  ): Promise<void>;
}

export interface RoleRepository {
  getMany(codes: readonly string[]): Promise<Role[]>;
  list(): Promise<Role[]>;
  upsert(tx: Tx, role: Role, meta: { at: Date; by: string }): void;
}

export interface RoleAssignmentRepository {
  listForUser(userId: string): Promise<(RoleAssignment & { companyId: string })[]>;
  listForUserInTx(tx: Tx, userId: string): Promise<RoleAssignmentRecord[]>;
  /** assignments whose branch is inside the scope, used for user administration screens */
  listInScope(scope: Scope, userId: string): Promise<RoleAssignmentRecord[]>;
  /** every assignment whose branch is inside the scope (one paged query), for user list filters */
  listAllInScope(scope: Scope): Promise<RoleAssignmentRecord[]>;
  /** users holding a role (any branch), e.g. to address approvers; capped */
  listByRole(companyId: string, roleCode: string, limit: number): Promise<RoleAssignmentRecord[]>;
  add(tx: Tx, a: RoleAssignmentRecord): void;
  remove(tx: Tx, id: string): void;
  getInTx(tx: Tx, id: string): Promise<RoleAssignmentRecord | null>;
}

export interface BranchRepository {
  /** Branches visible in the scope, sorted by code. */
  list(scope: Scope): Promise<Branch[]>;
  /** Out-of-scope or missing -> null (callers map to 404). Reads inside the transaction. */
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Branch | null>;
  get(scope: Scope, id: string): Promise<Branch | null>;
  create(tx: Tx, branch: Branch): void;
  update(
    tx: Tx,
    id: string,
    patch: Partial<Pick<Branch, 'name' | 'status' | 'hours' | 'contact'>> & {
      updatedAt: Date;
      updatedBy: string;
      version: number;
    },
  ): void;
  /** true when numbering counters already exist for the branch (MÃCN then becomes immutable) */
  hasNumbering(companyId: string, branchId: string): Promise<boolean>;
}

export interface CompanyRepository {
  get(id: string): Promise<Company | null>;
}

export type WarehouseSortField = 'code' | 'name';
export type WarehouseListQuery = ListQuery<WarehouseSortField>;

export interface WarehouseRepository {
  list(scope: Scope, query: WarehouseListQuery): Promise<Page<Warehouse>>;
  /** Out-of-scope or missing -> null. */
  get(scope: Scope, id: string): Promise<Warehouse | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Warehouse | null>;
  /** Stages the create; AlreadyExistsError on duplicate id. Scope is re-checked. */
  create(tx: Tx, scope: Scope, warehouse: Warehouse): void;
  update(
    tx: Tx,
    scope: Scope,
    id: string,
    patch: Partial<Pick<Warehouse, 'name' | 'nameNorm' | 'note' | 'status' | 'isDefault'>> & {
      updatedAt: Date;
      updatedBy: string;
      version: number;
    },
  ): void;
}

/**
 * Lifecycle guard (BA §3): a warehouse may be deactivated only when on-hand, reserved and
 * in-transit are all 0 and no open stock document refers to it. INV does not exist yet, so the
 * composition root wires a stub; the TODO test in tests/integration marks where INV plugs in.
 */
export interface WarehouseActivityPort {
  blockers(warehouse: Warehouse): Promise<string[]>;
}

/**
 * Branch lifecycle guard (BA §5): `locked` only when no open order, unclosed receipt, goods in
 * transit or failed invoice remains. The modules owning those objects do not exist yet; the
 * composition root wires a stub returning no blockers.
 */
export interface BranchActivityPort {
  blockers(branch: Branch): Promise<string[]>;
}

/** Loads personal fields of an entity for the "Hiện" endpoint; CRM registers `customer` here later. */
export interface PiiSource {
  /** permission that lets the actor see the entity at all (scope is resolved from it) */
  permission: `${string}:view`;
  load(
    deps: unknown,
    scope: Scope,
    id: string,
  ): Promise<{
    branchId: string | null;
    values: Partial<Record<'phone' | 'email' | 'address', string>>;
  } | null>;
}

export interface SessionRepository {
  find(id: string): Promise<SessionRecord | null>;
  create(session: SessionRecord): Promise<void>;
  touch(id: string, at: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
  setWorkingBranch(id: string, branchId: string | null): Promise<void>;
  listForUser(userId: string): Promise<SessionRecord[]>;
}

export interface AuthTokenRepository {
  /** Stages creation inside the caller's transaction. */
  create(tx: Tx, token: AuthToken): void;
  find(id: string): Promise<AuthToken | null>;
  findInTx(tx: Tx, id: string): Promise<AuthToken | null>;
  markUsed(tx: Tx, id: string, at: Date): void;
  /** releases a claim when the identity provider failed after the token was consumed */
  unmarkUsed(tx: Tx, id: string): void;
  /** Revokes still-open tokens of a user and kind (e.g. a new reset link replaces the old one). */
  revokeOpenForUser(tx: Tx, userId: string, kind: AuthToken['kind'], at: Date): Promise<void>;
}

export interface ConfigRepository {
  /** All versions (any status) of one (type, scopeKey), newest effectiveFrom first. */
  listVersions(companyId: string, type: string, scopeKey: string): Promise<ConfigVersion[]>;
  /** Versions of a type across scope keys, optionally filtered by status. */
  listByType(
    companyId: string,
    type: string,
    status: ConfigVersion['status'] | undefined,
    limit: number,
    cursor?: { v: string; id: string },
  ): Promise<Page<ConfigVersion>>;
  get(id: string): Promise<ConfigVersion | null>;
  getInTx(tx: Tx, id: string): Promise<ConfigVersion | null>;
  /** Stages the version AND its uniqueness slot (type, scopeKey, effectiveFrom). */
  create(tx: Tx, v: ConfigVersion): void;
  decide(
    tx: Tx,
    v: ConfigVersion,
    patch: Pick<ConfigVersion, 'status' | 'decidedBy' | 'decidedAt' | 'decisionNote'>,
  ): void;
}

export interface NotificationRepository {
  create(tx: Tx, n: Notification): void;
  /** Newest first, own notifications only. */
  listForUser(
    userId: string,
    limit: number,
    cursor?: { v: string; id: string },
  ): Promise<Page<Notification>>;
  unreadCount(userId: string, limit: number): Promise<number>;
  markRead(userId: string, id: string, at: Date): Promise<boolean>;
}

export interface ServiceRepository {
  list(
    companyId: string,
    q: ListQuery<'code' | 'name'> & { group?: string },
  ): Promise<Page<ServiceItem>>;
  get(companyId: string, id: string): Promise<ServiceItem | null>;
  create(tx: Tx, s: ServiceItem): void;
  update(
    tx: Tx,
    id: string,
    patch: Partial<Pick<ServiceItem, 'name' | 'nameNorm' | 'group' | 'status'>> & {
      updatedAt: Date;
      updatedBy: string;
      version: number;
    },
  ): void;
  getInTx(tx: Tx, companyId: string, id: string): Promise<ServiceItem | null>;
}

export interface PriceListRepository {
  list(companyId: string, q: ListQuery<'code' | 'name'>): Promise<Page<PriceListHeader>>;
  get(companyId: string, id: string): Promise<PriceListHeader | null>;
  create(tx: Tx, p: PriceListHeader): void;
  update(
    tx: Tx,
    id: string,
    patch: Partial<Pick<PriceListHeader, 'name' | 'nameNorm' | 'status'>> & {
      updatedAt: Date;
      updatedBy: string;
      version: number;
    },
  ): void;
  getInTx(tx: Tx, companyId: string, id: string): Promise<PriceListHeader | null>;
}

// ---- identity -------------------------------------------------------------

export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class IdentityUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('identity provider unavailable', { cause });
    this.name = 'IdentityUnavailableError';
  }
}

/**
 * Port over the identity store/token issuer (Firebase Auth behind the server; R-15).
 * Passwords are verified server-side; the browser never talks to the provider.
 */
export interface IdentityProvider {
  /** Throws InvalidCredentialsError on wrong email/password or disabled account. */
  signInWithPassword(email: string, password: string): Promise<{ uid: string; idToken: string }>;
  createSessionCookie(idToken: string, ttlMs: number): Promise<string>;
  /** Verifies signature, expiry and provider-side revocation; returns the uid or null. */
  verifySessionCookie(cookie: string): Promise<{ uid: string } | null>;
  /** Invalidates all refresh tokens of the user at the provider. */
  revokeUserTokens(uid: string): Promise<void>;
  /** Creates the account with an unknown random password (activation sets the real one). */
  createUser(input: { uid: string; email: string; displayName: string }): Promise<void>;
  setPassword(uid: string, password: string): Promise<void>;
  setDisabled(uid: string, disabled: boolean): Promise<void>;
}

// ---- email ------------------------------------------------------------------

export interface EmailMessage {
  to: string;
  template: 'password-reset' | 'invitation' | 'security-alert';
  /** template variables; the link carries the single-use token */
  vars: Record<string, string>;
  /** idempotency for retries */
  id: string;
}

/**
 * Outbound email port. Adapters: SMTP (`EMAIL_SMTP_URL`, required in prod) and the dev outbox that
 * only writes to the `emailOutbox` collection. Delivery happens outside any transaction.
 */
export interface EmailGateway {
  send(message: EmailMessage): Promise<void>;
}

// ---- strong authentication hook ---------------------------------------------

export type StrongAuthRequirement = 'none' | 'totp' | 'pin';

/**
 * HOOK POINT ONLY (ADR §2.1 A2). OWNER DECISION: MFA is out of scope for now ("làm sau"). The
 * port stays as a no-op so the owner's TOTP/PIN code can be wired in later without touching the
 * login flow. Nothing enforces or builds MFA.
 */
export interface StrongAuthPort {
  requirementFor(user: User): Promise<StrongAuthRequirement>;
  verify(user: User, proof: string): Promise<boolean>;
}

// ---- approvals (FR-SYS-004) ---------------------------------------------------------------------------

/** Every read takes a Scope (NFR-ISO-01): an approval belongs to one branch. */
export interface ApprovalRepository {
  get(scope: Scope, id: string): Promise<ApprovalRequest | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<ApprovalRequest | null>;
  /** requests of one branch in a status, newest first (the branch must be inside the scope) */
  listByBranchStatus(
    scope: Scope,
    branchId: string,
    status: ApprovalStatus,
    limit: number,
  ): Promise<ApprovalRequest[]>;
  /** the requester's own requests inside the scope, newest first */
  listByRequester(scope: Scope, requesterId: string, limit: number): Promise<ApprovalRequest[]>;
  /** one slot per (kind, subject): the id of the request that is pending for it, if any */
  getSlotInTx(tx: Tx, slotId: string): Promise<{ requestId: string; open: boolean } | null>;
  setSlot(tx: Tx, slotId: string, v: { requestId: string; open: boolean; companyId: string }): void;
  create(tx: Tx, r: ApprovalRequest): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

/**
 * What a module does when a request of its kind is decided, inside the SAME transaction as the decision
 * (registered by the composition root; SYS never imports the module that owns the kind).
 */
export interface ApprovalHandler {
  onDecided(c: {
    tx: Tx;
    request: ApprovalRequest;
    decision: 'approved' | 'rejected';
    note?: string;
    actor: Actor;
    ctx: { requestId: string; idempotencyKey?: string };
  }): Promise<void>;
}

// ---- data import (FR-SYS-007) -----------------------------------------------------------------

/** One unit the handler writes (a customer with its vehicles, a part, a stock line). Data is JSON-safe. */
export interface ImportUnit {
  /** first spreadsheet row of the unit (also the idempotency anchor) */
  row: number;
  rows: number[];
  data: Record<string, unknown>;
}

/** What a committed batch created, so undo removes exactly that and nothing else. */
export interface ImportEntityRef {
  type: string;
  id: string;
  row: number;
}

export interface ImportBatch {
  id: string;
  companyId: string;
  branchId: string;
  kind: ImportKind;
  fileName: string;
  fileHash: string;
  /** R99: the original file is NOT stored; only its name, size and hash are kept */
  fileSize: number;
  warehouseId: string | null;
  headers: string[];
  mapping: ColumnMapping;
  status: ImportStatus;
  rowCount: number;
  unitCount: number;
  /** units already written (commit resumes after this) */
  committedUnits: number;
  /** capped list of row problems; never carries cell values (personal data) */
  issues: RowIssue[];
  issueCount: number;
  warnings: RowIssue[];
  refs: ImportEntityRef[];
  failure: string | null;
  undoReason: string | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export const IMPORT_CHUNK_ROWS = 100;

export interface ImportBatchRepository {
  get(scope: Scope, id: string): Promise<ImportBatch | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<ImportBatch | null>;
  /** newest first, one branch */
  listByBranch(scope: Scope, branchId: string, limit: number): Promise<ImportBatch[]>;
  listByBranchStatus(
    scope: Scope,
    branchId: string,
    status: ImportBatch['status'],
    limit: number,
  ): Promise<ImportBatch[]>;
  create(tx: Tx, b: ImportBatch): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
  /** file slot: the batch that currently owns these exact bytes for (branch, kind) */
  getFileSlotInTx(tx: Tx, slotId: string): Promise<string | null>;
  setFileSlot(tx: Tx, slotId: string, batchId: string): void;
  /** staged units live in chunks read by key; personal data, removed after commit or discard */
  putUnits(tx: Tx, batchId: string, companyId: string, units: readonly ImportUnit[]): void;
  getUnits(batchId: string, chunkCount: number): Promise<ImportUnit[]>;
  deleteUnits(tx: Tx, batchId: string, chunkCount: number): void;
}

export interface ImportHandlerCtx {
  batchId: string;
  requestId: string;
  warehouseId: string | null;
}

/**
 * What one importable kind needs from its owning module (CRM, INV); registered by the composition root like
 * approval handlers. Every write goes through the module's own use case as the actor, so permissions, branch
 * scope, numbering, audit and idempotency are the module's own.
 */
export interface ImportKindHandler {
  kind: ImportKind;
  columns: readonly ImportColumn[];
  /** Vietnamese label of the kind (UI, audit) */
  label: string;
  needsWarehouse: boolean;
  /** units per commit step (one bounded transaction group) */
  chunkSize: number;
  /** permission strings the actor must hold besides data-import:create (checked with the actor's own scope) */
  requires: readonly string[];
  /** all rows of the file: format, cross-row duplicates and clashes with existing data; nothing is written */
  validate(
    actor: Actor,
    rows: readonly RawRow[],
    ctx: { warehouseId: string | null },
  ): Promise<{ units: ImportUnit[]; issues: RowIssue[]; warnings: RowIssue[] }>;
  commit(
    actor: Actor,
    units: readonly ImportUnit[],
    ctx: ImportHandlerCtx,
  ): Promise<ImportEntityRef[]>;
  /** removes or reverses exactly these refs; refuses the whole undo (nothing changed) when any cannot be undone */
  undo(
    actor: Actor,
    refs: readonly ImportEntityRef[],
    ctx: ImportHandlerCtx & { reason: string },
  ): Promise<void>;
}

/** A commit step that failed after writing some records: carries what was written so undo still removes it. */
export class ImportStepError extends Error {
  constructor(
    readonly partial: ImportEntityRef[],
    readonly original: unknown,
  ) {
    super('import step failed');
    this.name = 'ImportStepError';
  }
}

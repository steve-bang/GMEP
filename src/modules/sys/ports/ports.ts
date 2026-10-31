import type { Page, CursorPosition } from '@/platform/pagination/pagination';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { RoleAssignment } from '@/platform/rbac/rbac';
import type { Branch, Role, SessionRecord, User, Warehouse } from '../domain/entities';

/**
 * Pre-authentication lookups (login) cannot be scoped: they are the only unscoped reads and
 * return identity data only, never business records.
 */
export interface UserRepository {
  getById(id: string): Promise<User | null>;
  findByLogin(identifier: string): Promise<User | null>;
}

export interface RoleRepository {
  getMany(codes: readonly string[]): Promise<Role[]>;
}

export interface RoleAssignmentRepository {
  listForUser(userId: string): Promise<(RoleAssignment & { companyId: string })[]>;
}

export interface BranchRepository {
  /** Branches visible in the scope, sorted by code. */
  list(scope: Scope): Promise<Branch[]>;
  /** Out-of-scope or missing -> null (callers map to 404). Reads inside the transaction. */
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Branch | null>;
}

export type WarehouseSortField = 'code' | 'name';

export interface WarehouseListQuery {
  sort: WarehouseSortField;
  direction: 'asc' | 'desc';
  /** normalised (diacritics-free, lower-case) name prefix */
  namePrefix?: string;
  limit: number;
  cursor?: CursorPosition;
}

export interface WarehouseRepository {
  list(scope: Scope, query: WarehouseListQuery): Promise<Page<Warehouse>>;
  /** Out-of-scope or missing -> null. */
  get(scope: Scope, id: string): Promise<Warehouse | null>;
  /** Stages the create; throws ALREADY_EXISTS-style AlreadyExistsError on duplicate id. Scope is re-checked. */
  create(tx: Tx, scope: Scope, warehouse: Warehouse): void;
}

export class AlreadyExistsError extends Error {
  constructor(what: string) {
    super(`${what} already exists`);
    this.name = 'AlreadyExistsError';
  }
}

export interface SessionRepository {
  find(id: string): Promise<SessionRecord | null>;
  create(session: SessionRecord): Promise<void>;
  touch(id: string, at: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
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
}

// ---- strong authentication (A2) --------------------------------------------

export type StrongAuthRequirement = 'none' | 'totp' | 'pin';

/**
 * HOOK POINT ONLY (ADR §2.1 A2). TOTP / device PIN server code is provided by the project
 * owner later; dev writes none of it. The login flow asks this port after the password check.
 * Until the owner's implementation is plugged in, NoStrongAuth returns 'none'.
 */
export interface StrongAuthPort {
  requirementFor(user: User): Promise<StrongAuthRequirement>;
  verify(user: User, proof: string): Promise<boolean>;
}

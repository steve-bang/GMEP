/** SYS domain entities (FR-SYS-001, 005, 011, 012, 013). Pure data + invariants, no I/O. */
import { createHash } from 'node:crypto';

/** `invited`: created by an admin, not yet activated (cannot log in). */
export type UserStatus = 'invited' | 'active' | 'disabled';

/**
 * A User is a tenant MEMBERSHIP (FR-TEN-017): one identity (email + password, unique platform-wide) holds one
 * membership per tenant, each with its own roles, branches, status and revocation. `id` is the membership id.
 * For the first membership of an identity the id equals the identity-provider uid (and `identityId` may be absent,
 * as in data created before MT-0); a membership added later through an invitation has its own id.
 */
export interface User {
  id: string;
  /** identity-provider uid; absent = same as `id` (see {@link identityOf}) */
  identityId?: string;
  tenantId: string;
  email: string;
  /** Mã nhân viên; unique per company, immutable (BA §1.6). Stored normalised (upper-case, no spaces). */
  employeeCode: string;
  displayName: string;
  /** Staff contact phone: personal data, masked by PiiPolicy in every serializer (NFR-SEC-03). */
  phone?: string;
  status: UserStatus;
  /**
   * FR-TEN-017 / RULE-034: the person's agreement to THIS tenant's usage rules, recorded when the membership is accepted.
   * A membership added to an existing identity stays `invited` until it exists.
   */
  policyConsent?: { acceptedAt: Date; policyVersion: string };
  /** last successful sign-in (G4-SYS-01 column); absent until the first login */
  lastLoginAt?: Date;
  /**
   * P2-C (phase-2-plan 14.4, owner decision 07/11/2026): `employee_code` = staff member without an email who signs in
   * with company code + employee code + password. `email` is then empty, the account has exactly one membership, no
   * self-service recovery, and the identity-provider address is {@link workerLoginAddress} (never shown). Absent = email.
   */
  loginKind?: LoginKind;
  /** a manager set a temporary password: the next sign-in only allows changing it (P2-C) */
  mustChangePassword?: boolean;
  /** the temporary password stops working after this instant (configuration `tempPasswordTtlMs`) */
  tempPasswordExpiresAt?: Date | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export type LoginKind = 'email' | 'employee_code';

/**
 * P2-C: reserved domain of the internal sign-in address of staff without an email. `.invalid` (RFC 2606) never receives
 * mail, so no recovery mail can ever be sent and the address can never collide with a real one.
 */
export const WORKER_LOGIN_DOMAIN = 'workers.gmep.invalid';

/**
 * Internal identity-provider address of an `employee_code` account: derived from (tenant code, employee code), both
 * immutable, hashed so the address reveals neither. Server-side only: never in a DTO, a log or an audit entry.
 */
export function workerLoginAddress(tenantId: string, employeeCode: string): string {
  const h = createHash('sha256')
    .update(`${tenantId}\u0000${normalizeEmployeeCode(employeeCode)}`)
    .digest('hex')
    .slice(0, 40);
  return `w-${h}@${WORKER_LOGIN_DOMAIN}`;
}

/** Address used at the identity provider for this membership. */
export const loginAddressOf = (
  u: Pick<User, 'tenantId' | 'email' | 'employeeCode' | 'loginKind'>,
) => (u.loginKind === 'employee_code' ? workerLoginAddress(u.tenantId, u.employeeCode) : u.email);

/** Addresses nobody may register or invite: the reserved `.invalid` top-level domain (P2-C). */
export const isReservedLoginEmail = (email: string): boolean => /\.invalid$/i.test(email.trim());

/** Company code typed at the employee-code sign-in = the immutable tenant code, compared case-insensitively (FR-TEN-001). */
export const normalizeCompanyCode = (code: string): string => code.trim().toLowerCase();

/**
 * FR-SYS-011 + BA §5: `closing` = "Ngừng nhận lệnh mới", `locked` = read only. The behaviour per
 * state is configuration (domain/branchState.ts), not scattered conditions.
 */
export type BranchStatus = 'active' | 'closing' | 'locked';

export interface Branch {
  id: string;
  tenantId: string;
  /** MÃCN: 2-4 chars, immutable once documents are numbered (BA §6.2.4). */
  code: string;
  name: string;
  status: BranchStatus;
  /** Opening hours / contact: group C fields that a branch manager may edit (BA §2.3). */
  hours?: string;
  contact?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export interface Role {
  code: string;
  name: string;
  permissions: readonly string[];
  /** May view consolidated (all permitted branches) data; others must pick one branch (BA §4). */
  canConsolidate: boolean;
  /** ids of the permission top-ups already applied to this role (R30 / R21) */
  appliedTopUps?: readonly string[];
}

export interface RoleAssignmentRecord {
  id: string;
  userId: string;
  tenantId: string;
  roleCode: string;
  /** branch id or '*' */
  branchId: string;
  /** denormalised immutable employee code: the sort key of branch-scoped user lists (Firestore skips documents without the order field) */
  employeeCode: string;
  createdAt: Date;
  createdBy: string;
}

/** Role definitions are per tenant (FR-TEN-009): the document id carries the tenant, so two tenants may use the same code. */
export const roleDocId = (tenantId: string, code: string): string => `${tenantId}__${code}`;

export const roleAssignmentId = (userId: string, roleCode: string, branchId: string): string =>
  `ra_${userId}_${roleCode}_${branchId === '*' ? 'all' : branchId}`;

export type WarehouseStatus = 'active' | 'inactive';

/** FR-SYS-005: branch configuration includes its warehouses (Company -> Branch -> Warehouse). */
export interface Warehouse {
  id: string;
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  /** diacritics-free lower-case name for prefix search */
  nameNorm: string;
  status: WarehouseStatus;
  note?: string;
  isDefault: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export const WAREHOUSE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

/**
 * Deterministic id: the business key (branch, code) is unique by construction, so a duplicate
 * create fails atomically even under concurrency (no read-then-write race).
 */
export function warehouseId(branchId: string, code: string): string {
  return `wh_${branchId}_${code}`;
}

export const BRANCH_CODE_PATTERN = /^[A-Z0-9]{2,4}$/;

/** Normalised employee code (upper-case, no spaces), as stored. */
export const EMPLOYEE_CODE_PATTERN = /^[A-Z0-9._-]{2,20}$/;

/** Employee codes: compared case-insensitively, whitespace stripped (BA §1.6). */
export function normalizeEmployeeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

export const identityOf = (u: Pick<User, 'id' | 'identityId'>): string => u.identityId ?? u.id;

export interface SessionRecord {
  /** random session id (not derived from the cookie) */
  id: string;
  /**
   * Membership id the session is bound to (RULE-026: exactly one tenant). Empty while the session waits for the
   * "Chọn công ty" step (`tenantId === null`): such a session reads no business data at all.
   */
  userId: string;
  /** identity-provider uid of the person; absent in sessions created before MT-0 (= userId) */
  identityId?: string;
  /** tenant of the membership; null = tenant not chosen yet; absent in sessions created before MT-0 */
  tenantId?: string | null;
  /** membership ids the person may switch to, fixed at sign-in (a membership added later needs a new sign-in) */
  memberships?: string[];
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  /** Working branch chosen in the scope picker (BA §4); null = consolidated (CH/QV only). */
  workingBranchId: string | null;
  /** short, non-identifying description for the admin session list */
  device: string;
  /** P2-C: signed in with a temporary password; reads no business data until the password is changed */
  passwordChangeRequired?: boolean;
}

export type AuthTokenKind = 'reset' | 'invite';

export interface AuthToken {
  /** sha256 of the raw token; the raw token exists only in the email link */
  id: string;
  kind: AuthTokenKind;
  userId: string;
  tenantId: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

export type NotificationKind =
  | 'config.pending'
  | 'config.approved'
  | 'config.rejected'
  | 'user.invited'
  | 'security.anomaly'
  | 'stock.reservation_shortened'
  | 'crm.odometer_abnormal'
  | 'crm.lookup_limit'
  | 'rec.quote_decided'
  | 'rec.quote_expiring'
  | 'rec.order'
  | 'approval'
  | 'acc.cash'
  | 'ein.issue'
  | 'system';

/** FR-SYS-009: in-system notification. Never carries personal data (names, phones, addresses). */
export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  branchId: string | null;
  kind: NotificationKind;
  /** i18n key under `notifications.*` + non-personal params */
  titleKey: string;
  params: Record<string, string>;
  link: string | null;
  createdAt: Date;
  readAt: Date | null;
  /** TTL field: hidden after 30 days in the bell, deleted after 12 months (BA §8.1, configurable) */
  expiresAt: Date;
}

export interface ServiceItem {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  nameNorm: string;
  group: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export interface PriceListHeader {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  nameNorm: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** SYS domain entities (FR-SYS-001, 005, 011, 012, 013). Pure data + invariants, no I/O. */

/** `invited`: created by an admin, not yet activated (cannot log in). */
export type UserStatus = 'invited' | 'active' | 'disabled';

export interface User {
  id: string;
  companyId: string;
  email: string;
  /** Mã nhân viên; unique per company, immutable (BA §1.6). Stored normalised (upper-case, no spaces). */
  employeeCode: string;
  displayName: string;
  /** Staff contact phone: personal data, masked by PiiPolicy in every serializer (NFR-SEC-03). */
  phone?: string;
  status: UserStatus;
  /** last successful sign-in (G4-SYS-01 column); absent until the first login */
  lastLoginAt?: Date;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/**
 * FR-SYS-011 + BA §5: `closing` = "Ngừng nhận lệnh mới", `locked` = read only. The behaviour per
 * state is configuration (domain/branchState.ts), not scattered conditions.
 */
export type BranchStatus = 'active' | 'closing' | 'locked';

export interface Branch {
  id: string;
  companyId: string;
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

export interface Company {
  id: string;
  name: string;
  /** legal-entity ready: branches may later map to several legal entities (FR-SYS-018). */
  legalEntityIds: string[];
}

export interface Role {
  code: string;
  name: string;
  permissions: readonly string[];
  /** May view consolidated (all permitted branches) data; others must pick one branch (BA §4). */
  canConsolidate: boolean;
}

export interface RoleAssignmentRecord {
  id: string;
  userId: string;
  companyId: string;
  roleCode: string;
  /** branch id or '*' */
  branchId: string;
  /** denormalised immutable employee code: the sort key of branch-scoped user lists (Firestore skips documents without the order field) */
  employeeCode: string;
  createdAt: Date;
  createdBy: string;
}

export const roleAssignmentId = (userId: string, roleCode: string, branchId: string): string =>
  `ra_${userId}_${roleCode}_${branchId === '*' ? 'all' : branchId}`;

export type WarehouseStatus = 'active' | 'inactive';

/** FR-SYS-005: branch configuration includes its warehouses (Company -> Branch -> Warehouse). */
export interface Warehouse {
  id: string;
  companyId: string;
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

/** Employee codes: compared case-insensitively, whitespace stripped (BA §1.6). */
export function normalizeEmployeeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

export interface SessionRecord {
  /** random session id (not derived from the cookie) */
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  /** Working branch chosen in the scope picker (BA §4); null = consolidated (CH/QV only). */
  workingBranchId: string | null;
  /** short, non-identifying description for the admin session list */
  device: string;
}

export type AuthTokenKind = 'reset' | 'invite';

export interface AuthToken {
  /** sha256 of the raw token; the raw token exists only in the email link */
  id: string;
  kind: AuthTokenKind;
  userId: string;
  companyId: string;
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
  | 'system';

/** FR-SYS-009: in-system notification. Never carries personal data (names, phones, addresses). */
export interface Notification {
  id: string;
  companyId: string;
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
  companyId: string;
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
  companyId: string;
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

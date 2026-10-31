/** SYS domain entities (FR-SYS-001, 005, 011, 012, 013). Pure data + invariants, no I/O. */

export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  companyId: string;
  email: string;
  /** Mã nhân viên; unique per company. */
  employeeCode: string;
  displayName: string;
  status: UserStatus;
}

/** FR-SYS-011: a locked branch cannot create new documents but remains readable. */
export type BranchStatus = 'active' | 'locked';

export interface Branch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  status: BranchStatus;
}

export interface Role {
  code: string;
  name: string;
  permissions: readonly string[];
}

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

export interface SessionRecord {
  /** sha256 of the session cookie value */
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

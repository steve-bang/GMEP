import type { Page } from '../pagination/pagination';
import type { Scope } from '../scope/scope';
import type { Tx } from '../tx/unitOfWork';

/**
 * Append-only audit log (FR-SYS-003, plan §2.7). `record` stages the entry inside the SAME
 * transaction as the business change, so there is no change without a log line and no log
 * line for a rolled back change. There is deliberately no update/delete method.
 * Stores user ids, not names; personal data fields are reduced to "changed" markers
 * (sanitizeAuditValues, applied by the implementation, BA conflict resolution #2).
 */
export interface AuditEntry {
  id: string;
  at: Date;
  companyId: string;
  /** null for events that do not belong to one branch (e.g. login). */
  branchId: string | null;
  actorId: string;
  actorRoles: string[];
  entityType: string;
  entityId: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason?: string;
  requestId: string;
}

export interface AuditFilter {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  /** inclusive lower / exclusive upper bound on `at` */
  from?: Date;
  to?: Date;
}

export interface AuditLog {
  record(tx: Tx, entry: AuditEntry): void;
  /**
   * Read side, scope-limited, newest first. Entries with branchId null are visible to 'all'
   * scopes only (company-level events).
   */
  list(
    scope: Scope,
    filter: AuditFilter,
    page: { limit: number; cursor?: { v: string; id: string } },
  ): Promise<Page<AuditEntry>>;
}

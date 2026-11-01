import { AppError } from '@/platform/errors/errors';
import type { BranchStatus } from './entities';

/**
 * Branch state behaviour table (FR-SYS-011, ba-answers-for-dev §5). [Đề xuất BA - chờ xác nhận:
 * Chủ dự án]: the three states and this table are PROPOSALS and live as configuration so that a
 * client decision changes data, not scattered conditions. One guard (assertBranchWritable) is
 * used by every write path instead of per-use-case checks.
 */
export type WriteKind =
  | 'new_order' // appointment, quote, repair order
  | 'edit_open_order' // edit/finish an open order, payment, stock issue and invoice of an open order
  | 'free_stock_doc' // stock documents not tied to an order
  | 'new_master' // new warehouse, new user, role assignment for the branch
  | 'edit_master'; // branch master data (configuration, warehouse name)

export type Allowance = boolean | 'admin_only';

export const BRANCH_STATE_RULES: Record<BranchStatus, Record<WriteKind, Allowance>> = {
  active: {
    new_order: true,
    edit_open_order: true,
    free_stock_doc: true,
    new_master: true,
    edit_master: true,
  },
  closing: {
    new_order: false,
    edit_open_order: true,
    free_stock_doc: false,
    new_master: false,
    edit_master: 'admin_only',
  },
  locked: {
    new_order: false,
    edit_open_order: false,
    free_stock_doc: false,
    new_master: false,
    edit_master: false,
  },
};

/** Roles regarded as administrators for `admin_only` rows (owner, system admin). */
export const BRANCH_ADMIN_ROLES: readonly string[] = ['CH', 'AD'];

export function assertBranchWritable(
  status: BranchStatus,
  kind: WriteKind,
  actorRoleCodes: readonly string[],
  rules: typeof BRANCH_STATE_RULES = BRANCH_STATE_RULES,
): void {
  const allowance = rules[status][kind];
  if (allowance === true) return;
  if (allowance === 'admin_only' && actorRoleCodes.some((r) => BRANCH_ADMIN_ROLES.includes(r)))
    return;
  throw new AppError(status === 'locked' ? 'branch_locked' : 'branch_closing', 409);
}

/** Allowed manual transitions. Re-opening is an owner decision (permission checked by the use case). */
export const BRANCH_TRANSITIONS: Record<BranchStatus, readonly BranchStatus[]> = {
  active: ['closing'],
  closing: ['active', 'locked'],
  locked: ['active'],
};

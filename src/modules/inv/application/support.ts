import { z } from 'zod';
import { AppError, forbidden, notFound, validationFailed } from '@/platform/errors/errors';
import { type StoredResponse } from '@/platform/idempotency/idempotency';
import { requireWorkingBranch, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  assertBranchWritable,
  auditEntry,
  parseInput,
  roleCodesOf,
  type Branch,
  type RequestCtx,
  type Warehouse,
  type WriteKind,
} from '@/modules/sys';
import { InvRuleError } from '../domain/ledger';
import type { InvDeps } from '../ports/deps';

export { auditEntry, parseInput, roleCodesOf, notFound, forbidden, AppError, z };
export type { RequestCtx, StoredResponse };

export const idemOf = (deps: InvDeps) => ({
  uow: deps.sys.uow,
  store: deps.sys.idempotency,
  now: () => deps.sys.clock.now(),
  ttlMs: deps.sys.config.idempotencyTtlMs,
});

export function versionConflict(): AppError {
  return new AppError('version_conflict', 409);
}

/** Rule codes that describe bad input rather than a conflicting state. */
const INPUT_ERRORS = new Set([
  'lines_required',
  'line_invalid',
  'source_invalid',
  'source_required',
]);

/** Domain rule violations become RFC 9457 errors with the Vietnamese texts of errors.<code>. */
export function guard<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof InvRuleError) {
      if (INPUT_ERRORS.has(e.code))
        throw validationFailed([
          {
            field: e.detail?.line !== undefined ? `lines.${Number(e.detail.line) - 1}` : 'lines',
            message: String(e.detail?.why ?? e.code),
          },
        ]);
      throw new AppError(e.code, 409);
    }
    throw e;
  }
}

/**
 * The branch a stock write lands in must be writable in its state (FR-SYS-011). Documents tied to
 * an order use `edit_open_order`; free stock documents (receipt, adjustment, retail issue) use
 * `free_stock_doc`.
 */
export async function assertWritable(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  branchId: string,
  kind: WriteKind,
): Promise<Branch> {
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw forbidden();
  const branch = await deps.sys.branches.getInTx(tx, scope, branchId);
  if (!branch) throw notFound();
  assertBranchWritable(branch.status, kind, roleCodesOf(actor), deps.sys.config.branchStateRules);
  return branch;
}

/** Target warehouse of a write: must exist in scope, belong to the working branch, and be active. */
export async function activeWarehouse(
  deps: InvDeps,
  tx: Tx,
  scope: Scope,
  warehouseId: string,
  branchId: string,
): Promise<Warehouse> {
  const w = await deps.sys.warehouses.getInTx(tx, scope, warehouseId);
  if (!w || w.branchId !== branchId) throw notFound();
  if (w.status !== 'active') throw new AppError('warehouse_inactive', 409);
  return w;
}

export { requireWorkingBranch };

/** Ids that travel in document keys (reservation ids, sources): no separators of our own key format. */
export const idToken = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{1,64}$/,
    'Chỉ gồm chữ không dấu, số, gạch ngang hoặc gạch dưới (tối đa 64 ký tự).',
  );

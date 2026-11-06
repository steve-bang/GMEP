import type { Actor } from '@/platform/rbac/rbac';
import type { OrderHistoryEntry, RepairOrder } from '../domain/order';
import { isOrderOpen, type OrderEvent, type OrderStatus } from '../domain/orderState';

/** Shared small pieces of the order use cases (kept apart so orders.ts and supplement.ts do not import each other). */

export const SYSTEM_ORDER_ACTOR = 'system:order';

/**
 * The actor of an order opened by the customer's own approval (no staff member is present). It has no
 * permissions of its own: it only carries the branch to the INV hold and the audit line (`actorType` system).
 */
export function systemActor(tenantId: string, branchId: string): Actor {
  return {
    userId: SYSTEM_ORDER_ACTOR,
    tenantId,
    displayName: 'Hệ thống',
    assignments: [{ roleCode: 'SYSTEM', branchId }],
    rolePermissions: { SYSTEM: [] },
    canConsolidate: false,
    workingBranchId: branchId,
  };
}

export const pushHistory = (
  history: readonly OrderHistoryEntry[],
  e: OrderHistoryEntry,
): OrderHistoryEntry[] => [...history, e].slice(-100);

/** Applies one order event inside the caller's transaction (reads already done); returns the patch. */
export function orderPatch(
  o: RepairOrder,
  event: OrderEvent,
  to: OrderStatus,
  by: string,
  now: Date,
  reason?: string,
): Record<string, unknown> {
  return {
    status: to,
    open: isOrderOpen(to),
    ...(event === 'pause' ? { pausedReason: reason ?? null } : { pausedReason: null }),
    ...(event === 'start' ? { startedAt: now } : {}),
    history: pushHistory(o.history, {
      from: o.status,
      to,
      event,
      at: now,
      by,
      ...(reason ? { reason } : {}),
    }),
    updatedAt: now,
    updatedBy: by,
    version: o.version + 1,
  };
}

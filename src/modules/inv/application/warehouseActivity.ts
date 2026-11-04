import type { WarehouseActivityPort } from '@/modules/sys';
import type { InvDeps } from '../ports/deps';

/**
 * FR-SYS-029 / UAT-31: a warehouse is deactivated only when on-hand, reserved and in-transit are all
 * zero and no draft stock document refers to it. Replaces the SYS stub (the owner of the facts is INV).
 * `getDeps` is late-bound because SYS is built before INV in the composition root.
 */
export function invWarehouseActivity(getDeps: () => InvDeps): WarehouseActivityPort {
  return {
    async blockers(w) {
      const deps = getDeps();
      const out: string[] = [];
      if (await deps.balances.hasStock(w.companyId, w.id))
        out.push('Kho còn tồn thực tế, hàng giữ chỗ hoặc hàng đang vận chuyển.');
      if (await deps.documents.hasOpen(w.companyId, w.id))
        out.push('Kho còn chứng từ nháp chưa xử lý.');
      return out;
    },
  };
}

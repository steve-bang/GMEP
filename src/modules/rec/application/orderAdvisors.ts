import type { OrderAdvisorPort } from '@/modules/inv';
import type { RecDeps } from '../ports/deps';

/**
 * I15 (INV port): who owns a repair order, so INV can tell the advisor when a stocktake cuts their hold.
 * Orders are looked up by id (the order id is the hold's source id); unknown ids are simply absent.
 */
export function recOrderAdvisors(getDeps: () => RecDeps): OrderAdvisorPort {
  return {
    async advisorsOf(tenantId, sourceType, sourceIds) {
      const out = new Map<string, string>();
      if (sourceType !== 'repair-order') return out;
      const orders = await getDeps().orders.getMany(tenantId, sourceIds);
      for (const o of orders) out.set(o.id, o.advisorId);
      return out;
    },
  };
}

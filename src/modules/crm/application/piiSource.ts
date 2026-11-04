import type { PiiSource } from '@/modules/sys';
import type { CrmDeps } from '../ports/deps';

/**
 * Registers customers with the "Hiện" endpoint (NFR-SEC-03). The SYS use case checks the PiiPolicy
 * level, the reason and writes the access log; this source only answers inside the actor's scope.
 */
export function customerPiiSource(crm: () => CrmDeps): PiiSource {
  return {
    permission: 'customer:view',
    async load(_deps, scope, id) {
      const deps = crm();
      const c = await deps.customers.get(scope, id);
      if (!c || c.status !== 'active') return null;
      const pii = await deps.customers.getPii(scope.companyId, id);
      return {
        branchId: c.branchId,
        values: {
          ...(pii?.phone ? { phone: pii.phone } : {}),
          ...(pii?.email ? { email: pii.email } : {}),
          ...(pii?.address ? { address: pii.address } : {}),
        },
      };
    },
  };
}

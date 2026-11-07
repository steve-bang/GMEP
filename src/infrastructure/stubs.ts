import { RETENTION_UNVERIFIED, type CustomerRetentionPort } from '@/modules/crm';
import type { OrderAdvisorPort } from '@/modules/inv';
import type { BranchActivityPort } from '@/modules/sys';

/**
 * STUBS until the owning modules exist. The warehouse guard is real since slice 1.4 (INV);
 * REC/ACC/EIN will report open orders, unclosed receipts and failed invoices.
 * TODO(slice 1.7/1.8): replace; tests/integration/admin.test.ts holds the pending (todo) tests.
 */
export const stubBranchActivity: BranchActivityPort = { blockers: async () => [] };
/**
 * C17: the real gate is the CONJUNCTION of every owning module's check. Blockers add up, `retained`
 * adds up, and the result is verified only when every part verified. Modules not built yet contribute
 * the stub below (unverified), so the gate stays closed until the last module is connected.
 */
export function combineRetention(...parts: CustomerRetentionPort[]): CustomerRetentionPort {
  return {
    async check(tenantId, customerId) {
      const rs = await Promise.all(parts.map((p) => p.check(tenantId, customerId)));
      return {
        verified: rs.every((r) => r.verified),
        blockers: rs.flatMap((r) => r.blockers),
        retained: rs.flatMap((r) => r.retained),
      };
    },
  };
}

/** C4: fails closed (verified=false) so a delete request cannot complete until the real gate exists. REC reports open intakes and pending quotes since 1.5 (C17); TODO(slice 1.6-1.9): open orders and warranty (REC), outstanding debt (ACC), issued invoices (EIN) (FR-CRM-011) - this stub stands for the modules not connected yet. */
export const stubCustomerRetention: CustomerRetentionPort = {
  check: async () => RETENTION_UNVERIFIED,
};

/** I15: no repair order exists before slice 1.6, so no advisor can be named; only the branch manager is told. */
export const noOrderAdvisors: OrderAdvisorPort = { advisorsOf: async () => new Map() };

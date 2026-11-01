import type { BranchActivityPort, WarehouseActivityPort } from '@/modules/sys';

/**
 * STUBS until the owning modules exist. INV will report on-hand/reserved/in-transit and open
 * stock documents; REC/ACC/EIN will report open orders, unclosed receipts and failed invoices.
 * TODO(slice 1.4/1.7/1.8): replace; tests/integration/lifecycle-guards.test.ts holds the
 * pending (todo) tests that must go green with the real adapters.
 */
export const stubWarehouseActivity: WarehouseActivityPort = { blockers: async () => [] };
export const stubBranchActivity: BranchActivityPort = { blockers: async () => [] };

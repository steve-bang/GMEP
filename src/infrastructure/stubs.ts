import { NO_RETENTION, type CustomerRetentionPort } from '@/modules/crm';
import type { BranchActivityPort } from '@/modules/sys';

/**
 * STUBS until the owning modules exist. The warehouse guard is real since slice 1.4 (INV);
 * REC/ACC/EIN will report open orders, unclosed receipts and failed invoices.
 * TODO(slice 1.7/1.8): replace; tests/integration/admin.test.ts holds the pending (todo) tests.
 */
export const stubBranchActivity: BranchActivityPort = { blockers: async () => [] };
/** TODO(slice 1.7/1.9): REC reports open orders and warranty, ACC outstanding debt, EIN issued invoices (FR-CRM-011). */
export const stubCustomerRetention: CustomerRetentionPort = { check: async () => NO_RETENTION };

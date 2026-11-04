import { NO_RETENTION, type CustomerRetentionPort } from '@/modules/crm';
import type { RecDeps } from '../ports/deps';

/**
 * C17 (BA §17): REC's part of the data-retention gate for a delete request (FR-CRM-011, RULE-010).
 * It blocks while the customer has an intake file that is not finished (draft) or a quote waiting for
 * the customer's decision (a deposit hangs on the quote when payments exist). Repair orders, payments,
 * invoices and warranty join from slice 1.6 on; until then the combined gate in the composition root
 * stays `unverified`, so nothing is deleted automatically (C4 fails closed).
 */
const LIMIT = 50;

export function recCustomerRetention(getDeps: () => RecDeps): CustomerRetentionPort {
  return {
    async check(companyId, customerId) {
      const d = getDeps();
      const [drafts, sent] = await Promise.all([
        d.intakes.listByCustomer(companyId, customerId, 'draft', LIMIT),
        d.quotes.listByCustomer(companyId, customerId, 'sent', LIMIT),
      ]);
      const blockers = [
        ...(drafts.length ? [`Có ${drafts.length} hồ sơ tiếp nhận chưa hoàn tất.`] : []),
        ...(sent.length ? [`Có ${sent.length} báo giá đang chờ khách duyệt.`] : []),
      ];
      return { ...NO_RETENTION, blockers };
    },
  };
}

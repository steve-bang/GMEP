import { NO_RETENTION, type CustomerRetentionPort } from '@/modules/crm';
import type { RecDeps } from '../ports/deps';

/**
 * C17 (BA §17): REC's part of the data-retention gate for a delete request (FR-CRM-011, RULE-010).
 * It blocks while the customer has an intake file that is not finished (draft) or a quote waiting for
 * the customer's decision (a deposit hangs on the quote when payments exist). Open repair orders join since slice 1.6; payments,
 * invoices and warranty join later; until then the combined gate in the composition root
 * stays `unverified`, so nothing is deleted automatically (C4 fails closed).
 */
const LIMIT = 50;

export function recCustomerRetention(getDeps: () => RecDeps): CustomerRetentionPort {
  return {
    async check(tenantId, customerId) {
      const d = getDeps();
      const [drafts, sent, orders] = await Promise.all([
        d.intakes.listByCustomer(tenantId, customerId, 'draft', LIMIT),
        d.quotes.listByCustomer(tenantId, customerId, 'sent', LIMIT),
        // slice 1.6: a repair order that is not finished or cancelled is the source document of work in progress
        d.orders.listOpenByCustomer(tenantId, customerId, LIMIT),
      ]);
      const blockers = [
        ...(drafts.length ? [`Có ${drafts.length} hồ sơ tiếp nhận chưa hoàn tất.`] : []),
        ...(sent.length ? [`Có ${sent.length} báo giá đang chờ khách duyệt.`] : []),
        ...(orders.length
          ? [`Có ${orders.length} lệnh sửa chữa chưa hoàn tất hoặc chưa hủy.`]
          : []),
      ];
      return { ...NO_RETENTION, blockers };
    },
  };
}

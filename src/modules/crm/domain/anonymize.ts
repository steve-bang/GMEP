import { normalizeSearch } from '@/platform/text/normalize';
import type { Customer } from './entities';

/**
 * Anonymisation on a customer-delete request (FR-CRM-011). Contact data (phone, email, address) is
 * erased; the business record keeps its id, code, ownership history and counters so repair and
 * accounting history stay consistent. The display name is replaced. Legal-entity data of a business
 * customer (name, tax code) that appears on issued invoices must stay: the retention check decides
 * `keepLegalIdentity` [Cần xác nhận: Luật sư khách].
 */
export const ANONYMIZED_NAME = 'Khách đã ẩn danh';

export function anonymizedPatch(
  c: Pick<Customer, 'taxCode' | 'name' | 'nameNorm'>,
  keepLegalIdentity: boolean,
) {
  return {
    name: keepLegalIdentity ? c.name : ANONYMIZED_NAME,
    nameNorm: keepLegalIdentity ? c.nameNorm : normalizeSearch(ANONYMIZED_NAME),
    labels: [] as Customer['labels'],
    marketing: [] as string[],
    status: 'anonymized' as const,
    ...(keepLegalIdentity ? {} : { taxCode: null, contactName: null }),
  };
}

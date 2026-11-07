import type { Customer } from './entities';

/**
 * FR-CRM-003 (slice 2.8b): merging two records of the same customer. Nothing is deleted (BR-CRM-01): the source record
 * stays, marked `merged` with a pointer to the target; its documents (quotes, orders, payments, invoices, consents) keep
 * pointing at it, so posted financial records are never rewritten (RULE-010). Its current vehicles move to the target
 * through ordinary ownership records (the history of each vehicle shows the change). Both records get an audit entry.
 */
export type MergeRefusal =
  'merge_same_customer' | 'merge_not_active' | 'merge_type_mismatch' | 'merge_tax_code_mismatch';

export function checkMerge(
  target: Pick<Customer, 'id' | 'status' | 'type' | 'taxCode'>,
  source: Pick<Customer, 'id' | 'status' | 'type' | 'taxCode'>,
): MergeRefusal | null {
  if (target.id === source.id) return 'merge_same_customer';
  if (target.status !== 'active' || source.status !== 'active') return 'merge_not_active';
  if (target.type !== source.type) return 'merge_type_mismatch';
  // two different tax codes are two legal entities, never one customer
  if (target.taxCode && source.taxCode && target.taxCode !== source.taxCode)
    return 'merge_tax_code_mismatch';
  return null;
}

/** Branch relations of the merged record: the union, target first, no duplicates. */
export const mergedBranchIds = (target: readonly string[], source: readonly string[]): string[] => [
  ...new Set([...target, ...source]),
];

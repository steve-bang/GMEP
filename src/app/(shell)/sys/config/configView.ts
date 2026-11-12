import {
  CONFIG_DESCRIPTORS,
  type ConfigVersionDto,
  type DescribeT,
  type FieldDef,
} from '@/modules/sys';

export type ViewStatus = 'pending' | 'rejected' | 'current' | 'upcoming' | 'superseded';

/**
 * Display status of a version (G4-SYS-10): "Hiện hành" is the approved version with the greatest
 * effective date not after today; a later approved one is "Sắp hiệu lực"; older approved ones are
 * "Hết hiệu lực". Computed per scope key from the versions on the page; the domain only stores
 * pending / approved / rejected. (There is no draft state in the domain: see open questions.)
 */
export function viewStatuses(
  versions: readonly ConfigVersionDto[],
  today: string,
): Map<string, ViewStatus> {
  const current = new Map<string, string>(); // scopeKey -> effectiveFrom of the current version
  for (const v of versions)
    if (v.status === 'approved' && v.effectiveFrom <= today) {
      const c = current.get(v.scopeKey);
      if (!c || v.effectiveFrom > c) current.set(v.scopeKey, v.effectiveFrom);
    }
  const out = new Map<string, ViewStatus>();
  for (const v of versions) {
    if (v.status === 'pending') out.set(v.id, 'pending');
    else if (v.status === 'rejected') out.set(v.id, 'rejected');
    else if (v.effectiveFrom > today) out.set(v.id, 'upcoming');
    else out.set(v.id, current.get(v.scopeKey) === v.effectiveFrom ? 'current' : 'superseded');
  }
  return out;
}

export const STATUS_TONE: Record<
  ViewStatus,
  'warning' | 'danger' | 'success' | 'info' | 'neutral'
> = {
  pending: 'warning',
  rejected: 'danger',
  current: 'success',
  upcoming: 'info',
  superseded: 'neutral',
};

/** Human-readable value of a version payload: never raw JSON. Reads the type's descriptor. */
export function describeValue(t: DescribeT, type: string, p: Record<string, unknown>): string {
  return CONFIG_DESCRIPTORS[type]?.describe?.(t, p) ?? '';
}

export type { FieldDef };

/** Payload fields per type (the server validates with the type's zod schema); derived from the descriptors. */
export const PAYLOAD_FIELDS: Record<string, FieldDef[]> = Object.fromEntries(
  Object.entries(CONFIG_DESCRIPTORS).flatMap(([type, d]) => (d.fields ? [[type, d.fields]] : [])),
);

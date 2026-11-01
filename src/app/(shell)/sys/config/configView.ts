import { formatVnd } from '@/platform/format/vnd';
import { formatBp } from '@/platform/format/percent';
import { ROLE_NAMES, type ConfigVersionDto } from '@/modules/sys';

type T = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
};

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

const hours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h} giờ ${m} phút` : h ? `${h} giờ` : `${m} phút`;
};

/** Human-readable value of a version payload: never raw JSON. */
export function describeValue(t: T, type: string, p: Record<string, unknown>): string {
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');
  const enumLabel = (group: string, v: string) =>
    t.has(`config.enums.${group}.${v}`) ? t(`config.enums.${group}.${v}`) : v;
  switch (type) {
    case 'tax-rate':
      return `${str('name')} · ${num('rateBp') !== null ? formatBp(num('rateBp')!) : ''}`;
    case 'labor-rate':
      return num('hourlyRateVnd') !== null
        ? t('config.perHour', { amount: formatVnd(num('hourlyRateVnd')!) })
        : '';
    case 'standard-hours':
      return num('standardMinutes') !== null ? hours(num('standardMinutes')!) : '';
    case 'discount-limit': {
      const m = (p.maxDiscountBpByRole ?? {}) as Record<string, number>;
      return Object.entries(m)
        .map(([r, bp]) => `${ROLE_NAMES[r as keyof typeof ROLE_NAMES] ?? r}: ${formatBp(bp)}`)
        .join('; ');
    }
    case 'price-item':
      return [
        str('name'),
        num('costVnd') !== null ? t('config.cost', { amount: formatVnd(num('costVnd')!) }) : null,
        num('listPriceVnd') !== null
          ? t('config.listPrice', { amount: formatVnd(num('listPriceVnd')!) })
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'doc-template':
      return `${str('name')} · ${enumLabel('kind', str('kind'))} · ${enumLabel('paper', str('paper'))}`;
    case 'numbering-series':
      return [
        t('config.prefixValue', { prefix: str('prefix') }),
        enumLabel('group', str('group')),
        enumLabel('gapPolicy', str('gapPolicy')),
        enumLabel('scope', str('scope')),
        enumLabel('period', str('period')),
        t('config.widthValue', { width: num('seqWidth') ?? 0 }),
      ].join(' · ');
    default:
      return '';
  }
}

export interface FieldDef {
  name: string;
  kind: 'text' | 'vnd' | 'int' | 'percent' | 'select';
  /** select options; label keys resolve under config.enums.<name> */
  options?: string[];
}

/** Payload fields per type (the server validates with the type's zod schema). */
export const PAYLOAD_FIELDS: Record<string, FieldDef[]> = {
  'tax-rate': [
    { name: 'name', kind: 'text' },
    { name: 'rateBp', kind: 'percent' },
  ],
  'labor-rate': [{ name: 'hourlyRateVnd', kind: 'vnd' }],
  'standard-hours': [{ name: 'standardMinutes', kind: 'int' }],
  'discount-limit': [
    { name: 'role', kind: 'select' }, // options = role codes, filled by the page
    { name: 'maxBp', kind: 'percent' },
  ],
  'price-item': [
    { name: 'name', kind: 'text' },
    { name: 'costVnd', kind: 'vnd' },
    { name: 'listPriceVnd', kind: 'vnd' },
  ],
  'doc-template': [
    { name: 'name', kind: 'text' },
    {
      name: 'kind',
      kind: 'select',
      options: [
        'quote',
        'repair-order',
        'receipt',
        'stock-doc',
        'handover',
        'notification',
        'other',
      ],
    },
    { name: 'paper', kind: 'select', options: ['A4', 'A5', 'thermal80', 'thermal58'] },
  ],
  'numbering-series': [
    { name: 'prefix', kind: 'text' },
    { name: 'group', kind: 'select', options: ['A', 'B'] },
    { name: 'gapPolicy', kind: 'select', options: ['strict', 'relaxed'] },
    { name: 'scope', kind: 'select', options: ['branch', 'legalEntity'] },
    { name: 'period', kind: 'select', options: ['month', 'year', 'none'] },
    { name: 'seqWidth', kind: 'int' },
  ],
};

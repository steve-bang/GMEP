import { formatVnd } from '@/platform/format/vnd';
import { formatBp } from '@/platform/format/percent';
import type { PayloadShape } from '@/platform/config/payloadShape';
import { ROLE_NAMES } from './permissions';

/**
 * One descriptor per effective-dated config type (FR-SYS-004, NFR-MNT-01): the form fields, the menu group, the
 * human-readable value and the form-to-payload shape live here and nowhere else, so the form, the version table,
 * the menu and the guard test all read the same place. It carries NO business number: every value shown comes from
 * the version payload. Labels are i18n keys resolved by the caller's `t` (domain never imports i18n).
 */
export type DescribeT = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
};

/** Menu groups of the settings area (docs/dev/config-upgrade-plan.md, phase 2); label key `config.groups.<id>`. */
export const CONFIG_GROUPS = [
  'pricing',
  'service',
  'appointment',
  'labor',
  'finance',
  'inventory',
  'system',
] as const;
export type ConfigGroup = (typeof CONFIG_GROUPS)[number];

export interface FieldDef {
  name: string;
  kind: 'text' | 'vnd' | 'int' | 'percent' | 'select' | 'bool';
  /** select options; label keys resolve under config.enums.<name> */
  options?: string[];
}

export interface ConfigDescriptor {
  group: ConfigGroup;
  /** flat form fields; absent = the type has no form yet (API only) */
  fields?: FieldDef[];
  /** how form values become the API payload; absent = the values as typed */
  payloadShape?: PayloadShape;
  /** readable value of a version payload: never raw JSON, never a secret */
  describe?: (t: DescribeT, payload: Record<string, unknown>) => string;
}

const hours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h} giờ ${m} phút` : h ? `${h} giờ` : `${m} phút`;
};

const active = [
  { name: 'name', kind: 'text' },
  { name: 'status', kind: 'select', options: ['active', 'inactive'] },
] satisfies FieldDef[];
const reasonFields = [
  ...active,
  { name: 'party', kind: 'select', options: ['customer', 'garage', 'other'] },
  // FR-REC-045/046: the schema and checkReason support it; without this field a proposed version silently drops it
  { name: 'noteRequired', kind: 'bool' },
  { name: 'order', kind: 'int' },
] satisfies FieldDef[];

const nameStatus: ConfigDescriptor['describe'] = (t, p) =>
  `${str(p, 'name')} · ${enumLabel(t, 'status', str(p, 'status'))}`;
const reasonValue: ConfigDescriptor['describe'] = (t, p) =>
  [
    str(p, 'name'),
    enumLabel(t, 'status', str(p, 'status')),
    p.noteRequired === true ? t('config.fields.noteRequired') : null,
  ]
    .filter(Boolean)
    .join(' · ');

function num(p: Record<string, unknown>, k: string): number | null {
  return typeof p[k] === 'number' ? (p[k] as number) : null;
}
function str(p: Record<string, unknown>, k: string): string {
  return typeof p[k] === 'string' ? (p[k] as string) : '';
}
function enumLabel(t: DescribeT, group: string, v: string): string {
  return t.has(`config.enums.${group}.${v}`) ? t(`config.enums.${group}.${v}`) : v;
}

export const CONFIG_DESCRIPTORS: Record<string, ConfigDescriptor> = {
  'tax-rate': {
    group: 'pricing',
    fields: [
      { name: 'name', kind: 'text' },
      { name: 'rateBp', kind: 'percent' },
    ],
    describe: (_t, p) =>
      `${str(p, 'name')} · ${num(p, 'rateBp') !== null ? formatBp(num(p, 'rateBp')!) : ''}`,
  },
  'tax-mapping': {
    group: 'pricing',
    fields: [
      { name: 'labor', kind: 'text' },
      { name: 'part', kind: 'text' },
    ],
    describe: (t, p) =>
      `${t('config.fields.labor')}: ${str(p, 'labor')} · ${t('config.fields.part')}: ${str(p, 'part')}`,
  },
  'price-item': {
    group: 'pricing',
    fields: [
      { name: 'name', kind: 'text' },
      { name: 'costVnd', kind: 'vnd' },
      { name: 'listPriceVnd', kind: 'vnd' },
    ],
    describe: (t, p) =>
      [
        str(p, 'name'),
        num(p, 'costVnd') !== null
          ? t('config.cost', { amount: formatVnd(num(p, 'costVnd')!) })
          : null,
        num(p, 'listPriceVnd') !== null
          ? t('config.listPrice', { amount: formatVnd(num(p, 'listPriceVnd')!) })
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
  },
  'discount-limit': {
    group: 'pricing',
    fields: [
      { name: 'role', kind: 'select' }, // options = role codes, filled by the page
      { name: 'maxBp', kind: 'percent' },
    ],
    // the form edits one role at a time; the API payload is the per-role map
    payloadShape: {
      groupBy: { into: 'maxDiscountBpByRole', keyField: 'role', valueField: 'maxBp' },
    },
    describe: (_t, p) => {
      const m = (p.maxDiscountBpByRole ?? {}) as Record<string, number>;
      return Object.entries(m)
        .map(([r, bp]) => `${ROLE_NAMES[r as keyof typeof ROLE_NAMES] ?? r}: ${formatBp(bp)}`)
        .join('; ');
    },
  },
  'cost-method': {
    group: 'pricing',
    fields: [{ name: 'method', kind: 'select', options: ['weighted-average'] }],
    describe: (t, p) => enumLabel(t, 'costMethod', str(p, 'method')),
  },
  'labor-rate': {
    group: 'pricing',
    fields: [{ name: 'hourlyRateVnd', kind: 'vnd' }],
    describe: (t, p) =>
      num(p, 'hourlyRateVnd') !== null
        ? t('config.perHour', { amount: formatVnd(num(p, 'hourlyRateVnd')!) })
        : '',
  },
  'standard-hours': {
    group: 'pricing',
    fields: [{ name: 'standardMinutes', kind: 'int' }],
    describe: (_t, p) =>
      num(p, 'standardMinutes') !== null ? hours(num(p, 'standardMinutes')!) : '',
  },
  'service-type': { group: 'service', fields: active, describe: nameStatus },
  'service-package': { group: 'service' },
  'service-workflow': {
    group: 'service',
    describe: (t, p) => {
      const steps = Array.isArray(p.steps) ? (p.steps as { name?: string }[]) : [];
      return t('config.stepsValue', {
        n: steps.length,
        names: steps.map((x) => x.name ?? '').join(', '),
      });
    },
  },
  'qc-checklist': { group: 'service' },
  'evidence-kind': { group: 'service', fields: active, describe: nameStatus },
  'decline-reason': { group: 'service', fields: active, describe: nameStatus },
  'quote-approval': {
    group: 'service',
    describe: (t, p) =>
      t('config.quoteApprovalValue', {
        decline: t(p.allowDeclineRequired === false ? 'config.no' : 'config.yes'),
        verbal: t(p.verbalApproval === false ? 'config.no' : 'config.yes'),
        otp:
          p.otpMode === 'always'
            ? t('config.otpAlways')
            : p.otpMode === 'above_threshold'
              ? t('config.otpAbove', { amount: formatVnd(num(p, 'otpThresholdVnd') ?? 0) })
              : t('config.otpOff'),
      }),
  },
  'order-policy': { group: 'service' },
  'appointment-policy': { group: 'appointment' },
  'appointment-cancel-reason': {
    group: 'appointment',
    fields: reasonFields,
    describe: reasonValue,
  },
  'appointment-reschedule-reason': {
    group: 'appointment',
    fields: reasonFields,
    describe: reasonValue,
  },
  'warranty-term': { group: 'appointment' },
  'warranty-policy': { group: 'appointment' },
  'labor-method': { group: 'labor' },
  'labor-position': { group: 'labor' },
  'labor-policy': { group: 'labor' },
  'work-hours': { group: 'labor' },
  'acc-policy': { group: 'finance' },
  'approval-limit': { group: 'finance' },
  'expense-category': { group: 'finance' },
  'einvoice-issuer': { group: 'finance' },
  'einvoice-policy': { group: 'finance' },
  'inventory-policy': {
    group: 'inventory',
    fields: [
      { name: 'grnPriceVarianceBp', kind: 'percent' },
      { name: 'grnQtyVarianceBp', kind: 'percent' },
    ],
    describe: (t, p) =>
      t('config.grnVariance', {
        price: num(p, 'grnPriceVarianceBp') !== null ? formatBp(num(p, 'grnPriceVarianceBp')!) : '',
        qty: num(p, 'grnQtyVarianceBp') !== null ? formatBp(num(p, 'grnQtyVarianceBp')!) : '',
      }),
  },
  'part-group': { group: 'inventory', fields: active, describe: nameStatus },
  'part-unit': { group: 'inventory', fields: active, describe: nameStatus },
  'doc-template': {
    group: 'system',
    fields: [
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
    describe: (t, p) =>
      `${str(p, 'name')} · ${enumLabel(t, 'kind', str(p, 'kind'))} · ${enumLabel(t, 'paper', str(p, 'paper'))}`,
  },
  'numbering-series': {
    group: 'system',
    fields: [
      { name: 'prefix', kind: 'text' },
      { name: 'group', kind: 'select', options: ['A', 'B'] },
      { name: 'gapPolicy', kind: 'select', options: ['strict', 'relaxed'] },
      { name: 'scope', kind: 'select', options: ['branch', 'legalEntity'] },
      { name: 'period', kind: 'select', options: ['month', 'year', 'none'] },
      { name: 'seqWidth', kind: 'int' },
    ],
    // a reversal keeps the series of the document it reverses; the form has no switch for it
    payloadShape: { constants: { reversalSameSeries: true } },
    describe: (t, p) =>
      [
        t('config.prefixValue', { prefix: str(p, 'prefix') }),
        enumLabel(t, 'group', str(p, 'group')),
        enumLabel(t, 'gapPolicy', str(p, 'gapPolicy')),
        enumLabel(t, 'scope', str(p, 'scope')),
        enumLabel(t, 'period', str(p, 'period')),
        t('config.widthValue', { width: num(p, 'seqWidth') ?? 0 }),
      ].join(' · '),
  },
  'public-rate-limit': { group: 'system' },
  'tenant-limits': { group: 'system' },
  'report-policy': { group: 'system' },
  'branch-groups': { group: 'system' },
  'catalog-release': { group: 'system' },
};

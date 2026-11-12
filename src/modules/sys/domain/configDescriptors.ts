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

/** Joins the non-empty pieces of a value description. */
const parts = (...xs: string[]) => xs.filter(Boolean).join(' · ');
const int = (n: number | null): string =>
  n === null ? '' : new Intl.NumberFormat('vi-VN').format(n);
const vnd = (n: number | null): string => (n === null ? '' : formatVnd(n));
const arr = <T>(p: Record<string, unknown>, k: string): T[] =>
  Array.isArray(p[k]) ? (p[k] as T[]) : [];
const yn = (t: DescribeT, v: unknown) => t(v === true ? 'config.value.yes' : 'config.value.no');
/** minute of the day -> HH:MM (1440 = 24:00) */
const clock = (m: number | null): string =>
  m === null
    ? ''
    : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

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
  'service-package': {
    group: 'service',
    describe: (t, p) => {
      const items = arr<{ necessity?: string; lines?: unknown[] }>(p, 'items');
      return parts(
        str(p, 'name'),
        enumLabel(t, 'status', str(p, 'status')),
        str(p, 'serviceType')
          ? t('config.value.serviceTypeOf', { code: str(p, 'serviceType') })
          : '',
        t('config.value.servicePackage', {
          items: int(items.length),
          required: int(items.filter((x) => x.necessity === 'required').length),
          lines: int(items.reduce((n, x) => n + (Array.isArray(x.lines) ? x.lines.length : 0), 0)),
        }),
      );
    },
  },
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
  'qc-checklist': {
    group: 'service',
    describe: (t, p) => {
      const checks = arr<{ name?: string }>(p, 'checks');
      return t('config.value.qcChecklist', {
        n: int(checks.length),
        names: checks.map((x) => x.name ?? '').join(', '),
      });
    },
  },
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
  'order-policy': {
    group: 'service',
    describe: (t, p) =>
      parts(
        t('config.value.undoWindow', { sec: int(num(p, 'undoWindowSeconds')) }),
        t('config.value.handoverRequiresPayment', { v: yn(t, p.handoverRequiresPayment) }),
        t('config.value.handoverRequiresReceiver', { v: yn(t, p.handoverRequiresReceiver) }),
      ),
  },
  'appointment-policy': {
    group: 'appointment',
    describe: (t, p) => {
      const cap = num(p, 'dailyCapacity');
      const opt = (k: string, key: string) =>
        num(p, k) !== null ? t(`config.value.${key}`, { n: int(num(p, k)) }) : '';
      return parts(
        t(p.enabled === true ? 'config.value.appointmentsOn' : 'config.value.appointmentsOff'),
        cap ? t('config.value.dailyCapacity', { n: int(cap) }) : t('config.value.noCapacity'),
        opt('overdueGraceMinutes', 'overdueGrace'),
        opt('staleDays', 'staleDays'),
        opt('maxReschedules', 'maxReschedules'),
        opt('lateRescheduleMinutes', 'lateReschedule'),
        opt('noteMinLength', 'noteMinLength'),
      );
    },
  },
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
  'warranty-term': {
    group: 'appointment',
    describe: (t, p) => {
      const days = num(p, 'days');
      const km = num(p, 'km');
      const cond = str(p, 'conditions');
      return parts(
        days ? t('config.value.warrantyDays', { n: int(days) }) : t('config.value.noDayLimit'),
        km ? t('config.value.warrantyKm', { n: int(km) }) : t('config.value.noKmLimit'),
        cond
          ? t('config.value.conditions', {
              text: cond.length > 80 ? `${cond.slice(0, 80)}…` : cond,
            })
          : '',
      );
    },
  },
  'warranty-policy': {
    group: 'appointment',
    describe: (t, p) =>
      parts(
        t('config.value.crossBranchOpen', { v: yn(t, p.crossBranchOpen) }),
        t('config.value.costBearer', { v: enumLabel(t, 'costBearer', str(p, 'costBearer')) }),
      ),
  },
  'labor-method': {
    group: 'labor',
    describe: (t, p) => {
      const m = str(p, 'method');
      const bp = (k: string) => (num(p, k) === null ? '' : formatBp(num(p, k)!));
      return parts(
        t(`config.value.laborMethod.${m}`, {
          rate: vnd(num(p, 'hourlyRateVnd')),
          amount: vnd(num(p, 'amountVnd')),
          share: bp('rateBp'),
          fixed: vnd(num(p, 'fixedVnd')),
          bonus: vnd(num(p, 'bonusVnd')),
          within: bp('bonusMaxActualBp'),
        }),
        m === 'approved_actual' && num(p, 'capBp') !== null
          ? t('config.value.laborCap', { share: bp('capBp') })
          : '',
      );
    },
  },
  'labor-position': {
    group: 'labor',
    describe: (t, p) =>
      parts(
        str(p, 'name'),
        enumLabel(t, 'status', str(p, 'status')),
        num(p, 'coefficientBp') !== null
          ? t('config.value.coefficient', { v: formatBp(num(p, 'coefficientBp')!) })
          : '',
      ),
  },
  'labor-policy': {
    group: 'labor',
    describe: (t, p) =>
      parts(
        t('config.value.rounding', { v: enumLabel(t, 'rounding', str(p, 'roundingMode')) }),
        t('config.value.moneyStep', { amount: vnd(num(p, 'moneyStepVnd')) }),
        t('config.value.minutesStep', { n: int(num(p, 'minutesStep')) }),
        t('config.value.adjustThreshold', {
          n: int(num(p, 'adjustThresholdMinutes')),
          amount: vnd(num(p, 'adjustThresholdVnd')),
        }),
        t('config.value.rework', { v: enumLabel(t, 'rework', str(p, 'reworkMode')) }),
      ),
  },
  'work-hours': {
    group: 'labor',
    describe: (t, p) => {
      // 0 = Sunday (Date#getDay); shown Monday first
      const days = arr<number>(p, 'days');
      const shown = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
      return t('config.value.workHours', {
        days: shown.map((d) => enumLabel(t, 'weekday', String(d))).join(', '),
        from: clock(num(p, 'startMinute')),
        to: clock(num(p, 'endMinute')),
      });
    },
  },
  'acc-policy': {
    group: 'finance',
    describe: (t, p) =>
      parts(
        t('config.value.payMethods', {
          list: arr<string>(p, 'methods')
            .map((m) => enumLabel(t, 'payMethod', m))
            .join(', '),
        }),
        t('config.value.nonCashReference', { v: yn(t, p.nonCashReferenceRequired) }),
        t('config.value.receiptRequiresQc', { v: yn(t, p.receiptRequiresQc) }),
        t('config.value.varianceTolerance', { amount: vnd(num(p, 'varianceToleranceVnd')) }),
        num(p, 'debtMaxDays') !== null
          ? t('config.value.debtMaxDays', { n: int(num(p, 'debtMaxDays')) })
          : '',
        num(p, 'sourceFlagNoticeDays') !== null
          ? t('config.value.sourceFlagNoticeDays', { n: int(num(p, 'sourceFlagNoticeDays')) })
          : '',
      ),
  },
  'approval-limit': {
    group: 'finance',
    describe: (t, p) =>
      parts(
        t('config.value.selfMax', { amount: vnd(num(p, 'selfMaxVnd')) }),
        t('config.value.level1Max', { amount: vnd(num(p, 'level1MaxVnd')) }),
        num(p, 'shiftCapVnd') !== null
          ? t('config.value.shiftCap', { amount: vnd(num(p, 'shiftCapVnd')) })
          : '',
        t('config.value.dueHours', { n: int(num(p, 'dueHours')) }),
        num(p, 'validHours') !== null
          ? t('config.value.validHours', { n: int(num(p, 'validHours')) })
          : '',
        num(p, 'maxReopensPerMonth') !== null
          ? t('config.value.maxReopensPerMonth', { n: int(num(p, 'maxReopensPerMonth')) })
          : '',
        num(p, 'escalateAfterHours') !== null
          ? t('config.value.escalateAfterHours', { n: int(num(p, 'escalateAfterHours')) })
          : '',
        p.bulkAllowed === true ? t('config.value.bulkAllowed') : '',
        p.reauthOnApprove === true ? t('config.value.reauthOnApprove') : '',
      ),
  },
  'expense-category': {
    group: 'finance',
    describe: (t, p) =>
      parts(
        str(p, 'name'),
        enumLabel(t, 'status', str(p, 'status')),
        p.depositRefund === true ? t('config.value.depositRefund') : '',
        t('config.value.sourceRequirement', {
          v: enumLabel(t, 'sourceRequirement', str(p, 'sourceRequirement') || 'optional'),
        }),
        str(p, 'accountCode') ? t('config.value.accountCode', { code: str(p, 'accountCode') }) : '',
      ),
  },
  'einvoice-issuer': {
    group: 'finance',
    // no key or password lives in this payload (secrets are per-tenant integration config); nothing secret is shown
    describe: (t, p) =>
      parts(
        t(p.enabled === true ? 'config.value.enabledOn' : 'config.value.enabledOff'),
        t('config.value.provider', { code: str(p, 'providerCode') }),
        enumLabel(t, 'environment', str(p, 'environment')),
        str(p, 'sellerName'),
        t('config.value.taxCode', { code: str(p, 'sellerTaxCode') }),
        t('config.value.symbol', { code: str(p, 'symbol') }),
        enumLabel(t, 'invoiceType', str(p, 'invoiceType')),
        t('config.value.templateCode', { code: str(p, 'templateCode') }),
      ),
  },
  'einvoice-policy': {
    group: 'finance',
    describe: (t, p) => {
      const ms = num(p, 'providerTimeoutMs');
      return parts(
        enumLabel(t, 'lineMode', str(p, 'lineMode')),
        p.lineMode === 'per-rate' && str(p, 'perRateDescription')
          ? t('config.value.perRateDescription', { text: str(p, 'perRateDescription') })
          : '',
        t('config.value.issueAfter', { v: enumLabel(t, 'issueAfter', str(p, 'issueAfter')) }),
        t('config.value.taxChange', { v: enumLabel(t, 'taxChange', str(p, 'taxChangePolicy')) }),
        t('config.value.businessAddressRequired', { v: yn(t, p.businessAddressRequired) }),
        t('config.value.retailNameRequired', { v: yn(t, p.retailNameRequired) }),
        t('config.value.retry', {
          n: int(num(p, 'maxAttempts')),
          list: arr<number>(p, 'retryBackoffMinutes').map(int).join(', '),
        }),
        ms === null
          ? ''
          : ms % 1000 === 0
            ? t('config.value.timeoutSeconds', { n: int(ms / 1000) })
            : t('config.value.timeoutMs', { n: int(ms) }),
      );
    },
  },
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
  'public-rate-limit': {
    group: 'system',
    describe: (t, p) =>
      parts(
        t('config.value.viewLimit', {
          n: int(num(p, 'viewLimit')),
          sec: int(num(p, 'viewWindowSeconds')),
        }),
        t('config.value.decideLimit', {
          n: int(num(p, 'decideLimit')),
          min: int(num(p, 'decideWindowMinutes')),
        }),
        num(p, 'photoViewLimit') !== null
          ? t('config.value.photoViewLimit', {
              n: int(num(p, 'photoViewLimit')),
              sec: int(num(p, 'photoViewWindowSeconds')),
            })
          : '',
      ),
  },
  'tenant-limits': {
    group: 'system',
    describe: (t, p) => {
      const mb = num(p, 'photoStorageMb');
      return t('config.value.tenantLimits', {
        branches: int(num(p, 'activeBranches')),
        users: int(num(p, 'users')),
        storage:
          mb === null
            ? ''
            : mb % 1024 === 0
              ? t('config.value.gb', { n: int(mb / 1024) })
              : t('config.value.mb', { n: int(mb) }),
        api: int(num(p, 'apiPerMinute')),
        jobs: int(num(p, 'backgroundJobs')),
        imp: int(num(p, 'importRowsPerDay')),
        exp: int(num(p, 'exportRowsPerRun')),
      });
    },
  },
  'report-policy': {
    group: 'system',
    describe: (t, p) =>
      parts(
        t('config.value.openOrderMaxDays', { n: int(num(p, 'openOrderMaxDays')) }),
        t('config.value.uninvoicedAfterDays', { n: int(num(p, 'uninvoicedAfterDays')) }),
        t('config.value.unpaidHandoverGraceDays', { n: int(num(p, 'unpaidHandoverGraceDays')) }),
        t('config.value.cashVarianceAlert', { amount: vnd(num(p, 'cashVarianceAlertVnd')) }),
      ),
  },
  'branch-groups': {
    group: 'system',
    describe: (t, p) => {
      const groups = arr<{ name?: string; branchIds?: unknown[] }>(p, 'groups');
      if (groups.length === 0) return t('config.value.noGroups');
      return t('config.value.branchGroups', {
        n: int(groups.length),
        list: groups
          .map((g) =>
            t('config.value.groupItem', {
              name: g.name ?? '',
              n: int(Array.isArray(g.branchIds) ? g.branchIds.length : 0),
            }),
          )
          .join(', '),
      });
    },
  },
  'catalog-release': {
    group: 'system',
    describe: (t, p) =>
      p.audience === 'branches'
        ? t('config.value.releaseBranches', { n: int(arr<string>(p, 'branchIds').length) })
        : t('config.value.releaseAll'),
  },
};

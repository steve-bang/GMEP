import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG_TYPES } from '@/modules/sys/domain/config';
import { CONFIG_DESCRIPTORS, CONFIG_GROUPS } from '@/modules/sys/domain/configDescriptors';
import { buildConfigPayload, type RawFormValues } from '@/platform/config/formValues';
import { applyPayloadShape } from '@/platform/config/payloadShape';

const vi = JSON.parse(readFileSync('src/platform/i18n/vi.json', 'utf8')) as Record<string, unknown>;
const lookup = (key: string): string | undefined => {
  let cur: unknown = vi;
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
};

/** Types whose describe is not written yet (shrinks to empty in the phase that writes them). */
const KNOWN_MISSING_DESCRIBE: readonly string[] = [];

const types = Object.keys(CONFIG_TYPES);

describe('FR-SYS-004: every config type has one descriptor (guard against a type added without a view)', () => {
  it('descriptors and CONFIG_TYPES list exactly the same types', () => {
    expect(Object.keys(CONFIG_DESCRIPTORS).sort()).toEqual([...types].sort());
  });

  it.each(types)('%s: has a menu group with a label and a title and lead in i18n', (type) => {
    const d = CONFIG_DESCRIPTORS[type];
    expect(d, `descriptor of ${type}`).toBeDefined();
    expect(CONFIG_GROUPS, `group of ${type}`).toContain(d!.group);
    expect(lookup(`config.groups.${d!.group}`), `config.groups.${d!.group}`).toBeTruthy();
    expect(lookup(`config.types.${type}.title`), `config.types.${type}.title`).toBeTruthy();
    expect(lookup(`config.types.${type}.lead`), `config.types.${type}.lead`).toBeTruthy();
  });

  it.each(types.filter((x) => !KNOWN_MISSING_DESCRIBE.includes(x)))(
    '%s: has a describe',
    (type) => {
      expect(CONFIG_DESCRIPTORS[type]!.describe, `describe of ${type}`).toBeTypeOf('function');
    },
  );

  it('the known-missing list only names types that really lack a describe (so it cannot go stale)', () => {
    for (const type of KNOWN_MISSING_DESCRIBE) {
      expect(types, type).toContain(type);
      expect(
        CONFIG_DESCRIPTORS[type]!.describe,
        `${type} now has a describe: remove it from the list`,
      ).toBeUndefined();
    }
  });

  it('every form field of every type is a key of that type schema (the form cannot post an unknown key)', () => {
    for (const [type, d] of Object.entries(CONFIG_DESCRIPTORS)) {
      if (!d.fields) continue;
      const shape = (CONFIG_TYPES[type]!.payload as unknown as { shape?: Record<string, unknown> })
        .shape;
      if (!shape || d.payloadShape?.groupBy) continue; // wrapped payloads are checked below
      for (const f of d.fields) expect(Object.keys(shape), `${type}.${f.name}`).toContain(f.name);
    }
  });
});

describe('payload shapes keep the payload the form sent before the descriptors (no behaviour change)', () => {
  it('discount-limit wraps one role into maxDiscountBpByRole', () => {
    const d = CONFIG_DESCRIPTORS['discount-limit']!;
    const payload = applyPayloadShape(d.payloadShape, { role: 'QL', maxBp: 500 });
    expect(payload).toEqual({ maxDiscountBpByRole: { QL: 500 } });
    expect(CONFIG_TYPES['discount-limit']!.payload.safeParse(payload).success).toBe(true);
  });

  it('numbering-series adds reversalSameSeries: true and keeps the typed values', () => {
    const d = CONFIG_DESCRIPTORS['numbering-series']!;
    const values = {
      prefix: 'PT',
      group: 'B',
      gapPolicy: 'strict',
      scope: 'branch',
      period: 'month',
      seqWidth: 5,
    };
    const payload = applyPayloadShape(d.payloadShape, values);
    expect(payload).toEqual({ ...values, reversalSameSeries: true });
    expect(CONFIG_TYPES['numbering-series']!.payload.safeParse(payload).success).toBe(true);
  });

  it('a type without a shape posts the values as typed', () => {
    const values = { name: 'VAT', rateBp: 800 };
    expect(applyPayloadShape(CONFIG_DESCRIPTORS['tax-rate']!.payloadShape, values)).toBe(values);
  });
});

/** Phase 3a: the flat types that gained a form. Sample values are test data only (not business defaults). */
const FLAT_SAMPLES: Record<string, { full: RawFormValues; required: RawFormValues }> = {
  'public-rate-limit': {
    required: {
      viewLimit: '60',
      viewWindowSeconds: '60',
      decideLimit: '10',
      decideWindowMinutes: '15',
    },
    full: {
      viewLimit: '60',
      viewWindowSeconds: '60',
      decideLimit: '10',
      decideWindowMinutes: '15',
      photoViewLimit: '120',
      photoViewWindowSeconds: '60',
    },
  },
  'order-policy': {
    required: {
      undoWindowSeconds: '30',
      handoverRequiresPayment: 'true',
      handoverRequiresReceiver: 'false',
    },
    full: {
      undoWindowSeconds: '30',
      handoverRequiresPayment: 'true',
      handoverRequiresReceiver: 'false',
    },
  },
  'acc-policy': {
    required: {
      methods: ['cash', 'qr'],
      nonCashReferenceRequired: 'true',
      receiptRequiresQc: 'false',
      varianceToleranceVnd: '50.000',
    },
    full: {
      methods: ['cash', 'qr'],
      nonCashReferenceRequired: 'true',
      receiptRequiresQc: 'false',
      varianceToleranceVnd: '50.000',
      debtMaxDays: '45',
      sourceFlagNoticeDays: '2',
    },
  },
  'work-hours': {
    required: { days: ['1', '2', '3', '4', '5', '6'], startMinute: '07:45', endMinute: '17:30' },
    full: { days: ['1', '2', '3', '4', '5', '6'], startMinute: '07:45', endMinute: '24:00' },
  },
  'report-policy': {
    required: {
      openOrderMaxDays: '14',
      uninvoicedAfterDays: '0',
      unpaidHandoverGraceDays: '3',
      cashVarianceAlertVnd: '100.000',
    },
    full: {
      openOrderMaxDays: '14',
      uninvoicedAfterDays: '0',
      unpaidHandoverGraceDays: '3',
      cashVarianceAlertVnd: '100.000',
    },
  },
  'einvoice-policy': {
    required: {
      lineMode: 'per-rate',
      perRateDescription: 'Dịch vụ sửa chữa',
      issueAfter: 'qc',
      businessAddressRequired: 'true',
      retailNameRequired: 'false',
      taxChangePolicy: 'warn',
      maxAttempts: '5',
      retryBackoffMinutes: '5, 15, 60',
      providerTimeoutMs: '30000',
    },
    full: {
      lineMode: 'per-line',
      perRateDescription: 'Dịch vụ sửa chữa',
      issueAfter: 'handover',
      businessAddressRequired: 'true',
      retailNameRequired: 'false',
      taxChangePolicy: 'block',
      maxAttempts: '5',
      retryBackoffMinutes: '5, 15, 60',
      providerTimeoutMs: '30000',
    },
  },
  'appointment-policy': {
    required: { enabled: 'true', dailyCapacity: '0' },
    full: {
      enabled: 'true',
      dailyCapacity: '12',
      overdueGraceMinutes: '15',
      staleDays: '20',
      maxReschedules: '2',
      lateRescheduleMinutes: '60',
      noteMinLength: '5',
    },
  },
  'warranty-policy': {
    required: { crossBranchOpen: 'true', costBearer: 'origin_branch' },
    full: { crossBranchOpen: 'false', costBearer: 'company' },
  },
};
const FLAT_TYPES = Object.keys(FLAT_SAMPLES);

/** The 14 types whose form is still API only (phase 3b/3c); shrinks as they get a form. */
const STILL_API_ONLY: readonly string[] = [
  'approval-limit',
  'branch-groups',
  'catalog-release',
  'einvoice-issuer',
  'expense-category',
  'labor-method',
  'labor-policy',
  'labor-position',
  'qc-checklist',
  'quote-approval',
  'service-package',
  'service-workflow',
  'tenant-limits',
  'warranty-term',
];

describe('FR-SYS-004 phase 3a: flat types have a form', () => {
  it('exactly the 14 still-API-only types lack fields', () => {
    const without = types.filter((x) => !CONFIG_DESCRIPTORS[x]!.fields?.length).sort();
    expect(without).toEqual([...STILL_API_ONLY].sort());
    expect(STILL_API_ONLY).toHaveLength(14);
  });

  it.each(FLAT_TYPES)('%s: fields are not empty and every field and option has a label', (type) => {
    const fields = CONFIG_DESCRIPTORS[type]!.fields;
    expect(fields?.length, `fields of ${type}`).toBeGreaterThan(0);
    for (const f of fields!) {
      expect(lookup(`config.fields.${f.name}`), `config.fields.${f.name}`).toBeTruthy();
      const group = f.optionsGroup ?? f.name;
      if (f.kind === 'bool')
        for (const v of ['false', 'true'])
          expect(lookup(`config.enums.${group}.${v}`), `config.enums.${group}.${v}`).toBeTruthy();
      for (const o of f.options ?? [])
        expect(lookup(`config.enums.${group}.${o}`), `config.enums.${group}.${o}`).toBeTruthy();
    }
  });

  it.each(FLAT_TYPES)('%s: the form fields cover every key of the schema', (type) => {
    const shape = (CONFIG_TYPES[type]!.payload as unknown as { shape: Record<string, unknown> })
      .shape;
    const names = CONFIG_DESCRIPTORS[type]!.fields!.map((f) => f.name).sort();
    expect(names).toEqual(Object.keys(shape).sort());
  });

  it.each(FLAT_TYPES)('%s: a sample form is accepted by the server schema', (type) => {
    const d = CONFIG_DESCRIPTORS[type]!;
    for (const raw of [FLAT_SAMPLES[type]!.required, FLAT_SAMPLES[type]!.full]) {
      const { payload, errors } = buildConfigPayload(d.fields!, raw, d.payloadShape);
      expect(errors).toEqual({});
      const r = CONFIG_TYPES[type]!.payload.safeParse(payload);
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });

  it.each(FLAT_TYPES)('%s: an empty optional box is not in the payload', (type) => {
    const d = CONFIG_DESCRIPTORS[type]!;
    const optional = d.fields!.filter((f) => f.optional).map((f) => f.name);
    const blank = Object.fromEntries(optional.map((n) => [n, '']));
    const { payload, errors } = buildConfigPayload(
      d.fields!,
      { ...FLAT_SAMPLES[type]!.required, ...blank },
      d.payloadShape,
    );
    expect(errors).toEqual({});
    for (const n of optional) expect(Object.keys(payload), `${type}.${n}`).not.toContain(n);
    // a filled optional box is sent
    const filled = buildConfigPayload(d.fields!, FLAT_SAMPLES[type]!.full, d.payloadShape).payload;
    for (const n of optional) expect(Object.keys(filled), `${type}.${n}`).toContain(n);
  });

  it('appointment-policy has five optional boxes; the other required boxes stay required', () => {
    const d = CONFIG_DESCRIPTORS['appointment-policy']!;
    expect(d.fields!.filter((f) => f.optional)).toHaveLength(5);
    const { errors } = buildConfigPayload(d.fields!, { enabled: 'true', dailyCapacity: '' });
    expect(errors).toEqual({ dailyCapacity: 'number' });
  });

  it('rejects text that is not a time, a list or a pick (the server still owns the ranges)', () => {
    const wh = CONFIG_DESCRIPTORS['work-hours']!;
    const bad = buildConfigPayload(wh.fields!, {
      days: [],
      startMinute: '7h45',
      endMinute: '25:00',
    });
    expect(bad.errors).toEqual({ days: 'pick', startMinute: 'time', endMinute: 'time' });
    const ei = CONFIG_DESCRIPTORS['einvoice-policy']!;
    const list = buildConfigPayload(ei.fields!, {
      ...FLAT_SAMPLES['einvoice-policy']!.required,
      retryBackoffMinutes: '5, x',
    });
    expect(list.errors).toEqual({ retryBackoffMinutes: 'list' });
  });

  it('the server schema still refuses what the form cannot judge (no widened schema)', () => {
    const wh = CONFIG_DESCRIPTORS['work-hours']!;
    const { payload } = buildConfigPayload(wh.fields!, {
      days: ['1'],
      startMinute: '18:00',
      endMinute: '08:00',
    });
    expect(CONFIG_TYPES['work-hours']!.payload.safeParse(payload).success).toBe(false);
  });
});

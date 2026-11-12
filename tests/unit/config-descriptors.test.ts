import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG_TYPES } from '@/modules/sys/domain/config';
import { CONFIG_DESCRIPTORS, CONFIG_GROUPS } from '@/modules/sys/domain/configDescriptors';
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

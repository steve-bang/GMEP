import { describe, expect, it } from 'vitest';
import { CONFIG_TYPES } from '@/modules/sys/domain/config';
import { describeValue, PAYLOAD_FIELDS } from '../../src/app/(shell)/sys/config/configView';

const TYPES = ['appointment-cancel-reason', 'appointment-reschedule-reason'] as const;
const t = Object.assign((k: string) => k, { has: () => false });

describe('FR-REC-045/046: the config form of the reason catalogues covers the whole schema', () => {
  it.each(TYPES)(
    '%s: every payload key of the schema has a form field (noteRequired included)',
    (type) => {
      const shape = (CONFIG_TYPES[type]!.payload as unknown as { shape: Record<string, unknown> })
        .shape;
      const names = (PAYLOAD_FIELDS[type] ?? []).map((f) => f.name);
      for (const key of Object.keys(shape)) expect(names, key).toContain(key);
      expect(PAYLOAD_FIELDS[type]!.find((f) => f.name === 'noteRequired')!.kind).toBe('bool');
    },
  );

  it.each(TYPES)('%s: a version that needs a note says so in the list', (type) => {
    expect(
      describeValue(t, type, { name: 'Khác', status: 'active', noteRequired: true }),
    ).toContain('config.fields.noteRequired');
    expect(describeValue(t, type, { name: 'Bận', status: 'active' })).not.toContain(
      'config.fields.noteRequired',
    );
  });
});

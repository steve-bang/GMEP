import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messages } from '@/platform/i18n/messages';

/** FR-SYS-003: audit codes are technical; the UI shows Vietnamese labels, so every code written by the SYS module needs one. */
const dir = join(process.cwd(), 'src/modules/sys/application');
const source = readdirSync(dir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n');

const literals = (field: string) =>
  [...source.matchAll(new RegExp(`${field}:\\s*'([A-Za-z_.]+)'`, 'g'))].map((m) => m[1]!);
const key = (code: string) => code.replace(/\./g, '_');
const m = messages as unknown as {
  audit: { actions: Record<string, string>; entityTypes: Record<string, string> };
};

describe('audit code labels (no technical codes shown to users)', () => {
  it('every action literal has a Vietnamese label', () => {
    const actions = new Set([
      ...literals('action'),
      'config.approve',
      'config.reject',
      'user.disable',
      'user.enable',
      'warehouse.deactivate',
      'warehouse.reactivate',
    ]);
    const missing = [...actions].filter((a) => !m.audit.actions[key(a)]);
    expect(missing).toEqual([]);
  });
  it('every entity type literal has a Vietnamese label', () => {
    const missing = [...new Set(literals('entityType'))].filter(
      (e) => !m.audit.entityTypes[key(e)],
    );
    expect(missing).toEqual([]);
  });
});

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Proves the dependency-cruiser rules actually fire (ADR §6.2 escape hatch, R-12).
 * Runs the real config against a fixture tree that contains deliberate violations.
 */
describe('architecture boundaries (ADR 0001 §5/§6.2)', () => {
  const root = resolve(__dirname, '../..');
  const result = spawnSync(
    resolve(root, 'node_modules/.bin/depcruise'),
    ['src', '--config', resolve(root, '.dependency-cruiser.cjs'), '--output-type', 'json'],
    { cwd: resolve(root, 'tests/fixtures/boundaries'), encoding: 'utf8' },
  );
  const report = JSON.parse(result.stdout) as {
    summary: { violations: { rule: { name: string }; from: string; to: string }[] };
  };
  const hits = (rule: string, from: string) =>
    report.summary.violations.some((v) => v.rule.name === rule && v.from.endsWith(from));

  it('domain/ may not import firebase-admin', () => {
    expect(hits('domain-no-sdk', 'bad-domain.ts')).toBe(true);
  });
  it('application/ may not import firebase-admin', () => {
    expect(hits('application-no-sdk', 'bad-application.ts')).toBe(true);
  });
  it('a module may not reach into another module internals', () => {
    expect(hits('modules-via-public-index-only', 'bad-cross-module.ts')).toBe(true);
  });
  it('code outside modules may not import module internals', () => {
    expect(hits('outside-modules-via-public-index-only', 'bad-page.ts')).toBe(true);
  });
  it('shared UI may not import firebase-admin', () => {
    expect(hits('ui-is-browser-safe', 'bad-ui.ts')).toBe(true);
  });
  it('importing another module through its index.ts is allowed', () => {
    expect(report.summary.violations.some((v) => v.from.endsWith('good.ts'))).toBe(false);
  });
});

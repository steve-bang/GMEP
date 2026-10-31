import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The R-12 gate must actually fail when Firebase reaches the browser output. */
describe('bundle-must-not-contain-firebase check (ADR 0001 R-12)', () => {
  const root = resolve(__dirname, '../..');
  const run = (dir: string) =>
    spawnSync(
      resolve(root, 'node_modules/.bin/tsx'),
      ['--tsconfig', 'tsconfig.json', 'scripts/check-bundle.ts', dir],
      { cwd: root, encoding: 'utf8' },
    );
  it('fails (exit 1) on output that imports the Firebase SDK', () => {
    const r = run('tests/fixtures/bundle-bad');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Firebase references found');
  });
  it('passes on clean output', () => {
    expect(run('tests/fixtures/bundle-good').status).toBe(0);
  });
});

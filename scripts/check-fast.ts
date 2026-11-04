/**
 * Inner-loop check for a developer: only what the working-tree change can break. Full CI runs on the PR.
 * Order (stops at the first failure): typecheck, eslint + prettier on changed files, tests related to the change
 * (unit + in-memory integration), module boundaries, and the index catalogue when a repository changed.
 * Usage: pnpm check:fast [base-ref]   (default base: HEAD, i.e. uncommitted + untracked; pass origin/master for a whole branch)
 */
import { execFileSync, spawnSync } from 'node:child_process';

const base = process.argv[2] ?? 'HEAD';
const git = (...a: string[]) =>
  execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);

const changed = [
  ...new Set([
    ...git('diff', '--name-only', '--diff-filter=ACMR', base),
    ...git('ls-files', '--others', '--exclude-standard'),
  ]),
];
const code = changed.filter((f) => /\.(ts|tsx|mts|mjs|cjs|js)$/.test(f));
const fmt = changed.filter((f) => /\.(ts|tsx|mts|mjs|cjs|js|json|md|css|ya?ml)$/.test(f));
console.log(`check:fast: ${changed.length} changed file(s) vs ${base}`);
if (changed.length === 0) process.exit(0);

function step(name: string, cmd: string, args: string[]): void {
  console.log(`\n> ${name}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\ncheck:fast FAILED at: ${name}`);
    process.exit(r.status ?? 1);
  }
}

if (code.length > 0) {
  step('typecheck', 'pnpm', ['exec', 'tsc', '--noEmit']);
  step('eslint (changed)', 'pnpm', ['exec', 'eslint', '--max-warnings', '0', ...code]);
}
if (fmt.length > 0) step('prettier (changed)', 'pnpm', ['exec', 'prettier', '--check', ...fmt]);
if (code.length > 0) {
  step('tests related to the change', 'pnpm', [
    'exec',
    'vitest',
    'related',
    '--run',
    '--passWithNoTests',
    ...code,
  ]);
  step('module boundaries', 'pnpm', ['run', 'check:boundaries']);
}
if (changed.some((f) => f.startsWith('src/infrastructure/repos/')))
  step('index catalogue', 'pnpm', ['run', 'check:indexes']);
console.log('\ncheck:fast OK. Full CI (build, e2e, audit) runs on the PR.');

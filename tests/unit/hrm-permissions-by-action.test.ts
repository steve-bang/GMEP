import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 2.6a-5 (phase-2-plan 14.3): HRM rights are attached to ACTIONS (`employee:*`, `labor:*`), never to a role name, so
 * the roles "NS" and "MH" can be added later as a permission top-up without touching code. The ONLY place that keys on
 * role codes is the personal-data visibility table (Phụ lục D), which is data (`DEFAULT_EMPLOYEE_PII_POLICY`) and
 * already lists NS.
 */
const ROLE_LITERAL = /['"](CH|QV|QL|QD|CV|TH|TK|TN|KT|AD|NS|MH)['"]/;
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );

describe('2.6a-5 HRM permissions are attached to actions, not role names', () => {
  it('no role code literal in the HRM module outside the personal-data visibility table', () => {
    const offenders = [...walk('src/modules/hrm'), ...walk('src/app/api/v1/hrm')]
      .filter((f) => !f.endsWith('domain/employee.ts'))
      .filter((f) => ROLE_LITERAL.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { login } from '@/modules/sys';
import { backends, createHarness, type Harness } from './harness';

/**
 * UAT-TEN-21 (a), FR-TEN-016: an unknown email and an existing email with a wrong password answer with the same neutral
 * error, in the same time. 200 attempts per branch, compared by the MEDIAN: the difference must stay within
 * max(100 ms, 20 %). The password check at the identity provider runs for both (a decoy for the unknown one).
 */
const noThrottle = {
  assertAllowed: async () => undefined,
  recordFailure: async () => undefined,
  recordSuccess: async () => undefined,
  unlockName: async () => undefined,
} as never;
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
const N = 200;

describe.each(backends)('login timing and neutral errors [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });

  const attempt = async (identifier: string) => {
    const deps = { ...h.container.sys, throttle: noThrottle };
    const t0 = performance.now();
    const r = await login(deps, {
      identifier,
      password: 'wrong-password-x',
      address: '10.5.5.5',
      deviceId: 'dev',
      requestId: 'r',
    } as never).then(
      () => null,
      (e: { code?: string; status?: number }) => ({ code: e.code, status: e.status }),
    );
    return { ms: performance.now() - t0, r };
  };

  it('UAT-TEN-21 a: same error and a median within 100 ms or 20 % between an existing and an unknown email (200 each)', async () => {
    const existing: number[] = [];
    const unknown: number[] = [];
    const answers = new Set<string>();
    // interleave so a slow moment hits both branches alike
    for (let i = 0; i < N; i++) {
      const a = await attempt('chu@demo.gmep.test');
      const b = await attempt(`nobody.${i}@nowhere.test`);
      existing.push(a.ms);
      unknown.push(b.ms);
      answers.add(JSON.stringify(a.r));
      answers.add(JSON.stringify(b.r));
    }
    expect(answers.size, [...answers].join(' | ')).toBe(1);
    const me = median(existing);
    const mu = median(unknown);
    const diff = Math.abs(me - mu);
    expect(diff <= 100 || diff <= 0.2 * Math.max(me, mu), `existing ${me}ms unknown ${mu}ms`).toBe(
      true,
    );
  });

  /**
   * P2-C: the employee-code sign-in. Unknown company code, unknown employee code and a wrong password for an existing
   * staff member without email: same neutral answer, medians within max(100 ms, 20 %) pairwise (200 attempts each).
   */
  it('P2-C UAT-TEN-21 a: unknown company, unknown employee code and wrong password answer alike and in the same time (200 each)', async () => {
    const created = await h.call('POST', '/api/v1/sys/users', {
      as: 'u_ql_q7',
      key: 'timing-worker-000001',
      body: {
        loginKind: 'employee_code',
        employeeCode: 'TH-T01',
        displayName: 'Thợ đo thời gian',
        assignments: [{ roleCode: 'TH', branchId: 'br_q7' }],
        temporaryPassword: 'Tam-Thoi-Timing-2026',
      },
    });
    expect(created.status, created.text).toBe(201);
    const byCode = async (companyCode: string, employeeCode: string) => {
      const deps = { ...h.container.sys, throttle: noThrottle };
      const t0 = performance.now();
      const r = await login(deps, {
        companyCode,
        employeeCode,
        password: 'wrong-password-x',
        address: '10.5.5.6',
        deviceId: 'dev',
        requestId: 'r',
      }).then(
        () => null,
        (e: { code?: string; status?: number }) => ({ code: e.code, status: e.status }),
      );
      return { ms: performance.now() - t0, r };
    };
    const runs = { company: [] as number[], code: [] as number[], password: [] as number[] };
    const answers = new Set<string>();
    for (let i = 0; i < N; i++) {
      const a = await byCode(`tnt_none${i}`, 'TH-T01');
      const b = await byCode('tnt_demo', `TH-X${i}`);
      const c = await byCode('tnt_demo', 'TH-T01');
      runs.company.push(a.ms);
      runs.code.push(b.ms);
      runs.password.push(c.ms);
      for (const x of [a, b, c]) answers.add(JSON.stringify(x.r));
    }
    expect(answers.size, [...answers].join(' | ')).toBe(1);
    expect([...answers][0]).toContain('invalid_credentials');
    const m = { c: median(runs.company), e: median(runs.code), p: median(runs.password) };
    for (const [x, y] of [
      [m.c, m.e],
      [m.c, m.p],
      [m.e, m.p],
    ] as const) {
      const diff = Math.abs(x - y);
      expect(diff <= 100 || diff <= 0.2 * Math.max(x, y), JSON.stringify(m)).toBe(true);
    }
  });

  it('a decoy password check runs for an unknown email and for a non-email input (no early return)', async () => {
    const calls = (h.container.identity as unknown as { calls: { signIn: number } }).calls;
    const before = calls.signIn;
    await attempt('nobody@nowhere.test');
    await attempt('NV0001'); // an employee code is not a login name
    expect(calls.signIn - before).toBe(2);
    // P2-C: exactly one password check per employee-code attempt too, whatever is unknown
    const deps = { ...h.container.sys, throttle: noThrottle };
    const base = { password: 'x-wrong-pass', address: 'a', deviceId: 'd', requestId: 'r' };
    const mid = calls.signIn;
    for (const [companyCode, employeeCode] of [
      ['tnt_none', 'NV0001'],
      ['tnt_demo', 'NOPE01'],
      ['bad/code', '../..'],
      ['tnt_demo', 'NV0101'], // an email account: decoy, never its real address
    ])
      await login(deps, { ...base, companyCode, employeeCode }).catch(() => undefined);
    expect(calls.signIn - mid).toBe(4);
  });
});

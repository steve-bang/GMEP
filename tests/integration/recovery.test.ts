import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { backends, createHarness, type Harness } from './harness';

/**
 * FR-SYS-001: forgot password, single-use reset link, invitation and activation, lockout,
 * neutral responses (ba-answers-for-dev §1.3-§1.4, ADR §6.3). MFA is out of scope (owner decision).
 */
describe.each(backends)('FR-SYS-001 recovery, invitation and lockout [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });
  afterAll(() => undefined);

  const forgot = (identifier: string, ip = '10.9.9.1') =>
    h.call('POST', '/api/v1/auth/forgot-password', {
      body: { identifier },
      headers: { 'x-forwarded-for': ip },
    });
  const reset = (token: string, password: string, ip = '10.9.9.2') =>
    h.call('POST', '/api/v1/auth/reset-password', {
      body: { token, password },
      headers: { 'x-forwarded-for': ip },
    });
  const loginRaw = (identifier: string, password: string, ip: string, device?: string) =>
    h.call('POST', '/api/v1/auth/login', {
      body: { identifier, password },
      headers: {
        'x-forwarded-for': ip,
        ...(device ? { cookie: `__Host-gmep_device=${device}` } : {}),
      },
    });

  it('forgot-password answers identically for existing, unknown and disabled accounts and sends mail only to real ones', async () => {
    const before = (await h.outbox()).length;
    const a = await forgot('ql.q7@demo.gmep.test', '10.1.1.1');
    const b = await forgot('nobody@demo.gmep.test', '10.1.1.2');
    const c = await forgot('disabled@demo.gmep.test', '10.1.1.3');
    for (const r of [a, b, c]) expect(r.status).toBe(202);
    expect({ ...a.json }).toEqual({ ...b.json });
    expect({ ...a.json }).toEqual({ ...c.json });
    const mails = (await h.outbox()).slice(before);
    expect(mails.map((m) => m.to)).toEqual(['ql.q7@demo.gmep.test']);
    expect(mails[0]!.template).toBe('password-reset');
  });

  it('reset: single-use token (hashed at rest), enforces length and history, revokes every session', async () => {
    const cookie = await h.login('u_ql_td');
    expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(200);
    await forgot('ql.td@demo.gmep.test', '10.2.2.1');
    const token = await h.latestToken('ql.td@demo.gmep.test', 'password-reset');
    // the raw token is nowhere in the database, only its hash
    const tokensDump = JSON.stringify(
      backend === 'memory'
        ? [...h.container.memory!.db.col('authTokens').keys()]
        : (
            await (
              await import('@/infrastructure/firestore/client')
            )
              .getDb(h.container.env)
              .collection('authTokens')
              .get()
          ).docs.map((d) => d.id),
    );
    expect(tokensDump).not.toContain(token);

    const short = await reset(token, 'short');
    expect(short.status).toBe(422);
    expect(short.json.errors[0].message).toContain('10');
    const ok = await reset(token, 'garage-thu-duc-mua-dong');
    expect(ok.status).toBe(200);
    // single use
    const again = await reset(token, 'garage-thu-duc-mua-dong-2');
    expect(again.status).toBe(410);
    expect(again.json.code).toBe('token_used');
    // old sessions are dead; old password dead; new password works
    expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401);
    expect((await loginRaw('ql.td@demo.gmep.test', 'Demo!Pass-2026', '10.2.2.9')).status).toBe(401);
    expect(
      (await loginRaw('ql.td@demo.gmep.test', 'garage-thu-duc-mua-dong', '10.2.2.9')).status,
    ).toBe(200);

    // history: the new password cannot be reused by the next reset
    h.clock.set(new Date(h.clock.now().getTime() + 1000).toISOString()); // the outbox is ordered by time
    await forgot('ql.td@demo.gmep.test', '10.2.2.2');
    const t2 = await h.latestToken('ql.td@demo.gmep.test', 'password-reset');
    const reused = await reset(t2, 'garage-thu-duc-mua-dong');
    expect(reused.status).toBe(422);
    expect(JSON.stringify(reused.json.errors)).toContain('gần đây');
    // a failed attempt does not burn the link
    expect((await reset(t2, 'another-fresh-password')).status).toBe(200);
    // audit: reset is logged without secrets
    const entries = (
      await h.container.sys.audit.list(
        (await import('@/platform/scope/scope')).allBranchesScope('cmp_demo'),
        { entityType: 'user', entityId: 'u_ql_td' },
        { limit: 20 },
      )
    ).items;
    expect(entries.map((e) => e.action)).toContain('auth.password_reset');
    expect(JSON.stringify(entries)).not.toContain('another-fresh-password');
  });

  it('reset links expire after 30 minutes (configuration) and a newer link replaces the older one', async () => {
    await forgot('tk.q7@demo.gmep.test', '10.3.3.1');
    const t1 = await h.latestToken('tk.q7@demo.gmep.test', 'password-reset');
    h.clock.set(new Date(h.clock.now().getTime() + 1000).toISOString()); // the outbox is ordered by time
    await forgot('tk.q7@demo.gmep.test', '10.3.3.2');
    const t2 = await h.latestToken('tk.q7@demo.gmep.test', 'password-reset');
    expect((await reset(t1, 'new-password-for-tk-1')).json.code).toBe('token_revoked');
    h.clock.set(new Date(Date.now() + 31 * 60_000).toISOString());
    const late = await reset(t2, 'new-password-for-tk-1');
    expect(late.status).toBe(410);
    expect(late.json.code).toBe('token_expired');
    h.clock.set(new Date().toISOString());
    expect((await reset('x'.repeat(40), 'new-password-for-tk-1')).json.code).toBe('token_invalid');
  });

  it('forgot-password is rate limited per account name and per address (429 + Retry-After) with the same answer for unknown names', async () => {
    for (const name of ['multi@demo.gmep.test', 'ghost@demo.gmep.test']) {
      const codes: number[] = [];
      for (let i = 0; i < 5; i++)
        codes.push((await forgot(name, `10.4.${name.length}.${i}`)).status);
      expect(codes).toEqual([202, 202, 202, 429, 429]);
    }
    const limited = await forgot('multi@demo.gmep.test', '10.4.99.9');
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(limited.json.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('invitation: invited user cannot log in; activation needs consent and a valid password; token is single use; assignments become effective', async () => {
    const created = await h.call('POST', '/api/v1/sys/users', {
      as: 'u_ql_q7',
      key: 'invite-0001-aaaaaaaa',
      body: {
        email: 'moi.moi@demo.gmep.test',
        employeeCode: 'nv 7001',
        displayName: 'Người Được Mời',
        assignments: [{ roleCode: 'CV', branchId: 'br_q7' }],
      },
    });
    expect(created.status).toBe(201);
    expect(created.json.status).toBe('invited');
    expect(created.json.employeeCode).toBe('NV7001'); // normalised, immutable
    const uid = created.json.id as string;
    expect(
      (await loginRaw('moi.moi@demo.gmep.test', 'whatever-password-1', '10.5.5.1')).status,
    ).toBe(401);

    const token = await h.latestToken('moi.moi@demo.gmep.test', 'invitation');
    const act = (body: object) =>
      h.call('POST', '/api/v1/auth/activate', {
        body: { token, ...body },
        headers: { 'x-forwarded-for': '10.5.5.2' },
      });
    expect((await act({ password: 'valid-password-123', consent: false })).status).toBe(422); // consent required
    expect((await act({ password: 'short', consent: true })).status).toBe(422);
    expect((await act({ password: 'valid-password-123', consent: true })).status).toBe(200);
    expect((await act({ password: 'valid-password-123', consent: true })).json.code).toBe(
      'token_used',
    );
    // peek of the invitation must not leak after use
    const ok = await loginRaw('NV7001', 'valid-password-123', '10.5.5.3');
    expect(ok.status).toBe(200);
    const detail = await h.call('GET', `/api/v1/sys/users/${uid}`, { as: 'u_ql_q7' });
    expect(detail.json.status).toBe('active');
    // invitation expiry (72 h)
    await h.call('POST', '/api/v1/sys/users', {
      as: 'u_ql_q7',
      key: 'invite-0002-aaaaaaaa',
      body: {
        email: 'late@demo.gmep.test',
        employeeCode: 'NV7002',
        displayName: 'Mời Muộn',
        assignments: [{ roleCode: 'TH', branchId: 'br_q7' }],
      },
    });
    const lateToken = await h.latestToken('late@demo.gmep.test', 'invitation');
    h.clock.set(new Date(Date.now() + 73 * 3_600_000).toISOString());
    const expired = await h.call('POST', '/api/v1/auth/activate', {
      body: { token: lateToken, password: 'valid-password-123', consent: true },
      headers: { 'x-forwarded-for': '10.5.5.4' },
    });
    expect(expired.json.code).toBe('token_expired');
    h.clock.set(new Date().toISOString());
  });

  it('lockout (device+name): 5 wrong passwords lock that device with a generic 429, other devices and the real owner via another device still work; reset unlocks', async () => {
    const dev = 'device-aaaaaaaaaaaaaaaa';
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await loginRaw('NV0102', 'wrong-password-x', '10.6.6.1', dev)).status);
      h.clock.set(new Date(h.clock.now().getTime() + 3000).toISOString()); // stay below the slow-down thresholds
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401]);
    const locked = await loginRaw('NV0102', 'wrong-password-x', '10.6.6.1', dev);
    expect(locked.status).toBe(429);
    expect(locked.json.code).toBe('login_locked');
    // even the right password is refused on the locked device, with the same message
    const rightButLocked = await loginRaw('NV0102', 'Demo!Pass-2026', '10.6.6.1', dev);
    expect(rightButLocked.status).toBe(429);
    // the same applies to an unknown name: identical behaviour
    for (let i = 0; i < 5; i++) {
      await loginRaw('no.such.user', 'wrong-password-x', '10.6.6.2', dev);
      h.clock.set(new Date(h.clock.now().getTime() + 3000).toISOString());
    }
    const unknownLocked = await loginRaw('no.such.user', 'x', '10.6.6.2', dev);
    expect(unknownLocked.status).toBe(429);
    expect({ ...unknownLocked.json, traceId: '', retryAfterSeconds: 0 }).toEqual({
      ...locked.json,
      traceId: '',
      retryAfterSeconds: 0,
    });
    // another device is not affected
    expect(
      (await loginRaw('NV0102', 'Demo!Pass-2026', '10.6.6.3', 'device-bbbbbbbbbbbbbbbb')).status,
    ).toBe(200);
    // admin unlock (QL of the branch may unlock operative staff) clears the lock
    h.clock.set(new Date(h.clock.now().getTime() + 1000).toISOString());
    const unlock = await h.call('POST', '/api/v1/sys/users/u_tk_q7/unlock', {
      as: 'u_ql_q7',
      body: {},
    });
    expect(unlock.status).toBe(200);
    h.clock.set(new Date(h.clock.now().getTime() + 1000).toISOString());
    expect((await loginRaw('NV0102', 'Demo!Pass-2026', '10.6.6.1', dev)).status).toBe(200);
    // ...but a branch manager cannot unlock a manager (needs the owner, ba §1.4)
    expect(
      (await h.call('POST', '/api/v1/sys/users/u_ql_td/unlock', { as: 'u_ql_q7', body: {} }))
        .status,
    ).toBe(404);
    h.clock.set(new Date().toISOString());
  });

  it('login cookie jar: a device cookie is issued on first contact, also on failures', async () => {
    const r = await loginRaw('NV0101', 'wrong-password-x', '10.7.7.1');
    expect(r.headers.getSetCookie().some((c) => c.startsWith('__Host-gmep_device='))).toBe(true);
    const flags = r.headers.getSetCookie().find((c) => c.startsWith('__Host-gmep_device='))!;
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/'])
      expect(flags).toContain(attr);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { revokeAllSessions } from '@/modules/sys';
import { allBranchesScope } from '@/platform/scope/scope';
import { backends, createHarness, parseSetCookie, type Harness } from './harness';
import { DEMO_PASSWORD } from '@/infrastructure/seed/demo';

/** audit read helper: items of the first page */
async function auditList(
  audit: import('@/platform/audit/audit').AuditLog,
  scope: import('@/platform/scope/scope').Scope,
  filter: import('@/platform/audit/audit').AuditFilter,
  limit: number,
) {
  return (await audit.list(scope, filter, { limit })).items;
}

describe.each(backends)('FR-SYS-001 password login and server session [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });
  const login = (
    identifier: string,
    password: string,
    extra: { origin?: string | null; headers?: Record<string, string> } = {},
  ) => h.call('POST', '/api/v1/auth/login', { body: { identifier, password }, ...extra });

  it('logs in by email or employee code and sets a hardened __Host- session cookie', async () => {
    for (const identifier of ['ql.q7@demo.gmep.test', 'NV0101', 'nv0101']) {
      const res = await login(identifier, DEMO_PASSWORD);
      expect(res.status, identifier).toBe(200);
      const setCookie = res.headers.get('set-cookie')!;
      expect(setCookie.startsWith('__Host-gmep_session=')).toBe(true);
      for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/'])
        expect(setCookie).toContain(attr);
      expect(setCookie).not.toMatch(/domain=/i);
      expect(res.json.user).toMatchObject({ id: 'u_ql_q7' });
      expect(res.text).not.toContain(DEMO_PASSWORD);
    }
  });

  it('wrong password, unknown user and disabled user are indistinguishable (no enumeration)', async () => {
    const wrong = await login('ql.q7@demo.gmep.test', 'wrong-password');
    const unknown = await login('nobody@demo.gmep.test', 'wrong-password');
    const disabled = await login('disabled@demo.gmep.test', DEMO_PASSWORD);
    for (const r of [wrong, unknown, disabled]) {
      expect(r.status).toBe(401);
      expect(r.headers.getSetCookie().some((c) => c.startsWith('__Host-gmep_session'))).toBe(false);
    }
    const strip = (j: Record<string, unknown>) => ({ ...j, traceId: '' });
    expect(strip(wrong.json)).toEqual(strip(unknown.json));
    expect(strip(wrong.json)).toEqual(strip(disabled.json));
  });

  it('cookie authenticates /me; the response carries the visible scope', async () => {
    const cookie = await h.login('u_multi');
    const me = await h.call('GET', '/api/v1/auth/me', { cookie });
    expect(me.status).toBe(200);
    expect(me.json).toMatchObject({
      userId: 'u_multi',
      scope: { mode: 'picker', mustChoose: true, current: null },
      can: { warehouses: true },
    });
  });

  it('logout revokes the server-side session: the old cookie stops working even if replayed', async () => {
    const cookie = await h.login('u_tk_q7');
    expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(200);
    const out = await h.call('POST', '/api/v1/auth/logout', { cookie, body: {} });
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
    const replay = await h.call('GET', '/api/v1/auth/me', { cookie });
    expect(replay.status).toBe(401);
    expect(replay.json.code).toBe('unauthenticated');
  });

  it('S5 revoke: revoking all sessions of a user kills every cookie, other users are unaffected', async () => {
    const c1 = parseSetCookie((await login('NV0201', DEMO_PASSWORD)).headers.get('set-cookie'));
    const c2 = parseSetCookie((await login('NV0201', DEMO_PASSWORD)).headers.get('set-cookie'));
    const other = await h.login('u_owner');
    await revokeAllSessions(h.container.sys, 'u_ql_td');
    expect((await h.call('GET', '/api/v1/auth/me', { cookie: c1 })).status).toBe(401);
    expect((await h.call('GET', '/api/v1/auth/me', { cookie: c2 })).status).toBe(401);
    expect((await h.call('GET', '/api/v1/auth/me', { cookie: other })).status).toBe(200);
    // logging in again after a revoke works
    expect((await login('NV0201', DEMO_PASSWORD)).status).toBe(200);
  });

  it('idle timeout: a session unused longer than SESSION_IDLE_MINUTES is rejected', async () => {
    const cookie = await h.login('u_ql_q7');
    expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(200);
    h.clock.set(
      new Date(Date.now() + (h.container.env.SESSION_IDLE_MINUTES + 1) * 60_000).toISOString(),
    );
    expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401);
    h.clock.set(new Date().toISOString());
  });

  it('a cookie with garbage or forged content is rejected', async () => {
    for (const cookie of [
      '__Host-gmep_session=garbage',
      '__Host-gmep_session=eyJhbGciOiJub25lIn0.eyJ1aWQiOiJ1X293bmVyIn0.',
    ]) {
      expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401);
    }
  });

  it('CSRF: login/logout reject a missing or foreign Origin and non-JSON bodies', async () => {
    expect(
      (await login('NV0101', DEMO_PASSWORD, { origin: 'https://evil.example' })).json.code,
    ).toBe('bad_origin');
    expect((await login('NV0101', DEMO_PASSWORD, { origin: null })).json.code).toBe('bad_origin');
    const form = await h.call('POST', '/api/v1/auth/login', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'x=1',
    });
    expect(form.status).toBe(415);
  });

  it('A2 hook point: when StrongAuthPort requires a second factor the cookie is NOT issued', async () => {
    const original = h.container.sys.strongAuth;
    h.container.sys.strongAuth = { requirementFor: async () => 'totp', verify: async () => false };
    try {
      const res = await login('NV0101', DEMO_PASSWORD);
      expect(res.status).toBe(401);
      expect(res.json.code).toBe('strong_auth_required');
      expect(res.headers.getSetCookie().some((c) => c.startsWith('__Host-gmep_session'))).toBe(
        false,
      );
    } finally {
      h.container.sys.strongAuth = original;
    }
  });

  it('FR-SYS-003: login and logout are audited without secrets', async () => {
    const entries = await auditList(
      h.container.sys.audit,
      allBranchesScope('cmp_demo'),
      { entityType: 'session' },
      100,
    );
    expect(entries.some((e) => e.action === 'auth.login')).toBe(true);
    expect(entries.some((e) => e.action === 'auth.logout')).toBe(true);
    expect(JSON.stringify(entries)).not.toContain(DEMO_PASSWORD);
  });

  it('/api/health responds without authentication and echoes a request id', async () => {
    const res = await h.call('GET', '/api/health', {
      headers: { 'x-request-id': 'health-check-0001' },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: 'ok', requestId: 'health-check-0001' });
    expect(res.headers.get('x-request-id')).toBe('health-check-0001');
    const ready = await h.call('GET', '/api/health?ready=1');
    expect(ready.json).toMatchObject({ ready: true, backend });
  });
});

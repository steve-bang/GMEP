import { beforeAll, describe, expect, it } from 'vitest';
import {
  peekToken,
  revokeAllSessions,
  provisionTenant,
  transitionTenant,
  decideTenantTransition,
  getTenant,
  type PlatformActor,
} from '@/modules/sys';
import { parseSessionCookie, backends, createHarness, type Harness } from './harness';

/**
 * MT-0 identity and tenant session: FR-TEN-010, 016, 017, 020; RULE-018, 026, 034; UAT-TEN-07, 21.
 * One person (one email, one password) holds one membership per tenant; the session is bound to exactly one tenant.
 */
const cnt: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_owner',
  role: 'CNT',
  displayName: 'CNT',
};
const cnt2: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_owner2',
  role: 'CNT',
  displayName: 'CNT2',
};
const PW = 'Valid-Password-2026!';
let n = 0;
const rid = () => ({ requestId: `req-${++n}` });
const OWNER_DEMO = 'chu@demo.gmep.test'; // owner of tenant tnt_demo (identity u_owner)

describe.each(backends)('tenant identity and session [%s]', (backend) => {
  let h: Harness;
  const sys = () => h.container.sys;
  const login = (identifier: string, password = PW, ip = '10.9.0.1') =>
    h.call('POST', '/api/v1/auth/login', {
      body: { identifier, password },
      headers: { 'x-forwarded-for': ip },
    });
  const cookieOf = (r: { headers: Headers }) => parseSessionCookie(r.headers);
  const activate = async (email: string, body: object = { password: PW, consent: true }) =>
    h.call('POST', '/api/v1/auth/activate', {
      body: { token: await h.latestToken(email, 'invitation'), ...body },
      headers: { 'x-forwarded-for': '10.9.9.9' },
    });

  beforeAll(async () => {
    h = await createHarness(backend);
    // tenant alpha: a brand new person (new identity); tenant beta: the SAME person as the demo owner (existing identity)
    const a = await provisionTenant(
      sys(),
      cnt,
      {
        code: 'tnt_alpha',
        name: 'Garage Alpha',
        environment: 'demo',
        owner: { email: 'alpha.owner@alpha.test', name: 'Chủ Alpha', employeeCode: 'ch01' },
      },
      { ...rid(), idempotencyKey: 'prov-alpha' },
    );
    expect(a.state).toBe('provisioned');
    const b = await provisionTenant(
      sys(),
      cnt,
      {
        code: 'tnt_beta',
        name: 'Garage Beta',
        environment: 'demo',
        owner: { email: OWNER_DEMO, name: 'Chủ Demo (Beta)', employeeCode: 'CH01' },
      },
      { ...rid(), idempotencyKey: 'prov-beta' },
    );
    expect(b.state).toBe('provisioned');
    for (const code of ['tnt_alpha', 'tnt_beta']) {
      const t = await getTenant(sys(), cnt, code);
      await transitionTenant(sys(), cnt, code, { to: 'active', version: t.version }, rid());
    }
  });

  it('FR-TEN-016/RULE-018: the same employee code (CH01) in two tenants does not clash; a new email gets an identity and activates with a password', async () => {
    const r = await activate('alpha.owner@alpha.test');
    expect(r.status, r.text).toBe(200);
    const ok = await login('alpha.owner@alpha.test');
    expect(ok.status, ok.text).toBe(200);
    expect(ok.json.tenants).toBeUndefined();
    const me = await h.call('GET', '/api/v1/auth/me', { cookie: cookieOf(ok) });
    expect(me.status).toBe(200);
    expect(me.json.userId).toBe('own_tnt_alpha');
  });

  it('FR-TEN-017 d: an email that already has an identity gets a membership on acceptance, the password is NOT overwritten', async () => {
    const m = await sys().users.getAnyById('own_tnt_beta');
    expect(m).toMatchObject({ status: 'invited', identityId: 'u_owner', tenantId: 'tnt_beta' });
    const peek = await peekToken(sys(), 'invite', await h.latestToken(OWNER_DEMO, 'invitation'));
    expect(peek.invitee?.existingIdentity).toBe(true);
    const r = await activate(OWNER_DEMO, { consent: true });
    expect(r.status, r.text).toBe(200);
    // the old password still works, a password sent with the invitation changed nothing
    expect((await login(OWNER_DEMO, 'Demo!Pass-2026', '10.9.0.2')).status).toBe(200);
  });

  it('FR-TEN-016/017: two active memberships -> after the right password a session without a tenant; it reads nothing until a tenant is chosen', async () => {
    const r = await login(OWNER_DEMO, 'Demo!Pass-2026', '10.9.0.3');
    expect(r.status).toBe(200);
    expect(r.json.user).toBeNull();
    expect(r.json.tenants.map((t: { tenantId: string }) => t.tenantId).sort()).toEqual([
      'tnt_beta',
      'tnt_demo',
    ]);
    const pending = cookieOf(r);
    for (const path of [
      '/api/v1/auth/me',
      '/api/v1/crm/customers?limit=5',
      '/api/v1/sys/branches',
    ]) {
      const x = await h.call('GET', path, { cookie: pending });
      expect(x.status, path).toBe(403);
      expect(x.json.code).toBe('tenant_selection_required');
    }
    const list = await h.call('GET', '/api/v1/auth/tenants', { cookie: pending });
    expect(list.json.tenants).toHaveLength(2);
  });

  it('FR-TEN-017 c / RULE-026: choosing and switching create a new context; permissions, branch and data of the other tenant do not carry over', async () => {
    const r = await login(OWNER_DEMO, 'Demo!Pass-2026', '10.9.0.4');
    const pick = (cookie: string, tenantId: string) =>
      h.call('POST', '/api/v1/auth/tenant', { cookie, body: { tenantId } });
    const inDemo = await pick(cookieOf(r), 'tnt_demo');
    expect(inDemo.status, inDemo.text).toBe(200);
    const demoCookie = cookieOf(inDemo);
    // the pending session is dead after choosing (one session per context)
    expect((await h.call('GET', '/api/v1/auth/me', { cookie: cookieOf(r) })).status).toBe(401);
    const demoBranches = await h.call('GET', '/api/v1/sys/branches', { cookie: demoCookie });
    expect(demoBranches.status).toBe(200);
    expect(demoBranches.json.items.length).toBeGreaterThan(0);

    const inBeta = await pick(demoCookie, 'tnt_beta');
    expect(inBeta.status, inBeta.text).toBe(200);
    const betaCookie = cookieOf(inBeta);
    expect((await h.call('GET', '/api/v1/auth/me', { cookie: demoCookie })).status).toBe(401);
    const me = await h.call('GET', '/api/v1/auth/me', { cookie: betaCookie });
    expect(me.json.userId).toBe('own_tnt_beta');
    const betaBranches = await h.call('GET', '/api/v1/sys/branches', { cookie: betaCookie });
    expect(betaBranches.status).toBe(200);
    expect(betaBranches.json.items).toEqual([]); // nothing of tnt_demo
    const customers = await h.call('GET', '/api/v1/crm/customers?limit=50', { cookie: betaCookie });
    expect(customers.json.items).toEqual([]);
    // a record id of the other tenant is "not found", the same answer as an unknown id (FR-TEN-009)
    const ghost = await h.call('GET', '/api/v1/crm/customers/cus_nope', { cookie: betaCookie });
    const foreign = await h.call('GET', '/api/v1/crm/customers/cus_an', { cookie: betaCookie });
    expect(foreign.status).toBe(404);
    expect({ ...foreign.json, traceId: '' }).toEqual({ ...ghost.json, traceId: '' });
    // the tenant is never read from what the client sends (FR-TEN-010)
    const spoof = await h.call('GET', '/api/v1/crm/customers?limit=50&tenantId=tnt_demo', {
      cookie: betaCookie,
      headers: { 'x-tenant-id': 'tnt_demo' },
    });
    expect(spoof.json.items).toEqual([]);
    // a tenant that is not one of the person's own answers like an unknown one
    const stranger = await pick(betaCookie, 'tnt_alpha');
    const unknown = await pick(betaCookie, 'tnt_nowhere');
    expect(stranger.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect({ ...stranger.json, traceId: '' }).toEqual({ ...unknown.json, traceId: '' });
  });

  it('FR-TEN-017: revoking a membership in tenant B does not sign the person out of tenant A', async () => {
    const r = await login(OWNER_DEMO, 'Demo!Pass-2026', '10.9.0.5');
    const demo = cookieOf(
      await h.call('POST', '/api/v1/auth/tenant', {
        cookie: cookieOf(r),
        body: { tenantId: 'tnt_demo' },
      }),
    );
    const r2 = await login(OWNER_DEMO, 'Demo!Pass-2026', '10.9.0.6');
    const beta = cookieOf(
      await h.call('POST', '/api/v1/auth/tenant', {
        cookie: cookieOf(r2),
        body: { tenantId: 'tnt_beta' },
      }),
    );
    await revokeAllSessions(sys(), 'own_tnt_beta');
    expect((await h.call('GET', '/api/v1/auth/me', { cookie: beta })).status).toBe(401);
    expect((await h.call('GET', '/api/v1/auth/me', { cookie: demo })).status).toBe(200);
  });

  it('NFR-TEN-01 / RULE-018: the seeded second tenant reuses employee code NV0001 and branch code Q7 without any clash and sees nothing of the first', async () => {
    const two = await h.login('u_owner_b');
    const me = await h.call('GET', '/api/v1/auth/me', { cookie: two });
    expect(me.status).toBe(200);
    const users = await h.call('GET', '/api/v1/sys/users?limit=100', { cookie: two });
    expect(users.json.items.map((u: { employeeCode: string }) => u.employeeCode)).toEqual([
      'NV0001',
    ]);
    const branches = await h.call('GET', '/api/v1/sys/branches', { cookie: two });
    expect(branches.json.items.map((b: { id: string }) => b.id)).toEqual(['br_d2_q7']);
    const first = await h.call('GET', '/api/v1/sys/branches/br_q7', { cookie: two });
    expect(first.status).toBe(404);
  });

  it('FR-TEN-016 / UAT-TEN-21: wrong password, unknown email and a terminated or suspended tenant all end in the same answer', async () => {
    const wrong = await login('alpha.owner@alpha.test', 'wrong-password-x', '10.9.1.1');
    const unknown = await login('nobody@nowhere.test', 'wrong-password-x', '10.9.1.2');
    // terminate alpha (suspend, then terminating, then terminated: each step needs two people), after which its only
    // member cannot sign in and learns nothing about why
    let t = await getTenant(sys(), cnt, 'tnt_alpha');
    for (const to of ['suspended', 'terminating', 'terminated']) {
      await transitionTenant(
        sys(),
        cnt,
        'tnt_alpha',
        { to, reason: 'Kiểm thử cô lập', version: t.version },
        rid(),
      );
      await decideTenantTransition(sys(), cnt2, 'tnt_alpha', { decision: 'approve' }, rid());
      t = await getTenant(sys(), cnt, 'tnt_alpha');
    }
    const suspended = await login('alpha.owner@alpha.test', PW, '10.9.1.3');
    for (const r of [wrong, unknown, suspended]) {
      expect(r.status).toBe(401);
      expect({ ...r.json, traceId: '' }).toEqual({ ...wrong.json, traceId: '' });
    }
    // a person with a tenant that is no longer usable only sees the usable ones
    const mixed = await login(OWNER_DEMO, 'Demo!Pass-2026', '10.9.1.4');
    expect(mixed.status).toBe(200);
  });

  it('FR-TEN-017 d: inviting an email that exists in another tenant answers like inviting a new one and reveals nothing', async () => {
    // the demo owner now has two companies: choose the demo one (a session without a tenant reads nothing)
    const pending = cookieOf(await login(OWNER_DEMO, 'Demo!Pass-2026', '10.9.2.1'));
    const owner = cookieOf(
      await h.call('POST', '/api/v1/auth/tenant', {
        cookie: pending,
        body: { tenantId: 'tnt_demo' },
      }),
    );
    const body = (email: string, code: string) => ({
      email,
      employeeCode: code,
      displayName: 'Người mời thử',
      assignments: [{ roleCode: 'CV', branchId: 'br_q7' }],
    });
    const key = (s: string) => `${s}-0000000000000000`;
    const known = await h.call('POST', '/api/v1/sys/users', {
      cookie: owner,
      key: key('inv-known'),
      body: body('tk.q7@demo.gmep.test', 'NV9001'),
    });
    expect(known.status, known.text).toBe(409); // same tenant: its own member
    const fresh = await h.call('POST', '/api/v1/sys/users', {
      cookie: owner,
      key: key('inv-fresh'),
      body: body('fresh.person@x.test', 'NV9002'),
    });
    expect(fresh.status).toBe(201);
    // member of tenant tnt_alpha (suspended, but the identity exists): invite into tnt_demo
    const elsewhere = await h.call('POST', '/api/v1/sys/users', {
      cookie: owner,
      key: key('inv-else'),
      body: body('alpha.owner@alpha.test', 'NV9003'),
    });
    expect(elsewhere.status).toBe(201);
    const shape = (j: Record<string, unknown>) => Object.keys(j).sort();
    expect(shape(elsewhere.json)).toEqual(shape(fresh.json));
    expect(JSON.stringify(elsewhere.json)).not.toMatch(/tnt_alpha|Garage Alpha|identity/i);
  });
});

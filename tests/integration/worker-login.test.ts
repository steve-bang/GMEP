import { beforeAll, describe, expect, it } from 'vitest';
import {
  getTenant,
  provisionTenant,
  randomTenantCode,
  reissueTenantCode,
  transitionTenant,
  workerLoginAddress,
  type PlatformActor,
} from '@/modules/sys';
import { DEMO_TENANT_CODE } from '@/infrastructure/seed/demo';
import { DEMO_TENANT_2_CODE } from '@/infrastructure/seed/tenantDemo';
import { backends, createHarness, parseSessionCookie, type Harness } from './harness';

/**
 * P2-C (phase-2-plan 14.4, owner decision 07/11/2026): staff without email. The company code is the tenant's six-digit
 * `tenantCode` (owner decision 07/11/2026), never the tenant id. FR-SYS-001 (creation by a manager,
 * temporary password, forced change), FR-TEN-016/017 + RULE-034 (one membership, session bound to its tenant, no
 * "Chọn công ty"), UAT-TEN-21 (neutral errors), NFR-ISO-01 / UAT-TEN-07 (same employee code in two tenants).
 */
const TEMP = 'Tam-Thoi-2026-abc';
const CODE = DEMO_TENANT_CODE;
const NEW_PW = 'Mat-Khau-Moi-2026!';
const cnt: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_owner',
  role: 'CNT',
  displayName: 'CNT',
};
let seq = 0;
const key = () => `worker-key-${String(++seq).padStart(6, '0')}`;
type Json = Record<string, unknown> | null;
const strip = (j: Json) => {
  if (!j) return j;
  const { traceId: _t, instance: _i, requestId: _r, ...rest } = j; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
};

describe.each(backends)('P2-C staff without email [%s]', (backend) => {
  let h: Harness;
  let workerId = '';
  let workerCookie = '';
  const emp = (companyCode: string, employeeCode: string, password: string, ip = '10.7.0.1') =>
    h.call('POST', '/api/v1/auth/login', {
      body: { companyCode, employeeCode, password },
      headers: { 'x-forwarded-for': ip },
    });
  const create = (as: string, body: Record<string, unknown>, cookie?: string) =>
    h.call('POST', '/api/v1/sys/users', {
      ...(cookie ? { cookie } : { as }),
      key: key(),
      body: {
        loginKind: 'employee_code',
        displayName: 'Thợ Không Email',
        assignments: [{ roleCode: 'TH', branchId: 'br_q7' }],
        temporaryPassword: TEMP,
        ...body,
      },
    });
  const change = (cookie: string, body: Record<string, unknown>) =>
    h.call('POST', '/api/v1/auth/change-password', {
      cookie,
      body: { currentPassword: TEMP, newPassword: NEW_PW, consent: true, ...body },
      headers: { 'x-forwarded-for': '10.7.9.9' },
    });
  const auditActions = async (entityId: string) => {
    if (backend !== 'memory') return null;
    return [...h.container.memory!.db.col('auditLogs').values()]
      .filter((a) => (a as { entityId?: string }).entityId === entityId)
      .map((a) => (a as { action: string }).action);
  };

  beforeAll(async () => {
    h = await createHarness(backend);
  });

  it('FR-SYS-001 P2-C: a branch manager creates a staff member without email; no internal address, no password in the answer', async () => {
    const r = await create('u_ql_q7', { employeeCode: 'th-w01' });
    expect(r.status, r.text).toBe(201);
    expect(r.json).toMatchObject({
      employeeCode: 'TH-W01',
      email: '',
      loginKind: 'employee_code',
      companyCode: CODE,
      mustChangePassword: true,
      status: 'active',
    });
    expect(r.text).not.toContain('invalid');
    expect(r.text).not.toContain(TEMP);
    workerId = r.json.id;
    expect(await auditActions(workerId)).toEqual(
      backend === 'memory' ? ['user.create_no_email'] : null,
    );
    if (backend === 'memory') {
      // nothing stored anywhere holds the temporary password or the internal address (only the salted history hash)
      const dump = JSON.stringify(
        ['users', 'userKeys', 'auditLogs', 'idempotency', 'userSecurity'].map((c) => [
          ...h.container.memory!.db.col(c).values(),
        ]),
      );
      expect(dump).not.toContain(TEMP);
      expect(dump).not.toContain(workerLoginAddress('tnt_demo', 'TH-W01'));
    }
  });

  it('P2-C: only branch roles on a concrete branch, a valid temporary password and a free code', async () => {
    const mgmt = await create('u_owner', {
      employeeCode: 'TH-W90',
      assignments: [{ roleCode: 'QL', branchId: 'br_q7' }],
    });
    expect(mgmt.status).toBe(422);
    const all = await create('u_owner', {
      employeeCode: 'TH-W91',
      assignments: [{ roleCode: 'TH', branchId: '*' }],
    });
    expect(all.status).toBe(422);
    const short = await create('u_ql_q7', { employeeCode: 'TH-W92', temporaryPassword: 'short' });
    expect(short.status).toBe(422);
    expect(short.json.errors[0].field).toBe('temporaryPassword');
    const dup = await create('u_ql_q7', { employeeCode: 'TH-W01' });
    expect(dup.status).toBe(409);
    // a manager of another branch cannot create staff in Q7
    const other = await create('u_ql_td', { employeeCode: 'TH-W93' });
    expect(other.status).toBe(403);
  });

  it('P2-C: six-digit company code (spaces ignored) + employee code (case-insensitive) + temporary password opens a change-only session', async () => {
    const r = await emp(` ${CODE.slice(0, 3)} ${CODE.slice(3)} `, ' th-w01 ', TEMP);
    expect(r.status, r.text).toBe(200);
    expect(r.json.passwordChangeRequired).toBe(true);
    expect(r.json.tenants).toBeUndefined(); // never "Chọn công ty"
    const cookie = parseSessionCookie(r.headers);
    for (const path of ['/api/v1/auth/me', '/api/v1/sys/scope', '/api/v1/rec/orders'])
      expect((await h.call('GET', path, { cookie })).status, path).toBe(403);
    expect((await h.call('GET', '/api/v1/auth/tenants', { cookie })).status).toBe(403);
    const pick = await h.call('POST', '/api/v1/auth/tenant', {
      cookie,
      body: { tenantId: 'tnt_demo' },
    });
    expect(pick.status).toBe(403);
    expect(pick.json.code ?? pick.json.type).toBeTruthy();
    workerCookie = cookie;
  });

  it('P2-C: the first change checks the current password, the policy (not the temporary one) and the consent', async () => {
    const wrong = await change(workerCookie, { currentPassword: 'not-the-temp-pass' });
    expect(wrong.status).toBe(422);
    expect(wrong.json.errors[0].field).toBe('currentPassword');
    const same = await change(workerCookie, { newPassword: TEMP });
    expect(same.status).toBe(422);
    expect(same.json.errors[0].field).toBe('newPassword');
    const noConsent = await change(workerCookie, { consent: false });
    expect(noConsent.status).toBe(422);
    const ok = await change(workerCookie, {});
    expect(ok.status, ok.text).toBe(200);
    const full = parseSessionCookie(ok.headers);
    const me = await h.call('GET', '/api/v1/auth/me', { cookie: full });
    expect(me.status).toBe(200);
    expect(me.json.userId).toBe(workerId);
    // the change-only session is gone
    expect((await change(workerCookie, {})).status).toBe(401);
    expect((await emp(CODE, 'TH-W01', TEMP)).status).toBe(401);
    const again = await emp(CODE, 'TH-W01', NEW_PW);
    expect(again.status).toBe(200);
    expect(again.json.passwordChangeRequired).toBeUndefined();
    workerCookie = parseSessionCookie(again.headers);
    const actions = await auditActions(workerId);
    if (actions) expect(actions).toContain('auth.password_changed_first');
    const u = await h.container.sys.users.getById('tnt_demo', workerId);
    expect(u?.mustChangePassword).toBeFalsy();
    expect(u?.policyConsent?.policyVersion).toBeTruthy();
  });

  it('UAT-TEN-21: unknown company, unknown code, wrong password, an email account and a malformed code answer identically', async () => {
    const answers = [
      await emp('159357', 'TH-W01', NEW_PW, '10.7.1.1'), // no tenant holds this code
      await emp('tnt_demo', 'TH-W01', NEW_PW, '10.7.1.7'), // the tenant id is no company code any more
      await emp(CODE.slice(0, 5), 'TH-W01', NEW_PW, '10.7.1.8'), // five digits
      await emp(`${CODE}0`, 'TH-W01', NEW_PW, '10.7.1.9'), // seven digits
      await emp(CODE, 'TH-W77', NEW_PW, '10.7.1.2'),
      await emp(CODE, 'TH-W01', 'wrong-password-123', '10.7.1.3'),
      await emp(CODE, 'NV0101', 'Demo!Pass-2026', '10.7.1.4'), // an email account never signs in by code
      await emp('../x/y', 'a/b', NEW_PW, '10.7.1.5'),
      await emp(DEMO_TENANT_2_CODE, 'TH-W01', NEW_PW, '10.7.1.6'), // the same code in another tenant does not exist
    ];
    const bodies = new Set(answers.map((a) => JSON.stringify([a.status, strip(a.json)])));
    expect([...bodies]).toHaveLength(1);
    expect(answers[0]!.status).toBe(401);
    const cookieNames = new Set(
      answers.map((a) =>
        a.headers
          .getSetCookie()
          .map((c) => c.split('=')[0])
          .join(','),
      ),
    );
    expect([...cookieNames]).toHaveLength(1);
  });

  it('P2-C: the internal address is no email login, cannot be invited and gets no recovery mail', async () => {
    const alias = workerLoginAddress('tnt_demo', 'TH-W01');
    const viaEmail = await h.call('POST', '/api/v1/auth/login', {
      body: { identifier: alias, password: NEW_PW },
      headers: { 'x-forwarded-for': '10.7.2.1' },
    });
    const unknown = await h.call('POST', '/api/v1/auth/login', {
      body: { identifier: 'nobody@nowhere.test', password: NEW_PW },
      headers: { 'x-forwarded-for': '10.7.2.2' },
    });
    expect(viaEmail.status).toBe(401);
    expect(strip(viaEmail.json)).toEqual(strip(unknown.json));
    const invite = await h.call('POST', '/api/v1/sys/users', {
      as: 'u_owner_b',
      key: key(),
      body: {
        email: alias,
        employeeCode: 'TH-W01',
        displayName: 'Mời chéo',
        assignments: [{ roleCode: 'TH', branchId: 'br_d2_q7' }],
      },
    });
    expect(invite.status).toBe(422);
    const before = (await h.outbox()).length;
    const forgot = await h.call('POST', '/api/v1/auth/forgot-password', {
      body: { identifier: alias },
      headers: { 'x-forwarded-for': '10.7.2.3' },
    });
    expect(forgot.status).toBe(202); // neutral answer, nothing sent
    expect((await h.outbox()).length).toBe(before);
  });

  it('P2-C reset: by action and branch scope, audited with the reason, revokes every session, forces a new change', async () => {
    const u = await h.container.sys.users.getById('tnt_demo', workerId);
    const body = {
      temporaryPassword: 'Tam-Moi-2026-xyz',
      reason: 'Thợ quên mật khẩu',
      version: u!.version,
    };
    const path = `/api/v1/sys/users/${workerId}/reset-password`;
    expect((await h.call('POST', path, { as: 'u_ql_td', body })).status).toBe(404); // other branch = missing
    expect((await h.call('POST', path, { as: 'u_th_q7', body })).status).toBe(403); // no permission
    const emailUser = await h.call('POST', '/api/v1/sys/users/u_th_q7/reset-password', {
      as: 'u_ql_q7',
      body: { ...body, version: 1 },
    });
    expect(emailUser.status).toBe(409); // email accounts recover through their email
    const stale = await h.call('POST', path, { as: 'u_ql_q7', body: { ...body, version: 999 } });
    expect(stale.status).toBe(409);
    const ok = await h.call('POST', path, { as: 'u_ql_q7', body });
    expect(ok.status, ok.text).toBe(200);
    expect(ok.json.mustChangePassword).toBe(true);
    expect(ok.text).not.toContain('Tam-Moi-2026-xyz');
    expect((await h.call('GET', '/api/v1/auth/me', { cookie: workerCookie })).status).toBe(401);
    expect((await emp(CODE, 'TH-W01', NEW_PW, '10.7.3.1')).status).toBe(401);
    const tmp = await emp(CODE, 'TH-W01', 'Tam-Moi-2026-xyz', '10.7.3.2');
    expect(tmp.status).toBe(200);
    expect(tmp.json.passwordChangeRequired).toBe(true);
    const actions = await auditActions(workerId);
    if (actions) expect(actions).toContain('user.password_reset_by_manager');
    if (backend === 'memory') {
      const entry = [...h.container.memory!.db.col('auditLogs').values()].find(
        (a) => (a as { action: string }).action === 'user.password_reset_by_manager',
      ) as { reason?: string };
      expect(entry.reason).toBe('Thợ quên mật khẩu');
      expect(JSON.stringify(entry)).not.toContain('Tam-Moi-2026-xyz');
    }
  });

  it('lockout (BA §1.4): an existing and an unknown pair are slowed down the same way; the reset unlocks', async () => {
    const run = async (company: string, code: string) => {
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++)
        statuses.push((await emp(company, code, `bad-pass-${i}-xx`, `10.7.4.${i}`)).status);
      return statuses;
    };
    const known = await run(CODE, 'TH-W01');
    const unknown = await run(CODE, 'TH-W55');
    expect(known).toEqual(unknown);
    expect(known.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(known.at(-1)).toBe(429);
    const u = await h.container.sys.users.getById('tnt_demo', workerId);
    const reset = await h.call('POST', `/api/v1/sys/users/${workerId}/reset-password`, {
      as: 'u_ql_q7',
      body: {
        temporaryPassword: 'Tam-Lan3-2026-q',
        reason: 'Bị khóa đăng nhập',
        version: u!.version,
      },
    });
    expect(reset.status, reset.text).toBe(200);
    expect((await emp(CODE, 'TH-W01', 'Tam-Lan3-2026-q', '10.7.4.200')).status).toBe(200);
  });

  it('counter D: scanning employee codes of one company is slowed down without touching another company', async () => {
    let last = 0;
    for (let i = 0; i < 32; i++)
      last = (await emp('204816', `SCAN${i}`, 'bad-pass-xx', `10.7.5.${i}`)).status;
    expect(last).toBe(429);
    expect((await emp('204817', 'SCAN0', 'bad-pass-xx', '10.7.5.250')).status).toBe(401);
  });

  it('P2-C: a temporary password stops working after the configured time (neutral answer)', async () => {
    const r = await create('u_ql_q7', { employeeCode: 'TH-W02' });
    expect(r.status, r.text).toBe(201);
    const ttl = h.container.sys.config.tempPasswordTtlMs;
    const now = h.clock.now();
    h.clock.set(new Date(now.getTime() + ttl + 60_000).toISOString());
    try {
      const late = await emp(CODE, 'TH-W02', TEMP, '10.7.6.1');
      const unknown = await emp(CODE, 'TH-W56', TEMP, '10.7.6.2');
      expect(late.status).toBe(401);
      expect(strip(late.json)).toEqual(strip(unknown.json));
    } finally {
      h.clock.set(now.toISOString());
    }
  });

  it('anti-scan: random company codes from one address are slowed down (counter C); another address is not', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++)
      statuses.push((await emp(randomTenantCode(), 'NV0001', 'bad-pass-xx', '10.7.10.1')).status);
    expect(
      statuses.slice(0, 60).every((x) => x === 401),
      statuses.join(','),
    ).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // the right company code from that address waits too; the same attempt from another address is answered
    expect((await emp(CODE, 'TH-W01', 'bad-pass-xx', '10.7.10.1')).status).toBe(429);
    expect((await emp(CODE, 'TH-W01', 'bad-pass-xx', '10.7.10.2')).status).toBe(401);
  });

  /** UAT-TEN-07 / NFR-ISO-01: employee codes are unique per tenant only (RULE-018); NV0001 in two tenants never mixes. */
  describe('same employee code NV0001 in two tenants', () => {
    const owners: Record<string, string> = {};
    const codes: Record<string, string> = {};
    let reissuedOld = '';
    beforeAll(async () => {
      for (const code of ['tnt_wka', 'tnt_wkb']) {
        const email = `owner@${code.replace('tnt_', '')}.test`;
        const p = await provisionTenant(
          h.container.sys,
          cnt,
          {
            code,
            name: `Garage ${code}`,
            environment: 'demo',
            owner: { email, name: 'Chủ', employeeCode: 'CH01' },
          },
          { requestId: `req-${code}`, idempotencyKey: `prov-${code}-0001` },
        );
        expect(p.state).toBe('provisioned');
        const t = await getTenant(h.container.sys, cnt, code);
        await transitionTenant(
          h.container.sys,
          cnt,
          code,
          { to: 'active', version: t.version },
          { requestId: `req-${code}-a` },
        );
        const act = await h.call('POST', '/api/v1/auth/activate', {
          body: {
            token: await h.latestToken(email, 'invitation'),
            password: 'Valid-Password-2026!',
            consent: true,
          },
          headers: { 'x-forwarded-for': '10.7.7.1' },
        });
        expect(act.status, act.text).toBe(200);
        const login = await h.call('POST', '/api/v1/auth/login', {
          body: { identifier: email, password: 'Valid-Password-2026!' },
          headers: { 'x-forwarded-for': '10.7.7.2' },
        });
        expect(login.status, login.text).toBe(200);
        owners[code] = parseSessionCookie(login.headers);
        const br = await h.call('POST', '/api/v1/sys/branches', {
          cookie: owners[code],
          key: key(),
          body: { code: 'Q1', name: 'Chi nhánh Q1' },
        });
        expect(br.status, br.text).toBe(201);
        const w = await create(
          '',
          {
            employeeCode: 'NV0001',
            assignments: [{ roleCode: 'TH', branchId: br.json.id }],
            temporaryPassword: `Tam-${code}-2026`,
          },
          owners[code],
        );
        expect(w.status, w.text).toBe(201);
        expect(w.json.companyCode).toMatch(/^\d{6}$/);
        expect((await getTenant(h.container.sys, cnt, code)).tenantCode).toBe(w.json.companyCode);
        codes[code] = w.json.companyCode;
      }
    });

    it('each tenant code opens its own NV0001 only; the password of one never opens the other', async () => {
      expect(workerLoginAddress('tnt_wka', 'NV0001')).not.toBe(
        workerLoginAddress('tnt_wkb', 'NV0001'),
      );
      expect(codes.tnt_wka).not.toBe(codes.tnt_wkb);
      const crossed = await emp(codes.tnt_wka!, 'NV0001', 'Tam-tnt_wkb-2026', '10.7.8.1');
      expect(crossed.status).toBe(401);
      for (const code of ['tnt_wka', 'tnt_wkb']) {
        expect((await emp(code, 'NV0001', `Tam-${code}-2026`, '10.7.8.3')).status).toBe(401); // id refused
        const r = await emp(codes[code]!, 'NV0001', `Tam-${code}-2026`, '10.7.8.2');
        expect(r.status, r.text).toBe(200);
        const ok = await change(parseSessionCookie(r.headers), {
          currentPassword: `Tam-${code}-2026`,
          newPassword: `Moi-${code}-2026!`,
        });
        expect(ok.status, ok.text).toBe(200);
        const session = await h.container.sys.sessions.find(
          parseSessionCookie(ok.headers).split('=')[1]!.split('.')[0]!,
        );
        expect(session?.tenantId).toBe(code);
        expect(session?.memberships).toHaveLength(1);
      }
      // the owner of tnt_wkb resets "NV0001" of tnt_wka: unknown there
      const users = await h.call('GET', '/api/v1/sys/users?limit=100', { cookie: owners.tnt_wka });
      const a = (users.json.items as { id: string; employeeCode: string }[]).find(
        (x) => x.employeeCode === 'NV0001',
      )!;
      const cross = await h.call('POST', `/api/v1/sys/users/${a.id}/reset-password`, {
        cookie: owners.tnt_wkb,
        body: { temporaryPassword: 'Tam-Cheo-2026-zz', reason: 'thử chéo', version: 1 },
      });
      expect(cross.status).toBe(404);
    });

    /** Owner decision 07/11/2026: the platform reissues a leaked company code; staff keep their account and password. */
    it('reissue (CNT/QTN): reason, idempotent, platform audit; the old code opens nothing, the new one opens the same account', async () => {
      const sys = h.container.sys;
      const qtn: PlatformActor = { ...cnt, platformUserId: 'pf_admin', role: 'QTN' };
      const htn: PlatformActor = { ...cnt, platformUserId: 'pf_support', role: 'HTN' };
      const before = await getTenant(sys, cnt, 'tnt_wka');
      const old = before.tenantCode!;
      expect(old).toBe(codes.tnt_wka);
      const input = { reason: 'Mã công ty bị lộ trên mạng xã hội', version: before.version };
      const rid = { requestId: 'req-reissue', idempotencyKey: 'reissue-wka-000001' };
      await expect(reissueTenantCode(sys, htn, 'tnt_wka', input, rid)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        reissueTenantCode(sys, qtn, 'tnt_wka', { ...input, reason: ' ' }, rid),
      ).rejects.toMatchObject({ status: 422 });
      await expect(
        reissueTenantCode(sys, qtn, 'tnt_wka', input, { requestId: 'r' }),
      ).rejects.toMatchObject({ status: 400 });
      const r = await reissueTenantCode(sys, qtn, 'tnt_wka', input, rid);
      expect(r.replayed).toBe(false);
      expect(r.previousCode).toBe(old);
      expect(r.tenant.tenantCode).toMatch(/^\d{6}$/);
      expect(r.tenant.tenantCode).not.toBe(old);
      const hold = sys.config.tenantCodeHoldDays * 86_400_000;
      expect(new Date(r.releaseAfter!).getTime()).toBe(h.clock.now().getTime() + hold);
      // a retried call (same key) draws nothing new; another key on the old version is a conflict
      const again = await reissueTenantCode(sys, qtn, 'tnt_wka', input, rid);
      expect(again.replayed).toBe(true);
      expect(again.tenant.tenantCode).toBe(r.tenant.tenantCode);
      await expect(
        reissueTenantCode(sys, qtn, 'tnt_wka', input, { ...rid, idempotencyKey: 'reissue-wka-2' }),
      ).rejects.toMatchObject({ status: 409 });
      codes.tnt_wka = r.tenant.tenantCode!;
      reissuedOld = old;

      // the internal address hashes (tenant id, employee code): same account, same password, new code only
      const stale = await emp(old, 'NV0001', 'Moi-tnt_wka-2026!', '10.7.11.1');
      const unknown = await emp('159357', 'NV0001', 'Moi-tnt_wka-2026!', '10.7.11.2');
      expect(stale.status).toBe(401);
      expect(strip(stale.json)).toEqual(strip(unknown.json));
      const ok = await emp(codes.tnt_wka, 'NV0001', 'Moi-tnt_wka-2026!', '10.7.11.3');
      expect(ok.status, ok.text).toBe(200);
      expect(
        (await h.call('GET', '/api/v1/auth/me', { cookie: parseSessionCookie(ok.headers) })).json
          .userId,
      ).toBeTruthy();
      const users = await h.call('GET', '/api/v1/sys/users?limit=100', { cookie: owners.tnt_wka });
      const w = (users.json.items as { id: string; employeeCode: string }[]).find(
        (x) => x.employeeCode === 'NV0001',
      )!;
      const detail = await h.call('GET', `/api/v1/sys/users/${w.id}`, { cookie: owners.tnt_wka });
      expect(detail.json.companyCode).toBe(codes.tnt_wka);

      const oldSlot = await sys.tenants.getCodeSlot(old);
      expect(oldSlot).toMatchObject({ tenantId: 'tnt_wka', state: 'retired' });
      if (backend === 'memory') {
        const line = [...h.container.memory!.db.col('platformAuditLogs').values()].find(
          (a) => (a as { action: string }).action === 'tenant.code_reissued',
        ) as { reason?: string; actorRole?: string; tenantId?: string };
        expect(line).toMatchObject({
          reason: 'Mã công ty bị lộ trên mạng xã hội',
          actorRole: 'QTN',
          tenantId: 'tnt_wka',
        });
      }
    });

    it('a reissued code is held for the configured period: no other tenant draws it before, one may after', async () => {
      const sys = h.container.sys;
      const old = reissuedOld;
      expect(await sys.tenants.getCodeSlot(old)).toMatchObject({ state: 'retired' });
      const original = sys.newTenantCode;
      const queue = (xs: string[]) => () => xs.shift() ?? '583920';
      const prov = (code: string) =>
        provisionTenant(
          sys,
          cnt,
          { code, name: `Garage ${code}`, environment: 'demo' },
          { requestId: `req-${code}`, idempotencyKey: `prov-${code}-0001` },
        );
      const now = h.clock.now();
      try {
        sys.newTenantCode = queue([old, '583921']);
        expect((await prov('tnt_wkc')).tenant.tenantCode).toBe('583921');
        h.clock.set(
          new Date(now.getTime() + (sys.config.tenantCodeHoldDays + 1) * 86_400_000).toISOString(),
        );
        sys.newTenantCode = queue([old]);
        expect((await prov('tnt_wkd')).tenant.tenantCode).toBe(old);
        expect(await sys.tenants.getCodeSlot(old)).toMatchObject({
          tenantId: 'tnt_wkd',
          state: 'active',
        });
      } finally {
        sys.newTenantCode = original;
        h.clock.set(now.toISOString());
      }
    });
  });
});

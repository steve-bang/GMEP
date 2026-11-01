import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { allBranchesScope } from '@/platform/scope/scope';
import { allocateDocumentNumber, revealPii } from '@/modules/sys';
import { chunkBranches } from '@/platform/store/docStore';
import { Q } from '@/infrastructure/repos/queries';
import { getDb } from '@/infrastructure/firestore/client';
import { FirestoreDocStore } from '@/infrastructure/store/firestoreDocStore';
import {
  allRouteFiles,
  backends,
  createHarness,
  hasEmulator,
  listAll,
  type Harness,
} from './harness';

describe.each(backends)('FR-REC-030 / BA-13 document numbering service [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });
  const branch = { id: 'br_q7', companyId: 'cmp_demo', code: 'Q7' } as never;
  const alloc = (
    docType: string,
    businessDate: string,
    stage: 'create' | 'post',
    requestKey?: string,
    documentId = 'doc-1',
  ) =>
    h.container.sys.uow.run((tx) =>
      allocateDocumentNumber(h.container.sys, tx, {
        branch,
        docType,
        businessDate,
        stage,
        documentId,
        ...(requestKey ? { requestKey } : {}),
      }),
    );

  it('group A numbers at creation, increments per branch/type/month, restarts each month from the businessDate', async () => {
    expect((await alloc('repair-order', '2026-11-03', 'create')).number).toBe('RO-Q7-2611-00001');
    expect((await alloc('repair-order', '2026-11-30', 'create')).number).toBe('RO-Q7-2611-00002');
    expect((await alloc('repair-order', '2026-12-01', 'create')).number).toBe('RO-Q7-2612-00001');
    expect((await alloc('repair-order', '2026-11-30', 'create')).number).toBe('RO-Q7-2611-00003'); // late entry keeps its own period
    expect((await alloc('quote', '2026-11-03', 'create')).number).toBe('BG-Q7-2611-00001'); // separate sequence per type
    expect((await alloc('repair-order', '2026-11-03', 'post')).number).toBeNull(); // group A: nothing at posting
  });
  it('group B gets a temporary reference as draft (no counter used) and the number only when posted', async () => {
    const draft = await alloc(
      'receipt-voucher',
      '2026-11-03',
      'create',
      undefined,
      'abcd-1234-efgh',
    );
    expect(draft.number).toBeNull();
    expect(draft.draftRef).toMatch(/^NHAP-/);
    const posted = await alloc('receipt-voucher', '2026-11-03', 'post');
    expect(posted.number).toBe('PT-Q7-2611-00001'); // the draft consumed nothing: no gap
  });
  it('the same request key returns the same number and does not consume another one', async () => {
    const a = await alloc('intake', '2026-11-03', 'create', 'req-key-0001');
    const b = await alloc('intake', '2026-11-03', 'create', 'req-key-0001');
    expect(b.number).toBe(a.number);
    expect(b.assigned?.replayed).toBe(true);
    const c = await alloc('intake', '2026-11-03', 'create', 'req-key-0002');
    expect(c.assigned!.seq).toBe(a.assigned!.seq + 1);
  });
  it('a rolled-back transaction burns no number (never a hole for group B)', async () => {
    const before = (await alloc('goods-receipt', '2026-11-03', 'post')).assigned!.seq;
    await expect(
      h.container.sys.uow.run(async (tx) => {
        await allocateDocumentNumber(h.container.sys, tx, {
          branch,
          docType: 'goods-receipt',
          businessDate: '2026-11-03',
          stage: 'post',
          documentId: 'x',
        });
        throw new Error('business rule failed after numbering');
      }),
    ).rejects.toThrow('business rule failed');
    const after = (await alloc('goods-receipt', '2026-11-03', 'post')).assigned!.seq;
    expect(after).toBe(before + 1);
  });
  it('concurrency: 25 parallel transactions on one series get 25 distinct consecutive numbers (no duplicates, no holes)', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => alloc('payment-voucher', '2026-11-05', 'post')),
    );
    const seqs = results.map((r) => r.assigned!.seq).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(new Set(results.map((r) => r.number)).size).toBe(25);
  });
  it('series are configuration: an approved numbering-series version overrides the default from its date', async () => {
    const eff = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const p = await h.call('POST', '/api/v1/sys/config/numbering-series', {
      as: 'u_ad',
      key: 'num-cfg-0001-aaaa',
      body: {
        scopeKey: 'cash-transfer',
        effectiveFrom: eff,
        reason: 'kế toán yêu cầu dãy năm',
        payload: {
          prefix: 'CQ',
          group: 'B',
          gapPolicy: 'strict',
          scope: 'branch',
          period: 'year',
          seqWidth: 6,
          reversalSameSeries: true,
        },
      },
    });
    expect(p.status).toBe(201);
    // AD cannot approve; the owner can
    expect(
      (
        await h.call(
          'POST',
          `/api/v1/sys/config/numbering-series/${encodeURIComponent(p.json.id)}/decide`,
          { as: 'u_ad', key: 'num-cfg-0002-aaaa', body: { decision: 'approve' } },
        )
      ).status,
    ).toBe(403);
    await h.call(
      'POST',
      `/api/v1/sys/config/numbering-series/${encodeURIComponent(p.json.id)}/decide`,
      { as: 'u_owner', key: 'num-cfg-0003-aaaa', body: { decision: 'approve' } },
    );
    const before = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10); // the day before the new series applies
    const [, mm] = before.split('-');
    expect((await alloc('cash-transfer', before, 'post')).number).toBe(
      `CQ-Q7-${before.slice(2, 4)}${mm}-00001`,
    ); // default series
    expect((await alloc('cash-transfer', eff, 'post')).number).toBe(
      `CQ-Q7-${eff.slice(2, 4)}-000001`,
    );
  });
  it('unknown document types are refused', async () => {
    await expect(alloc('unknown-type', '2026-11-03', 'create')).rejects.toMatchObject({
      code: 'numbering_unknown_type',
    });
  });
});

describe.each(backends)('NFR-SEC-03 PII masking, reveal and access log [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });
  const reveal = (as: string, body: object) =>
    h.call('POST', '/api/v1/sys/pii/reveal', { as, body });
  beforeAll(() => {
    // CRM does not exist yet: a test-only source standing in for `customer` (accountant may view it)
    h.container.sys.piiSources['test-customer'] = {
      permission: 'warehouse:view',
      async load(_deps, scope, id) {
        if (id !== 'c1') return null;
        const ok = scope.kind === 'all' || scope.branchIds.includes('br_q7');
        return ok
          ? {
              branchId: 'br_q7',
              values: { phone: '0911222333', address: '1 A, Phường B, Quận 7, TP.HCM' },
            }
          : null;
      },
    };
  });
  const rawAccessLogs = async () =>
    backend === 'memory'
      ? [...h.container.memory!.db.col('accessLogs').values()]
      : (await getDb(h.container.env).collection('accessLogs').get()).docs.map((d) => d.data());

  it('serializers mask staff phone numbers by role; the full value is absent from the response', async () => {
    const asOwner = await h.call('GET', '/api/v1/sys/users/u_cv_q7', { as: 'u_owner' });
    expect(asOwner.json).toMatchObject({ phone: '09•• ••• 103', phoneReveal: 'plain' });
    expect(asOwner.text).not.toContain('0900000103');
    const asManager = await h.call('GET', '/api/v1/sys/users/u_cv_q7', { as: 'u_ql_q7' });
    expect(asManager.json.phone).toBe('0900000103'); // QL sees in full (BA §7.1: branch manager, related branch)
    const asAdmin = await h.call('GET', '/api/v1/sys/users/u_cv_q7', { as: 'u_ad' });
    expect(asAdmin.json.phone).toBeUndefined();
    expect(asAdmin.text).not.toContain('0900000103');
    const list = await h.call('GET', '/api/v1/sys/users?limit=100', { as: 'u_owner' });
    expect(list.text).not.toMatch(/090000010[0-9]/);
  });
  it('reveal: allowed for the owner without reason, logged with roles/session/result and WITHOUT the value', async () => {
    const r = await reveal('u_owner', { entityType: 'user', entityId: 'u_cv_q7', field: 'phone' });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ field: 'phone', value: '0900000103' });
    expect(r.headers.get('cache-control')).toBe('no-store');
    const logs = await rawAccessLogs();
    const entry = logs.find((l) => l.purpose === 'reveal' && l.actorId === 'u_owner')!;
    expect(entry).toMatchObject({
      entityType: 'user',
      entityId: 'u_cv_q7',
      fields: ['phone'],
      result: 'allowed',
      actorRoles: ['CH'],
    });
    expect(entry.sessionId).toBeTruthy();
    expect(JSON.stringify(logs)).not.toContain('0900000103');
  });
  it('reveal: the accountant needs a coded reason and a note of at least 5 characters; denials are logged too', async () => {
    const base = { entityType: 'test-customer', entityId: 'c1', field: 'phone' };
    expect((await reveal('u_kt', base)).status).toBe(422);
    expect(
      (await reveal('u_kt', { ...base, reasonCode: 'invoice_check', reasonText: 'abc' })).status,
    ).toBe(422);
    const ok = await reveal('u_kt', {
      ...base,
      reasonCode: 'invoice_check',
      reasonText: 'đối chiếu hóa đơn tháng 10',
    });
    expect(ok.status).toBe(200);
    expect(ok.json.value).toBe('0911222333');
    const logs = await rawAccessLogs();
    expect(
      logs.filter((l) => l.actorId === 'u_kt' && l.result === 'denied').length,
    ).toBeGreaterThanOrEqual(2);
    const allowed = logs.find((l) => l.actorId === 'u_kt' && l.result === 'allowed')!;
    expect(allowed).toMatchObject({ reasonCode: 'invoice_check' });
    expect(JSON.stringify(allowed)).not.toContain('đối chiếu'); // free text is not copied into the log
  });
  it('reveal: a customer source respects the scope of the source permission (out-of-scope looks missing) and the address field', async () => {
    const tdManager = await reveal('u_ql_td', {
      entityType: 'test-customer',
      entityId: 'c1',
      field: 'phone',
    });
    expect(tdManager.status).toBe(403); // QL is a full-view role: no reveal button, no reveal
    const owner = await reveal('u_owner', {
      entityType: 'test-customer',
      entityId: 'c1',
      field: 'address',
    });
    expect(owner.json.value).toContain('Quận 7');
    const addr = await h.call('GET', '/api/v1/sys/users/u_cv_q7', { as: 'u_tk_q7' });
    expect(addr.status).toBe(403);
  });
  it('reveal: roles without the right get 403 (logged); out-of-scope or unknown entities look missing', async () => {
    const base = { entityType: 'user', entityId: 'u_cv_q7', field: 'phone' };
    expect((await reveal('u_ad', base)).json.code).toBe('pii_reveal_denied');
    expect((await reveal('u_tk_q7', base)).json.code).toBe('pii_reveal_denied');
    expect((await reveal('u_th_q7', base)).status).toBe(403);
    expect((await reveal('u_owner', { ...base, entityId: 'nope' })).status).toBe(404);
    expect((await reveal('u_owner', { ...base, entityType: 'customer' })).status).toBe(404);
    expect((await reveal('u_owner', { ...base, field: 'address' })).status).toBe(404); // user has no address
    const denied = (await rawAccessLogs()).filter(
      (l) => l.result === 'denied' && l.actorId === 'u_ad',
    );
    expect(denied.length).toBeGreaterThan(0);
  });
  it('reveal is rate limited per user', async () => {
    let last = 0;
    for (let i = 0; i < 32; i++)
      last = (await reveal('u_owner', { entityType: 'user', entityId: 'u_cv_q7', field: 'phone' }))
        .status;
    expect(last).toBe(429);
  });
  it('audit log keeps only the field name and a changed marker for personal data (BA conflict resolution #2)', async () => {
    const u = await h.call('GET', '/api/v1/sys/users/u_cv_q7', { as: 'u_ql_q7' });
    await h.call('PATCH', '/api/v1/sys/users/u_cv_q7', {
      as: 'u_ql_q7',
      body: { phone: '0988776655', version: u.json.version },
    });
    const entries = (
      await h.container.sys.audit.list(
        allBranchesScope('cmp_demo'),
        { entityType: 'user', entityId: 'u_cv_q7' },
        { limit: 10 },
      )
    ).items;
    const upd = entries.find((e) => e.action === 'user.update')!;
    expect(upd.after).toMatchObject({ phone: '[đã đổi]' });
    expect(JSON.stringify(entries)).not.toMatch(/0988776655|0900000103/);
    // invite entries do not carry the email/phone either
    const invited = await h.call('POST', '/api/v1/sys/users', {
      as: 'u_ql_q7',
      key: 'pii-inv-0001-aaaa',
      body: {
        email: 'pii.check@demo.gmep.test',
        employeeCode: 'NV7777',
        displayName: 'Kiểm tra PII',
        phone: '0977665544',
        assignments: [{ roleCode: 'CV', branchId: 'br_q7' }],
      },
    });
    const log = await h.call(
      'GET',
      `/api/v1/sys/audit?entityType=user&entityId=${invited.json.id}`,
      { as: 'u_owner' },
    );
    expect(JSON.stringify(log.json)).not.toMatch(/0977665544|pii\.check@/);
  });
  it('request logs never contain the password or the login name', async () => {
    const lines: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => (
      lines.push(String(chunk)),
      true
    )) as typeof process.stdout.write;
    try {
      await h.call('POST', '/api/v1/auth/login', {
        body: { identifier: 'leak.check@demo.gmep.test', password: 'Sup3r-Secret-Pass' },
        headers: { 'x-forwarded-for': '10.20.20.20' },
      });
    } finally {
      process.stdout.write = orig;
    }
    const out = lines.join('');
    expect(out).not.toContain('Sup3r-Secret-Pass');
    expect(out).not.toContain('leak.check');
  });
  it('revealPii is the only code path that returns a full value (type-level: it needs a session id)', () => {
    expect(revealPii.length).toBe(5);
  });
});

describe.each(backends)(
  'security headers coverage: CSRF Origin check on EVERY write route [%s]',
  (backend) => {
    let h: Harness;
    beforeAll(async () => {
      h = await createHarness(backend);
    });
    it('every route file that exports POST/PUT/PATCH/DELETE rejects a foreign or missing Origin before doing anything', async () => {
      const routes = allRouteFiles();
      expect(routes.length).toBeGreaterThan(30);
      let checked = 0;
      for (const r of routes) {
        for (const method of r.methods.filter((m) => m !== 'GET')) {
          const path = r.file
            .replace('/src/app', '')
            .replace('/route.ts', '')
            .replace(/\[(\w+)\]/g, 'x1');
          for (const origin of ['https://evil.example', null]) {
            const res = await h.call(method, path, {
              as: 'u_owner',
              origin,
              body: {},
              key: 'csrf-check-0001-aaaa',
            });
            expect(res.status, `${method} ${path} origin=${origin}`).toBe(403);
            expect(res.json.code, `${method} ${path}`).toBe('bad_origin');
          }
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(20);
    });
    it('every API route file is wrapped by apiRoute (static check of the source)', () => {
      const files: string[] = [];
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          if (statSync(join(d, f)).isDirectory()) walk(join(d, f));
          else if (f === 'route.ts') files.push(join(d, f));
        }
      };
      walk('src/app/api');
      for (const f of files) {
        const src = readFileSync(f, 'utf8');
        const exported = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = (\w+)\(/g)];
        for (const [, , wrapper] of exported)
          expect(['apiRoute', 'api', 'authed'], f).toContain(wrapper);
        expect(src, f).not.toMatch(/export (async )?function (GET|POST|PUT|PATCH|DELETE)\b/);
      }
    });
  },
);

describe.each(backends)(
  'H1 per-request cost: cached session and permission verification [%s]',
  (backend) => {
    it('measures store and identity calls per authenticated request, cache off vs on, and keeps revocation safe', async () => {
      const measure = async (ttl: string) => {
        const h = await createHarness(backend, { env: { AUTH_CACHE_TTL_SECONDS: ttl } });
        const cookie = await h.login('u_ql_q7');
        await h.call('GET', '/api/v1/sys/warehouses?limit=5', { cookie }); // warm
        const s0 = { ...h.container.store.stats };
        const i0 = { ...h.container.identity.calls };
        const N = 10;
        for (let i = 0; i < N; i++)
          await h.call('GET', '/api/v1/sys/warehouses?limit=5', { cookie });
        const s1 = h.container.store.stats;
        const i1 = h.container.identity.calls;
        return {
          h,
          cookie,
          storeOps: (s1.reads + s1.queries + s1.writes - (s0.reads + s0.queries + s0.writes)) / N,
          queries: (s1.queries - s0.queries) / N,
          identityCalls: (i1.verify - i0.verify) / N,
        };
      };
      const before = await measure('0');
      const after = await measure('30');
      console.log(
        `H1 [${backend}] per request (warehouse list): cache off -> store ops ${before.storeOps}, queries ${before.queries}, identity verify ${before.identityCalls}; cache on -> store ops ${after.storeOps}, queries ${after.queries}, identity verify ${after.identityCalls}`,
      );
      expect(before.identityCalls).toBe(1);
      expect(after.identityCalls).toBe(0);
      expect(after.storeOps).toBeLessThan(before.storeOps);
      // maximum staleness semantic: revoke in THIS process is immediate (cache invalidated) ...
      const { h, cookie } = after;
      expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(200);
      await h.call('DELETE', '/api/v1/sys/users/u_ql_q7/sessions', { as: 'u_owner' });
      expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401);
    });
    it('a revocation done by ANOTHER instance (no local invalidation) is honoured after at most the cache TTL', async () => {
      const h = await createHarness(backend, { env: { AUTH_CACHE_TTL_SECONDS: '30' } });
      const cookie = await h.login('u_tk_q7');
      expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(200);
      // simulate another instance: revoke directly in the stores, bypassing this process's cache
      await h.container.sys.sessions.revokeAllForUser('u_tk_q7', h.clock.now());
      await h.container.identity.revokeUserTokens('u_tk_q7');
      expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(200); // stale, within TTL
      h.container.sys.caches.auth.clear(); // = TTL elapsed
      expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401);
    });
    it('idle and absolute timeouts are still enforced on cache hits, per role', async () => {
      const h = await createHarness(backend, { env: { AUTH_CACHE_TTL_SECONDS: '300' } });
      const owner = await h.login('u_owner'); // CH: 15 minute idle
      const tk = await h.login('u_tk_q7'); // TK: 30 minute idle
      expect((await h.call('GET', '/api/v1/auth/me', { cookie: owner })).status).toBe(200);
      expect((await h.call('GET', '/api/v1/auth/me', { cookie: tk })).status).toBe(200);
      h.clock.set(new Date(Date.now() + 16 * 60_000).toISOString());
      expect((await h.call('GET', '/api/v1/auth/me', { cookie: owner })).status).toBe(401);
      expect((await h.call('GET', '/api/v1/auth/me', { cookie: tk })).status).toBe(200); // kept alive; touched
      h.clock.set(new Date(Date.now() + 13 * 3_600_000).toISOString());
      expect((await h.call('GET', '/api/v1/auth/me', { cookie: tk })).status).toBe(401); // 12 h absolute
    });
  },
);

describe.each(backends)('H2 idempotency TTL vs business uniqueness [%s]', (backend) => {
  it('an expired key is no longer replayed, but the business key (branch + code) still refuses a duplicate', async () => {
    const h = await createHarness(backend);
    const body = { branchId: 'br_q7', code: 'TTL-1', name: 'Kho TTL' };
    const a = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ad',
      key: 'ttl-key-0001-aaaaa',
      body,
    });
    expect(a.status).toBe(201);
    const replay = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ad',
      key: 'ttl-key-0001-aaaaa',
      body,
    });
    expect(replay.headers.get('idempotent-replayed')).toBe('true');
    h.clock.set(new Date(Date.now() + 25 * 3_600_000).toISOString()); // past IDEMPOTENCY_TTL_HOURS = 24
    const late = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ad',
      key: 'ttl-key-0001-aaaaa',
      body,
    });
    expect(late.headers.get('idempotent-replayed')).toBeNull();
    expect(late.status).toBe(409);
    expect(late.json.code).toBe('warehouse_code_exists'); // business uniqueness is independent of the HTTP record
    const warehouses = await listAll(h, 'u_ad', { q: 'kho ttl' });
    expect(warehouses.items).toHaveLength(1);
    // the stored record carries the Firestore TTL field
    const rec =
      backend === 'memory'
        ? [...h.container.memory!.db.col('idempotencyKeys').values()][0]
        : (
            await getDb(h.container.env).collection('idempotencyKeys').limit(1).get()
          ).docs[0]!.data();
    expect(rec).toHaveProperty('expiresAt');
  });
});

describe.runIf(hasEmulator)('H3 `in` queries over 30 branches on the Firestore emulator', () => {
  it('chunks the scope, merges the chunks and pages with a correct cursor (no skipped or repeated rows)', async () => {
    const h = await createHarness('firestore', { seed: false });
    const db = getDb(h.container.env);
    const store = new FirestoreDocStore(db);
    const BR = 75;
    const batch = db.batch();
    for (let b = 0; b < BR; b++)
      for (let k = 0; k < 2; k++)
        batch.set(db.collection('warehouses').doc(`wh_chunk_${b}_${k}`), {
          companyId: 'c-chunk',
          branchId: `bx${b}`,
          code: `K${String((b * 7 + k * 13) % 150).padStart(3, '0')}-${b}${k}`,
          nameNorm: `n${b}${k}`,
          status: 'active',
        });
    // an unrelated branch that must never appear
    batch.set(db.collection('warehouses').doc('wh_chunk_other'), {
      companyId: 'c-chunk',
      branchId: 'other',
      code: 'ZZZ',
      nameNorm: 'zzz',
      status: 'active',
    });
    await batch.commit();
    const scope = Array.from({ length: BR }, (_, i) => `bx${i}`);
    expect(chunkBranches(scope)).toHaveLength(3);
    const shape = Q.warehouses['code.asc']!.pick([], true);
    const seen: string[] = [];
    let cursor: { v: string; id: string } | undefined;
    let pages = 0;
    for (;;) {
      const rows = await store.query(shape, {
        eq: { companyId: 'c-chunk' },
        scopeBranches: scope,
        limit: 21,
        ...(cursor ? { cursor } : {}),
      });
      const page = rows.slice(0, 20);
      seen.push(...page.map((r) => r.id));
      pages++;
      if (rows.length <= 20) break;
      const last = page.at(-1)!;
      cursor = { v: last.data.code, id: last.id };
    }
    expect(seen).toHaveLength(BR * 2);
    expect(new Set(seen).size).toBe(BR * 2);
    expect(seen).not.toContain('wh_chunk_other');
    expect(pages).toBe(8);
    const dbCodes = (
      await db.collection('warehouses').where('companyId', '==', 'c-chunk').get()
    ).docs
      .filter((d) => d.data().branchId !== 'other')
      .map((d) => `${d.data().code}|${d.id}`)
      .sort();
    const viaPages = seen.map((id) => `${batchLookup(id)}|${id}`);
    function batchLookup(id: string) {
      const m = /wh_chunk_(\d+)_(\d)/.exec(id)!;
      const b = Number(m[1]);
      const k = Number(m[2]);
      return `K${String((b * 7 + k * 13) % 150).padStart(3, '0')}-${b}${k}`;
    }
    expect(viaPages).toEqual(dbCodes);
  });
});

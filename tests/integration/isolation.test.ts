import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { backends, createHarness, listAll, type Harness } from './harness';

/**
 * Branch isolation test matrix (NFR-ISO-01, FR-SYS-002, UAT-06): a user of branch A can never
 * list, search, get or export branch B data. Out-of-scope records answer exactly like missing ones.
 * Runs against the in-memory adapters always and against the Firestore Emulator when available.
 */
describe.each(backends)('FR-SYS-002 branch isolation matrix [%s]', (backend) => {
  let h: Harness;
  const EXTRA_Q7 = 30;
  const EXTRA_TD = 27;

  beforeAll(async () => {
    h = await createHarness(backend);
    // enough rows in both branches to force several pages
    for (let i = 1; i <= EXTRA_Q7; i++) {
      const r = await h.call('POST', '/api/v1/sys/warehouses', {
        as: 'u_ad',
        key: `seed-q7-${String(i).padStart(4, '0')}-xxxxxxxx`,
        body: {
          branchId: 'br_q7',
          code: `Q7-${String(i).padStart(3, '0')}`,
          name: `Kho phụ ${i} Quận 7`,
        },
      });
      expect(r.status).toBe(201);
    }
    for (let i = 1; i <= EXTRA_TD; i++) {
      const r = await h.call('POST', '/api/v1/sys/warehouses', {
        as: 'u_ad',
        key: `seed-td-${String(i).padStart(4, '0')}-xxxxxxxx`,
        body: {
          branchId: 'br_td',
          code: `TD-${String(i).padStart(3, '0')}`,
          name: `Kho phụ ${i} Thủ Đức`,
        },
      });
      expect(r.status).toBe(201);
    }
  });
  afterAll(() => undefined);

  // 3 seeded + 30 extra in Q7; 2 + 27 in TD; 1 in the locked branch
  const total = { br_q7: 3 + EXTRA_Q7, br_td: 2 + EXTRA_TD, br_lk: 1 };
  const visible: Record<string, string[]> = {
    u_owner: ['br_q7', 'br_td', 'br_lk'],
    u_ql_q7: ['br_q7'],
    u_ql_td: ['br_td'],
    u_tk_q7: ['br_q7'],
  };

  describe.each(Object.entries(visible))('user %s', (user, branches) => {
    it('list returns exactly the in-scope rows across all pages, none from other branches', async () => {
      const { items, pages } = await listAll(h, user, {}, 25);
      const expected = branches.reduce((n, b) => n + total[b as keyof typeof total], 0);
      expect(items.length).toBe(expected);
      expect(new Set(items.map((i) => i.id)).size).toBe(expected); // no duplicates across pages
      expect(items.every((i) => branches.includes(i.branchId))).toBe(true);
      expect(pages).toBeGreaterThan(1);
    });

    it('search never returns out-of-scope rows (diacritics-insensitive prefix)', async () => {
      for (const q of ['kho', 'KHO PHỤ', 'kho chinh', 'Kho chính Thủ Đức']) {
        const { items } = await listAll(h, user, { q });
        expect(items.every((i) => branches.includes(i.branchId))).toBe(true);
      }
      const td = await listAll(h, user, { q: 'Kho chinh thu duc' });
      expect(td.items.length).toBe(branches.includes('br_td') ? 1 : 0);
    });

    it('GET by id: in-scope 200, out-of-scope 404 identical to a missing id', async () => {
      const missing = await h.call('GET', '/api/v1/sys/warehouses/wh_nope_NOPE', { as: user });
      expect(missing.status).toBe(404);
      for (const [branch, id] of [
        ['br_q7', 'wh_br_q7_WH-CHINH'],
        ['br_td', 'wh_br_td_WH-CHINH'],
        ['br_lk', 'wh_br_lk_WH-CHINH'],
      ] as const) {
        const res = await h.call('GET', `/api/v1/sys/warehouses/${id}`, { as: user });
        if (branches.includes(branch)) expect(res.status).toBe(200);
        else {
          expect(res.status).toBe(404);
          expect({ ...res.json, traceId: 'x' }).toEqual({ ...missing.json, traceId: 'x' });
        }
      }
    });

    it('requesting another branch via the branchId filter yields nothing, not an error that leaks existence', async () => {
      for (const b of ['br_q7', 'br_td', 'br_lk']) {
        const { items } = await listAll(h, user, { branchId: b });
        expect(items.length).toBe(branches.includes(b) ? total[b as keyof typeof total] : 0);
      }
    });
  });

  describe('multi-branch user (BA §4, D-06): one working branch at a time, no merged view', () => {
    it('without a choice the list answers 409 scope_required; with a choice only that branch is visible', async () => {
      await h.login('u_multi');
      const before = await h.call('GET', '/api/v1/sys/warehouses', { as: 'u_multi' });
      expect(before.status).toBe(409);
      expect(before.json.code).toBe('scope_required');
      for (const [branch, expected] of [
        ['br_q7', total.br_q7],
        ['br_td', total.br_td],
      ] as const) {
        await h.loginAt('u_multi', branch);
        const { items } = await listAll(h, 'u_multi', {}, 25);
        expect(items.length).toBe(expected);
        expect(items.every((i) => i.branchId === branch)).toBe(true);
      }
    });
    it('a branch outside the assignments cannot be chosen, and nobody but CH/QV may choose "all"', async () => {
      const cookie = await h.login('u_multi');
      expect(
        (await h.call('PUT', '/api/v1/sys/scope', { cookie, body: { branchId: 'br_lk' } })).status,
      ).toBe(403);
      expect(
        (await h.call('PUT', '/api/v1/sys/scope', { cookie, body: { branchId: 'all' } })).status,
      ).toBe(403);
      const owner = await h.login('u_owner');
      expect(
        (await h.call('PUT', '/api/v1/sys/scope', { cookie: owner, body: { branchId: 'all' } }))
          .status,
      ).toBe(200);
    });
  });

  it('export (NFR-EXP-01): only holders of warehouse:export, only their scope; storekeeper is refused', async () => {
    const q7 = await h.call('GET', '/api/v1/sys/warehouses/export', { as: 'u_ql_q7' });
    expect(q7.status).toBe(200);
    expect(q7.headers.get('content-type')).toContain('text/csv');
    const lines = q7.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines.length - 1).toBe(total.br_q7);
    expect(lines.slice(1).every((l) => l.includes('"br_q7"'))).toBe(true);
    expect(q7.text).not.toContain('br_td');

    const owner = await h.call('GET', '/api/v1/sys/warehouses/export', { as: 'u_owner' });
    expect(owner.text.replace(/^﻿/, '').trim().split('\r\n').length - 1).toBe(
      total.br_q7 + total.br_td + total.br_lk,
    );

    const tk = await h.call('GET', '/api/v1/sys/warehouses/export', { as: 'u_tk_q7' });
    expect(tk.status).toBe(403);
    // the multi-role user can export only where QL applies... and view elsewhere; export scope = Q7 only
    await h.loginAt('u_multi', 'br_q7');
    const multi = await h.call('GET', '/api/v1/sys/warehouses/export', { as: 'u_multi' });
    expect(multi.status).toBe(200);
    expect(multi.text).not.toContain('br_td');
  });

  it('creating outside the permitted scope is refused (FR-SYS-012: permissions are per branch)', async () => {
    const body = (branchId: string, code: string) => ({ branchId, code, name: 'Kho thử nghiệm' });
    // BA §2.3: only AD and CH create warehouses; a branch manager (QL) does not
    const cases: [string, string, number][] = [
      ['u_ql_q7', 'br_q7', 403],
      ['u_ql_q7', 'br_td', 403],
      ['u_tk_q7', 'br_q7', 403],
      ['u_multi', 'br_q7', 403],
      ['u_ad', 'br_td', 201],
      ['u_owner', 'br_td', 201],
    ];
    let n = 0;
    for (const [user, branch, status] of cases) {
      const r = await h.call('POST', '/api/v1/sys/warehouses', {
        as: user,
        key: `perm-${n}-${backend}-xxxxxxxx`,
        body: body(branch, `PRM-${n++}`),
      });
      expect(r.status, `${user} -> ${branch}`).toBe(status);
    }
  });

  it('user without any role gets 403 and a disabled user cannot log in', async () => {
    const r = await h.call('GET', '/api/v1/sys/warehouses', { as: 'u_norole' });
    expect(r.status).toBe(403);
    const dis = await h.call('POST', '/api/v1/auth/login', {
      body: { identifier: 'disabled@demo.gmep.test', password: 'Demo!Pass-2026' },
    });
    expect(dis.status).toBe(401);
  });

  it('every endpoint rejects unauthenticated requests with 401', async () => {
    for (const [m, p] of [
      ['GET', '/api/v1/sys/warehouses'],
      ['GET', '/api/v1/sys/warehouses/wh_br_q7_WH-CHINH'],
      ['GET', '/api/v1/sys/warehouses/export'],
      ['GET', '/api/v1/auth/me'],
    ] as const) {
      const r = await h.call(m, p, {});
      expect(r.status, p).toBe(401);
    }
    const post = await h.call('POST', '/api/v1/sys/warehouses', {
      key: 'unauth-1234567890',
      body: { branchId: 'br_q7', code: 'ZZ-1', name: 'Zz' },
    });
    expect(post.status).toBe(401);
  });

  it("a cursor produced for one user cannot widen another user's scope", async () => {
    const q7 = await h.call('GET', '/api/v1/sys/warehouses?limit=5', { as: 'u_owner' });
    expect(q7.json.nextCursor).toBeTruthy();
    const stolen = await h.call(
      'GET',
      `/api/v1/sys/warehouses?limit=100&cursor=${q7.json.nextCursor}`,
      { as: 'u_ql_td' },
    );
    expect(stolen.status).toBe(200);
    expect(stolen.json.items.every((i: { branchId: string }) => i.branchId === 'br_td')).toBe(true);
  });

  it('rejects bad paging input with stable error codes', async () => {
    expect(
      (await h.call('GET', '/api/v1/sys/warehouses?limit=101', { as: 'u_owner' })).status,
    ).toBe(422);
    const bad = await h.call('GET', '/api/v1/sys/warehouses?cursor=garbage', { as: 'u_owner' });
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe('invalid_cursor');
    expect(
      (await h.call('GET', '/api/v1/sys/warehouses?sort=password', { as: 'u_owner' })).status,
    ).toBe(422); // sort whitelist
  });

  it('sorting by name descending is stable across pages', async () => {
    const { items } = await listAll(h, 'u_owner', { sort: 'name', direction: 'desc' }, 20);
    const names = items.map((i) => i.name as string);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    const norm = names.map((n) =>
      n
        .normalize('NFD')
        .replace(/\p{M}+/gu, '')
        .replace(/đ/gi, 'd')
        .toLowerCase(),
    );
    expect(norm).toEqual([...norm].sort().reverse());
  });
});

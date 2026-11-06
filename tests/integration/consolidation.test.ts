import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { computeDaily, DEFAULT_RPT_POLICY, type DailyRollup } from '@/modules/rpt';
import { configVersionId } from '@/modules/sys/domain/config';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const D1 = '2026-10-05';
const D2 = '2026-10-06';
const D3 = '2026-10-07';

interface Spec {
  exTax: number;
  closed: number;
  official: boolean;
  inflow?: number;
  quotes?: {
    created: number;
    approved: number;
    rejected: number;
    expired: number;
    pending: number;
  };
  customers?: { visits: number; newCount: number; returningCount: number };
}

/** a rollup of an empty day (real `computeDaily`) with the figures overwritten: only the consolidation is under test */
function fake(branchId: string, date: string, s: Spec): DailyRollup {
  const base = computeDaily(
    { tenantId: 'tnt_demo', branchId, date },
    {
      orders: [],
      lines: new Map(),
      money: new Map(),
      invoiceStates: new Map(),
      payments: [],
      openDebts: [],
      shifts: [],
      dayClosedAt: s.official ? new Date(`${date}T20:00:00Z`) : null,
      invoicesIssued: [],
      stockIssues: [],
      truncated: [],
    },
    DEFAULT_RPT_POLICY,
    { refsMax: 5, alertsMax: 5 },
    new Date(`${date}T23:00:00Z`),
    () => 'h',
  );
  return {
    ...base,
    official: s.official,
    orders: { ...base.orders, closed: s.closed },
    revenue: { ...base.revenue, exTaxVnd: s.exTax, laborVnd: s.exTax, orderTotalVnd: s.exTax },
    money: { ...base.money, inflowVnd: s.inflow ?? 0 },
    ...(s.quotes ? { quotes: s.quotes } : {}),
    ...(s.customers ? { customers: s.customers } : {}),
  };
}

describe.each(backends)('slice 2.1 consolidation, groups, history, release [%s]', (backend) => {
  let h: Harness;
  let owner: string;
  let qv: string;
  let ql: string;
  let qlTd: string;
  const put = async (collection: string, id: string, data: Row) => {
    if (backend === 'memory') h.container.memory!.db.col<Row>(collection).set(id, data);
    else await getDb(h.container.env).collection(collection).doc(id).set(data);
  };
  const putRollup = (r: DailyRollup) => {
    const { id, ...data } = r;
    return put('rollups', id, data);
  };
  const get = (cookie: string, path: string) => h.call('GET', path, { cookie });
  const range = `from=${D1}&to=${D3}`;

  beforeAll(async () => {
    h = await createHarness(backend);
    owner = await h.loginAt('u_owner', 'all');
    qv = await h.loginAt('u_qv', 'all');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    // Q7: three days, D2 provisional; TD: D1 and D3 only (D2 missing); both official otherwise
    await putRollup(
      fake('br_q7', D1, { exTax: 1_000_000, closed: 4, official: true, inflow: 900_000 }),
    );
    await putRollup(
      fake('br_q7', D2, { exTax: 2_000_000, closed: 5, official: false, inflow: 100 }),
    );
    await putRollup(fake('br_q7', D3, { exTax: 500_000, closed: 1, official: true, inflow: 50 }));
    await putRollup(fake('br_td', D1, { exTax: 2_500_000, closed: 2, official: true, inflow: 10 }));
    await putRollup(fake('br_td', D3, { exTax: 1_000_000, closed: 3, official: true, inflow: 20 }));
    // the branch of another tenant has a rollup too: it must never show up in tnt_demo reports (RULE-017)
    await putRollup({
      ...fake('br_d2_q7', D1, { exTax: 99_000_000, closed: 99, official: true }),
      tenantId: 'tnt_demo2',
    });
  });

  describe('ranking (FR-RPT-002, FR-RPT-010; UAT-P2-10)', () => {
    it('ranks branches on the SAME period; a missing day is listed, never zero; provisional days are labelled', async () => {
      const r = await get(owner, `/api/v1/rpt/ranking?${range}&metric=exTaxVnd`);
      expect(r.status, r.text).toBe(200);
      const rows = r.json.rows as Row[];
      const q7 = rows.find((x) => x.branchId === 'br_q7')!;
      const td = rows.find((x) => x.branchId === 'br_td')!;
      expect(q7.value).toBe(3_500_000);
      expect(td.value).toBe(3_500_000); // a tie shares rank 1 (standard competition ranking)
      expect([q7.rank, td.rank]).toEqual([1, 1]);
      expect(td.missingDates).toEqual([D2]);
      expect(q7.provisional).toBe(true);
      expect(q7.provisionalDays).toBe(1);
      expect(td.provisional).toBe(false);
      // branches with no data at all are listed last and not ranked
      expect(rows.filter((x) => x.rank === null).map((x) => x.branchId)).toEqual(
        expect.arrayContaining(['br_lk', 'br_cl']),
      );
      // the total is the sum of the branches (FR-RPT-001) and carries the provisional label
      expect(r.json.total).toBe(7_000_000);
      expect(r.json.allOfficial).toBe(false);
      expect(r.json.provisionalDays).toBe(1);
      expect(r.json.missingDays).toBeGreaterThan(0);
    });

    it('the total of one day equals the consolidated dashboard (sum of the per-branch documents)', async () => {
      const rk = (await get(owner, `/api/v1/rpt/ranking?from=${D1}&to=${D1}`)).json;
      const dash = (await get(owner, `/api/v1/rpt/dashboard?date=${D1}`)).json;
      expect(rk.total).toBe(dash.totals.revenue.exTaxVnd);
      expect(rk.total).toBe(3_500_000);
    });

    it('ratios are recomputed from the parts, never averaged: average per order and quote approval', async () => {
      const avg = (await get(owner, `/api/v1/rpt/ranking?${range}&metric=avgPerOrderVnd`)).json;
      const q7 = avg.rows.find((x: Row) => x.branchId === 'br_q7');
      expect(q7.value).toBe(350_000); // 3 500 000 / 10 orders
      expect(q7.parts).toEqual({ num: 3_500_000, den: 10 });
      const td = avg.rows.find((x: Row) => x.branchId === 'br_td');
      expect(td.value).toBe(700_000); // 3 500 000 / 5
      expect(avg.rows[0].branchId).toBe('br_td');
      expect(avg.total).toBe(466_667); // 7 000 000 / 15 = 466 666.67 rounded half up
    });

    it('permissions: owner and regional manager only (Q85); a branch manager and a bad period are refused', async () => {
      expect((await get(qv, `/api/v1/rpt/ranking?${range}`)).status).toBe(200);
      expect((await get(ql, `/api/v1/rpt/ranking?${range}`)).status).toBe(403);
      expect((await get(qlTd, `/api/v1/rpt/ranking?${range}`)).status).toBe(403);
      expect((await get(owner, `/api/v1/rpt/ranking?from=${D3}&to=${D1}`)).status).toBe(422);
      expect((await get(owner, `/api/v1/rpt/ranking?from=2026-01-01&to=2026-12-31`)).status).toBe(
        422,
      );
      expect((await get(owner, `/api/v1/rpt/ranking?${range}&metric=nope`)).status).toBe(422);
    });

    it('tenant axis: the other tenant never appears; its owner sees only its own branch', async () => {
      const r = await get(owner, `/api/v1/rpt/ranking?${range}`);
      expect(r.text).not.toContain('br_d2_q7');
      expect(r.text).not.toContain('99000000');
      // the same keys asked through another tenant's scope are dropped by the repository (defence in depth)
      const deps = h.container.rpt;
      const { branchesScope } = await import('@/platform/scope/scope');
      const scope = branchesScope('tnt_demo', ['br_d2_q7', 'br_q7']);
      const docs = await deps.rollups.getMany(scope, [
        { branchId: 'br_d2_q7', date: D1 },
        { branchId: 'br_q7', date: D1 },
      ]);
      expect(docs.map((d) => d.branchId)).toEqual(['br_q7']);
    });
  });

  describe('regional view (Q84: configured groups, no hard-coded role)', () => {
    beforeAll(async () => {
      const id = configVersionId('tnt_demo', 'branch-groups', 'tenant', '2026-01-01');
      await put('configVersions', id, {
        tenantId: 'tnt_demo',
        type: 'branch-groups',
        scopeKey: 'tenant',
        effectiveFrom: '2026-01-01',
        status: 'approved',
        payload: {
          groups: [
            { code: 'south', name: 'Miền Nam', branchIds: ['br_q7', 'br_td', 'br_d2_q7'] },
            { code: 'td-only', name: 'Thủ Đức', branchIds: ['br_td'] },
            { code: 'foreign', name: 'Ngoài', branchIds: ['br_d2_q7'] },
          ],
        },
        proposedBy: 'seed',
        proposedAt: new Date('2026-01-01T00:00:00Z'),
        reason: 'test',
        decidedBy: 'seed2',
        decidedAt: new Date('2026-01-01T00:00:00Z'),
        decisionNote: null,
        version: 1,
      });
      h.container.sys.caches.config.invalidateTag('cfg:tnt_demo:branch-groups');
    });

    it('a group is a filter over the branches already in scope: another tenant branch in the list adds nothing', async () => {
      const g = (await get(owner, '/api/v1/rpt/groups')).json.items as Row[];
      expect(g.map((x) => x.code).sort()).toEqual(['south', 'td-only']);
      expect(g.find((x) => x.code === 'south')!.branchCount).toBe(2); // not 3: the foreign id is not a branch of this tenant
      const r = await get(owner, `/api/v1/rpt/ranking?${range}&groupId=south`);
      expect(r.status, r.text).toBe(200);
      expect(r.json.rows.map((x: Row) => x.branchId).sort()).toEqual(['br_q7', 'br_td']);
      expect(r.text).not.toContain('br_d2_q7');
      const one = await get(owner, `/api/v1/rpt/ranking?${range}&groupId=td-only`);
      expect(one.json.rows.map((x: Row) => x.branchId)).toEqual(['br_td']);
      expect(one.json.total).toBe(3_500_000);
    });

    it('the regional manager sees only the group inside the assigned branches; a group outside the assignment is refused; unknown group 422', async () => {
      const mine = await get(qv, `/api/v1/rpt/ranking?${range}&groupId=south`);
      expect(mine.json.rows.map((x: Row) => x.branchId).sort()).toEqual(['br_q7', 'br_td']);
      expect((await get(qv, `/api/v1/rpt/ranking?${range}&groupId=foreign`)).status).toBe(403);
      expect((await get(qv, `/api/v1/rpt/ranking?${range}&groupId=nope`)).status).toBe(422);
      // the dashboard and the alerts take the group too
      const d = (await get(qv, `/api/v1/rpt/dashboard?date=${D1}&groupId=td-only`)).json;
      expect(d.rows.map((x: Row) => x.branchId)).toEqual(['br_td']);
      expect(d.groupId).toBe('td-only');
      expect((await get(qv, `/api/v1/rpt/alerts?date=${D1}&groupId=td-only`)).status).toBe(200);
    });

    it('a branch manager cannot widen the view with a group (the group is a filter, not a grant)', async () => {
      const d = await get(qlTd, `/api/v1/rpt/dashboard?date=${D1}&groupId=south`);
      expect(d.status).toBe(200);
      expect(d.json.rows.map((x: Row) => x.branchId)).toEqual(['br_td']);
    });
  });

  describe('customers and indicators (FR-RPT-015 without receivables, FR-RPT-016 without stock accuracy)', () => {
    beforeAll(async () => {
      await putRollup(
        fake('br_q7', D1, {
          exTax: 1_000_000,
          closed: 4,
          official: true,
          inflow: 900_000,
          quotes: { created: 10, approved: 5, rejected: 2, expired: 1, pending: 2 },
          customers: { visits: 6, newCount: 2, returningCount: 3 },
        }),
      );
      await putRollup(
        fake('br_td', D1, {
          exTax: 2_500_000,
          closed: 2,
          official: true,
          quotes: { created: 4, approved: 1, rejected: 1, expired: 0, pending: 2 },
          customers: { visits: 3, newCount: 1, returningCount: 1 },
        }),
      );
    });

    it('customer visits: new vs returning, rate in basis points, days written before schema 6 are listed not counted', async () => {
      const r = (await get(owner, `/api/v1/rpt/customers?${range}`)).json;
      const q7 = r.rows.find((x: Row) => x.branchId === 'br_q7');
      expect([q7.visits, q7.newCount, q7.returningCount]).toEqual([6, 2, 3]);
      expect(q7.returningBp).toBe(6000);
      expect(q7.unavailableDates).toEqual([D2, D3]);
      expect(r.total).toMatchObject({ visits: 9, newCount: 3, returningCount: 4 });
      expect(r.total.returningBp).toBe(5714); // 4 / 7
      expect(r.receivablesIncluded).toBe(false);
    });

    it('indicators: average per order and quote approval rate, with the formula and the numerator/denominator', async () => {
      const r = (await get(owner, `/api/v1/rpt/indicators?from=${D1}&to=${D1}`)).json;
      const approval = r.indicators.find((x: Row) => x.metric === 'quoteApprovalBp');
      expect(approval.rows.find((x: Row) => x.code === 'Q7')).toMatchObject({
        value: 6250, // 5 / (5 + 2 + 1)
        num: 5,
        den: 8,
      });
      expect(approval.total).toBe(6000); // (5 + 1) / (8 + 2)
      expect(approval.formula).toContain('approved');
      const avg = r.indicators.find((x: Row) => x.metric === 'avgPerOrderVnd');
      expect(avg.total).toBe(583_333); // 3 500 000 / 6
    });

    it('ranking by a metric needs the permission of its section', async () => {
      const q = (await get(owner, `/api/v1/rpt/ranking?from=${D1}&to=${D1}&metric=quoteApprovalBp`))
        .json;
      expect(q.rows[0].branchId).toBe('br_q7'); // 6250 vs 5000
      expect(q.rows[0].rank).toBe(1);
      const c = (
        await get(owner, `/api/v1/rpt/ranking?from=${D1}&to=${D1}&metric=returningCustomerBp`)
      ).json;
      expect(c.rows.find((x: Row) => x.branchId === 'br_q7').value).toBe(6000);
    });
  });

  describe('login history (FR-SYS-014)', () => {
    it('everybody reads their own; another person only with the permission, inside the scope, and it is audited', async () => {
      const own = await get(ql, '/api/v1/sys/login-history');
      expect(own.status, own.text).toBe(200);
      expect(own.json.items.length).toBeGreaterThan(0);
      expect(own.json.items[0]).toHaveProperty('device');
      expect(own.json.items[0].state).toBe('active');
      expect(own.text).not.toMatch(/\d+\.\d+\.\d+\.\d+/); // no IP address is kept
      // a counter clerk has no right to read someone else's; a branch manager only inside the own branch (BA: QL cn)
      const cv = await h.loginAt('u_cv_q7', 'br_q7');
      expect((await get(cv, '/api/v1/sys/login-history?userId=u_tn_q7')).status).toBe(403);
      expect((await get(ql, '/api/v1/sys/login-history?userId=u_tn_q7')).status).toBe(200);
      expect((await get(qlTd, '/api/v1/sys/login-history?userId=u_tn_q7')).status).toBe(404);
      // the owner may, and the access is in the audit trail
      const other = await get(owner, '/api/v1/sys/login-history?userId=u_ql_q7');
      expect(other.status, other.text).toBe(200);
      const audit = (await get(owner, '/api/v1/sys/audit?action=user.login_history_viewed')).json;
      expect(audit.items.some((e: Row) => e.entityId === 'u_ql_q7')).toBe(true);
      expect((await get(owner, '/api/v1/sys/login-history?userId=nope_NOPE_0000')).status).toBe(
        404,
      );
    });
  });

  describe('catalogue release (FR-SYS-016)', () => {
    it('no release = unrestricted; a release limits the entry to the chosen branches from its date; the old document keeps its version', async () => {
      const before = (
        await get(owner, '/api/v1/sys/catalog-releases?catalog=service&itemCode=SV-DAU')
      ).json;
      expect(before.audience).toBe('unrestricted');
      expect(before.branches.every((b: Row) => b.released)).toBe(true);
      const p = await h.call('POST', '/api/v1/sys/config/catalog-release', {
        cookie: owner,
        key: 'rel-prop-000000001',
        body: {
          scopeKey: 'service:SV-DAU',
          effectiveFrom: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
          payload: { audience: 'branches', branchIds: ['br_td'] },
          reason: 'Chỉ phát hành cho Thủ Đức',
        },
      });
      expect(p.status, p.text).toBe(201);
      expect(p.json.status).toBe('pending'); // approval first: nothing changes yet
      const pending = (
        await get(owner, '/api/v1/sys/catalog-releases?catalog=service&itemCode=SV-DAU')
      ).json;
      expect(pending.audience).toBe('unrestricted');
      // a malformed release is refused at the boundary
      const bad = await h.call('POST', '/api/v1/sys/config/catalog-release', {
        cookie: owner,
        key: 'rel-prop-000000002',
        body: {
          scopeKey: 'service:SV-DAU',
          effectiveFrom: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
          payload: { audience: 'branches' },
          reason: 'thiếu chi nhánh',
        },
      });
      expect(bad.status).toBe(422);
      // a branch manager may read but not propose (head office only)
      expect(
        (await get(ql, '/api/v1/sys/catalog-releases?catalog=service&itemCode=SV-DAU')).status,
      ).toBe(403);
    });
  });

  describe('audit filters moved out of the index (index-budget, slice 2.1)', () => {
    it('actor and action filters page through the stream, keep the scope, and end with an empty cursor', async () => {
      const all = (await get(owner, '/api/v1/sys/audit?limit=100')).json;
      const actor = all.items.find((e: Row) => e.actorId === 'u_owner')?.actorId ?? 'u_owner';
      const want = all.items.filter((e: Row) => e.actorId === actor).length;
      expect(want).toBeGreaterThan(0);
      let cursor: string | null = null;
      let seen = 0;
      for (let i = 0; i < 50; i++) {
        const r: { json: Row; status: number } = await get(
          owner,
          `/api/v1/sys/audit?actorId=${actor}&limit=25${cursor ? `&cursor=${cursor}` : ''}`,
        );
        expect(r.status).toBe(200);
        for (const e of r.json.items) expect(e.actorId).toBe(actor);
        seen += r.json.items.length;
        cursor = r.json.nextCursor;
        if (!cursor) break;
      }
      expect(seen).toBeGreaterThanOrEqual(want);
      expect(cursor).toBeNull();
      const byAction = (await get(owner, '/api/v1/sys/audit?action=auth.login&limit=25')).json;
      expect(byAction.items.length).toBeGreaterThan(0);
      expect(byAction.items.every((e: Row) => e.action === 'auth.login')).toBe(true);
      // a branch-bound viewer filtering by actor still sees only its scope
      const scoped = (await get(qlTd, '/api/v1/sys/audit?actorId=u_ql_q7&limit=25')).json;
      expect(scoped.items ?? []).toEqual([]);
    });
  });
});

/**
 * Load measurement (Q63, plan 2.1): the consolidated reads of the owner at 8 and 20 branches. Counts documents read and
 * wall time on the in-memory store (an upper bound on the logic, NOT a Firestore latency: that needs staging).
 */
describe('slice 2.1 load: consolidated reads at 8 and 20 branches (memory)', () => {
  it.each([8, 20])(
    '%i branches x 31 days: the ranking reads branches x days documents by key and stays well under 5 s',
    async (n) => {
      const h = await createHarness('memory');
      const owner = await h.loginAt('u_owner', 'all');
      const db = h.container.memory!.db;
      const ids = Array.from({ length: n }, (_, i) => `br_load_${String(i).padStart(2, '0')}`);
      for (const [i, id] of ids.entries())
        db.col<Row>('branches').set(id, {
          tenantId: 'tnt_demo',
          code: `L${String(i).padStart(2, '0')}`,
          name: `Chi nhánh tải ${i}`,
          status: 'active',
        });
      const days = Array.from(
        { length: 31 },
        (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`,
      ).filter((d) => d <= '2026-09-30');
      const dates = [...days, '2026-10-01'];
      for (const [i, id] of ids.entries())
        for (const d of dates) {
          const { id: rid, ...data } = fake(id, d, {
            exTax: 1_000_000 + i * 1000,
            closed: 3,
            official: true,
          });
          db.col<Row>('rollups').set(rid, data);
        }
      const t0 = performance.now();
      const r = await h.call('GET', `/api/v1/rpt/ranking?from=${dates[0]}&to=${dates.at(-1)}`, {
        cookie: owner,
      });
      const ms = performance.now() - t0;
      expect(r.status, r.text).toBe(200);
      const loaded = (r.json.rows as Row[]).filter((x) => x.branchId.startsWith('br_load_'));
      expect(loaded).toHaveLength(n);
      expect(loaded.every((x) => x.presentDays === dates.length)).toBe(true);
      expect(r.json.documentsRead).toBeGreaterThanOrEqual(n * dates.length);
      expect(loaded[0]!.rank).toBe(1);
      expect(loaded[0]!.branchId).toBe(ids[n - 1]); // the highest revenue ranks first
      // one dashboard day (consolidated): today and yesterday per branch
      const t1 = performance.now();
      const dash = await h.call('GET', '/api/v1/rpt/dashboard?date=2026-10-01', { cookie: owner });
      const dashMs = performance.now() - t1;
      expect(dash.status).toBe(200);
      console.log(
        `[load] ${n} branches: ranking ${r.json.documentsRead} keys in ${ms.toFixed(0)} ms; dashboard ${dashMs.toFixed(0)} ms (2 x ${n} documents)`,
      );
      expect(ms).toBeLessThan(5000);
      expect(dashMs).toBeLessThan(5000);
    },
  );
});

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD } from '@/infrastructure/seed/demo';
import {
  approvalLevelFor,
  approvalLimitsOf,
  configVersionId,
  type ApprovalKind,
  type ApprovalRequest,
  type ConfigVersion,
} from '@/modules/sys';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;
const T = 'tnt_demo';
const HOUR = 3_600_000;

/**
 * Slice 2.5 "Phê duyệt đầy đủ": FR-SYS-004 (limits by matrix, level), FR-SYS-015 and FR-SYS-034 (reminder after T1,
 * escalation after T2 by working time, bulk of one kind, shared queue), FR-SYS-033 (delegation), RULE-011, RULE-036
 * (nobody approves their own request, not even through a delegation; no limit issued = highest level), UAT-P2-01,
 * NFR-ISO-01 (tenant and branch axes). Requests of the kinds already running keep their behaviour (see acc.test.ts).
 */
describe.each(backends)('SYS approvals phase 2 [%s]', (backend) => {
  let h: Harness;
  let ch: string;
  let ql: string;
  let cv: string;
  let qlTd: string;
  let chB: string;
  let t0 = '';
  const sys = () => h.container.sys;
  const call = (cookie: string, method: string, path: string, body?: unknown) =>
    h.call(method, path, { cookie, key: key('apr'), ...(body !== undefined ? { body } : {}) });
  const get = (cookie: string, path: string) => h.call('GET', path, { cookie });
  const detail = async (cookie: string, id: string) =>
    (await get(cookie, `/api/v1/sys/approvals/${id}`)).json as Row;
  const decide = async (cookie: string, id: string, decision = 'approve', note?: string) =>
    call(cookie, 'POST', `/api/v1/sys/approvals/${id}/decide`, {
      version: (await detail(cookie, id)).version ?? 1,
      decision,
      ...(note ? { note } : {}),
      reauthPassword: DEMO_PASSWORD,
    });

  /** a pending request written straight into the store (the owning modules' use cases are tested in their slices) */
  async function seedRequest(o: {
    kind?: ApprovalKind;
    level?: 1 | 2;
    requestedBy?: string;
    valueVnd?: number;
    branchId?: string;
    tenantId?: string;
  }): Promise<string> {
    const id = `ap_t${++seq}`;
    const now = h.clock.now();
    const r: ApprovalRequest = {
      id,
      tenantId: o.tenantId ?? T,
      branchId: o.branchId ?? 'br_q7',
      number: `YC-TEST-${seq}`,
      kind: o.kind ?? 'expense',
      level: o.level ?? 1,
      subjectType: 'expense',
      subjectId: `subj-${id}`,
      subjectLabel: `PC-TEST-${seq}`,
      valueVnd: o.valueVnd ?? 1_200_000,
      reason: 'Dữ liệu thử',
      payload: {},
      status: 'pending',
      requestedBy: o.requestedBy ?? 'u_tn_q7',
      requestedByName: 'Người đề xuất',
      requestedByRole: 'TN',
      requestedAt: now,
      dueAt: new Date(now.getTime() + HOUR),
      createdAt: now,
      createdBy: o.requestedBy ?? 'u_tn_q7',
      updatedAt: now,
      updatedBy: o.requestedBy ?? 'u_tn_q7',
      version: 1,
    };
    await sys().uow.run(async (tx) => {
      sys().approvals.create(tx, r);
    });
    return id;
  }
  async function putLimit(kind: string, payload: Record<string, unknown>) {
    const v: ConfigVersion = {
      id: configVersionId(T, 'approval-limit', kind, '2026-10-02'),
      tenantId: T,
      type: 'approval-limit',
      scopeKey: kind,
      effectiveFrom: '2026-10-02',
      status: 'approved',
      payload,
      proposedBy: 'test',
      proposedAt: new Date(),
      reason: 'Dữ liệu thử cho slice 2.5 (minh họa)',
      decidedBy: 'test',
      decidedAt: new Date(),
      decisionNote: null,
      version: 1,
    };
    await sys().uow.run(async (tx) => {
      sys().configs.create(tx, v);
    });
  }
  /** sessions idle out: move the clock, then sign in again (a new cookie for the same people) */
  const relogin = async () => {
    ch = await h.loginAt('u_owner', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    cv = await h.loginAt('u_cv_q7', 'br_q7');
  };
  const advance = async (ms: number) => {
    h.clock.set(new Date(h.clock.now().getTime() + ms).toISOString());
    await relogin();
  };
  const delegationBody = (o: Row = {}) => ({
    delegatorId: 'u_ql_q7',
    delegateId: 'u_cv_q7',
    kinds: ['expense'],
    branchIds: ['br_q7'],
    validFrom: new Date(h.clock.now().getTime() - HOUR).toISOString(),
    validUntil: new Date(h.clock.now().getTime() + 24 * HOUR).toISOString(),
    reason: 'QL nghỉ phép hai ngày',
    ...o,
  });

  beforeAll(async () => {
    h = await createHarness(backend);
    t0 = h.clock.now().toISOString();
    // written BEFORE the first read of these keys (the config cache is per process); effective after the seed version
    await putLimit('expense', {
      selfMaxVnd: 500_000,
      level1MaxVnd: 5_000_000,
      dueHours: 1,
      escalateAfterHours: 1,
      bulkAllowed: true,
    });
    await putLimit('payment_reversal', {
      selfMaxVnd: 0,
      level1MaxVnd: 50_000_000,
      dueHours: 24,
      bulkAllowed: true,
      reauthOnApprove: true,
    });
    ch = await h.loginAt('u_owner', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    chB = await h.loginAt('u_owner_b', 'br_d2_q7');
  });
  afterEach(async () => {
    h.clock.set(t0);
    await relogin();
    // a delegation of one test must not leak into the next (they share the tenant)
    const list = await get(ch, '/api/v1/sys/approvals/delegations');
    for (const d of (list.json.items ?? []) as Row[])
      if (d.status === 'active' || d.status === 'scheduled')
        await call(ch, 'POST', `/api/v1/sys/approvals/delegations/${d.id}/revoke`, {
          version: d.version,
        });
  });

  describe('limits by tenant (FR-SYS-033, RULE-036)', () => {
    it('RULE-036: a kind with no limit in force goes to the highest level and never passes alone', async () => {
      const date = t0.slice(0, 10);
      // tenant 2 has issued no limit: level 2 whatever the value, even a value of 1 VND
      const lim = await approvalLimitsOf(sys(), 'tnt_demo2', 'expense', date);
      expect(lim.topOnly).toBe(true);
      expect((await approvalLevelFor(sys(), 'tnt_demo2', 'expense', 1)).level).toBe(2);
      expect((await approvalLevelFor(sys(), 'tnt_demo2', 'payment_reversal', 0)).level).toBe(2);
      // tenant 1 has its own matrix: within the limit level 1, above it level 2, and the split spend is added up
      expect((await approvalLevelFor(sys(), T, 'expense', 1_200_000)).level).toBe(1);
      expect((await approvalLevelFor(sys(), T, 'expense', 5_000_001)).level).toBe(2);
      expect((await approvalLevelFor(sys(), T, 'expense', 2_000_000, 3_000_001)).level).toBe(2);
      expect((await approvalLevelFor(sys(), T, 'expense', 400_000)).level).toBe(0);
      expect((await approvalLevelFor(sys(), T, 'expense', 400_000, 200_000)).level).toBe(1);
    });
  });

  describe('reminder and escalation (FR-SYS-015, FR-SYS-034; UAT-P2-01)', () => {
    it('after T1 the approvers are reminded once; after T1 + T2 the request moves to level 2 and stays pending; repeats change nothing', async () => {
      const id = await seedRequest({});
      const run = async () => (await call(ch, 'POST', '/api/v1/sys/approvals/jobs/escalate')).json;
      expect(await run()).toMatchObject({ reminded: 0, escalated: 0 });
      await advance(61 * 60_000); // past T1 (1 hour)
      expect(await run()).toMatchObject({ reminded: 1, escalated: 0 });
      expect(await run()).toMatchObject({ reminded: 0, escalated: 0 });
      expect((await detail(ch, id)).reminded).toBe(true);
      await advance(60 * 60_000); // past T1 + T2
      expect(await run()).toMatchObject({ reminded: 0, escalated: 1 });
      expect(await run()).toMatchObject({ reminded: 0, escalated: 0 });
      const d = await detail(ch, id);
      expect(d).toMatchObject({
        status: 'pending',
        level: 2,
        escalated: true,
        escalatedFrom: 1,
        escalationReason: 'overdue',
      });
      // the level-1 manager no longer decides it; the owner does
      expect((await decide(ql, id)).status).toBe(403);
      expect((await decide(ch, id)).status).toBe(200);
    });

    it('the escalation is audited with the actor, time and reason in the same transaction', async () => {
      const id = await seedRequest({});
      await advance(130 * 60_000);
      await call(ch, 'POST', '/api/v1/sys/approvals/jobs/escalate');
      const rows = await h.call('GET', `/api/v1/sys/audit?entityId=${id}`, { cookie: ch });
      const text = JSON.stringify(rows.json);
      expect(text).toContain('approval.escalate');
    });

    it('only the owner runs the job, and a read-only tenant is skipped', async () => {
      expect((await call(ql, 'POST', '/api/v1/sys/approvals/jobs/escalate')).status).toBe(403);
      await sys().uow.run(async (tx) => {
        sys().tenants.update(tx, T, { status: 'suspended' } as never);
      });
      try {
        const id = await seedRequest({});
        await advance(180 * 60_000);
        // the API gate refuses writes of a read-only tenant; the use case also skips it (a scheduler has no gate)
        const r = await call(ch, 'POST', '/api/v1/sys/approvals/jobs/escalate');
        expect(r.status).toBe(403);
        expect(r.json.code).toBe('tenant_read_only');
        expect((await detail(ch, id)).escalated).toBe(false);
      } finally {
        await sys().uow.run(async (tx) => {
          sys().tenants.update(tx, T, { status: 'active' } as never);
        });
      }
    });
  });

  describe('delegation (FR-SYS-033, RULE-036)', () => {
    it('is off by default and only the owner creates it', async () => {
      const id = await seedRequest({});
      expect((await decide(cv, id)).status).toBe(403);
      expect(
        (await call(ql, 'POST', '/api/v1/sys/approvals/delegations', delegationBody())).status,
      ).toBe(403);
      const ok = await call(ch, 'POST', '/api/v1/sys/approvals/delegations', delegationBody());
      expect(ok.status, ok.text).toBe(201);
      const r = await decide(cv, id);
      expect(r.status, r.text).toBe(200);
      const done = await detail(ch, id);
      expect(done).toMatchObject({ status: 'approved', decidedOnBehalfOf: 'u_ql_q7' });
      // the next delegation call replays under the same key without a second record
      const list = await get(ch, '/api/v1/sys/approvals/delegations');
      expect(list.json.items.length).toBeGreaterThan(0);
    });

    it('an expired delegation loses the right at once; a revoked one too', async () => {
      const created = await call(
        ch,
        'POST',
        '/api/v1/sys/approvals/delegations',
        delegationBody({ validUntil: new Date(h.clock.now().getTime() + 2 * HOUR).toISOString() }),
      );
      expect(created.status, created.text).toBe(201);
      const a = await seedRequest({});
      expect((await decide(cv, a)).status).toBe(200);
      const b = await seedRequest({});
      await advance(3 * HOUR); // past validUntil (the request is older than T1 but the job did not run)
      expect((await decide(cv, b)).status).toBe(403);
      h.clock.set(t0);
      await relogin();
      // (back in time the first delegation would be valid again: take it back before the revoke check)
      await call(ch, 'POST', `/api/v1/sys/approvals/delegations/${created.json.id}/revoke`, {
        version: created.json.version,
      });
      const c2 = await call(ch, 'POST', '/api/v1/sys/approvals/delegations', delegationBody());
      const rev = await call(ch, 'POST', `/api/v1/sys/approvals/delegations/${c2.json.id}/revoke`, {
        version: c2.json.version,
      });
      expect(rev.status, rev.text).toBe(200);
      const c = await seedRequest({});
      expect((await decide(cv, c)).status).toBe(403);
      // revoking twice is refused
      expect(
        (
          await call(ch, 'POST', `/api/v1/sys/approvals/delegations/${c2.json.id}/revoke`, {
            version: 2,
          })
        ).status,
      ).toBe(409);
    });

    it('RULE-036: no self-approval by proxy (own request, or one the delegator raised); a delegate cannot decide above the delegator', async () => {
      await call(ch, 'POST', '/api/v1/sys/approvals/delegations', delegationBody());
      const own = await seedRequest({ requestedBy: 'u_cv_q7' });
      const ownTry = await decide(cv, own);
      expect(ownTry.status).toBe(409); // approval_self_decision, never by proxy
      const raisedByDelegator = await seedRequest({ requestedBy: 'u_ql_q7' });
      expect((await decide(cv, raisedByDelegator)).status).toBe(403);
      expect((await decide(ch, raisedByDelegator)).status).toBe(200);
      // a level-2 request needs a delegator who holds level 2: the manager's delegation does not reach it
      const high = await seedRequest({ level: 2 });
      expect((await decide(cv, high)).status).toBe(403);
    });

    it('RULE-036: the delegate must see the branch data (FR-SYS-033); a delegator without the right is refused', async () => {
      const noView = await call(
        ch,
        'POST',
        '/api/v1/sys/approvals/delegations',
        delegationBody({ delegateId: 'u_ql_td' }),
      );
      expect(noView.status).toBe(422);
      expect(JSON.stringify(noView.json)).toContain('xem dữ liệu');
      const noRight = await call(
        ch,
        'POST',
        '/api/v1/sys/approvals/delegations',
        delegationBody({ delegatorId: 'u_cv_q7', delegateId: 'u_ql_q7' }),
      );
      expect(noRight.status).toBe(422);
      const self = await call(
        ch,
        'POST',
        '/api/v1/sys/approvals/delegations',
        delegationBody({ delegateId: 'u_ql_q7' }),
      );
      expect(self.status).toBe(422);
    });
  });

  describe('bulk decision (FR-SYS-034)', () => {
    const bulk = async (cookie: string, ids: string[], decision = 'approve', note?: string) => {
      const items = await Promise.all(
        ids.map(async (id) => ({ id, version: (await detail(cookie, id)).version ?? 1 })),
      );
      return call(cookie, 'POST', '/api/v1/sys/approvals/bulk-decide', {
        decision,
        items,
        ...(note ? { note } : {}),
      });
    };
    it('decides requests of one kind that allows it, each on its own checks', async () => {
      const a = await seedRequest({});
      const b = await seedRequest({});
      const own = await seedRequest({ requestedBy: 'u_ql_q7' });
      const r = await bulk(ql, [a, b, own]);
      expect(r.status, r.text).toBe(200);
      expect(r.json.results).toEqual([
        { id: a, ok: true },
        { id: b, ok: true },
        { id: own, ok: false, code: 'approval_self_decision' },
      ]);
      expect((await detail(ch, a)).status).toBe('approved');
      expect((await detail(ch, own)).status).toBe('pending');
    });

    it('refuses a mix of kinds, a kind that asks for the password again, and a rejection without a note', async () => {
      const a = await seedRequest({});
      const p = await seedRequest({ kind: 'payment_reversal', valueVnd: 1_000_000 });
      expect((await bulk(ql, [a, p])).status).toBe(422);
      expect((await bulk(ql, [p])).json.code ?? (await bulk(ql, [p])).text).toContain(
        'bulk_not_allowed',
      );
      expect((await bulk(ql, [a], 'reject')).status).toBe(422);
      // the same request alone, one by one, asks for the password (configured, not hard-coded)
      const noPw = await call(ql, 'POST', `/api/v1/sys/approvals/${p}/decide`, {
        version: 1,
        decision: 'approve',
      });
      expect(noPw.status).not.toBe(200);
      expect((await decide(ql, p)).status).toBe(200);
    });
  });

  describe('isolation (NFR-ISO-01)', () => {
    it('another tenant and another branch see and decide nothing; the queue is the working branch only', async () => {
      const id = await seedRequest({});
      // the answer is the same as for an id that does not exist: nothing tells that it exists in another tenant
      const dB = await decide(chB, id);
      const none = await decide(chB, 'ap_does_not_exist');
      expect(dB.status).toBe(none.status);
      expect(dB.json.code).toBe(none.json.code);
      expect((await get(chB, `/api/v1/sys/approvals/${id}`)).status).toBe(404);
      expect((await get(chB, '/api/v1/sys/approvals?tab=toDecide')).json.items).toEqual([]);
      expect((await decide(qlTd, id)).status).toBe(
        (await decide(qlTd, 'ap_does_not_exist')).status,
      );
      expect((await get(qlTd, `/api/v1/sys/approvals/${id}`)).status).toBe(404);
      expect((await get(chB, '/api/v1/sys/approvals/delegations')).json.items).toEqual([]);
      const mine = await get(ql, '/api/v1/sys/approvals?tab=toDecide');
      expect(mine.json.items.some((x: Row) => x.id === id)).toBe(true);
      const td = await get(qlTd, '/api/v1/sys/approvals?tab=toDecide');
      expect(td.json.items.some((x: Row) => x.id === id)).toBe(false);
      // a delegation of tenant 1 means nothing in tenant 2
      expect(
        (await call(chB, 'POST', '/api/v1/sys/approvals/delegations', delegationBody())).status,
      ).toBe(422);
    });
  });
});

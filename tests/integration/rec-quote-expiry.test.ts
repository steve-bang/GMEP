import { beforeAll, describe, expect, it } from 'vitest';
import { businessDate } from '@/platform/format/date';
import type { Actor } from '@/platform/rbac/rbac';
import { branchesScope } from '@/platform/scope/scope';
import { runQuoteExpiry } from '@/modules/rec';
import { runScheduledJobs, type CronJob } from '@/composition/cron';
import type { ApiCtx } from '@/composition/api';
import { createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;
const DAY = 86_400_000;
const SV_DAU = 'svc_cmp_demo_SV-DAU';

const cronActorAt = (branchId: string): Actor => ({
  userId: 'system:cron',
  companyId: 'cmp_demo',
  displayName: 'Hệ thống (cron)',
  assignments: [{ roleCode: 'SYSTEM_CRON', branchId }],
  rolePermissions: { SYSTEM_CRON: ['quote:manage'] },
  canConsolidate: false,
  workingBranchId: branchId,
});

/**
 * R10 / R17 background job: quotes past `validUntil` are stored as "Hết hạn" and the advisor is reminded before expiry.
 * Memory DocStore only (the Firestore variant runs with the emulator suite on the PR).
 */
describe('REC quote expiry job (R10, R17, FR-REC-011)', () => {
  let h: Harness;
  let cv: string;
  const t0 = new Date().getTime();
  let odo = 400_000;
  const rows = (name: string): Row[] =>
    [...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v }));
  const call = (cookie: string, method: string, path: string, body?: unknown) =>
    h.call(method, path, { cookie, key: key('qx'), ...(body !== undefined ? { body } : {}) });
  const advanceDays = (n: number) => h.clock.set(new Date(t0 + n * DAY).toISOString());
  const run = (branchId = 'br_q7') =>
    runQuoteExpiry(h.container.rec, cronActorAt(branchId), { requestId: 'req-test' });

  async function sentQuote(vehicleId: string): Promise<Row> {
    const c = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId });
    const p = await call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km: (odo += 100),
      customerRequest: 'Bảo dưỡng',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    const done = await call(cv, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    const q = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: done.json.id });
    const e = await call(cv, 'PATCH', `/api/v1/rec/quotes/${q.json.id}`, {
      version: q.json.version,
      items: [
        { name: 'Thay dầu', necessity: 'required', lines: [{ kind: 'labor', serviceId: SV_DAU }] },
      ],
    });
    const s = await call(cv, 'POST', `/api/v1/rec/quotes/${q.json.id}/send`, {
      version: e.json.version,
    });
    expect(s.status, s.text).toBe(200);
    return s.json as Row;
  }
  const stored = (id: string) => h.container.memory!.db.col('quotes').get(id) as Row;
  const storedVersion = (id: string) =>
    h.container.memory!.db.col('quoteVersions').get(`${id}__v1`) as Row;
  const auditOf = (id: string, action: string) =>
    rows('auditLogs').filter((a) => a.entityId === id && a.action === action);
  const bell = (id: string) => rows('notifications').filter((n) => n.link === `/rec/quotes/${id}`);

  beforeAll(async () => {
    h = await createHarness('memory');
    h.clock.set(new Date(t0).toISOString());
    cv = await h.loginAt('u_cv_q7', 'br_q7');
  });

  it('R10/R17: the advisor is reminded once, one day before validUntil; a repeat run writes nothing', async () => {
    const q = await sentQuote('veh_an');
    expect(stored(q.id).validUntil).toBe(businessDate(new Date(t0 + 7 * DAY)));
    advanceDays(5);
    expect((await run()).reminded).toBe(0); // 2 days left: too early
    advanceDays(6);
    const r1 = await run();
    expect(r1.reminded).toBeGreaterThanOrEqual(1);
    const n1 = bell(q.id);
    expect(n1).toHaveLength(1);
    expect(n1[0]).toMatchObject({
      userId: stored(q.id).advisorId,
      kind: 'rec.quote_expiring',
      titleKey: 'notifications.quoteExpiringSoon',
    });
    expect(JSON.stringify(n1[0])).not.toMatch(/0900000|@demo|Nguyễn/); // no personal data in the bell
    expect(stored(q.id).status).toBe('sent'); // a reminder is not a state change
    const again = await run();
    expect(again.reminded).toBe(0);
    expect(bell(q.id)).toHaveLength(1);
    expect(auditOf(q.id, 'quote.remind_expiry')).toHaveLength(1);
  });

  it('R10/R17/FR-REC-011: past validUntil the job stores "Hết hạn" with an audit entry of system:cron; idempotent; the list filter sees it', async () => {
    advanceDays(0);
    const q = await sentQuote('veh_biz');
    advanceDays(8);
    const r = await run();
    expect(r.expired).toBeGreaterThanOrEqual(1);
    expect(stored(q.id).status).toBe('expired');
    expect(storedVersion(q.id)).toMatchObject({
      status: 'expired',
      closedReason: 'validity_ended',
    });
    const audit = auditOf(q.id, 'quote.expire');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: 'system:cron',
      actorType: 'system',
      branchId: 'br_q7',
      before: { status: 'sent' },
      after: { status: 'expired' },
    });
    const rep = await run();
    expect(rep).toMatchObject({ expired: 0, reminded: 0, failed: 0 });
    expect(auditOf(q.id, 'quote.expire')).toHaveLength(1);
    // R17: the stored-state filter now lists it
    const page = await h.container.rec.quotes.list(branchesScope('cmp_demo', ['br_q7']), {
      limit: 100,
      status: 'expired',
    });
    expect(page.items.map((x) => x.id)).toContain(q.id);
    // a quote holds no reservation, so the job touched no stock document
    expect(rows('stockReservations').filter((x) => x.sourceId === q.id)).toHaveLength(0);
  });

  it('NFR-ISO-01: the job only touches the branch of its actor; a decided quote is left alone', async () => {
    advanceDays(0);
    const q = await sentQuote('veh_an');
    const rej = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/reject`, {
      version: stored(q.id).version,
      reason: 'Khách không làm',
    });
    expect(rej.status, rej.text).toBe(200);
    const other = await sentQuote('veh_biz');
    advanceDays(20);
    const td = await run('br_td');
    expect(td).toMatchObject({ expired: 0, reminded: 0 });
    expect(stored(other.id).status).toBe('sent');
    await run('br_q7');
    expect(stored(other.id).status).toBe('expired');
    expect(stored(q.id).status).toBe('rejected');
    expect(auditOf(q.id, 'quote.expire')).toHaveLength(0);
  });

  it('R10: an actor without quote:manage is refused (SYSTEM_CRON permission is explicit)', async () => {
    const actor = { ...cronActorAt('br_q7'), rolePermissions: { SYSTEM_CRON: [] } };
    await expect(runQuoteExpiry(h.container.rec, actor, { requestId: 'r' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('R10/R17: overlapping runs expire the quote once (one audit entry)', async () => {
    advanceDays(0);
    const q = await sentQuote('veh_an');
    advanceDays(8);
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.expired + b.expired).toBeGreaterThanOrEqual(1);
    expect(stored(q.id).status).toBe('expired');
    expect(auditOf(q.id, 'quote.expire')).toHaveLength(1);
  });

  it('R10: the reminder lead time is configuration, not code', async () => {
    advanceDays(0);
    const q = await sentQuote('veh_biz');
    h.container.rec.rec.quoteReminderLeadDays = 3;
    try {
      advanceDays(3); // 4 days left: not yet
      await run();
      expect(bell(q.id)).toHaveLength(0);
      advanceDays(4); // 3 days left
      await run();
      expect(bell(q.id)).toHaveLength(1);
    } finally {
      h.container.rec.rec.quoteReminderLeadDays = 1;
    }
  });

  it('cron registry: a failing job does not stop the other jobs or other branches and is reported as failed', async () => {
    const on = await createHarness('memory', { env: { CRON_COMPANY_ID: 'cmp_demo' } });
    const calls: string[] = [];
    const jobs: CronJob[] = [
      {
        name: 'boom',
        run: async ({ branchId }) => {
          calls.push(`boom:${branchId}`);
          throw new Error('x');
        },
      },
      {
        name: 'fine',
        run: async ({ branchId }) => {
          calls.push(`fine:${branchId}`);
          return { n: 1 };
        },
      },
    ];
    const c = { sys: on.container.sys, log: { error() {} }, requestId: 'r' } as unknown as ApiCtx;
    const out = await runScheduledJobs(c, jobs);
    expect(out.configured).toBe(true);
    const branches = out.branches as Row[];
    expect(branches.length).toBeGreaterThan(1);
    for (const b of branches) expect(b).toMatchObject({ boom: 'failed', fine: { n: 1 } });
    expect(calls.filter((x) => x.startsWith('fine:')).length).toBe(branches.length);
  });

  it('cron route keeps its contract and adds the new job results', async () => {
    const secret = 'cron-secret-0123456789-abcdefghijklmnop';
    const on = await createHarness('memory', {
      env: { CRON_SECRET: secret, CRON_COMPANY_ID: 'cmp_demo' },
    });
    const res = await on.call('POST', '/api/v1/internal/cron/run-due', {
      origin: null,
      headers: { 'x-cron-secret': secret },
    });
    expect(res.status).toBe(200);
    expect(res.json.configured).toBe(true);
    const row = res.json.branches[0];
    expect(row.rpt).toBe('ok');
    expect(row.ein).toBeDefined();
    expect(row.ein).not.toBe('failed');
    expect(row.quoteExpiry).toMatchObject({ failed: 0 });
  });
});

import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  importCustomers,
  percentile,
  sampleOp,
  type BatchTiming,
  type Sample,
} from '../helpers/volume';
import { journey, type Row, type Staff } from '../helpers/journey';
import { backends, createHarness, type Harness } from './harness';

/**
 * NFR-PERF-01 (common actions under 2 s on 4G) and NFR-PERF-02 (consolidated dashboard under 5 s), as a REGRESSION test.
 *
 * This is NOT a 4G measurement and NOT a load test: it runs in-process against the in-memory adapters and the Firestore
 * Emulator (Q-E: real numbers come from k6 on staging once a GCP project exists). What it protects is the cost model:
 *  - the number of documents read per request is bounded by the page size, not by the data volume (the primary criterion,
 *    counted through the DocStore stats, stable on any machine);
 *  - the wall time is a secondary guard with a generous threshold (x2 on the emulator, as the plan says).
 *
 * Volume: 5.000 customers with one vehicle each (loaded through the real Excel import route, FR-SYS-007), a few
 * repair orders with payments, 30 days of daily rollups for the branch. Thresholds are NOT sign-off numbers.
 */

const VOLUME = Number(process.env.PERF_VOLUME ?? 5000);
const BATCH = 2000; // the import ceiling (R94)
const SLOW = 2; // emulator factor on the time guard
const LIMIT_MS = 2000;
const DASH_LIMIT_MS = 5000;
const p95 = (xs: Sample[], k: keyof Sample) =>
  percentile(
    xs.map((x) => x[k]),
    95,
  );

describe.each(backends)('NFR-PERF-01/02 performance regression [%s]', (backend) => {
  let h: Harness;
  let ql: string;
  let owner: string;
  let staff: Staff;
  const factor = backend === 'firestore' ? SLOW : 1;
  const timings: BatchTiming[] = [];
  const medium: Record<string, Sample[]> = {}; // measured after the first 2.000 rows
  const large: Record<string, Sample[]> = {}; // measured after the full volume
  const orders: Row[] = [];

  async function ops(into: Record<string, Sample[]>) {
    const N = 8;
    into.customerList = await sampleOp(h, N, () =>
      h.call('GET', '/api/v1/crm/customers?limit=25', { cookie: ql }),
    );
    into.customerSearchName = await sampleOp(h, N, (i) =>
      h.call(
        'GET',
        `/api/v1/crm/customers?q=${encodeURIComponent(`khach volume 1${i}`)}&limit=25`,
        { cookie: ql },
      ),
    );
    into.customerSearchPhone = await sampleOp(h, N, (i) =>
      h.call('GET', `/api/v1/crm/customers?q=09${10_000_100 + i}&limit=25`, { cookie: ql }),
    );
    into.vehicleSearchPlate = await sampleOp(h, N, (i) =>
      h.call('GET', `/api/v1/crm/vehicles?q=99K-${10_100 + i}&limit=25`, { cookie: ql }),
    );
    into.vehicleList = await sampleOp(h, N, () =>
      h.call('GET', '/api/v1/crm/vehicles?limit=25', { cookie: ql }),
    );
    into.orderList = await sampleOp(h, N, () =>
      h.call('GET', '/api/v1/rec/orders?limit=25', { cookie: ql }),
    );
    into.orderOpen = await sampleOp(h, N, (i) =>
      h.call('GET', `/api/v1/rec/orders/${orders[i % orders.length]!.id}`, { cookie: ql }),
    );
    into.paymentList = await sampleOp(h, N, () =>
      h.call('GET', '/api/v1/acc/payments?limit=25', { cookie: ql }),
    );
    into.dashboardOwnerAll = await sampleOp(h, 4, () =>
      h.call('GET', '/api/v1/rpt/dashboard', { cookie: owner }),
    );
    into.monthly = await sampleOp(h, 4, () =>
      h.call('GET', `/api/v1/rpt/monthly?month=${new Date().toISOString().slice(0, 7)}`, {
        cookie: ql,
      }),
    );
  }

  beforeAll(async () => {
    h = await createHarness(backend);
    const j = journey(h);
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    owner = await h.loginAt('u_owner', 'all');
    staff = {
      cv: await h.loginAt('u_cv_q7', 'br_q7'),
      qd: await h.loginAt('u_qd_q7', 'br_q7'),
      th: await h.loginAt('u_th_q7', 'br_q7'),
      tn: await h.loginAt('u_tn_q7', 'br_q7'),
      tk: await h.loginAt('u_tk_q7', 'br_q7'),
    };
    // a handful of real orders with payments (the order and payment paths are measured below)
    for (let i = 0; i < 6; i++) {
      const c = await j.customerWithVehicle(staff.cv, `PERF${i}`, `98P-${20_000 + i}`);
      const ro = await j.readyOrder(staff, c.vehicleId);
      orders.push(ro.order);
    }
    // 30 days of rollups for the branch (read by key by the monthly report and the dashboard)
    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
      const r = await h.call('POST', '/api/v1/rpt/jobs/rebuild', {
        cookie: ql,
        key: `perf-rb-${d}-0000000001`,
        body: { date },
      });
      expect([200, 201, 403]).toContain(r.status);
    }
  }, 600_000);

  it('R94: a 2.000-row import commits well inside one request (decides whether a background job is needed)', async () => {
    const first = await importCustomers(h, ql, 0, BATCH);
    timings.push(first);
    await ops(medium);
    // measured: the committed batch is what makes the later reads realistic
    expect(first.commitMs, `2.000-row commit took ${first.commitMs} ms`).toBeLessThan(
      60_000 * factor,
    );
  }, 600_000);

  it(`loads the rest of the ${VOLUME} customers and measures every common action at full volume`, async () => {
    for (let from = BATCH; from < VOLUME; from += BATCH) {
      timings.push(await importCustomers(h, ql, from, Math.min(BATCH, VOLUME - from)));
    }
    await ops(large);
    // one searchable sample proves the volume really is there
    const q = encodeURIComponent(`khach volume ${VOLUME - 1}`);
    const r = await h.call('GET', `/api/v1/crm/customers?q=${q}&limit=5`, { cookie: ql });
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBeGreaterThan(0);
  }, 1_800_000);

  const bound: Record<string, number> = {
    // documents read per request: about twice what was measured (25 rows plus the joins a row needs); a regression to a scan of the collection is orders of magnitude above
    customerList: 160,
    customerSearchName: 160,
    customerSearchPhone: 30,
    vehicleSearchPlate: 30,
    vehicleList: 160,
    orderList: 30,
    orderOpen: 30,
    paymentList: 20,
    // 30 daily documents read by key (+ config and permission reads)
    monthly: 80,
    // consolidated owner dashboard: branches x days read by key
    dashboardOwnerAll: 40,
  };

  it.each(Object.keys(bound))(
    'NFR-PERF-01: %s reads a bounded number of documents at full volume and stays under the time guard',
    (name) => {
      const s = large[name]!;
      expect(s, 'measured').toBeDefined();
      expect(p95(s, 'reads'), `${name} reads p95`).toBeLessThanOrEqual(bound[name]!);
      const limit = name === 'dashboardOwnerAll' ? DASH_LIMIT_MS : LIMIT_MS;
      expect(p95(s, 'ms'), `${name} time p95 (guard, not a 4G measurement)`).toBeLessThan(
        limit * factor,
      );
    },
  );

  it('the cost of a request does not grow with the data: reads at 5.000 customers stay within 20 percent (+10) of 2.000', () => {
    if (VOLUME <= BATCH) return;
    for (const name of Object.keys(bound)) {
      const m = p95(medium[name]!, 'reads');
      const l = p95(large[name]!, 'reads');
      expect(l, `${name}: ${m} -> ${l} reads`).toBeLessThanOrEqual(Math.ceil(m * 1.2) + 10);
    }
  });

  it('NFR-PERF-01: taking a payment (the hot path at the counter) is a handful of documents and under the time guard', async () => {
    const j = journey(h);
    await j.ensureShift(staff.tn);
    const s = await sampleOp(h, orders.length, async (i) => {
      const bal = (await h.call('GET', `/api/v1/acc/orders/${orders[i]!.id}`, { cookie: staff.tn }))
        .json.balance;
      const r = await h.call('POST', `/api/v1/acc/orders/${orders[i]!.id}/payments`, {
        cookie: staff.tn,
        key: `perf-pay-${i}-00000000001`,
        body: { kind: 'receipt', lines: [{ method: 'cash', amountVnd: bal.outstandingVnd }] },
      });
      expect(r.status, r.text.slice(0, 200)).toBe(201);
    });
    expect(p95(s, 'reads'), 'payment reads p95').toBeLessThanOrEqual(150);
    expect(p95(s, 'writes'), 'payment writes p95').toBeLessThanOrEqual(40);
    expect(p95(s, 'ms')).toBeLessThan(LIMIT_MS * factor);
  });

  it('records the numbers (printed, so a regression is visible in the log)', () => {
    const line = (k: string, v: Record<string, Sample[]>) =>
      `${k}: reads p95 ${p95(v[k]!, 'reads')}, queries p95 ${p95(v[k]!, 'queries')}, ms p95 ${Math.round(p95(v[k]!, 'ms'))}`;
    const report =
      `[perf ${backend}] import batches: ${timings.map((t) => `${t.rows} rows dry-run ${t.dryRunMs} ms, commit ${t.commitMs} ms`).join(' | ')}\n` +
      Object.keys(large)
        .map((k) => `[perf ${backend}] ${line(k, large)}`)
        .join('\n');
    console.info(report);
    if (process.env.PERF_REPORT) appendFileSync(process.env.PERF_REPORT, report + '\n');
    expect(Object.keys(large).length).toBeGreaterThan(5);
  });
});

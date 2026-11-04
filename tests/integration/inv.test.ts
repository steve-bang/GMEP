import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { allRouteFiles, backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const Q7 = 'wh_br_q7_WH-CHINH';
const P_FILTER = 'part_seed_01'; // Q7: on-hand 20, reserved 2 (order ro_demo_1), min 6
const P_OIL = 'part_seed_02'; // Q7: 10
const P_BRAKE = 'part_seed_03'; // Q7: 3, min 5 -> low
const P_OUT = 'part_seed_05'; // Q7: 0, min 4 -> out
const P_BATT = 'part_seed_07'; // Q7: 4 @ 1.350.000
const P_COOL = 'part_seed_08'; // Q7: 30

/**
 * Slice 1.4 INV: FR-INV-001, 002, 003, 005, 006, 007, 008, 009, 019, 020, 021, 027;
 * RULE-007, 008, 009, 010; UAT-02, 13, 25; NFR-ISO-01; concurrency (S1 design, no oversell).
 * Seed (fake): Q7 main warehouse holds parts 01-08 (see invDemo.ts), Thu Duc a small stock.
 */
describe.each(backends)('INV stock ledger [%s]', (backend) => {
  let h: Harness;
  let tk: string; // Q7 storekeeper
  let ql: string; // Q7 manager
  let cv: string; // Q7 advisor
  let th: string; // Q7 technician
  let qlTd: string;
  let owner: string;
  let ownerAll: string;
  let kt: string;

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).values()] as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);

  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('inv')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  const stock = async (cookie: string, q = '') => {
    const r = await h.call('GET', `/api/v1/inv/stock?limit=100${q}`, { cookie });
    expect(r.status).toBe(200);
    return r.json.items as Row[];
  };
  const balance = async (cookie: string, partId: string, wh = Q7) => {
    const b = (await stock(cookie)).find((x) => x.partId === partId && x.warehouseId === wh);
    return b as Row;
  };
  const draft = (cookie: string, body: Record<string, unknown>, k?: string) =>
    call(cookie, 'POST', '/api/v1/inv/documents', { warehouseId: Q7, ...body }, k);
  const post = (cookie: string, id: string, version = 1, k = key('post')) =>
    call(cookie, 'POST', `/api/v1/inv/documents/${id}/post`, { version }, k);
  const grnPo = (partId: string, qty: number, unit: number, extra: Row = {}) => ({
    type: 'GRN',
    source: { type: 'purchase-order', id: 'po-demo-1' },
    lines: [{ partId, qty, unitCostVnd: unit, ...extra }],
  });
  const gin = (order: string, partId: string, qty: number, receiver = 'u_th_q7') => ({
    type: 'GIN',
    source: { type: 'repair-order', id: order },
    receiverUserId: receiver,
    lines: [{ partId, qty }],
  });
  /** The REC approval path (BA-07 rows 2, 3, 6): the order line's demand, held as far as stock allows. */
  const demand = (order: string, partId: string, qty: number, cookie = tk, lineKey = partId) =>
    call(cookie, 'POST', '/api/v1/inv/reservations/approval', {
      orderId: order,
      warehouseId: Q7,
      lines: [{ lineKey, partId, qty }],
    });
  const release = (order: string, extra: Row = {}, cookie = cv) =>
    call(cookie, 'POST', '/api/v1/inv/reservations/release', {
      sourceType: 'repair-order',
      sourceId: order,
      ...extra,
    });
  /** I8: an issue for an order needs the order's demand line first. */
  async function ginOk(order: string, partId: string, qty: number, cookie = tk) {
    const d = await demand(order, partId, qty);
    expect(d.status, d.text).toBe(200);
    return postOk(cookie, gin(order, partId, qty));
  }
  async function postOk(cookie: string, body: Record<string, unknown>, approver = cookie) {
    const d = await draft(cookie, body);
    expect(d.status, d.text).toBe(201);
    const p = await post(approver, d.json.id, d.json.version);
    expect(p.status, p.text).toBe(200);
    return p.json as Row;
  }

  /** RULE-009: the ledger reproduces every balance and no balance breaks an invariant. */
  async function assertLedgerMatchesBalances() {
    const [balances, moves] = await Promise.all([rows('stockBalances'), rows('stockMovements')]);
    const sums = new Map<string, Row>();
    for (const m of moves) {
      const k = `${m.warehouseId}__${m.partId}`;
      const s = sums.get(k) ?? { onHand: 0, reserved: 0, value: 0 };
      s.onHand += m.onHandDelta;
      s.reserved += m.reservedDelta;
      s.value += m.valueDeltaVnd;
      sums.set(k, s);
    }
    for (const b of balances) {
      const k = b.id ?? `${b.warehouseId}__${b.partId}`;
      const s = sums.get(k) ?? { onHand: 0, reserved: 0, value: 0 };
      expect({ k, ...s }, `ledger of ${k}`).toEqual({
        k,
        onHand: b.onHand,
        reserved: b.reserved,
        value: b.valueVnd,
      });
      expect(b.onHand, `${k} on-hand`).toBeGreaterThanOrEqual(0);
      expect(b.reserved, `${k} reserved`).toBeGreaterThanOrEqual(0);
      expect(b.onHand - b.reserved, `${k} available`).toBeGreaterThanOrEqual(0);
    }
  }

  beforeAll(async () => {
    h = await createHarness(backend);
    tk = await h.loginAt('u_tk_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    th = await h.loginAt('u_th_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    owner = await h.loginAt('u_owner', 'br_q7');
    ownerAll = await h.loginAt('u_owner', 'all');
    kt = await h.login('u_kt');
  });

  describe('FR-INV-001/002 part catalogue', () => {
    it('storekeeper creates a part; the code is normalised; Idempotency-Key replays the same record', async () => {
      const k = key('part');
      const body = {
        code: ' test-avg 01 ',
        name: 'Phụ tùng thử giá vốn',
        brand: 'Demo',
        unit: 'piece',
        group: 'other',
        barcode: '8930000009991',
        compat: [{ make: 'Kia', model: 'Morning' }],
      };
      const a = await call(tk, 'POST', '/api/v1/inv/parts', body, k);
      expect(a.status, a.text).toBe(201);
      expect(a.json.code).toBe('TEST-AVG01');
      const b = await call(tk, 'POST', '/api/v1/inv/parts', body, k);
      expect(b.headers.get('idempotent-replayed')).toBe('true');
      expect(b.json.id).toBe(a.json.id);
    });

    it('a duplicate code is blocked whatever the case or separators, and names the existing part (FR-INV-002)', async () => {
      const dup = await call(tk, 'POST', '/api/v1/inv/parts', {
        code: 'test avg-01',
        name: 'Trùng mã',
        unit: 'piece',
        group: 'other',
      });
      expect(dup.status).toBe(409);
      expect(dup.json.code).toBe('part_code_exists');
      expect(dup.json.errors[0].message).toContain('TEST-AVG01');
      const dupBarcode = await call(tk, 'POST', '/api/v1/inv/parts', {
        code: 'KHAC-MA-01',
        name: 'Trùng mã vạch',
        unit: 'piece',
        group: 'other',
        barcode: '8930000009991',
      });
      expect(dupBarcode.json.code).toBe('part_barcode_exists');
    });

    it('only the storekeeper edits the catalogue; advisers and accountants read it', async () => {
      const body = { code: 'ZZ-001', name: 'x', unit: 'piece', group: 'other' };
      for (const who of [ql, cv, th, kt, ownerAll])
        expect((await call(who, 'POST', '/api/v1/inv/parts', body)).status).toBe(403);
      expect((await h.call('GET', '/api/v1/inv/parts', { cookie: cv })).status).toBe(200);
      expect((await h.call('GET', '/api/v1/inv/parts', { cookie: th })).status).toBe(403);
    });

    it('finds a part by code, name without diacritics, barcode and vehicle line', async () => {
      const find = async (qs: string) =>
        ((await h.call('GET', `/api/v1/inv/parts?${qs}`, { cookie: cv })).json.items as Row[]).map(
          (p) => p.code,
        );
      expect(await find('q=loc-dau')).toEqual(['LOC-DAU-TY01']);
      expect(await find('q=loc%20dau')).toEqual(['LOC-DAU-TY01']);
      expect(await find('q=L%E1%BB%8Dc%20d%E1%BA%A7u')).toEqual(['LOC-DAU-TY01']);
      expect(await find('q=8930000000011')).toEqual(['LOC-DAU-TY01']);
      expect(await find('q=toyota%20vios&by=model')).toEqual([
        'BUGI-NGK-IR01',
        'DAU-5W30-4L',
        'LOC-DAU-TY01',
        'LOP-MICH-18565',
        'MA-PHANH-TY01',
      ]);
      expect(await find('q=cx-5&by=model')).toEqual(['BUGI-NGK-IR01', 'DAU-5W30-4L']);
      expect(await find('q=zzz-no-such')).toEqual([]);
    });

    it('quantities cannot be edited through the catalogue (FR-INV-021)', async () => {
      const before = await balance(tk, P_COOL);
      const r = await h.call('PATCH', `/api/v1/inv/parts/${P_COOL}`, {
        cookie: tk,
        body: { name: 'Nước làm mát 1 lít (đổi tên)', onHand: 999, version: 1 },
      });
      expect(r.status).toBe(200);
      expect(r.json.name).toContain('đổi tên');
      expect(r.json.onHand).toBeUndefined();
      expect((await balance(tk, P_COOL)).onHand).toBe(before.onHand);
      const stale = await h.call('PATCH', `/api/v1/inv/parts/${P_COOL}`, {
        cookie: tk,
        body: { name: 'x', version: 1 },
      });
      expect(stale.json.code).toBe('version_conflict');
    });

    it('an inactive part keeps its history but cannot enter a new receipt', async () => {
      const off = await h.call('POST', `/api/v1/inv/parts/part_seed_10/status`, {
        cookie: tk,
        body: { status: 'inactive', version: 1 },
      });
      expect(off.json.code).toBe('state_invalid'); // already inactive in the seed
      const d = await draft(tk, grnPo('part_seed_10', 1, 1000));
      expect(d.json.code).toBe('part_inactive');
    });

    it('shows standard list prices from the price list headers (FR-INV-025 link); cost only with permission', async () => {
      const r = await h.call('GET', `/api/v1/inv/parts/${P_FILTER}/prices`, { cookie: ql });
      expect(r.json.items[0]).toMatchObject({
        priceListCode: 'STD',
        listPriceVnd: 130000,
        costVnd: 85000,
      });
      const tkPrices = await h.call('GET', `/api/v1/inv/parts/${P_FILTER}/prices`, { cookie: tk });
      expect(tkPrices.json.items[0].listPriceVnd).toBe(130000);
      expect(tkPrices.json.items[0].costVnd).toBeNull();
    });
  });

  describe('RULE-008 the four numbers and branch isolation (NFR-ISO-01)', () => {
    it('shows on-hand, reserved, in-transit and available together; available = on-hand - reserved (UAT-13)', async () => {
      const b = await balance(tk, P_FILTER);
      expect(b).toMatchObject({ onHand: 20, reserved: 2, inTransit: 0, available: 18 });
      expect(b.valueVnd).toBeNull(); // storekeeper has no cost permission
      const m = await balance(ql, P_FILTER);
      expect(m).toMatchObject({ valueVnd: 1_700_000, unitCostVnd: 85000 });
    });

    it('an adviser sees the available quantity only, never on-hand, reserved or cost', async () => {
      expect((await h.call('GET', '/api/v1/inv/stock', { cookie: cv })).status).toBe(403);
      const r = await h.call('GET', `/api/v1/inv/availability?partIds=${P_FILTER},${P_OIL}`, {
        cookie: cv,
      });
      expect(r.status).toBe(200);
      expect(r.json.items).toEqual([
        { partId: P_FILTER, available: 18, warehouses: [{ warehouseId: Q7, available: 18 }] },
        { partId: P_OIL, available: 10, warehouses: [{ warehouseId: Q7, available: 10 }] },
      ]);
      expect(JSON.stringify(r.json)).not.toMatch(/onHand|reserved|valueVnd|cost/i);
    });

    it('Thu Duc sees only its own stock and documents; Q7 records answer 404', async () => {
      const own = await stock(qlTd);
      expect(own.length).toBeGreaterThan(0);
      expect(own.every((b) => b.branchId === 'br_td')).toBe(true);
      expect(own.find((b) => b.partId === P_FILTER)).toMatchObject({ onHand: 6, available: 6 });
      const docs = await rows('stockDocuments');
      const q7Doc = docs.find((d) => d.branchId === 'br_q7')!;
      const id = q7Doc.id ?? 'stk_seed_q7_open';
      expect((await h.call('GET', `/api/v1/inv/documents/${id}`, { cookie: qlTd })).status).toBe(
        404,
      );
      // cannot write into another branch's warehouse either
      const w = await call(qlTd, 'POST', '/api/v1/inv/documents', {
        warehouseId: Q7,
        ...grnPo(P_OIL, 1, 1),
      });
      expect([403, 404]).toContain(w.status);
      const card = await h.call('GET', `/api/v1/inv/parts/${P_FILTER}/ledger?warehouseId=${Q7}`, {
        cookie: qlTd,
      });
      expect(card.json.items).toEqual([]);
    });

    it('the owner sees the consolidated stock of both branches but cannot create documents there', async () => {
      const all = await stock(ownerAll);
      expect(new Set(all.map((b) => b.branchId))).toEqual(new Set(['br_q7', 'br_td']));
      const w = await call(ownerAll, 'POST', '/api/v1/inv/documents', grnPo(P_OIL, 1, 1));
      expect(w.status).toBe(403); // CH only views stock
    });
  });

  describe('FR-INV-005/021/027 receipts, documents and weighted average cost', () => {
    it('GRN without a purchase order needs a reason and a manager to post; the draft changes no stock', async () => {
      const noReason = await draft(tk, {
        type: 'GRN',
        source: { type: 'no-po' },
        lines: [{ partId: P_COOL, qty: 5, unitCostVnd: 90000 }],
      });
      expect(noReason.status).toBe(422);
      const d = await draft(tk, {
        type: 'GRN',
        source: { type: 'no-po' },
        reason: 'Hàng nhà cung cấp tặng',
        lines: [{ partId: P_COOL, qty: 5, unitCostVnd: 90000 }],
      });
      expect(d.status).toBe(201);
      expect(d.json).toMatchObject({
        status: 'draft',
        number: null,
        needsApproval: true,
        approvalReasons: ['no_purchase_order'],
      });
      expect(d.json.displayNo).toMatch(/^NHAP-/);
      expect((await balance(tk, P_COOL)).onHand).toBe(30);
      const byTk = await post(tk, d.json.id);
      expect(byTk.status).toBe(403);
      expect(byTk.json.code).toBe('stock_approval_required');
      const byQl = await post(ql, d.json.id);
      expect(byQl.status).toBe(200);
      expect(byQl.json.number).toMatch(/^PN-Q7-\d{4}-\d{5}$/);
      expect(byQl.json.status).toBe('posted');
      expect(await balance(tk, P_COOL)).toMatchObject({ onHand: 35, available: 35 });
      // the draft reference was never a number: the first official number is 00001
      expect(byQl.json.number).toMatch(/-00001$/);
    });

    it('10 x 100.000 then 20 x 120.000 gives an average cost of 113.333 (UAT-25, sample case)', async () => {
      const part = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'AVG-CASE-1',
          name: 'Phụ tùng ví dụ giá bình quân',
          unit: 'piece',
          group: 'other',
        })
      ).json;
      await postOk(
        tk,
        grnPo(part.id, 10, 100_000, { expectedQty: 10, expectedUnitCostVnd: 100_000 }),
      );
      const g2 = await postOk(
        tk,
        grnPo(part.id, 20, 120_000, { expectedQty: 20, expectedUnitCostVnd: 120_000 }),
      );
      expect(g2.totalValueVnd).toBe(2_400_000);
      expect(await balance(ql, part.id)).toMatchObject({
        onHand: 30,
        valueVnd: 3_400_000,
        unitCostVnd: 113_333,
      });
      // issuing one unit leaves the average unchanged to within rounding
      const out = await ginOk('ro-avg-1', part.id, 1);
      expect(out.lines[0].unitCostVnd).toBeNull(); // storekeeper does not see cost
      const asQl = await h.call('GET', `/api/v1/inv/documents/${out.id}`, { cookie: ql });
      expect(asQl.json.lines[0]).toMatchObject({ unitCostVnd: 113_333, valueVnd: -113_333 });
    });

    it('a price or quantity variance beyond the threshold needs a manager (FR-INV-005)', async () => {
      const d = await draft(
        tk,
        grnPo(P_COOL, 10, 120_000, { expectedQty: 10, expectedUnitCostVnd: 90_000 }),
      );
      expect(d.json.approvalReasons).toEqual(['price_variance']);
      expect((await post(tk, d.json.id)).status).toBe(403);
      const q = await draft(
        tk,
        grnPo(P_COOL, 9, 90_000, { expectedQty: 10, expectedUnitCostVnd: 90_000 }),
      );
      // I7: receiving LESS than ordered is a partial receipt, no approval; receiving MORE needs one
      expect(q.json.approvalReasons).toEqual([]);
      const over = await draft(
        tk,
        grnPo(P_COOL, 11, 90_000, { expectedQty: 10, expectedUnitCostVnd: 90_000 }),
      );
      expect(over.json.approvalReasons).toEqual(['quantity_variance']);
      const ok = await draft(
        tk,
        grnPo(P_COOL, 10, 94_000, { expectedQty: 10, expectedUnitCostVnd: 90_000 }),
      );
      expect(ok.json.approvalReasons).toEqual([]); // 4,44% is within the default 5%
    });

    it('drafts can be edited and cancelled; posting twice is refused; posted documents are final (RULE-010)', async () => {
      const d = await draft(tk, grnPo(P_COOL, 1, 90_000));
      const edited = await h.call('PATCH', `/api/v1/inv/documents/${d.json.id}`, {
        cookie: tk,
        body: {
          version: 1,
          source: { type: 'purchase-order', id: 'po-demo-2' },
          lines: [{ partId: P_COOL, qty: 2, unitCostVnd: 91_000 }],
        },
      });
      expect(edited.status, edited.text).toBe(200);
      expect(edited.json.lines[0].qty).toBe(2);
      const stale = await h.call('PATCH', `/api/v1/inv/documents/${d.json.id}`, {
        cookie: tk,
        body: {
          version: 1,
          source: { type: 'no-po' },
          reason: 'x'.repeat(6),
          lines: [{ partId: P_COOL, qty: 1, unitCostVnd: 1 }],
        },
      });
      expect(stale.json.code).toBe('version_conflict');
      const k = key('post');
      const p1 = await post(tk, d.json.id, 2, k);
      expect(p1.status).toBe(200);
      const replay = await post(tk, d.json.id, 2, k);
      expect(replay.headers.get('idempotent-replayed')).toBe('true');
      expect(replay.json.number).toBe(p1.json.number);
      expect((await post(tk, d.json.id, 3)).json.code).toBe('state_invalid');
      const afterEdit = await h.call('PATCH', `/api/v1/inv/documents/${d.json.id}`, {
        cookie: tk,
        body: {
          version: 3,
          source: { type: 'purchase-order', id: 'po-x' },
          lines: [{ partId: P_COOL, qty: 9, unitCostVnd: 1 }],
        },
      });
      expect(afterEdit.json.code).toBe('state_invalid');
      const cancelPosted = await call(tk, 'POST', `/api/v1/inv/documents/${d.json.id}/cancel`, {
        reason: 'Nhập nhầm',
        version: 3,
      });
      expect(cancelPosted.json.code).toBe('state_invalid');

      const c = await draft(tk, grnPo(P_COOL, 1, 90_000));
      const cancelled = await call(tk, 'POST', `/api/v1/inv/documents/${c.json.id}/cancel`, {
        reason: 'Nhập nhầm phụ tùng',
        version: 1,
      });
      expect(cancelled.json.status).toBe('cancelled');
      expect((await post(tk, c.json.id, 2)).json.code).toBe('state_invalid');
    });

    it('numbers are issued at posting only, consecutive, and a failed posting burns none', async () => {
      const before = (await rows('stockDocuments')).filter((d) => d.type === 'GRN' && d.number);
      const lastSeq = Math.max(0, ...before.map((d) => Number(String(d.number).split('-').at(-1))));
      await demand('ro-fail', P_OUT, 1); // the demand is stored although nothing can be held
      const bad = await draft(tk, gin('ro-fail', P_OUT, 1)); // part 05 has no stock
      expect((await post(tk, bad.json.id)).json.code).toBe('stock_insufficient');
      const next = await postOk(tk, grnPo(P_COOL, 1, 90_000));
      expect(Number(next.number.split('-').at(-1))).toBe(lastSeq + 1);
    });
  });

  describe('FR-INV-006/007/019/020 issues need a source, respect available, consume the order hold', () => {
    it('there is no stock issue without a source document or a receiver (UAT-02, RULE-007)', async () => {
      const noSource = await draft(tk, { type: 'GIN', lines: [{ partId: P_OIL, qty: 1 }] });
      expect(noSource.status).toBe(422);
      const manual = await draft(tk, {
        type: 'GIN',
        source: { type: 'manual', id: 'x' },
        lines: [{ partId: P_OIL, qty: 1 }],
      });
      expect(manual.status).toBe(422);
      const noRef = await draft(tk, {
        type: 'GIN',
        source: { type: 'repair-order' },
        lines: [{ partId: P_OIL, qty: 1 }],
        receiverUserId: 'u_th_q7',
      });
      expect(noRef.status).toBe(422);
      const noReceiver = await draft(tk, {
        type: 'GIN',
        source: { type: 'repair-order', id: 'ro-x' },
        lines: [{ partId: P_OIL, qty: 1 }],
      });
      expect(noReceiver.status).toBe(422);
      expect(noReceiver.json.errors[0].field).toBe('receiverUserId');
      const ghost = await draft(tk, gin('ro-x', P_OIL, 1, 'u_nobody'));
      expect(ghost.status).toBe(422);
    });

    it('stock 20, hold 2 -> available 18: another order cannot take 19, the holder can take its 2 on top (UAT-13)', async () => {
      const d19 = await demand('ro-other', P_FILTER, 19);
      expect(d19.json.items[0]).toMatchObject({ heldQty: 18, unmetQty: 1 }); // approval never refused
      const other = await draft(tk, gin('ro-other', P_FILTER, 19));
      const blocked = await post(tk, other.json.id);
      expect(blocked.status).toBe(409);
      expect(blocked.json.code).toBe('stock_insufficient');
      // ro-other holds the 18 that were available (its 19th unit is unmet); the seed order keeps its 2
      expect(await balance(tk, P_FILTER)).toMatchObject({ onHand: 20, reserved: 20, available: 0 });

      const ok = await postOk(tk, gin('ro-other', P_FILTER, 18));
      expect(await balance(tk, P_FILTER)).toMatchObject({ onHand: 2, reserved: 2 });
      expect(ok.number).toMatch(/^PX-Q7-\d{4}-\d{5}$/);
      expect(await balance(tk, P_FILTER)).toMatchObject({ onHand: 2, reserved: 2, available: 0 });
      // the protected hold cannot be taken by a third order
      await demand('ro-third', P_FILTER, 1);
      const third = await draft(tk, gin('ro-third', P_FILTER, 1));
      expect((await post(tk, third.json.id)).json.code).toBe('stock_insufficient');
      // the holder's own 2 turn into an issue: reserved and on-hand drop together
      const own = await postOk(tk, gin('ro_demo_1', P_FILTER, 2));
      expect(own.status).toBe('posted');
      expect(await balance(tk, P_FILTER)).toMatchObject({ onHand: 0, reserved: 0, available: 0 });
      const rs = await h.call('GET', `/api/v1/inv/reservations?partId=${P_FILTER}`, { cookie: tk });
      expect(rs.json.items[0]).toMatchObject({
        sourceId: 'ro_demo_1',
        status: 'fulfilled',
        issuedQty: 2,
        heldQty: 0,
      });
      await assertLedgerMatchesBalances();
    });

    it('the stock card lists every document that moved the balance, newest first (RULE-009)', async () => {
      const card = await h.call('GET', `/api/v1/inv/parts/${P_FILTER}/ledger?warehouseId=${Q7}`, {
        cookie: ql,
      });
      expect(card.status).toBe(200);
      const kinds = (card.json.items as Row[]).map((m) => m.kind);
      expect(kinds).toEqual(['issue', 'issue', 'reserve', 'reserve', 'adjust']);
      expect(card.json.items[0].documentNo).toMatch(/^PX-/);
      expect(card.json.items[0].onHandAfter).toBe(0);
      const asTk = await h.call('GET', `/api/v1/inv/parts/${P_FILTER}/ledger?warehouseId=${Q7}`, {
        cookie: tk,
      });
      expect(asTk.json.items[0].unitCostVnd).toBeNull();
    });

    it('issueForOrder (REC entry point) creates and posts in one step, idempotently', async () => {
      const k = key('iss');
      await demand('ro-rec-1', P_BATT, 5); // 4 on hand: 4 held, 1 unmet
      const body = {
        warehouseId: Q7,
        orderId: 'ro-rec-1',
        receiverUserId: 'u_th_q7',
        lines: [{ partId: P_BATT, qty: 1 }],
      };
      const a = await call(tk, 'POST', '/api/v1/inv/issues', body, k);
      expect(a.status, a.text).toBe(201);
      expect(a.json).toMatchObject({ status: 'posted', type: 'GIN' });
      const b = await call(tk, 'POST', '/api/v1/inv/issues', body, k);
      expect(b.headers.get('idempotent-replayed')).toBe('true');
      expect((await balance(tk, P_BATT)).onHand).toBe(3);
      const over = await call(tk, 'POST', '/api/v1/inv/issues', {
        ...body,
        lines: [{ partId: P_BATT, qty: 4 }],
      });
      expect(over.json.code).toBe('stock_insufficient');
      expect((await balance(tk, P_BATT)).onHand).toBe(3);
      await release('ro-rec-1', { reason: 'order-closed' });
    });
  });

  describe('FR-INV-008 returns and RULE-010 reversal', () => {
    let issued: Row;
    beforeAll(async () => {
      issued = await ginOk('ro-ret-1', P_OIL, 4);
    });

    it('returns parts of an order at the cost they left with, never more than issued', async () => {
      const rtn = (qty: number, order = 'ro-ret-1', line = 1) => ({
        type: 'RTN',
        source: { type: 'repair-order', id: order },
        originalDocumentId: issued.id,
        lines: [{ partId: P_OIL, qty, originalLineNo: line }],
      });
      const r1 = await postOk(tk, rtn(3));
      expect(r1.number).toMatch(/^HK-Q7-/);
      expect(await balance(ql, P_OIL)).toMatchObject({ onHand: 9, valueVnd: 9 * 420000 });
      const over = await draft(tk, rtn(2));
      expect((await post(tk, over.json.id)).json.code).toBe('return_exceeds_issued');
      const wrongOrder = await draft(tk, rtn(1, 'ro-other-order'));
      expect(wrongOrder.json.code).toBe('original_invalid');
      await postOk(tk, rtn(1));
      expect((await balance(tk, P_OIL)).onHand).toBe(10);
      await assertLedgerMatchesBalances();
    });

    it('a posted document is reversed by a numbered reversal document linked both ways; twice is refused', async () => {
      const g = await postOk(tk, grnPo(P_COOL, 3, 90_000));
      const asTk = await call(tk, 'POST', `/api/v1/inv/documents/${g.id}/reverse`, {
        reason: 'Nhập nhầm số lượng',
        version: 2,
      });
      expect(asTk.status).toBe(403);
      const rev = await call(ql, 'POST', `/api/v1/inv/documents/${g.id}/reverse`, {
        reason: 'Nhập nhầm số lượng',
        version: 2,
      });
      expect(rev.status, rev.text).toBe(201);
      expect(rev.json).toMatchObject({ status: 'posted', reversalOf: g.id });
      expect(rev.json.number).toMatch(/^PN-Q7-/);
      expect(rev.json.number).not.toBe(g.number);
      const orig = await h.call('GET', `/api/v1/inv/documents/${g.id}`, { cookie: ql });
      expect(orig.json.reversedBy).toBe(rev.json.id);
      expect(orig.json.status).toBe('posted');
      const again = await call(ql, 'POST', `/api/v1/inv/documents/${g.id}/reverse`, {
        reason: 'Đảo lần hai',
        version: 3,
      });
      expect(again.json.code).toBe('state_invalid');
      await assertLedgerMatchesBalances();
    });

    it('a receipt cannot be reversed when its stock is already gone (negative stock stays blocked)', async () => {
      const g = await postOk(tk, grnPo(P_BATT, 2, 1_300_000));
      await ginOk('ro-batt-2', P_BATT, 5); // 3 + 2 on hand, take all 5
      const rev = await call(ql, 'POST', `/api/v1/inv/documents/${g.id}/reverse`, {
        reason: 'Đảo phiếu nhập',
        version: 2,
      });
      expect(rev.status).toBe(409);
      expect(['stock_insufficient', 'stock_negative']).toContain(rev.json.code);
    });

    it('reversing an issue puts the parts back at the same value', async () => {
      const before = await balance(ql, P_COOL);
      const g = await ginOk('ro-cool-1', P_COOL, 4);
      const mid = await balance(ql, P_COOL);
      expect(mid.onHand).toBe(before.onHand - 4);
      const rev = await call(ql, 'POST', `/api/v1/inv/documents/${g.id}/reverse`, {
        reason: 'Xuất nhầm lệnh',
        version: 2,
      });
      expect(rev.status).toBe(201);
      const after = await balance(ql, P_COOL);
      expect(after.onHand).toBe(before.onHand);
      expect(after.valueVnd).toBe(before.valueVnd);
    });
  });

  describe('FR-INV-020 reservations', () => {
    const hold = (cookie: string, order: string, partId: string, qty: number, extra: Row = {}) =>
      call(cookie, 'POST', '/api/v1/inv/reservations', {
        sourceType: 'repair-order',
        sourceId: order,
        warehouseId: Q7,
        partId,
        qty,
        ...extra,
      });

    it('holds against available, fails whole when short, supports a partial hold with the shortage reported', async () => {
      const a = await hold(cv, 'ro-h1', P_BRAKE, 2);
      expect(a.status, a.text).toBe(200);
      expect(a.json).toMatchObject({ heldQty: 2, status: 'holding', shortBy: 0 });
      expect(await balance(tk, P_BRAKE)).toMatchObject({ onHand: 3, reserved: 2, available: 1 });
      const short = await hold(cv, 'ro-h2', P_BRAKE, 2);
      expect(short.status).toBe(409);
      expect(short.json.code).toBe('stock_insufficient');
      const part = await hold(cv, 'ro-h2', P_BRAKE, 2, { allowPartial: true });
      expect(part.json).toMatchObject({ heldQty: 1, qty: 2, unmetQty: 1, shortBy: 1 });
      expect((await balance(tk, P_BRAKE)).available).toBe(0);
      const none = await hold(cv, 'ro-h3', P_BRAKE, 1, { allowPartial: true });
      // I1: the shortage is stored (shortage list), not dropped; still no backorder document
      expect(none.json).toMatchObject({ heldQty: 0, unmetQty: 1, shortBy: 1, status: 'holding' });
      expect((await rows('stockReservations')).find((r) => r.sourceId === 'ro-h3')).toMatchObject({
        unmetQty: 1,
        heldQty: 0,
      });
      await assertLedgerMatchesBalances();
    });

    it('asking again for the same total changes nothing; a new total holds or releases the difference', async () => {
      const again = await hold(cv, 'ro-h1', P_BRAKE, 2);
      expect(again.json.heldQty).toBe(2);
      const moves = (await rows('stockMovements')).filter((m) => m.sourceId === 'ro-h1');
      expect(moves.length).toBe(1);
      const lower = await hold(cv, 'ro-h1', P_BRAKE, 1);
      expect(lower.json).toMatchObject({ heldQty: 1, qty: 1 });
      expect((await balance(tk, P_BRAKE)).available).toBe(1);
      const lines = (await rows('stockMovements')).filter((m) => m.sourceId === 'ro-h1');
      expect(lines.map((m) => m.kind).sort()).toEqual(['release', 'reserve']);
    });

    it('releasing a rejected quote or cancelled order frees the stock; releasing twice is harmless', async () => {
      const k = key('rel');
      const rel = await call(
        cv,
        'POST',
        '/api/v1/inv/reservations/release',
        { sourceType: 'repair-order', sourceId: 'ro-h2' },
        k,
      );
      expect(rel.status, rel.text).toBe(200);
      expect(rel.json.released[0]).toMatchObject({ heldQty: 0, unmetQty: 0, status: 'released' });
      await release('ro-h3');
      const rel2 = await call(cv, 'POST', '/api/v1/inv/reservations/release', {
        sourceType: 'repair-order',
        sourceId: 'ro-h2',
      });
      expect(rel2.json.released).toEqual([]);
      const replay = await call(
        cv,
        'POST',
        '/api/v1/inv/reservations/release',
        { sourceType: 'repair-order', sourceId: 'ro-h2' },
        k,
      );
      expect(replay.headers.get('idempotent-replayed')).toBe('true');
      await call(cv, 'POST', '/api/v1/inv/reservations/release', {
        sourceType: 'repair-order',
        sourceId: 'ro-h1',
      });
      expect(await balance(tk, P_BRAKE)).toMatchObject({ onHand: 3, reserved: 0, available: 3 });
      await assertLedgerMatchesBalances();
    });

    it('a technician cannot reserve; a quote can hold stock like an order', async () => {
      expect((await hold(th, 'ro-h4', P_BRAKE, 1)).status).toBe(403);
      const q = await call(cv, 'POST', '/api/v1/inv/reservations', {
        sourceType: 'quote',
        sourceId: 'bg-1',
        warehouseId: Q7,
        partId: P_BRAKE,
        qty: 1,
      });
      expect(q.json).toMatchObject({ sourceType: 'quote', heldQty: 1 });
      await call(cv, 'POST', '/api/v1/inv/reservations/release', {
        sourceType: 'quote',
        sourceId: 'bg-1',
      });
    });
  });

  describe('reorder alert compares AVAILABLE, not on-hand (RULE-008)', () => {
    it('lists parts whose available quantity is at or below the minimum, with the suggested quantity', async () => {
      const low = await h.call('GET', '/api/v1/inv/stock?lowStock=true', { cookie: tk });
      const codes = (low.json.items as Row[]).map((b) => b.partCode);
      expect(codes).toContain('MA-PHANH-TY01'); // 3 <= 5
      expect(codes).toContain('LOC-GIO-HY01'); // 0 <= 4, out of stock
      expect(codes).not.toContain('DAU-5W30-4L');
      const brake = (low.json.items as Row[]).find((b) => b.partCode === 'MA-PHANH-TY01')!;
      expect(brake).toMatchObject({ status: 'low', minQty: 5, maxQty: 12, suggestQty: 9 });
      const out = (low.json.items as Row[]).find((b) => b.partCode === 'LOC-GIO-HY01')!;
      expect(out.status).toBe('out');
    });

    it('reserved stock can trigger the alert although on-hand is above the minimum', async () => {
      const cool = await balance(tk, P_COOL);
      const min = cool.available - 3;
      const lv = await call(tk, 'PUT', '/api/v1/inv/stock/levels', {
        warehouseId: Q7,
        partId: P_COOL,
        minQty: min,
        maxQty: 60,
      });
      expect(lv.status, lv.text).toBe(200);
      const codes = async () =>
        (
          (await h.call('GET', '/api/v1/inv/stock?lowStock=true', { cookie: tk })).json
            .items as Row[]
        ).map((b) => b.partCode);
      expect(await codes()).not.toContain('NUOC-MAT-1L');
      await call(cv, 'POST', '/api/v1/inv/reservations', {
        sourceType: 'repair-order',
        sourceId: 'ro-cool',
        warehouseId: Q7,
        partId: P_COOL,
        qty: 4,
      });
      expect(await codes()).toContain('NUOC-MAT-1L');
      expect((await balance(tk, P_COOL)).onHand).toBeGreaterThan(min);
      const bad = await call(tk, 'PUT', '/api/v1/inv/stock/levels', {
        warehouseId: Q7,
        partId: P_COOL,
        minQty: 10,
        maxQty: 5,
      });
      expect(bad.status).toBe(422);
      await call(cv, 'POST', '/api/v1/inv/reservations/release', {
        sourceType: 'repair-order',
        sourceId: 'ro-cool',
      });
    });
  });

  describe('FR-SYS-029 warehouse deactivation guard (UAT-31)', () => {
    it('is refused while stock exists or a draft document is open, allowed once empty and clean', async () => {
      const st = (id: string, k: string) =>
        h.call('POST', `/api/v1/sys/warehouses/${id}/status`, {
          cookie: owner,
          key: k,
          body: { status: 'inactive', version: 1 },
        });
      const blocked = await st(Q7, key('wh'));
      expect(blocked.status).toBe(409);
      expect(blocked.json.code).toBe('warehouse_not_empty');
      const lop = 'wh_br_q7_WH-LOP';
      const d = await call(tk, 'POST', '/api/v1/inv/documents', {
        warehouseId: lop,
        ...grnPo(P_OIL, 1, 1),
      });
      expect(d.status, d.text).toBe(201);
      expect((await st(lop, key('wh'))).json.code).toBe('warehouse_not_empty');
      await call(tk, 'POST', `/api/v1/inv/documents/${d.json.id}/cancel`, {
        reason: 'Không dùng nữa',
        version: 1,
      });
      expect((await st(lop, key('wh'))).status).toBe(200);
      const toInactive = await call(tk, 'POST', '/api/v1/inv/documents', {
        warehouseId: lop,
        ...grnPo(P_OIL, 1, 1),
      });
      expect(toInactive.json.code).toBe('warehouse_inactive');
    });
  });

  describe('separation of duties and audit', () => {
    it('an adjustment needs a manager who is not its creator (opening balance and corrections)', async () => {
      // give the manager the storekeeper role so one person can both create and approve
      const add = await h.call('POST', '/api/v1/sys/users/u_ql_q7/assignments', {
        cookie: owner,
        body: { roleCode: 'TK', branchId: 'br_q7' },
      });
      expect(add.status, add.text).toBe(201);
      const adj = await draft(ql, {
        type: 'ADJ',
        source: { type: 'manual-adjustment' },
        reason: 'Kiểm đếm phát hiện thiếu',
        lines: [{ partId: P_COOL, qty: -1 }],
      });
      expect(adj.status, adj.text).toBe(201);
      expect(adj.json.approvalReasons).toEqual(['adjustment']);
      const own = await post(ql, adj.json.id);
      expect(own.status).toBe(409);
      expect(own.json.code).toBe('approver_must_differ');
      const multi = await h.loginAt('u_multi', 'br_q7');
      const ok = await post(multi, adj.json.id);
      expect(ok.status, ok.text).toBe(200);
      expect(ok.json.number).toMatch(/^DC-Q7-/);
      // an opening balance cannot be negative, and needs a cost for what it adds
      const open = await draft(ql, {
        type: 'ADJ',
        source: { type: 'opening-balance' },
        lines: [{ partId: P_COOL, qty: -1 }],
      });
      expect(open.status).toBe(422);
      const noCost = await draft(ql, {
        type: 'ADJ',
        source: { type: 'opening-balance' },
        lines: [{ partId: P_COOL, qty: 5 }],
      });
      expect(noCost.status).toBe(422);
    });

    it('every change writes an audit entry in the same transaction (FR-SYS-003)', async () => {
      const a = await h.call('GET', '/api/v1/sys/audit?entityType=stockDocument&limit=100', {
        cookie: ql,
      });
      expect(a.status).toBe(200);
      const actions = new Set((a.json.items as Row[]).map((e) => e.action));
      for (const x of [
        'stockDocument.create',
        'stockDocument.post',
        'stockDocument.reverse',
        'stockDocument.cancel',
      ])
        expect(actions.has(x), x).toBe(true);
      const res = await h.call('GET', '/api/v1/sys/audit?entityType=stockReservation&limit=100', {
        cookie: ql,
      });
      expect((res.json.items as Row[]).map((e) => e.action)).toContain('stockReservation.hold');
    });

    it('the permission matrix: accountant reads, technician and adviser cannot post, nobody deletes', async () => {
      const d = await draft(tk, grnPo(P_OIL, 1, 1));
      for (const who of [cv, th, kt]) expect((await post(who, d.json.id)).status).toBe(403);
      expect((await h.call('GET', '/api/v1/inv/documents', { cookie: kt })).status).toBe(200);
      // there is no API to delete or overwrite a posted record (RULE-010): no inv route exports DELETE,
      // and PUT exists only for the reorder-level setter, which is not a stock movement
      const methods = allRouteFiles()
        .filter((r) => r.file.includes('/api/v1/inv/'))
        .flatMap((r) => r.methods.map((m) => `${m} ${r.file}`));
      expect(methods.filter((m) => m.startsWith('DELETE'))).toEqual([]);
      expect(methods.filter((m) => m.startsWith('PUT'))).toEqual([
        'PUT /src/app/api/v1/inv/stock/levels/route.ts',
      ]);
      await call(tk, 'POST', `/api/v1/inv/documents/${d.json.id}/cancel`, {
        reason: 'Dọn dẹp thử nghiệm',
        version: 1,
      });
    });
  });

  describe('BA-07 reservation events, I1 I3 I8: demand lines, partial approval, release, restore, shortage', () => {
    const newPart = async (code: string) =>
      (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code,
          name: `Phụ tùng thử ${code}`,
          unit: 'piece',
          group: 'other',
        })
      ).json as Row;
    const resOf = async (order: string, partId: string) =>
      (await rows('stockReservations')).find((r) => r.sourceId === order && r.partId === partId)!;

    it('rows 2, 3, 6: the approval path never refuses; the shortfall is stored; one approval shares the balance read', async () => {
      const part = await newPart('ROW-A2');
      await postOk(tk, grnPo(part.id, 5, 1000));
      const k = key('appr');
      const body = {
        orderId: 'ro-ap1',
        warehouseId: Q7,
        lines: [
          { lineKey: 'l1', partId: part.id, qty: 3 },
          { lineKey: 'l2', partId: part.id, qty: 3 },
        ],
      };
      const a = await call(tk, 'POST', '/api/v1/inv/reservations/approval', body, k);
      expect(a.status, a.text).toBe(200);
      expect(a.json.items.map((x: Row) => [x.heldQty, x.unmetQty])).toEqual([
        [3, 0],
        [2, 1],
      ]);
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 5, reserved: 5, available: 0 });
      const again = await call(tk, 'POST', '/api/v1/inv/reservations/approval', body, k);
      expect(again.headers.get('idempotent-replayed')).toBe('true');
      // row 6: supplementary work approved -> call again with the new total; goods arrived -> same call holds the shortage (row 16)
      await postOk(tk, grnPo(part.id, 4, 1000));
      const more = await demand('ro-ap1', part.id, 4, tk, 'l2');
      expect(more.json.items[0]).toMatchObject({ heldQty: 4, unmetQty: 0 });
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 9, reserved: 7, available: 2 });
      // a technician cannot approve for a customer
      expect((await demand('ro-ap2', part.id, 1, th)).status).toBe(403);
      await release('ro-ap1', { reason: 'order-cancelled' });
      expect(await balance(tk, part.id)).toMatchObject({ reserved: 0, available: 9 });
      await assertLedgerMatchesBalances();
    });

    it('I8: an issue for an order needs the order demand line and cannot exceed the demand still open (I3 cap)', async () => {
      const part = await newPart('ROW-I8');
      await postOk(tk, grnPo(part.id, 10, 1000));
      const none = await draft(tk, gin('ro-i8', part.id, 1));
      const noLine = await post(tk, none.json.id);
      expect(noLine.status).toBe(409);
      expect(noLine.json.code).toBe('order_line_missing');
      // another order's demand does not help
      await demand('ro-i8-other', part.id, 2);
      expect((await post(tk, none.json.id)).json.code).toBe('order_line_missing');
      await demand('ro-i8', part.id, 3);
      const big = await draft(tk, gin('ro-i8', part.id, 4)); // plenty of available stock, but only 3 demanded
      expect((await post(tk, big.json.id)).json.code).toBe('issue_exceeds_demand');
      await postOk(tk, gin('ro-i8', part.id, 2));
      const rest = await draft(tk, gin('ro-i8', part.id, 2));
      expect((await post(tk, rest.json.id)).json.code).toBe('issue_exceeds_demand'); // 1 left
      await postOk(tk, gin('ro-i8', part.id, 1));
      expect(await resOf('ro-i8', part.id)).toMatchObject({ status: 'fulfilled', issuedQty: 3 });
    });

    it('rows 10, 14, 18: partial issue consumes the hold; completing the item releases the surplus and closes the line', async () => {
      const part = await newPart('ROW-B14');
      await postOk(tk, grnPo(part.id, 10, 1000));
      await demand('ro-14', part.id, 5);
      await postOk(tk, gin('ro-14', part.id, 2));
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 8, reserved: 3, available: 5 });
      const rel = await release('ro-14', { reason: 'item-completed' });
      expect(rel.json.released[0]).toMatchObject({
        heldQty: 0,
        unmetQty: 0,
        qty: 2,
        status: 'fulfilled',
      });
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 8, reserved: 0, available: 8 });
      expect((await resOf('ro-14', part.id)).closed).toBe(true);
      const late = await draft(tk, gin('ro-14', part.id, 1));
      expect((await post(tk, late.json.id)).json.code).toBe('order_line_missing'); // closed line: no demand left
      const audit = await h.call('GET', '/api/v1/sys/audit?entityType=stockReservation&limit=100', {
        cookie: ql,
      });
      expect(
        (audit.json.items as Row[]).some(
          (e) => e.action === 'stockReservation.release' && e.reason === 'item-completed',
        ),
      ).toBe(true);
      await assertLedgerMatchesBalances();
    });

    it('row 13: reversing an issue puts the demand back on the line (held if the stock covers it); a closed line stays closed', async () => {
      const part = await newPart('ROW-C13');
      await postOk(tk, grnPo(part.id, 10, 1000));
      await demand('ro-13', part.id, 4);
      const g = await postOk(tk, gin('ro-13', part.id, 4));
      expect(await resOf('ro-13', part.id)).toMatchObject({ status: 'fulfilled', heldQty: 0 });
      const rev = await call(ql, 'POST', `/api/v1/inv/documents/${g.id}/reverse`, {
        reason: 'Xuất nhầm số lượng',
        version: 2,
      });
      expect(rev.status, rev.text).toBe(201);
      expect(await resOf('ro-13', part.id)).toMatchObject({
        status: 'holding',
        heldQty: 4,
        issuedQty: 0,
        unmetQty: 0,
      });
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 10, reserved: 4 });
      // the order line was completed and closed: a later reversal only returns the stock
      await demand('ro-13b', part.id, 2);
      const g2 = await postOk(tk, gin('ro-13b', part.id, 2));
      await release('ro-13b', { reason: 'item-completed' });
      await call(ql, 'POST', `/api/v1/inv/documents/${g2.id}/reverse`, {
        reason: 'Xuất nhầm lệnh',
        version: 2,
      });
      expect(await resOf('ro-13b', part.id)).toMatchObject({
        heldQty: 0,
        issuedQty: 2,
        closed: true,
      });
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 10, reserved: 4 });
      await assertLedgerMatchesBalances();
    });

    it('row 23: a count below the reserved quantity is booked; the holds given last are shortened and become unmet', async () => {
      const part = await newPart('ROW-C23');
      await postOk(tk, grnPo(part.id, 10, 1000));
      await demand('ro-23a', part.id, 4);
      h.clock.set(new Date(h.clock.now().getTime() + 5_000).toISOString());
      await demand('ro-23b', part.id, 4);
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 10, reserved: 8, available: 2 });
      const d = await draft(tk, {
        type: 'ADJ',
        source: { type: 'manual-adjustment' },
        reason: 'Kiểm kê thiếu 5',
        lines: [{ partId: part.id, qty: -5 }],
      });
      const p = await post(ql, d.json.id);
      expect(p.status, p.text).toBe(200);
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 5, reserved: 5, available: 0 });
      expect(await resOf('ro-23a', part.id)).toMatchObject({ heldQty: 4, unmetQty: 0 });
      expect(await resOf('ro-23b', part.id)).toMatchObject({ heldQty: 1, unmetQty: 3, qty: 4 });
      // more than the shelf holds is still refused
      const bad = await draft(tk, {
        type: 'ADJ',
        source: { type: 'manual-adjustment' },
        reason: 'Kiểm kê thiếu nhiều',
        lines: [{ partId: part.id, qty: -6 }],
      });
      expect((await post(ql, bad.json.id)).json.code).toBe('stock_insufficient');
      await assertLedgerMatchesBalances();
    });

    it('I15: a count that cuts holds tells the branch manager and the advisor of each affected order, and never blocks posting', async () => {
      const part = await newPart('ROW-I15');
      await postOk(tk, grnPo(part.id, 10, 1000));
      await demand('ro-15a', part.id, 4);
      h.clock.set(new Date(h.clock.now().getTime() + 5_000).toISOString());
      await demand('ro-15b', part.id, 4);
      const real = h.container.inv.advisors;
      const notices = async () =>
        (await rows('notifications')).filter(
          (n) =>
            n.kind === 'stock.reservation_shortened' &&
            JSON.stringify(n.params).includes(part.code ?? 'ROW-I15'),
        );
      h.container.inv.advisors = {
        advisorsOf: async (_c, _t, ids) => new Map(ids.map((i) => [i, 'u_cv_q7'])),
      };
      try {
        const d = await draft(tk, {
          type: 'ADJ',
          source: { type: 'manual-adjustment' },
          reason: 'Kiểm kê thiếu 5',
          lines: [{ partId: part.id, qty: -5 }],
        });
        expect((await post(ql, d.json.id)).status).toBe(200);
      } finally {
        h.container.inv.advisors = real;
      }
      const got = await notices();
      // only the order whose hold was cut (ro-15b, 3 short); the active managers of Q7 + that order's advisor
      expect(got.map((n) => n.userId).sort()).toEqual(['u_cv_q7', 'u_multi', 'u_ql_q7']); // the disabled manager is skipped
      for (const n of got) expect(n.params).toMatchObject({ orderId: 'ro-15b', qty: '3' });
      expect(JSON.stringify(got)).not.toMatch(/Nguyễn|09\d{8}/); // part code, order, quantity only
      // a failing advisor lookup still books the count; the manager is told
      const second = await newPart('ROW-I15B');
      await postOk(tk, grnPo(second.id, 4, 1000));
      await demand('ro-15c', second.id, 4);
      h.container.inv.advisors = {
        advisorsOf: async () => {
          throw new Error('down');
        },
      };
      try {
        const d2 = await draft(tk, {
          type: 'ADJ',
          source: { type: 'manual-adjustment' },
          reason: 'Kiểm kê thiếu 2',
          lines: [{ partId: second.id, qty: -2 }],
        });
        expect((await post(ql, d2.json.id)).status).toBe(200);
      } finally {
        h.container.inv.advisors = real;
      }
      expect(await balance(tk, second.id)).toMatchObject({ onHand: 2, reserved: 2 });
      await assertLedgerMatchesBalances();
    });

    it('I20: an issue names the immutable order line; without it, only when the order has ONE line for the part', async () => {
      const part = await newPart('ROW-I20');
      await postOk(tk, grnPo(part.id, 10, 1000));
      const approval = await call(tk, 'POST', '/api/v1/inv/reservations/approval', {
        orderId: 'ro-i20',
        warehouseId: Q7,
        lines: [
          { lineKey: 'l1', partId: part.id, qty: 2 },
          { lineKey: 'l2', partId: part.id, qty: 3 },
        ],
      });
      expect(approval.status, approval.text).toBe(200);
      // two demand lines for the same part: the part code is no key
      const ambiguous = await draft(tk, gin('ro-i20', part.id, 1));
      expect(ambiguous.status).toBe(422);
      expect(ambiguous.json.errors[0].field).toBe('lines.0.lineKey');
      const viaIssues = await call(tk, 'POST', '/api/v1/inv/issues', {
        warehouseId: Q7,
        orderId: 'ro-i20',
        receiverUserId: 'u_th_q7',
        lines: [{ partId: part.id, qty: 1 }],
      });
      expect(viaIssues.status).toBe(422);
      // the key picks the line; the other line is untouched
      const ok = await postOk(tk, {
        ...gin('ro-i20', part.id, 2),
        lines: [{ partId: part.id, qty: 2, lineKey: 'l1' }],
      });
      expect(ok.lines[0].lineKey).toBe('l1');
      const res = (await rows('stockReservations')).filter((r) => r.sourceId === 'ro-i20');
      expect(res.find((r) => r.lineKey === 'l1')).toMatchObject({ issuedQty: 2, heldQty: 0 });
      expect(res.find((r) => r.lineKey === 'l2')).toMatchObject({ issuedQty: 0, heldQty: 3 });
      // issuing more than line l1 still needs is refused even though l2 has stock held
      const over = await draft(tk, {
        ...gin('ro-i20', part.id, 1),
        lines: [{ partId: part.id, qty: 1, lineKey: 'l1' }],
      });
      expect((await post(tk, over.json.id)).json.code).toBe('issue_exceeds_demand');
      // a key that is no line of the order
      const ghost = await draft(tk, {
        ...gin('ro-i20', part.id, 1),
        lines: [{ partId: part.id, qty: 1, lineKey: 'l9' }],
      });
      expect((await post(tk, ghost.json.id)).json.code).toBe('order_line_missing');
    });

    it('I16: the transfer-order source is refused wherever the flag is off (everything but local and test)', async () => {
      const part = await newPart('ROW-I16');
      await postOk(tk, grnPo(part.id, 3, 1000));
      const body = {
        type: 'GIN',
        source: { type: 'transfer-order', id: 'ck-1' },
        lines: [{ partId: part.id, qty: 1 }],
      };
      const cfg = h.container.inv.inv;
      expect(cfg.allowTransferOrderSource).toBe(true); // GMEP_ENV=local in the tests
      expect((await draft(tk, body)).status).toBe(201);
      cfg.allowTransferOrderSource = false;
      try {
        const r = await draft(tk, body);
        expect(r.status).toBe(422);
        expect(r.json.errors[0].message).toBe('source_invalid');
      } finally {
        cfg.allowTransferOrderSource = true;
      }
    });

    it('I2: shortage list and long-held report (never released automatically)', async () => {
      const part = await newPart('ROW-RPT');
      await demand('ro-rpt', part.id, 3); // nothing on the shelf
      const short = await h.call('GET', '/api/v1/inv/reservations/open?kind=short', { cookie: ql });
      expect(short.status, short.text).toBe(200);
      expect((short.json.items as Row[]).find((r) => r.sourceId === 'ro-rpt')).toMatchObject({
        unmetQty: 3,
        heldQty: 0,
      });
      await postOk(tk, grnPo(part.id, 2, 1000));
      await demand('ro-rpt', part.id, 3);
      const longDefault = await h.call('GET', '/api/v1/inv/reservations/open?kind=long-held', {
        cookie: ql,
      });
      expect((longDefault.json.items as Row[]).some((r) => r.sourceId === 'ro-rpt')).toBe(false); // fresh
      const longNow = await h.call('GET', '/api/v1/inv/reservations/open?kind=long-held&days=0', {
        cookie: ql,
      });
      expect((longNow.json.items as Row[]).some((r) => r.sourceId === 'ro-rpt')).toBe(true);
      expect(
        (await h.call('GET', '/api/v1/inv/reservations/open?kind=short', { cookie: cv })).status,
      ).toBe(403);
      await release('ro-rpt', { reason: 'order-cancelled' });
    });
  });

  describe('I5 cost in whole dong, I7 partial receipt, I4 quantity scale, I12 codes, I14 catalogues, I11', () => {
    it('I5: a return takes the issue value pro rata and no dong is lost; a surplus defaults to the average cost', async () => {
      const part = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'COST-I5',
          name: 'Phụ tùng ví dụ I5',
          unit: 'piece',
          group: 'other',
        })
      ).json as Row;
      await postOk(tk, grnPo(part.id, 10, 100_000));
      await postOk(tk, grnPo(part.id, 20, 120_000));
      const out = await ginOk('ro-i5', part.id, 5);
      const asQl = await h.call('GET', `/api/v1/inv/documents/${out.id}`, { cookie: ql });
      expect(asQl.json.lines[0].valueVnd).toBe(-566_667); // round(3.400.000 x 5 / 30), not 5 x 113.333
      const rtn = (qty: number) => ({
        type: 'RTN',
        source: { type: 'repair-order', id: 'ro-i5' },
        originalDocumentId: out.id,
        lines: [{ partId: part.id, qty, originalLineNo: 1 }],
      });
      const r1 = await postOk(tk, rtn(2));
      const r2 = await postOk(tk, rtn(3));
      const v = async (id: string) =>
        (await h.call('GET', `/api/v1/inv/documents/${id}`, { cookie: ql })).json.lines[0].valueVnd;
      expect(await v(r1.id)).toBe(226_667);
      expect(await v(r2.id)).toBe(340_000);
      expect(await balance(ql, part.id)).toMatchObject({ onHand: 30, valueVnd: 3_400_000 });
      // stocktake surplus without a price: average cost from the stored value
      const adj = await draft(tk, {
        type: 'ADJ',
        source: { type: 'manual-adjustment' },
        reason: 'Kiểm kê thừa 3',
        lines: [{ partId: part.id, qty: 3 }],
      });
      expect(adj.status, adj.text).toBe(201);
      expect((await post(ql, adj.json.id)).status).toBe(200);
      expect(await balance(ql, part.id)).toMatchObject({ onHand: 33, valueVnd: 3_740_000 });
      // an empty balance has no average: the price is required
      const empty = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'COST-I5B',
          name: 'Phụ tùng chưa có tồn',
          unit: 'piece',
          group: 'other',
        })
      ).json as Row;
      const noAvg = await draft(tk, {
        type: 'ADJ',
        source: { type: 'manual-adjustment' },
        reason: 'Kiểm kê thừa 1',
        lines: [{ partId: empty.id, qty: 1 }],
      });
      expect((await post(ql, noAvg.json.id)).status).toBe(422);
      await assertLedgerMatchesBalances();
    });

    it('I4: quantityScale defaults to 1, is accepted from the catalogue list, and locks once the part has stock', async () => {
      const a = await call(tk, 'POST', '/api/v1/inv/parts', {
        code: 'SCALE-1',
        name: 'Dầu bán lẻ theo lít',
        unit: 'litre',
        group: 'oil',
        quantityScale: 1000,
      });
      expect(a.status, a.text).toBe(201);
      expect(a.json.quantityScale).toBe(1000);
      const plain = await call(tk, 'POST', '/api/v1/inv/parts', {
        code: 'SCALE-2',
        name: 'Phụ tùng số nguyên',
        unit: 'piece',
        group: 'other',
      });
      expect(plain.json.quantityScale).toBe(1);
      const bad = await call(tk, 'POST', '/api/v1/inv/parts', {
        code: 'SCALE-3',
        name: 'Tỉ lệ sai',
        unit: 'piece',
        group: 'other',
        quantityScale: 7,
      });
      expect(bad.status).toBe(422);
      const change = await h.call('PATCH', `/api/v1/inv/parts/${plain.json.id}`, {
        cookie: tk,
        body: { quantityScale: 100, version: 1 },
      });
      expect(change.json.quantityScale).toBe(100);
      await postOk(tk, grnPo(plain.json.id, 1, 1000));
      const locked = await h.call('PATCH', `/api/v1/inv/parts/${plain.json.id}`, {
        cookie: tk,
        body: { quantityScale: 1, version: 2 },
      });
      expect(locked.status).toBe(409);
      expect(locked.json.code).toBe('scale_locked');
    });

    it('I12: a manufacturer code may contain "/" but not spaces', async () => {
      const ok = await call(tk, 'POST', '/api/v1/inv/parts', {
        code: ' 90915/yzze1 ',
        name: 'Lọc dầu mã hãng',
        unit: 'piece',
        group: 'filter',
      });
      expect(ok.status, ok.text).toBe(201);
      expect(ok.json.code).toBe('90915/YZZE1');
      const dup = await call(tk, 'POST', '/api/v1/inv/parts', {
        code: '90915-YZZE1',
        name: 'Trùng mã khác dấu',
        unit: 'piece',
        group: 'filter',
      });
      expect(dup.json.code).toBe('part_code_exists');
      const bad = await call(tk, 'POST', '/api/v1/inv/parts', {
        code: '/90915',
        name: 'Bắt đầu bằng gạch chéo',
        unit: 'piece',
        group: 'filter',
      });
      expect(bad.status).toBe(422);
    });

    it('I14: groups and units are company catalogues proposed by the storekeeper and approved by the owner', async () => {
      const body = (group: string) => ({
        code: `CAT-${group}`,
        name: 'Phụ tùng nhóm cấu hình',
        unit: 'piece',
        group,
      });
      const unknown = await call(tk, 'POST', '/api/v1/inv/parts', body('xe-dien'));
      expect(unknown.status).toBe(422);
      expect(unknown.json.errors[0].field).toBe('group');
      const today = new Date().toISOString().slice(0, 10);
      const p = await h.call('POST', '/api/v1/sys/config/part-group', {
        cookie: tk,
        key: key('cfg'),
        body: {
          scopeKey: 'xe-dien',
          effectiveFrom: today,
          payload: { name: 'Xe điện', status: 'active' },
          reason: 'Chuỗi bắt đầu sửa xe điện',
        },
      });
      expect(p.status, p.text).toBe(201);
      expect((await call(tk, 'POST', '/api/v1/inv/parts', body('xe-dien'))).status).toBe(422); // pending: not in force
      const ok = await h.call(
        'POST',
        `/api/v1/sys/config/part-group/${encodeURIComponent(p.json.id)}/decide`,
        { cookie: owner, key: key('dec'), body: { decision: 'approve' } },
      );
      expect(ok.status, ok.text).toBe(200);
      const created = await call(tk, 'POST', '/api/v1/inv/parts', body('xe-dien'));
      expect(created.status, created.text).toBe(201);
      expect(created.json.group).toBe('xe-dien');
      // the storekeeper cannot approve his own proposal
      const self = await h.call('POST', '/api/v1/sys/config/part-unit', {
        cookie: tk,
        key: key('cfg'),
        body: {
          scopeKey: 'tuyp',
          effectiveFrom: today,
          payload: { name: 'Tuýp', status: 'active' },
          reason: 'Thêm đơn vị tuýp',
        },
      });
      expect(self.status, self.text).toBe(201);
      const selfOk = await h.call(
        'POST',
        `/api/v1/sys/config/part-unit/${encodeURIComponent(self.json.id)}/decide`,
        { cookie: tk, key: key('dec'), body: { decision: 'approve' } },
      );
      expect(selfOk.status).toBe(403);
    });

    it('I11: the reorder alert fires when available EQUALS the minimum (<=)', async () => {
      const part = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'LOW-EQ',
          name: 'Phụ tùng thử định mức',
          unit: 'piece',
          group: 'other',
        })
      ).json as Row;
      await postOk(tk, grnPo(part.id, 5, 1000));
      const codes = async () =>
        (
          (await h.call('GET', '/api/v1/inv/stock?lowStock=true&limit=100', { cookie: tk })).json
            .items as Row[]
        ).map((b) => b.partCode);
      await call(tk, 'PUT', '/api/v1/inv/stock/levels', {
        warehouseId: Q7,
        partId: part.id,
        minQty: 4,
        maxQty: null,
      });
      expect(await codes()).not.toContain('LOW-EQ');
      await call(tk, 'PUT', '/api/v1/inv/stock/levels', {
        warehouseId: Q7,
        partId: part.id,
        minQty: 5,
        maxQty: null,
      });
      expect(await codes()).toContain('LOW-EQ');
    });
  });

  describe('concurrency: no oversell, no negative stock, idempotent replays (S1 design)', () => {
    const N = 24;

    it('24 parallel postings of 1 unit against stock 10 succeed exactly 10 times', async () => {
      const part = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'CONC-ISSUE',
          name: 'Phụ tùng thử đồng thời xuất',
          unit: 'piece',
          group: 'other',
        })
      ).json;
      // the 24 orders demand the part while the shelf is empty (unmet, nothing held), then 10 arrive: the
      // 24 issues race for AVAILABLE stock
      for (let i = 0; i < N; i++) await demand(`ro-c${i}`, part.id, 1);
      await postOk(tk, grnPo(part.id, 10, 50_000));
      const drafts = [];
      for (let i = 0; i < N; i++) drafts.push((await draft(tk, gin(`ro-c${i}`, part.id, 1))).json);
      const results = await Promise.all(drafts.map((d) => post(tk, d.id, d.version)));
      const ok = results.filter((r) => r.status === 200);
      const refused = results.filter((r) => r.status === 409);
      expect(ok.length, results.map((r) => r.status).join(',')).toBe(10);
      expect(refused.length).toBe(N - 10);
      expect(refused.every((r) => r.json.code === 'stock_insufficient')).toBe(true);
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 0, reserved: 0, available: 0 });
      // official numbers are distinct and gap-free
      const nos = ok
        .map((r) => Number(String(r.json.number).split('-').at(-1)))
        .sort((a, b) => a - b);
      expect(new Set(nos).size).toBe(10);
      expect(nos.at(-1)! - nos[0]!).toBe(9);
      await assertLedgerMatchesBalances();
    });

    it('24 parallel holds of 1 unit against stock 10 are granted exactly 10 times', async () => {
      const part = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'CONC-HOLD',
          name: 'Phụ tùng thử đồng thời giữ chỗ',
          unit: 'piece',
          group: 'other',
        })
      ).json;
      await postOk(tk, grnPo(part.id, 10, 50_000));
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          call(cv, 'POST', '/api/v1/inv/reservations', {
            sourceType: 'repair-order',
            sourceId: `ro-h${i}x`,
            warehouseId: Q7,
            partId: part.id,
            qty: 1,
          }),
        ),
      );
      expect(
        results.filter((r) => r.status === 200).length,
        results.map((r) => r.status).join(','),
      ).toBe(10);
      expect(
        results.filter((r) => r.status === 409).every((r) => r.json.code === 'stock_insufficient'),
      ).toBe(true);
      expect(await balance(tk, part.id)).toMatchObject({ onHand: 10, reserved: 10, available: 0 });
      await assertLedgerMatchesBalances();
    });

    it('holds racing with issues never leave available negative', async () => {
      const part = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'CONC-MIX',
          name: 'Phụ tùng thử đồng thời hỗn hợp',
          unit: 'piece',
          group: 'other',
        })
      ).json;
      for (let i = 0; i < 8; i++) await demand(`ro-m${i}`, part.id, 1);
      await postOk(tk, grnPo(part.id, 6, 10_000));
      const drafts = [];
      for (let i = 0; i < 8; i++) drafts.push((await draft(tk, gin(`ro-m${i}`, part.id, 1))).json);
      const ops = [
        ...drafts.map((d) => post(tk, d.id, d.version)),
        ...Array.from({ length: 8 }, (_, i) =>
          call(cv, 'POST', '/api/v1/inv/reservations', {
            sourceType: 'repair-order',
            sourceId: `ro-mh${i}`,
            warehouseId: Q7,
            partId: part.id,
            qty: 1,
          }),
        ),
      ];
      const res = await Promise.all(ops);
      expect(
        res.every((r) => [200, 409].includes(r.status)),
        res.map((r) => r.status).join(','),
      ).toBe(true);
      const b = await balance(tk, part.id);
      expect(b.onHand).toBeGreaterThanOrEqual(0);
      expect(b.available).toBeGreaterThanOrEqual(0);
      const issued = res.filter((r) => r.status === 200 && r.json.number).length;
      const held = res.filter((r) => r.status === 200 && r.json.heldQty !== undefined).length;
      expect(issued + held).toBeLessThanOrEqual(6);
      expect(b.onHand).toBe(6 - issued);
      expect(b.reserved).toBe(held);
      await assertLedgerMatchesBalances();
    });

    it('8 parallel requests with the SAME Idempotency-Key apply the posting once', async () => {
      const part = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'CONC-KEY',
          name: 'Phụ tùng thử trùng khóa',
          unit: 'piece',
          group: 'other',
        })
      ).json;
      await postOk(tk, grnPo(part.id, 5, 10_000));
      await demand('ro-key', part.id, 2);
      const d = (await draft(tk, gin('ro-key', part.id, 2))).json;
      const k = key('same');
      const res = await Promise.all(Array.from({ length: 8 }, () => post(tk, d.id, d.version, k)));
      expect(
        res.every((r) => r.status === 200),
        res.map((r) => r.status).join(','),
      ).toBe(true);
      expect(res.filter((r) => r.headers.get('idempotent-replayed') !== 'true').length).toBe(1);
      expect(new Set(res.map((r) => r.json.number)).size).toBe(1);
      expect((await balance(tk, part.id)).onHand).toBe(3);
      await assertLedgerMatchesBalances();
    });

    it('parallel receipts add up exactly and the weighted average stays consistent', async () => {
      const part = (
        await call(tk, 'POST', '/api/v1/inv/parts', {
          code: 'CONC-RECV',
          name: 'Phụ tùng thử đồng thời nhập',
          unit: 'piece',
          group: 'other',
        })
      ).json;
      const drafts = [];
      for (let i = 0; i < 10; i++)
        drafts.push((await draft(tk, grnPo(part.id, 2, 1000 + i * 100))).json);
      const res = await Promise.all(drafts.map((d) => post(tk, d.id, d.version)));
      expect(
        res.every((r) => r.status === 200),
        res.map((r) => r.status).join(','),
      ).toBe(true);
      const expectedValue = Array.from({ length: 10 }, (_, i) => 2 * (1000 + i * 100)).reduce(
        (a, b) => a + b,
        0,
      );
      expect(await balance(ql, part.id)).toMatchObject({ onHand: 20, valueVnd: expectedValue });
      await assertLedgerMatchesBalances();
    });
  });
});

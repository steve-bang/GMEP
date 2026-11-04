import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD } from '@/infrastructure/seed/demo';
import { getDb } from '@/infrastructure/firestore/client';
import { NO_RETENTION } from '@/modules/crm';
import { backends, createHarness, listAll, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const CUSTOMERS = '/api/v1/crm/customers';
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

/**
 * Slice 1.3 CRM: FR-CRM-001, 002, 004, 010, 011, 013, 014, 017; UAT-10, 18, 20; NFR-ISO-01; NFR-SEC-03.
 * Seed (fake): An (Q7+TD, plate 51H12345, zalo consent), Binh (TD only, 29A67890), Biz (Q7, 51D99988).
 */
describe.each(backends)('CRM core [%s]', (backend) => {
  let h: Harness;
  let cv: string; // Q7 advisor cookie
  let qlQ7: string;
  let qlTd: string;
  let owner: string; // CH, working branch Q7
  let ownerAll: string; // CH, consolidated

  async function accessLogs(): Promise<Row[]> {
    const rows =
      backend === 'memory'
        ? [...h.container.memory!.db.col('accessLogs').values()]
        : (await getDb(h.container.env).collection('accessLogs').get()).docs.map((d) => d.data());
    return rows as Row[];
  }
  const mk = (as: string, body: Record<string, unknown>, k = key('cus')) =>
    h.call('POST', CUSTOMERS, { cookie: as, key: k, body });

  beforeAll(async () => {
    h = await createHarness(backend);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    qlQ7 = await h.loginAt('u_ql_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    owner = await h.loginAt('u_owner', 'br_q7');
    ownerAll = await h.loginAt('u_owner', 'all');
  });
  afterAll(() => undefined);

  describe('FR-CRM-001 customers', () => {
    it('creates an individual customer at the working branch; Idempotency-Key replays the same record', async () => {
      const k = key('cus');
      const body = {
        type: 'individual',
        name: 'Lê Thị Test Một',
        phone: '0900000301',
        email: 'm@example.test',
        address: '1 Đường A, Quận 7, TP.HCM',
      };
      const a = await mk(cv, body, k);
      expect(a.status).toBe(201);
      expect(a.json.code).toMatch(/^KH-Q7-\d{5}$/);
      expect(a.json.branchId).toBe('br_q7');
      expect(a.json.phone.value).toBe('0900000301'); // CV sees contact data in full (BA §7.1)
      const b = await mk(cv, body, k);
      expect(b.status).toBe(201);
      expect(b.headers.get('idempotent-replayed')).toBe('true');
      expect(b.json.id).toBe(a.json.id);
      const c = await mk(cv, { ...body, name: 'Khác' }, k);
      expect(c.status).toBe(422); // same key, different content
      expect(c.json.code).toBe('idempotency_key_reuse');
    });

    it('needs an Idempotency-Key and a working branch', async () => {
      const r = await h.call('POST', CUSTOMERS, {
        cookie: cv,
        body: { type: 'individual', name: 'Không khóa' },
      });
      expect(r.status).toBe(400);
      expect(r.json.code).toBe('idempotency_key_required');
      const noBranch = await mk(ownerAll, { type: 'individual', name: 'Chưa chọn chi nhánh' });
      expect(noBranch.status).toBe(409); // consolidated view cannot create documents (SCOPE_MERGED)
    });

    it('validates phone, MST and type-specific rules with field errors (RFC 9457)', async () => {
      const bad = await mk(cv, {
        type: 'business',
        name: 'Công ty X',
        phone: '12345',
        taxCode: '123',
      });
      expect(bad.status).toBe(422);
      expect(bad.json.errors.map((e: { field: string }) => e.field).sort()).toEqual([
        'phone',
        'taxCode',
      ]);
      const ind = await mk(cv, {
        type: 'individual',
        name: 'Cá nhân có MST',
        taxCode: '0312345678',
      });
      expect(ind.status).toBe(422);
      const ok = await mk(cv, {
        type: 'business',
        name: 'Công ty TNHH Hợp Lệ',
        taxCode: '0312345679',
        contactName: 'Anh Kế',
      });
      expect(ok.status).toBe(201);
      expect(ok.json.taxCode).toBe('0312345679');
    });

    it('update uses optimistic locking and refuses a branch that cannot see the customer', async () => {
      const made = await mk(cv, { type: 'individual', name: 'Sửa Được' });
      const id = made.json.id;
      const upd = await h.call('PATCH', `${CUSTOMERS}/${id}`, {
        cookie: cv,
        body: { name: 'Sửa Được Rồi', version: 1 },
      });
      expect(upd.status).toBe(200);
      expect(upd.json.name).toBe('Sửa Được Rồi');
      expect(upd.json.version).toBe(2);
      const stale = await h.call('PATCH', `${CUSTOMERS}/${id}`, {
        cookie: cv,
        body: { name: 'Muộn', version: 1 },
      });
      expect(stale.status).toBe(409);
      expect(stale.json.code).toBe('version_conflict');
      const other = await h.call('PATCH', `${CUSTOMERS}/${id}`, {
        cookie: qlTd,
        body: { name: 'Lén sửa', version: 2 },
      });
      expect(other.status).toBe(404);
    });

    it('writes are refused in a locked branch (FR-SYS-011)', async () => {
      const lk = await h.loginAt('u_owner', 'br_lk');
      const r = await mk(lk, { type: 'individual', name: 'Chi nhánh khóa' });
      expect(r.status).toBe(409);
      expect(r.json.code).toBe('branch_locked');
    });

    it('audit log keeps the change but never the personal values (FR-SYS-003, PDPL)', async () => {
      const made = await mk(cv, {
        type: 'individual',
        name: 'Có Nhật Ký',
        phone: '0900000399',
        address: '9 Phố Bí Mật, Quận 7',
      });
      const audit = await h.call(
        'GET',
        `/api/v1/sys/audit?entityType=customer&entityId=${made.json.id}`,
        { cookie: owner },
      );
      expect(audit.status).toBe(200);
      const row = audit.json.items.find((r: { action: string }) => r.action === 'customer.create');
      expect(row).toBeTruthy();
      expect(audit.text).not.toContain('0900000399');
      expect(audit.text).not.toContain('Phố Bí Mật');
      expect(row.after.phone).toBe('[đã đổi]');
    });
  });

  describe('NFR-ISO-01 branch isolation matrix', () => {
    const names = (items: { name: string }[]) => items.map((i) => i.name);
    it('Q7 advisor sees An and the business, not Binh; Thu Duc manager sees An and Binh', async () => {
      const q7 = names((await listAll(h, 'u_cv_q7', {}, 25, CUSTOMERS)).items);
      expect(q7).toContain('Nguyễn Văn An');
      expect(q7).toContain('Công ty TNHH Vận tải Demo');
      expect(q7).not.toContain('Trần Thị Bình');
      const td = names((await listAll(h, 'u_ql_td', {}, 25, CUSTOMERS)).items);
      expect(td).toContain('Trần Thị Bình');
      expect(td).toContain('Nguyễn Văn An');
      expect(td).not.toContain('Công ty TNHH Vận tải Demo');
    });

    it('GET of an out-of-scope customer, vehicle, request or consent list answers exactly like a missing one', async () => {
      const missing = await h.call('GET', `${CUSTOMERS}/cus_nope`, { cookie: cv });
      expect(missing.status).toBe(404);
      for (const path of [
        `${CUSTOMERS}/cus_binh`,
        `${CUSTOMERS}/cus_binh/consents`,
        `${CUSTOMERS}/cus_binh/vehicles`,
        '/api/v1/crm/vehicles/veh_binh',
        '/api/v1/crm/vehicles/veh_binh/owner',
      ]) {
        const r = await h.call('GET', path, { cookie: cv });
        expect(r.status, path).toBe(404);
        expect({ ...r.json, traceId: 'x' }).toEqual({ ...missing.json, traceId: 'x' });
      }
    });

    it('search never leaks: phone prefix, plate prefix and name (diacritics-insensitive) stay inside the scope', async () => {
      const phoneQ7 = await listAll(h, 'u_cv_q7', { q: '0900000222' }, 25, CUSTOMERS);
      expect(phoneQ7.items).toEqual([]);
      const phoneTd = await listAll(h, 'u_ql_td', { q: '0900000222' }, 25, CUSTOMERS);
      expect(names(phoneTd.items)).toEqual(['Trần Thị Bình']);
      const plateTd = await listAll(h, 'u_ql_td', { q: '29a-678' }, 25, CUSTOMERS);
      expect(names(plateTd.items)).toEqual(['Trần Thị Bình']);
      expect((await listAll(h, 'u_cv_q7', { q: '29a678' }, 25, CUSTOMERS)).items).toEqual([]);
      for (const q of ['tran thi', 'TRẦN THỊ BÌNH', 'trần']) {
        expect(names((await listAll(h, 'u_ql_td', { q }, 25, CUSTOMERS)).items)).toEqual([
          'Trần Thị Bình',
        ]);
        expect((await listAll(h, 'u_cv_q7', { q }, 25, CUSTOMERS)).items).toEqual([]);
      }
      expect(
        names((await listAll(h, 'u_cv_q7', { q: 'nguyen van an' }, 25, CUSTOMERS)).items),
      ).toEqual(['Nguyễn Văn An']);
    });

    it('a consolidating role spanning two branches lists every customer once across pages (no duplicates)', async () => {
      for (let i = 1; i <= 12; i++) {
        await mk(cv, {
          type: 'individual',
          name: `Khách Phân Trang ${String(i).padStart(2, '0')}`,
        });
        await mk(qlTd, {
          type: 'individual',
          name: `Khách Phân Trang TD ${String(i).padStart(2, '0')}`,
        });
      }
      await h.login('u_qv'); // QV: Q7 + TD, may consolidate
      const { items, pages } = await listAll(h, 'u_qv', {}, 5, CUSTOMERS);
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(pages).toBeGreaterThan(3);
      expect(names(items)).toContain('Trần Thị Bình');
      expect(names(items)).toContain('Công ty TNHH Vận tải Demo');
      expect(ids.filter((i) => i === 'cus_an').length).toBe(1); // linked to both branches, listed once
      await h.loginAt('u_owner', 'all');
      const all = await listAll(h, 'u_owner', {}, 7, CUSTOMERS);
      expect(new Set(all.items.map((i) => i.id)).size).toBe(all.items.length);
      expect(all.items.length).toBeGreaterThanOrEqual(items.length);
    });

    it('roles without customer rights are refused (AD, TH, TK) and TN/QD are read only', async () => {
      for (const u of ['u_ad', 'u_th_q7', 'u_tk_q7'])
        expect((await h.call('GET', CUSTOMERS, { as: u })).status, u).toBe(403);
      const tn = await h.loginAt('u_tn_q7', 'br_q7');
      expect((await h.call('GET', CUSTOMERS, { cookie: tn })).status).toBe(200);
      expect((await mk(tn, { type: 'individual', name: 'Thu ngân tạo' })).status).toBe(403);
      const qd = await h.loginAt('u_qd_q7', 'br_q7');
      expect((await mk(qd, { type: 'individual', name: 'Quản đốc tạo' })).status).toBe(403);
    });
  });

  describe('NFR-SEC-03 masking, "Hiện" and access log', () => {
    it('the owner sees masked contact data and the full value is nowhere in the response', async () => {
      const r = await h.call('GET', `${CUSTOMERS}/cus_an`, { cookie: ownerAll });
      expect(r.status).toBe(200);
      expect(r.json.phone).toMatchObject({ masked: true, reveal: 'plain' });
      expect(r.json.phone.value).not.toContain('0900000211');
      expect(r.text).not.toContain('0900000211');
      expect(r.text).not.toContain('Nguyễn Văn Linh');
      const list = await h.call('GET', CUSTOMERS, { cookie: ownerAll });
      expect(list.text).not.toContain('0900000211');
    });

    it('reveal returns the value, is logged without it; KT needs a reason; CV cannot reveal; denials are logged', async () => {
      const ok = await h.call('POST', '/api/v1/sys/pii/reveal', {
        cookie: ownerAll,
        key: key('rev'),
        body: { entityType: 'customer', entityId: 'cus_an', field: 'phone' },
      });
      expect(ok.status).toBe(200);
      expect(ok.json.value).toBe('0900000211');
      const kt = await h.login('u_kt');
      const noReason = await h.call('POST', '/api/v1/sys/pii/reveal', {
        cookie: kt,
        body: { entityType: 'customer', entityId: 'cus_an', field: 'phone' },
      });
      expect(noReason.status).toBe(422);
      const withReason = await h.call('POST', '/api/v1/sys/pii/reveal', {
        cookie: kt,
        body: {
          entityType: 'customer',
          entityId: 'cus_an',
          field: 'phone',
          reasonCode: 'invoice_check',
          reasonText: 'Đối chiếu hóa đơn 123',
        },
      });
      expect(withReason.status).toBe(200);
      const cvDenied = await h.call('POST', '/api/v1/sys/pii/reveal', {
        cookie: cv,
        body: { entityType: 'customer', entityId: 'cus_an', field: 'phone' },
      });
      expect(cvDenied.status).toBe(403); // CV already sees it in full: there is no Hiện button
      const outOfScope = await h.call('POST', '/api/v1/sys/pii/reveal', {
        cookie: qlTd,
        body: { entityType: 'customer', entityId: 'cus_biz', field: 'phone' },
      });
      expect(outOfScope.status).toBe(403); // QL sees phone in full: no reveal either way
      const logs = await accessLogs();
      const mine = logs.filter((l) => l.entityType === 'customer' && l.entityId === 'cus_an');
      expect(mine.some((l) => l.purpose === 'reveal' && l.result === 'allowed')).toBe(true);
      expect(mine.some((l) => l.purpose === 'denied')).toBe(true);
      expect(JSON.stringify(logs)).not.toContain('0900000211');
    });

    it('opening a record as a role that sees personal data in full writes one open_record entry', async () => {
      const before = (await accessLogs()).filter(
        (l) => l.purpose === 'open_record' && l.entityId === 'cus_biz',
      ).length;
      expect((await h.call('GET', `${CUSTOMERS}/cus_biz`, { cookie: cv })).status).toBe(200);
      const after = (await accessLogs()).filter(
        (l) => l.purpose === 'open_record' && l.entityId === 'cus_biz',
      ).length;
      expect(after).toBe(before + 1);
      const row = (await accessLogs()).find(
        (l) => l.purpose === 'open_record' && l.entityId === 'cus_biz',
      )!;
      expect(row.actorId).toBe('u_cv_q7');
      expect(row.fields).toContain('phone');
    });

    it('a system admin gets no customer data at all', async () => {
      expect((await h.call('GET', `${CUSTOMERS}/cus_an`, { as: 'u_ad' })).status).toBe(403);
      const rev = await h.call('POST', '/api/v1/sys/pii/reveal', {
        as: 'u_ad',
        body: { entityType: 'customer', entityId: 'cus_an', field: 'phone' },
      });
      expect(rev.status).toBe(403);
    });
  });

  describe('FR-CRM-002 / 014 vehicles and ownership (UAT-18)', () => {
    const VEH = '/api/v1/crm/vehicles';
    const vehicle = (customerId: string, plate: string, extra: Record<string, unknown> = {}) => ({
      customerId,
      plate,
      make: 'Kia',
      model: 'Morning',
      year: 2018,
      ...extra,
    });

    it('creates a vehicle with its first ownership; the plate is stored normalised and unique company-wide', async () => {
      const made = await h.call('POST', VEH, {
        cookie: cv,
        key: key('veh'),
        body: vehicle('cus_an', '30e-111.22', {
          vin: 'jtdbr32e720123456',
          isCommercial: true,
          lastKm: 1000,
        }),
      });
      expect(made.status).toBe(201);
      expect(made.json.plate).toBe('30E-111.22');
      expect(made.json.vin).toBe('JTDBR32E720123456');
      expect(made.json.owner.id).toBe('cus_an');
      const owners = await h.call('GET', `${VEH}/${made.json.id}/owner`, { cookie: cv });
      expect(owners.json.items).toHaveLength(1);
      expect(owners.json.items[0]).toMatchObject({ customerId: 'cus_an', to: null, current: true });
      // another typing of the same plate, even from another branch that cannot see the vehicle's owner
      for (const [who, plate] of [
        [cv, '30E11122'],
        [qlTd, '30e 111 22'],
        [qlTd, '51H-123.45'],
      ] as const) {
        const dup = await h.call('POST', VEH, {
          cookie: who,
          key: key('veh'),
          body: vehicle(who === qlTd ? 'cus_binh' : 'cus_an', plate),
        });
        expect(dup.status, plate).toBe(409);
        expect(dup.json.code).toBe('plate_exists');
        expect(dup.text).not.toContain('br_q7');
        expect(dup.text).not.toContain('Nguyễn');
      }
    });

    it('concurrent creation of the same plate yields exactly one vehicle', async () => {
      const results = await Promise.all(
        [1, 2, 3].map((i) =>
          h.call('POST', VEH, {
            cookie: cv,
            key: key(`race${i}`),
            body: vehicle('cus_an', '77Z-555.55'),
          }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    });

    it('validates plate, VIN, year and a customer the branch cannot see', async () => {
      const bad = await h.call('POST', VEH, {
        cookie: cv,
        key: key('veh'),
        body: vehicle('cus_an', 'AB-12', { vin: 'BAD', year: 2100 }),
      });
      expect(bad.status).toBe(422);
      expect(bad.json.errors.map((e: { field: string }) => e.field).sort()).toEqual([
        'plate',
        'vin',
        'year',
      ]);
      const hidden = await h.call('POST', VEH, {
        cookie: cv,
        key: key('veh'),
        body: vehicle('cus_binh', '88B-888.88'),
      });
      expect(hidden.status).toBe(404);
    });

    it('owner change closes the open record the day before and keeps the whole history (UAT-18)', async () => {
      const made = await h.call('POST', VEH, {
        cookie: cv,
        key: key('veh'),
        body: vehicle('cus_an', '61C-222.33', { ownedFrom: '2024-02-01' }),
      });
      const id = made.json.id;
      const k = key('own');
      const change = await h.call('POST', `${VEH}/${id}/owner`, {
        cookie: cv,
        key: k,
        body: {
          newCustomerId: 'cus_biz',
          effectiveDate: '2026-03-01',
          note: 'Bán xe',
          version: made.json.version,
        },
      });
      expect(change.status).toBe(200);
      expect(change.json.owner.id).toBe('cus_biz');
      const replay = await h.call('POST', `${VEH}/${id}/owner`, {
        cookie: cv,
        key: k,
        body: {
          newCustomerId: 'cus_biz',
          effectiveDate: '2026-03-01',
          note: 'Bán xe',
          version: made.json.version,
        },
      });
      expect(replay.headers.get('idempotent-replayed')).toBe('true');
      const hist = (await h.call('GET', `${VEH}/${id}/owner`, { cookie: cv })).json.items;
      expect(hist).toHaveLength(2);
      expect(hist[0]).toMatchObject({
        customerId: 'cus_biz',
        from: '2026-03-01',
        to: null,
        current: true,
      });
      expect(hist[1]).toMatchObject({
        customerId: 'cus_an',
        from: '2024-02-01',
        to: '2026-02-28',
        current: false,
      });
      // the previous owner no longer lists the vehicle; the new owner does; counters follow
      const anVeh = (
        await h.call('GET', `${CUSTOMERS}/cus_an/vehicles`, { cookie: cv })
      ).json.items.map((v: { id: string }) => v.id);
      expect(anVeh).not.toContain(id);
      const bizVeh = (
        await h.call('GET', `${CUSTOMERS}/cus_biz/vehicles`, { cookie: cv })
      ).json.items.map((v: { id: string }) => v.id);
      expect(bizVeh).toContain(id);
      expect((await h.call('GET', `${CUSTOMERS}/cus_biz`, { cookie: cv })).json.vehicleCount).toBe(
        bizVeh.length,
      );
      // rules
      const same = await h.call('POST', `${VEH}/${id}/owner`, {
        cookie: cv,
        key: key('own'),
        body: {
          newCustomerId: 'cus_biz',
          effectiveDate: '2026-04-01',
          version: change.json.version,
        },
      });
      expect(same.json.code).toBe('owner_same_owner');
      const early = await h.call('POST', `${VEH}/${id}/owner`, {
        cookie: cv,
        key: key('own'),
        body: {
          newCustomerId: 'cus_an',
          effectiveDate: '2026-03-01',
          version: change.json.version,
        },
      });
      expect(early.json.code).toBe('owner_before_current_start');
      const future = await h.call('POST', `${VEH}/${id}/owner`, {
        cookie: cv,
        key: key('own'),
        body: {
          newCustomerId: 'cus_an',
          effectiveDate: '2999-01-01',
          version: change.json.version,
        },
      });
      expect(future.status).toBe(422);
      const stale = await h.call('POST', `${VEH}/${id}/owner`, {
        cookie: cv,
        key: key('own'),
        body: { newCustomerId: 'cus_an', effectiveDate: '2026-05-01', version: made.json.version },
      });
      expect(stale.status).toBe(409);
      const invisible = await h.call('POST', `${VEH}/${id}/owner`, {
        cookie: cv,
        key: key('own'),
        body: {
          newCustomerId: 'cus_binh',
          effectiveDate: '2026-05-01',
          version: change.json.version,
        },
      });
      expect(invisible.status).toBe(404);
    });

    it('plate change keeps the old plate in the vehicle record and frees it', async () => {
      const made = await h.call('POST', VEH, {
        cookie: cv,
        key: key('veh'),
        body: vehicle('cus_biz', '43D-123.00'),
      });
      const id = made.json.id;
      const r = await h.call('POST', `${VEH}/${id}/plate`, {
        cookie: cv,
        body: {
          plate: '43D-321.00',
          reason: 'Đổi biển số theo thủ tục',
          version: made.json.version,
        },
      });
      expect(r.status).toBe(200);
      expect(r.json.plate).toBe('43D-321.00');
      expect(r.json.previousPlates[0].plate).toBe('43D-123.00');
      const reuse = await h.call('POST', VEH, {
        cookie: cv,
        key: key('veh'),
        body: vehicle('cus_an', '43d12300'),
      });
      expect(reuse.status).toBe(201); // the freed plate can be registered again
      const taken = await h.call('POST', `${VEH}/${id}/plate`, {
        cookie: cv,
        body: { plate: '43D 123 00', reason: 'Thử lại biển cũ', version: r.json.version },
      });
      expect(taken.json.code).toBe('plate_exists');
      const search = await listAll(h, 'u_cv_q7', { q: '43d-321' }, 25, VEH);
      expect(search.items.map((v) => v.id)).toEqual([id]);
    });

    it('vehicle list is scoped and searchable by plate; out of scope plates never appear', async () => {
      const q7 = (await listAll(h, 'u_cv_q7', {}, 5, VEH)).items.map((v) => v.plate);
      expect(q7).toContain('51H-123.45');
      expect(q7).toContain('51D-999.88');
      expect(q7).not.toContain('29A-678.90');
      expect((await listAll(h, 'u_cv_q7', { q: '29a' }, 25, VEH)).items).toEqual([]);
      expect(
        (await listAll(h, 'u_ql_td', { q: '29a 678' }, 25, VEH)).items.map((v) => v.plate),
      ).toEqual(['29A-678.90']);
    });
  });

  describe('FR-CRM-004 cross-branch history projection', () => {
    const hist = (as: string, id = 'veh_an') =>
      h.call('GET', `/api/v1/crm/vehicles/${id}/history`, { cookie: as });

    it('a vehicle repaired at Q7 and Thu Duc shows both visits at either branch, white-listed fields only', async () => {
      for (const who of [cv, qlTd]) {
        const r = await hist(who);
        expect(r.status).toBe(200);
        expect(r.json.items.map((i: { branchName: string }) => i.branchName)).toEqual([
          'Chi nhánh Quận 7',
          'Chi nhánh Thủ Đức',
        ]);
        expect(Object.keys(r.json.items[0]).sort()).toEqual([
          'branchName',
          'date',
          'id',
          'items',
          'km',
          'orderCode',
          'parts',
          'totalVnd',
        ]);
        expect(r.json.items[0].totalVnd).toBe(2150000);
      }
    });

    it('prices can be switched off by configuration [Cần xác nhận: Chủ dự án]', async () => {
      h.container.crm.crm.historyShowPrice = false;
      try {
        expect(
          (await hist(cv)).json.items.every(
            (i: { totalVnd: number | null }) => i.totalVnd === null,
          ),
        ).toBe(true);
      } finally {
        h.container.crm.crm.historyShowPrice = true;
      }
    });

    it('C20 QV (and KT) read the history inside their scope only; CH, CV, QL and QD may also read a vehicle outside it', async () => {
      const now = new Date();
      const lk = {
        id: 'veh_lk_c20',
        companyId: 'cmp_demo',
        branchId: 'br_lk',
        plate: '77Z99999',
        plateNorm: '77Z99999',
        previousPlates: [],
        make: 'Ford',
        model: 'Ranger',
        year: 2020,
        isCommercial: false,
        currentOwnerId: null,
        branchIds: ['br_lk'],
        createdAt: now,
        createdBy: 'seed',
        updatedAt: now,
        updatedBy: 'seed',
        version: 1,
      };
      await h.container.crm.sys.uow.run(async (tx) => {
        h.container.crm.vehicles.create(tx, lk);
        h.container.crm.vehicles.link(tx, lk, 'br_lk', now);
      });
      const qv = await h.loginAt('u_qv', 'br_q7');
      const qd = await h.login('u_qd_q7');
      // QV is assigned to Q7 and Thu Duc only: the vehicle of the locked branch is out of scope
      expect((await hist(qv, 'veh_lk_c20')).status).toBe(404);
      for (const who of [cv, qd, ownerAll])
        expect((await hist(who, 'veh_lk_c20')).status).toBe(200);
    });

    it('needs vehicle-history:view; roles without it (TH, TK, AD) are refused', async () => {
      for (const u of ['u_th_q7', 'u_tk_q7', 'u_ad'])
        expect(
          (await h.call('GET', '/api/v1/crm/vehicles/veh_an/history', { as: u })).status,
          u,
        ).toBe(403);
    });

    it('the projection store keeps only the white-listed fields even if a producer passes more', async () => {
      await h.container.crm.sys.uow.run(async (tx) => {
        h.container.crm.history.upsert(tx, {
          id: 'ro:leak',
          companyId: 'cmp_demo',
          vehicleId: 'veh_biz',
          branchId: 'br_q7',
          branchName: 'Chi nhánh Quận 7',
          orderCode: 'RO-X',
          date: '2026-09-09',
          items: ['Kiểm tra'],
          parts: [],
          projectedAt: new Date(),
          // @ts-expect-error not part of the projection type: must never be persisted
          mechanic: 'Thợ A',
          paid: 1,
          internalNote: 'bí mật',
          customerPhone: '0900000233',
        });
      });
      const r = await hist(cv, 'veh_biz');
      expect(r.status).toBe(200);
      expect(r.text).not.toContain('Thợ A');
      expect(r.text).not.toContain('bí mật');
      expect(r.text).not.toContain('0900000233');
    });
  });

  describe('cross-branch exact lookup (BA §10 P1/P2)', () => {
    const lookup = (as: string, body: Record<string, unknown>) =>
      h.call('POST', '/api/v1/crm/lookup', { cookie: as, body });

    it('finds a Thu Duc vehicle by exact plate from Q7 with a white-listed projection and no contact data', async () => {
      expect((await h.call('GET', `${CUSTOMERS}/cus_binh`, { cookie: cv })).status).toBe(404);
      const r = await lookup(cv, { plate: '29a-678.90' });
      expect(r.status).toBe(200);
      const v = r.json.vehicles[0];
      expect(v).toMatchObject({ plate: '29A-678.90', make: 'Mazda', related: false });
      expect(v.owner).toMatchObject({
        name: 'Trần Thị Bình',
        branches: ['Chi nhánh Thủ Đức'],
        related: false,
      });
      expect(r.text).not.toContain('0900000222');
      expect(r.text).not.toContain('Võ Văn Ngân');
      expect(r.text).not.toMatch(/"(phone|email|address)"/);
      expect((await lookup(cv, { plate: '29A-678' })).json.vehicles).toEqual([]); // exact only, never a prefix
    });

    it('phone lookup needs the full number, is exact, and every phone search is logged without the number', async () => {
      const before = (await accessLogs()).filter((l) => l.purpose === 'search_by_phone').length;
      const r = await lookup(cv, { phone: '+84 900 000 222' });
      expect(r.status).toBe(200);
      expect(r.json.customers.map((c: { name: string }) => c.name)).toEqual(['Trần Thị Bình']);
      expect((await lookup(cv, { phone: '090000022' })).status).toBe(422);
      expect((await lookup(cv, { phone: '0900000999' })).json.customers).toEqual([]);
      const logs = (await accessLogs()).filter((l) => l.purpose === 'search_by_phone');
      expect(logs.length).toBe(before + 2);
      expect(JSON.stringify(logs)).not.toContain('900000222');
    });

    it('needs customer-lookup:view and exactly one criterion; TH, TK, AD are refused', async () => {
      for (const u of ['u_th_q7', 'u_tk_q7', 'u_ad'])
        expect(
          (await h.call('POST', '/api/v1/crm/lookup', { as: u, body: { plate: '51H12345' } }))
            .status,
        ).toBe(403);
      expect((await lookup(cv, { plate: '51H12345', phone: '0900000211' })).status).toBe(422);
      expect((await lookup(cv, {})).status).toBe(422);
    });

    it('relating the customer to the working branch makes the full record visible there (and only there)', async () => {
      const r = await h.call('POST', `${CUSTOMERS}/cus_binh/relate`, {
        cookie: cv,
        key: key('rel'),
        body: {},
      });
      expect(r.status).toBe(200);
      expect(r.json.changed).toBe(true);
      const again = await h.call('POST', `${CUSTOMERS}/cus_binh/relate`, {
        cookie: cv,
        key: key('rel'),
        body: {},
      });
      expect(again.json.changed).toBe(false);
      expect((await h.call('GET', `${CUSTOMERS}/cus_binh`, { cookie: cv })).status).toBe(200);
      expect((await h.call('GET', '/api/v1/crm/vehicles/veh_binh', { cookie: cv })).status).toBe(
        200,
      );
      expect(names(await listAll(h, 'u_cv_q7', {}, 25, CUSTOMERS))).toContain('Trần Thị Bình');
      const q7Only = await h.loginAt('u_ql_q7', 'br_q7');
      expect((await h.call('GET', `${CUSTOMERS}/cus_binh`, { cookie: q7Only })).status).toBe(200);
    });
    const names = (r: { items: { name: string }[] }) => r.items.map((i) => i.name);
  });

  describe('FR-CRM-010 / 013 consent (UAT-10)', () => {
    it('records a basis, derives advertising channels, keeps the history when withdrawn', async () => {
      const made = await mk(cv, { type: 'individual', name: 'Đồng Ý Thử' });
      const id = made.json.id;
      const rec = (body: Record<string, unknown>, k = key('con')) =>
        h.call('POST', `${CUSTOMERS}/${id}/consents`, {
          cookie: cv,
          key: k,
          body: { evidenceKind: 'paper-slip', ...body },
        });
      expect((await rec({ purpose: 'marketing', channel: 'zalo', basis: 'contract' })).status).toBe(
        422,
      ); // advertising needs consent
      const granted = await rec({
        purpose: 'marketing',
        channel: 'zalo',
        basis: 'consent',
        evidence: 'Phiếu giấy 01',
      });
      expect(granted.status).toBe(201);
      expect(granted.json.policyVersion).toBeTruthy();
      expect(
        (await rec({ purpose: 'marketing', channel: 'zalo', basis: 'consent' })).json.code,
      ).toBe('consent_exists');
      expect(
        (await rec({ purpose: 'service', channel: 'in_person', basis: 'contract' })).status,
      ).toBe(201);
      expect((await h.call('GET', `${CUSTOMERS}/${id}`, { cookie: cv })).json.marketing).toEqual([
        'zalo',
      ]);
      const w = await h.call('POST', `/api/v1/crm/consents/${granted.json.id}/withdraw`, {
        cookie: cv,
        body: { reason: 'Khách gọi điện', version: 1 },
      });
      expect(w.status).toBe(200);
      expect(w.json.status).toBe('withdrawn');
      expect(
        (
          await h.call('POST', `/api/v1/crm/consents/${granted.json.id}/withdraw`, {
            cookie: cv,
            body: { version: 2 },
          })
        ).json.code,
      ).toBe('consent_withdrawn');
      expect((await h.call('GET', `${CUSTOMERS}/${id}`, { cookie: cv })).json.marketing).toEqual(
        [],
      );
      const list = (await h.call('GET', `${CUSTOMERS}/${id}/consents`, { cookie: cv })).json.items;
      expect(list).toHaveLength(2); // withdrawn record stays visible
      expect(list.find((c: { id: string }) => c.id === granted.json.id)).toMatchObject({
        status: 'withdrawn',
        withdrawnAt: expect.any(String),
      });
    });

    it('campaign helper excludes customers without consent and reports how many (FR-CRM-013)', async () => {
      const aud = (body: unknown, as = ownerAll) =>
        h.call('POST', '/api/v1/crm/marketing/audience', { cookie: as, body });
      const before = await aud({
        channel: 'zalo',
        customerIds: ['cus_an', 'cus_biz', 'cus_binh', 'cus_nope'],
      });
      expect(before.status).toBe(200);
      expect(before.json.eligible).toEqual(['cus_an']);
      expect(before.json.excludedCount).toBe(3);
      expect(before.json.excluded.map((e: { reason: string }) => e.reason).sort()).toEqual([
        'no_consent',
        'no_consent',
        'not_found',
      ]);
      expect((await aud({ channel: 'sms', customerIds: ['cus_an'] })).json.eligible).toEqual([]);
      // a customer outside the actor's scope counts as excluded and is never revealed
      expect(
        (await aud({ channel: 'zalo', customerIds: ['cus_an', 'cus_binh'] }, qlQ7)).json.eligible,
      ).toContain('cus_an');
      // withdrawing stops the campaign at once
      const withdraw = await h.call('POST', '/api/v1/crm/consents/con_cus_an/withdraw', {
        cookie: cv,
        body: { version: 1 },
      });
      expect(withdraw.status).toBe(200);
      expect((await aud({ channel: 'zalo', customerIds: ['cus_an'] })).json).toMatchObject({
        eligible: [],
        excludedCount: 1,
      });
    });

    it('consent of a customer in another branch is invisible and cannot be withdrawn', async () => {
      const r = await h.call('POST', '/api/v1/crm/consents/con_cus_an/withdraw', {
        cookie: await h.loginAt('u_ql_td', 'br_td'),
        body: { version: 99 },
      });
      expect(r.status).not.toBe(200);
      const hidden = await h.call('GET', `${CUSTOMERS}/cus_biz/consents`, { cookie: qlTd });
      expect(hidden.status).toBe(404);
    });
  });

  describe('FR-CRM-011 data-subject requests (UAT-10)', () => {
    const REQ = '/api/v1/crm/data-requests';
    const newDelete = async () => {
      const phone = `09000${Math.floor(10000 + Math.random() * 89999)}`;
      const c = await mk(cv, {
        type: 'individual',
        name: 'Xóa Dữ Liệu',
        phone,
        email: 'x@example.test',
      });
      await h.call('POST', `${CUSTOMERS}/${c.json.id}/consents`, {
        cookie: cv,
        key: key('con'),
        body: {
          purpose: 'marketing',
          channel: 'sms',
          basis: 'consent',
          evidenceKind: 'web-tick',
        },
      });
      const v = await h.call('POST', '/api/v1/crm/vehicles', {
        cookie: cv,
        key: key('veh'),
        body: {
          customerId: c.json.id,
          plate: `70K-${Math.floor(10000 + Math.random() * 89999)}`,
          make: 'Honda',
          model: 'City',
          year: 2019,
        },
      });
      const r = await h.call('POST', REQ, {
        cookie: cv,
        key: key('dsr'),
        body: {
          customerId: c.json.id,
          type: 'delete',
          receivedVia: 'in_person',
          note: 'Khách yêu cầu xóa',
        },
      });
      return { customer: c.json, vehicle: v.json, request: r, phone };
    };

    it('registers a request with a code, a deadline (72 h default) and no assignee', async () => {
      const { request } = await newDelete();
      expect(request.status).toBe(201);
      expect(request.json.code).toMatch(/^CD-Q7-\d{4}-\d{5}$/);
      expect(request.json.status).toBe('received');
      expect(request.json.assigneeId).toBeNull();
      expect(
        new Date(request.json.internalDueAt).getTime() -
          new Date(request.json.receivedAt).getTime(),
      ).toBe(72 * 3_600_000);
    });

    it('walks the state machine: assign -> complete; deletion needs the owner and the retention check', async () => {
      const { customer, vehicle, request, phone } = await newDelete();
      const id = request.json.id;
      // received cannot jump to completed
      const jump = await h.call('POST', `${REQ}/${id}/close`, {
        cookie: qlQ7,
        body: { outcome: 'completed', resultNote: 'Đã xử lý xong', version: 1 },
      });
      expect(jump.status).toBe(409);
      expect(jump.json.code).toBe('request_transition_invalid');
      // advisor cannot assign (no update right), manager can
      expect(
        (
          await h.call('POST', `${REQ}/${id}/assign`, {
            cookie: cv,
            body: { assigneeId: 'u_ql_q7', version: 1 },
          })
        ).status,
      ).toBe(403);
      const assigned = await h.call('POST', `${REQ}/${id}/assign`, {
        cookie: qlQ7,
        body: { assigneeId: 'u_ql_q7', version: 1 },
      });
      expect(assigned.status).toBe(200);
      expect(assigned.json).toMatchObject({
        status: 'in_progress',
        assigneeId: 'u_ql_q7',
        version: 2,
      });
      expect(
        (
          await h.call('POST', `${REQ}/${id}/assign`, {
            cookie: qlQ7,
            body: { assigneeId: 'u_ql_td', version: 2 },
          })
        ).status,
      ).toBe(422); // assignee outside the branch scope
      // a branch manager cannot execute a deletion
      const body = {
        outcome: 'completed',
        resultNote: 'Đã ẩn danh dữ liệu theo yêu cầu',
        version: 2,
      };
      expect((await h.call('POST', `${REQ}/${id}/close`, { cookie: qlQ7, body })).status).toBe(403);
      // retention blockers (open order, debt, warranty) hold the deletion back
      const real = h.container.crm.retention;
      h.container.crm.retention = {
        check: async () => ({
          verified: true,
          blockers: ['Còn lệnh sửa chữa đang mở'],
          retained: [],
        }),
      };
      try {
        const blocked = await h.call('POST', `${REQ}/${id}/close`, { cookie: owner, body });
        expect(blocked.status).toBe(409);
        expect(blocked.json.code).toBe('request_blocked');
        expect(
          (await h.call('GET', `${CUSTOMERS}/${customer.id}`, { cookie: owner })).json.status,
        ).toBe('active');
        // C4 (fail closed): the temporary port cannot verify anything, so the deletion must not run
        h.container.crm.retention = real;
        const unverified = await h.call('POST', `${REQ}/${id}/close`, { cookie: owner, body });
        expect(unverified.status).toBe(409);
        expect(unverified.json.code).toBe('retention_unverified');
        expect(
          (await h.call('GET', `${CUSTOMERS}/${customer.id}`, { cookie: owner })).json.status,
        ).toBe('active');
        expect((await h.call('GET', `${REQ}/${id}`, { cookie: owner })).json.status).toBe(
          'in_progress',
        );
      } finally {
        h.container.crm.retention = real;
      }
      expect(NO_RETENTION.blockers).toEqual([]);
      // a gate that verified "nothing blocks" lets the deletion complete
      h.container.crm.retention = { check: async () => NO_RETENTION };
      const done = await h.call('POST', `${REQ}/${id}/close`, { cookie: owner, body });
      h.container.crm.retention = real;
      expect(done.status).toBe(200);
      expect(done.json).toMatchObject({ status: 'completed', anonymizedAt: expect.any(String) });
      // customer anonymised: contact data gone, business record and ownership kept
      const after = await h.call('GET', `${CUSTOMERS}/${customer.id}`, { cookie: owner });
      expect(after.json).toMatchObject({
        status: 'anonymized',
        name: 'Khách đã ẩn danh',
        marketing: [],
        vehicleCount: 1,
      });
      expect(after.json.phone.value).toBeUndefined();
      expect(after.text).not.toContain(phone);
      expect(
        (await h.call('GET', `/api/v1/crm/vehicles/${vehicle.id}/owner`, { cookie: owner })).json
          .items,
      ).toHaveLength(1);
      expect((await listAll(h, 'u_ql_q7', { q: phone }, 25, CUSTOMERS)).items).toEqual([]); // phone search no longer finds it
      expect(
        (
          await h.call('POST', `${CUSTOMERS}/${customer.id}/consents`, {
            cookie: cv,
            key: key('con'),
            body: { purpose: 'service', channel: 'in_person', basis: 'contract' },
          })
        ).json.code,
      ).toBe('customer_anonymized');
      expect(
        (
          await h.call('PATCH', `${CUSTOMERS}/${customer.id}`, {
            cookie: cv,
            body: { name: 'Sửa lại', version: after.json.version },
          })
        ).json.code,
      ).toBe('customer_anonymized');
      // closed requests are final
      expect(
        (
          await h.call('POST', `${REQ}/${id}/close`, {
            cookie: owner,
            body: { ...body, version: 3 },
          })
        ).json.code,
      ).toBe('request_transition_invalid');
      // audit: anonymisation recorded, no personal value
      const audit = await h.call(
        'GET',
        `/api/v1/sys/audit?entityType=customer&entityId=${customer.id}`,
        { cookie: owner },
      );
      expect(
        audit.json.items.some((r: { action: string }) => r.action === 'customer.anonymize'),
      ).toBe(true);
      expect(audit.text).not.toContain(phone);
    });

    it('a view/correct request closes without touching the customer; overdue is reported', async () => {
      const c = await mk(cv, { type: 'individual', name: 'Yêu Cầu Xem' });
      // the deadline is configuration: a zero-hour deadline makes the request due at once
      const cfg = h.container.crm.crm;
      const was = cfg.requestInternalTargetHours;
      cfg.requestInternalTargetHours = { view: 0, correct: 0, delete: 0 };
      const r = await h.call('POST', REQ, {
        cookie: cv,
        key: key('dsr'),
        body: { customerId: c.json.id, type: 'view', receivedVia: 'phone' },
      });
      cfg.requestInternalTargetHours = was;
      const id = r.json.id;
      await h.call('POST', `${REQ}/${id}/assign`, {
        cookie: qlQ7,
        body: { assigneeId: 'u_cv_q7', version: 1 },
      });
      h.clock.set(new Date(Date.now() + 60_000).toISOString());
      try {
        expect((await h.call('GET', `${REQ}/${id}`, { cookie: qlQ7 })).json.overdue).toBe(true);
        const closed = await h.call('POST', `${REQ}/${id}/close`, {
          cookie: qlQ7,
          body: {
            outcome: 'completed',
            resultNote: 'Đã gửi bản sao dữ liệu cho khách',
            version: 2,
          },
        });
        expect(closed.status).toBe(200);
        expect(closed.json.overdue).toBe(false);
        expect((await h.call('GET', `${CUSTOMERS}/${c.json.id}`, { cookie: cv })).json.status).toBe(
          'active',
        );
      } finally {
        h.clock.set(new Date().toISOString());
      }
    });

    it('requests are branch scoped: Thu Duc cannot see or list Q7 requests', async () => {
      const { request } = await newDelete();
      expect((await h.call('GET', `${REQ}/${request.json.id}`, { cookie: qlTd })).status).toBe(404);
      const list = await listAll(h, 'u_ql_td', {}, 25, REQ);
      expect(list.items.some((x) => x.id === request.json.id)).toBe(false);
      const mine = await listAll(h, 'u_ql_q7', { status: 'received' }, 25, REQ);
      expect(mine.items.some((x) => x.id === request.json.id)).toBe(true);
    });
  });

  describe('FR-CRM-017 / UAT-20 export', () => {
    const exp = (as: string, body: Record<string, unknown> = {}) =>
      h.call('POST', `${CUSTOMERS}/export`, { cookie: as, body });
    const rowsOf = (text: string) => text.replace(/^﻿/, '').trim().split('\r\n');

    it('no export permission, no file: CV, TN, QD, TH, TK, AD are refused', async () => {
      for (const u of ['u_cv_q7', 'u_tn_q7', 'u_qd_q7', 'u_th_q7', 'u_tk_q7', 'u_ad']) {
        const r = await h.call('POST', `${CUSTOMERS}/export`, { as: u, body: {} });
        expect(r.status, u).toBe(403);
        expect(r.text).not.toContain('Nguyễn Văn An');
      }
    });

    it('a manager exports only the branch scope, with the personal columns the role may see', async () => {
      const r = await exp(qlQ7);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toContain('text/csv');
      expect(r.text).toContain('Nguyễn Văn An');
      expect(r.text).not.toContain('Phân Trang TD');
      expect(rowsOf(r.text)[0]).toContain('phone');
    });

    it('accountant gets masked contact data; admin-like hidden columns disappear', async () => {
      const kt = await h.login('u_kt');
      const r = await exp(kt);
      expect(r.status).toBe(200);
      expect(r.text).toContain('Trần Thị Bình');
      expect(r.text).not.toContain('0900000222');
      expect(r.text).toContain('09•• ••• 222');
      expect(r.text).not.toContain('Võ Văn Ngân');
    });

    it('full personal columns need customer-pii:export, a reason and the password again; all of it is logged', async () => {
      const noReason = await exp(ownerAll, { includePii: true, reauthPassword: DEMO_PASSWORD });
      expect(noReason.status).toBe(422);
      const noPw = await exp(ownerAll, { includePii: true, reason: 'Gửi báo cáo cho kế toán' });
      expect(noPw.status).toBe(403);
      expect(noPw.json.code).toBe('reauth_required');
      const wrong = await exp(ownerAll, {
        includePii: true,
        reason: 'Gửi báo cáo cho kế toán',
        reauthPassword: 'sai-mat-khau',
      });
      expect(wrong.status).toBe(403);
      const ql = await exp(qlQ7, {
        includePii: true,
        reason: 'Tôi muốn xem hết',
        reauthPassword: DEMO_PASSWORD,
      });
      expect(ql.status).toBe(403); // QL has no customer-pii:export
      const ok = await exp(ownerAll, {
        includePii: true,
        reason: 'Gửi báo cáo cho kế toán',
        reauthPassword: DEMO_PASSWORD,
      });
      expect(ok.status).toBe(200);
      expect(ok.text).toContain('0900000222');
      const logs = (await accessLogs()).filter((l) => l.purpose === 'export');
      expect(logs.length).toBeGreaterThan(0);
      expect(JSON.stringify(logs)).not.toContain('0900000222');
      expect(logs.some((l) => l.rowCount > 3 && l.columns.includes('phone'))).toBe(true);
      const audit = await h.call('GET', '/api/v1/sys/audit?entityType=customerExport', {
        cookie: ownerAll,
      });
      expect(
        audit.json.items.some(
          (r: { action: string; reason: string }) =>
            r.action === 'customer.export' && r.reason === 'Gửi báo cáo cho kế toán',
        ),
      ).toBe(true);
      expect(audit.text).not.toContain('0900000222');
    });

    it('is capped (default 5,000 rows; 1,000 with personal columns) and spreadsheet formulas are neutralised', async () => {
      await mk(cv, { type: 'individual', name: '=HYPERLINK("http://evil.test","x")' });
      const r = await exp(qlQ7);
      expect(r.text).toContain(`"'=HYPERLINK(`);
      expect(r.text).not.toContain('"=HYPERLINK');
      const crm = h.container.crm.crm;
      const saved = crm.exportMaxRows;
      crm.exportMaxRows = 2;
      try {
        const big = await exp(qlQ7);
        expect(big.status).toBe(422);
        expect(big.json.code).toBe('export_too_large');
      } finally {
        crm.exportMaxRows = saved;
      }
      expect(crm.exportMaxRows).toBe(5000);
      expect(crm.exportMaxRowsWithPii).toBe(1000);
    });
  });
  describe('BA answers C1-C15 (ba-answers-for-dev §15)', () => {
    const VEH = '/api/v1/crm/vehicles';
    const REQ = '/api/v1/crm/data-requests';
    let plateSeq = 0;
    const plate = () => `30A${String(10000 + ++plateSeq)}`;
    async function docs(collection: string): Promise<Row[]> {
      return (
        backend === 'memory'
          ? [...h.container.memory!.db.col(collection).values()]
          : (await getDb(h.container.env).collection(collection).get()).docs.map((d) => ({
              ...d.data(),
              id: d.id,
            }))
      ) as Row[];
    }
    const newVehicle = async (customerId: string, extra: Record<string, unknown> = {}) =>
      h.call('POST', VEH, {
        cookie: cv,
        key: key('veh'),
        body: { customerId, plate: plate(), make: 'Kia', model: 'Morning', year: 2020, ...extra },
      });

    it('C3 internal target and legal deadline are separate parameters; the legal one stays blank until set (FR-CRM-011)', async () => {
      const c = await mk(cv, { type: 'individual', name: 'Hạn Pháp Lý' });
      const mkReq = (type: string) =>
        h.call('POST', REQ, {
          cookie: cv,
          key: key('dsr'),
          body: { customerId: c.json.id, type, receivedVia: 'phone' },
        });
      const blank = await mkReq('view');
      expect(blank.json.legalDueAt).toBeNull();
      expect(blank.json.legallyOverdue).toBe(false);
      const cfg = h.container.crm.crm;
      const saved = { i: cfg.requestInternalTargetHours, l: cfg.requestLegalDeadlineHours };
      cfg.requestInternalTargetHours = { view: 72, correct: 24, delete: 72 };
      cfg.requestLegalDeadlineHours = { delete: 720 };
      try {
        const correct = await mkReq('correct');
        const del = await mkReq('delete');
        const ms = (r: Row, f: string) =>
          new Date(r.json[f]).getTime() - new Date(r.json.receivedAt).getTime();
        expect(ms(correct, 'internalDueAt')).toBe(24 * 3_600_000);
        expect(correct.json.legalDueAt).toBeNull(); // no legal value for this type: no conclusion
        expect(ms(del, 'legalDueAt')).toBe(720 * 3_600_000);
        expect(ms(del, 'internalDueAt')).toBe(72 * 3_600_000);
      } finally {
        cfg.requestInternalTargetHours = saved.i;
        cfg.requestLegalDeadlineHours = saved.l;
      }
    });

    it('C23 evidence is picked from the catalogue; a reference is screened; "other" needs a note', async () => {
      const c = await mk(cv, { type: 'individual', name: 'Bằng Chứng Danh Mục' });
      const post = (body: Record<string, unknown>) =>
        h.call('POST', `${CUSTOMERS}/${c.json.id}/consents`, { cookie: cv, key: key('con'), body });
      const base = { purpose: 'service', channel: 'in_person', basis: 'contract' };
      const none = await post(base);
      expect(none.status).toBe(422);
      expect(none.json.errors[0].field).toBe('evidenceKind');
      const unknown = await post({ ...base, evidenceKind: 'made-up' });
      expect(unknown.status).toBe(422);
      expect(unknown.json.errors[0].field).toBe('evidenceKind');
      const noNote = await post({ ...base, evidenceKind: 'other' });
      expect(noNote.status).toBe(422);
      expect(noNote.json.errors[0].field).toBe('evidence');
      const badRef = await post({ ...base, evidenceKind: 'paper-slip', evidenceRef: '0912345678' });
      expect(badRef.status).toBe(422);
      expect(badRef.json.errors[0].field).toBe('evidenceRef');
      const ok = await post({
        ...base,
        evidenceKind: 'paper-slip',
        evidenceRef: 'PG-0042',
        evidence: 'Ký tại quầy',
      });
      expect(ok.status).toBe(201);
      expect(ok.json).toMatchObject({ evidenceKind: 'paper-slip', evidenceRef: 'PG-0042' });
      const stored = (await docs('consents')).filter((d) => d.customerId === c.json.id);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ evidenceKind: 'paper-slip', evidenceRef: 'PG-0042' });
    });

    it('C4 consent records keep no phone or email, and reasons/evidence are screened', async () => {
      const c = await mk(cv, { type: 'individual', name: 'Bằng Chứng Sạch', phone: '0911222333' });
      const post = (body: Record<string, unknown>) =>
        h.call('POST', `${CUSTOMERS}/${c.json.id}/consents`, {
          cookie: cv,
          key: key('con'),
          body: { evidenceKind: 'paper-slip', ...body },
        });
      for (const evidence of [
        'gọi 0912 345 678 xác nhận',
        'khach@example.com đồng ý',
        '+84 912-345-678',
      ]) {
        const r = await post({
          purpose: 'service',
          channel: 'in_person',
          basis: 'contract',
          evidence,
        });
        expect(r.status, evidence).toBe(422);
        expect(r.json.errors[0].field).toBe('evidence');
      }
      const ok = await post({
        purpose: 'service',
        channel: 'in_person',
        basis: 'contract',
        evidence: 'Phiếu giấy số 123 tại quầy',
      });
      expect(ok.status).toBe(201);
      const w = await h.call('POST', `/api/v1/crm/consents/${ok.json.id}/withdraw`, {
        cookie: cv,
        body: { reason: 'liên hệ 0912345678', version: ok.json.version },
      });
      expect(w.status).toBe(422);
      const stored = (await docs('consents')).filter((d) => d.customerId === c.json.id);
      expect(JSON.stringify(stored)).not.toMatch(/0911222333|0912|@example/);
    });

    it('C10 legitimate interest is not usable (any purpose) until the lawyer confirms; advertising needs consent', async () => {
      const c = await mk(cv, { type: 'individual', name: 'Căn Cứ Thử' });
      for (const purpose of ['service', 'marketing']) {
        const r = await h.call('POST', `${CUSTOMERS}/${c.json.id}/consents`, {
          cookie: cv,
          key: key('con'),
          body: { purpose, channel: 'sms', basis: 'legitimate_interest' },
        });
        expect(r.status, purpose).toBe(422);
        expect(r.json.errors[0].field).toBe('basis');
      }
      expect(h.container.crm.crm.consentBasesEnabled).not.toContain('legitimate_interest');
    });

    it('C5 a lower odometer reading needs a reason and is audited; nothing is hard-blocked', async () => {
      const c = await mk(cv, { type: 'individual', name: 'Số Km Thử' });
      const v = await newVehicle(c.json.id, { lastKm: 50000 });
      expect(v.status).toBe(201);
      const patch = (body: Record<string, unknown>, version = 1) =>
        h.call('PATCH', `${VEH}/${v.json.id}`, { cookie: cv, body: { version, ...body } });
      expect((await patch({ lastKm: 40000 })).status).toBe(422); // no reason
      const other = await patch({ lastKm: 40000, lastKmReason: 'other', lastKmNote: 'ngắn' });
      expect(other.status).toBe(422);
      expect(other.json.errors[0].field).toBe('lastKmNote');
      const typo = await patch({ lastKm: 49000, lastKmReason: 'typo' });
      expect(typo.status).toBe(200);
      expect(typo.json.lastKm).toBe(49000);
      const up = await patch({ lastKm: 52000 }, 2); // raising never needs a reason
      expect(up.status).toBe(200);
      const swapped = await patch({ lastKm: 10, lastKmReason: 'odometer_replaced' }, 3);
      expect(swapped.status).toBe(200);
      const audit = await h.call(
        'GET',
        `/api/v1/sys/audit?entityType=vehicle&entityId=${v.json.id}`,
        {
          cookie: owner,
        },
      );
      const reasons = audit.json.items.map((r: { reason?: string }) => r.reason ?? '');
      expect(reasons.some((r: string) => r.includes('50000 -> 49000') && r.includes('typo'))).toBe(
        true,
      );
      expect(reasons.some((r: string) => r.includes('odometer_replaced'))).toBe(true);
      // C18/R9: a drop above the ONE shared threshold (1.000 km) tells the branch manager; smaller drops
      // and a replaced odometer did not
      const notices = async () =>
        (await docs('notifications')).filter(
          (n) => n.kind === 'crm.odometer_abnormal' && n.userId === 'u_ql_q7',
        );
      expect(await notices()).toHaveLength(0);
      expect((await patch({ lastKm: 30000 }, 4)).status).toBe(200);
      const abnormal = await patch({ lastKm: 27000, lastKmReason: 'typo' }, 5);
      expect(abnormal.status).toBe(200);
      const got = await notices();
      expect(got).toHaveLength(1);
      expect(got[0]!.params).toEqual({ plate: v.json.plate, from: '30000', to: '27000' });
      expect(JSON.stringify(got)).not.toMatch(/Số Km Thử|09\d{8}/); // no personal data
      expect(h.container.crm.crm.abnormalKmDrop).toBe(1000);
    });

    it('C11 the plate is normalised and the VIN is unique company-wide without naming a branch', async () => {
      const c = await mk(cv, { type: 'individual', name: 'Số Khung Thử' });
      const VIN = '1HGCM82633A004352';
      const a = await newVehicle(c.json.id, { vin: VIN.toLowerCase() });
      expect(a.status).toBe(201);
      expect(a.json.vin).toBe(VIN);
      const dup = await newVehicle(c.json.id, { vin: VIN });
      expect(dup.status).toBe(409);
      expect(dup.json.code).toBe('vin_exists');
      expect(dup.text).not.toMatch(/Quận 7|Thủ Đức|br_/);
      // C22: inside the actor's scope the answer points at the vehicle that already has the VIN
      expect(dup.json.existingVehicleId).toBe(a.json.id);
      const b = await newVehicle(c.json.id);
      expect(b.status).toBe(201);
      const clash = await h.call('PATCH', `${VEH}/${b.json.id}`, {
        cookie: cv,
        body: { vin: VIN, version: 1 },
      });
      expect(clash.status).toBe(409);
      expect(clash.json.code).toBe('vin_exists');
      expect(clash.json.existingVehicleId).toBe(a.json.id);
      // C22: a VIN held by a vehicle OUTSIDE the scope never names it or its branch; a role with the
      // lookup right gets only the P2 fields and continues through the exact plate lookup
      const td = await mk(qlTd, { type: 'individual', name: 'Khách Thủ Đức Khung' });
      const far = await h.call('POST', VEH, {
        cookie: qlTd,
        key: key('veh'),
        body: {
          customerId: td.json.id,
          plate: plate(),
          make: 'Honda',
          model: 'City',
          year: 2021,
          vin: '3HGCM82633A004354',
        },
      });
      expect(far.status).toBe(201);
      const outside = await newVehicle(c.json.id, { vin: '3HGCM82633A004354' });
      expect(outside.status).toBe(409);
      expect(outside.json.code).toBe('vin_exists');
      expect(outside.json.existingVehicleId).toBeUndefined();
      expect(outside.json).toMatchObject({
        outOfScope: true,
        projection: { make: 'Honda', model: 'City', year: 2021 },
      });
      expect(outside.text).not.toContain(far.json.id);
      expect(outside.text).not.toMatch(/Thủ Đức|br_td/);
      // moving the VIN frees the old slot
      const move = await h.call('PATCH', `${VEH}/${a.json.id}`, {
        cookie: cv,
        body: { vin: '2HGCM82633A004353', version: 1 },
      });
      expect(move.status).toBe(200);
      expect(
        (
          await h.call('PATCH', `${VEH}/${b.json.id}`, {
            cookie: cv,
            body: { vin: VIN, version: 1 },
          })
        ).status,
      ).toBe(200);
      // plate spelling variants collapse to one normalised plate
      const p = String(b.json.plate).replace(/[^0-9A-Z]/g, '');
      const spaced = `${p.slice(0, 3)}-${p.slice(3, 6)}.${p.slice(6)}`.toLowerCase();
      expect((await newVehicle(c.json.id, { plate: spaced })).json.code).toBe('plate_exists');
    });

    it('C9 QD looks up by plate only and sees vehicle fields; TN sees customers but no history; 30 lookups per hour', async () => {
      const qd = await h.login('u_qd_q7');
      const tn = await h.login('u_tn_q7');
      const lookup = (as: string, body: Record<string, unknown>) =>
        h.call('POST', '/api/v1/crm/lookup', { cookie: as, body });
      const denied = (await accessLogs()).filter((l) => l.result === 'denied').length;
      const byPhone = await lookup(qd, { phone: '0900000222' });
      expect(byPhone.status).toBe(403);
      expect((await accessLogs()).filter((l) => l.result === 'denied').length).toBe(denied + 1);
      const byPlate = await lookup(qd, { plate: '29A-678.90' });
      expect(byPlate.status).toBe(200);
      expect(byPlate.json.vehicles[0]).toMatchObject({
        plate: '29A-678.90',
        make: 'Mazda',
        owner: null,
      });
      expect(byPlate.text).not.toContain('Trần Thị Bình');
      // TN: customer + vehicles, but the repair history and prices are not theirs (P3)
      const tnPlate = await lookup(tn, { plate: '29A-678.90' });
      expect(tnPlate.json.vehicles[0].owner).toMatchObject({ name: 'Trần Thị Bình' });
      expect((await lookup(tn, { phone: '0900000222' })).json.customers).toHaveLength(1);
      expect((await h.call('GET', `${VEH}/veh_binh/history`, { cookie: tn })).status).toBe(403);
      // rate limit: 30 per person per hour, then refused and logged as denied
      let last = 0;
      for (let i = 0; i < 30; i++) last = (await lookup(tn, { plate: '29A-678.90' })).status;
      expect(last).toBe(429);
      expect(
        (await accessLogs()).filter((l) => l.result === 'denied').length,
      ).toBeGreaterThanOrEqual(denied + 2);
    });

    it('C21 QV may look a vehicle up by plate (vehicle fields) but not find a customer by phone', async () => {
      const qv = await h.login('u_qv');
      const lookup = (body: Record<string, unknown>) =>
        h.call('POST', '/api/v1/crm/lookup', { cookie: qv, body });
      expect((await lookup({ phone: '0900000222' })).status).toBe(403);
      const byPlate = await lookup({ plate: '29A-678.90' });
      expect(byPlate.status).toBe(200);
      expect(byPlate.json.vehicles[0].owner).toBeNull();
    });

    it('C19 the owners are told once a day when a person exceeds the lookup limit; the notice carries no customer data', async () => {
      const person = await h.loginAt('u_multi', 'br_q7'); // a person no other test has used for lookups
      const lookup = () =>
        h.call('POST', '/api/v1/crm/lookup', { cookie: person, body: { plate: '29A-678.90' } });
      const before = (await docs('notifications')).filter((n) => n.kind === 'crm.lookup_limit');
      let status = 0;
      for (let i = 0; i < 40 && status !== 429; i++) status = (await lookup()).status;
      expect(status).toBe(429);
      for (let i = 0; i < 3; i++) expect((await lookup()).status).toBe(429);
      const notes = (await docs('notifications')).filter((n) => n.kind === 'crm.lookup_limit');
      const mine = notes.slice(before.length);
      expect(mine.map((n) => n.userId)).toEqual(['u_owner']); // every CH, one notice each, not one per refusal
      expect(JSON.stringify(mine)).not.toMatch(/29A|67890|Bình|09\d{8}/);
    });

    it('C2 adoption is for CV/QL only, records its source and who, and is access-logged; the business-event flag blocks it', async () => {
      const c = await mk(cv, { type: 'individual', name: 'Dùng Hồ Sơ A' });
      const d = await mk(cv, { type: 'individual', name: 'Dùng Hồ Sơ B' });
      const relate = (as: string, id: string) =>
        h.call('POST', `${CUSTOMERS}/${id}/relate`, { cookie: as, key: key('rel'), body: {} });
      const tn = await h.login('u_tn_q7');
      const qd = await h.login('u_qd_q7');
      expect((await relate(tn, c.json.id)).status).toBe(403);
      expect((await relate(qd, c.json.id)).status).toBe(403);
      const cfg = h.container.crm.crm;
      cfg.adoptRequiresBusinessEvent = true;
      try {
        const blocked = await relate(qlTd, c.json.id);
        expect(blocked.status).toBe(409);
        expect(blocked.json.code).toBe('relation_needs_business_event');
        expect((await h.call('GET', `${CUSTOMERS}/${c.json.id}`, { cookie: qlTd })).status).toBe(
          404,
        );
      } finally {
        cfg.adoptRequiresBusinessEvent = false;
      }
      const before = (await accessLogs()).filter((l) => l.purpose === 'open_record').length;
      expect((await relate(qlTd, c.json.id)).json.changed).toBe(true);
      const link = (await docs('customerLinks')).find(
        (l) => l.customerId === c.json.id && l.branchId === 'br_td',
      );
      expect(link).toMatchObject({ source: 'lookup_adopt', createdBy: 'u_ql_td' });
      const own = (await docs('customerLinks')).find(
        (l) => l.customerId === c.json.id && l.branchId === 'br_q7',
      );
      expect(own).toMatchObject({ source: 'created' });
      const logs = (await accessLogs()).filter((l) => l.purpose === 'open_record');
      expect(logs.length).toBeGreaterThan(before);
      expect(JSON.stringify(logs)).not.toContain('Dùng Hồ Sơ');
      // a different record was not related by that call
      expect((await h.call('GET', `${CUSTOMERS}/${d.json.id}`, { cookie: qlTd })).status).toBe(404);
    });

    it('C12 phone search starts at 4 digits and tells when the 50 bound cut the list', async () => {
      for (let i = 1; i <= 51; i++)
        await mk(qlQ7, {
          type: 'individual',
          name: `Hàng Loạt ${i}`,
          phone: `09330${String(i).padStart(5, '0')}`,
        });
      const get = (q: string) =>
        h.call('GET', `${CUSTOMERS}?q=${encodeURIComponent(q)}&limit=100`, { cookie: qlQ7 });
      const wide = await get('0933');
      expect(wide.json.items).toHaveLength(50);
      expect(wide.json.capped).toBe(true);
      const narrow = await get('093300001');
      expect(narrow.json.capped).toBe(false);
      expect(narrow.json.items.length).toBeGreaterThan(0);
      const short = await get('093'); // 3 digits: not a phone search, nothing is browsed
      expect(short.json.items).toEqual([]);
      expect((await get('0900000211')).json.capped).toBe(false);
      // an export built on a cut search is refused instead of silently truncated
      const exp = await h.call('POST', `${CUSTOMERS}/export`, {
        cookie: qlQ7,
        body: { q: '0933' },
      });
      expect(exp.status).toBe(422);
      expect(exp.json.code).toBe('export_too_large');
    });

    it('C7/C14 only CH and KT may export full personal columns; QL and QV are refused even with reason and password', async () => {
      const qv = await h.login('u_qv');
      for (const as of [qlQ7, qv]) {
        const r = await h.call('POST', `${CUSTOMERS}/export`, {
          cookie: as,
          body: {
            includePii: true,
            reason: 'Gửi báo cáo cho kế toán',
            reauthPassword: DEMO_PASSWORD,
          },
        });
        expect(r.status).toBe(403);
        expect(r.text).not.toContain('0900000211');
      }
      const kt = await h.login('u_kt');
      const ok = await h.call('POST', `${CUSTOMERS}/export`, {
        cookie: kt,
        body: { includePii: true, reason: 'Đối chiếu hóa đơn', reauthPassword: DEMO_PASSWORD },
      });
      expect(ok.status).toBe(200);
    });
  });
});

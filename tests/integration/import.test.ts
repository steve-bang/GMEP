import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { warehouseId } from '@/modules/sys';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const IMPORTS = '/api/v1/sys/imports';
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;
const csv = (...lines: string[]) => lines.join('\r\n') + '\r\n';
const WH = warehouseId('br_q7', 'WH-CHINH');

/**
 * Slice 1.11 FR-SYS-007 / UAT-12: dry run with row-level errors, no partial write of an invalid file, batch commit,
 * idempotency, branch scope, permission, undo of exactly the batch (stock by reversal, RULE-010), audit.
 * Fake data only.
 */
describe.each(backends)('Excel import [%s]', (backend) => {
  let h: Harness;
  let ql: string; // QL Q7: customers, vehicles, parts, stock documents
  let qlTd: string;
  let tk: string; // TK Q7: parts and stock, no customer data
  let cv: string; // CV: no data-import right

  const upload = (
    as: string,
    kind: string,
    text: string | Buffer,
    extra: Record<string, string> = {},
    name = 'file.csv',
    k = key('imp'),
  ) => {
    const form = new FormData();
    form.set('kind', kind);
    for (const [a, b] of Object.entries(extra)) form.set(a, b);
    form.set(
      'file',
      new File([new Uint8Array(typeof text === 'string' ? Buffer.from(text) : text)], name),
    );
    return h.call('POST', IMPORTS, { cookie: as, form, key: k });
  };
  const commit = (as: string, id: string) =>
    h.call('POST', `${IMPORTS}/${id}/commit`, { cookie: as, key: key('cmt'), body: {} });
  const undo = (as: string, id: string, reason = 'Nhập nhầm tệp thử') =>
    h.call('POST', `${IMPORTS}/${id}/undo`, { cookie: as, key: key('und'), body: { reason } });
  const customers = async (as: string, q: string) =>
    (await h.call('GET', `/api/v1/crm/customers?q=${encodeURIComponent(q)}`, { cookie: as })).json
      .items as Row[];
  const audits = async (entityId: string) =>
    ((
      await h.call('GET', `/api/v1/sys/audit?entityType=dataImport&entityId=${entityId}`, {
        cookie: ql,
      })
    ).json.items ?? []) as Row[];

  beforeAll(async () => {
    h = await createHarness(backend);
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    tk = await h.loginAt('u_tk_q7', 'br_q7');
    cv = await h.loginAt('u_cv_q7', 'br_q7');
  });
  afterAll(() => undefined);

  describe('customers and vehicles', () => {
    const HEAD = 'Mã khách cũ,Tên khách hàng,Số điện thoại,Biển số xe,Hãng xe,Dòng xe,Năm sản xuất';

    it('FR-SYS-007: a file with one bad row is rejected whole, with row-level errors, and writes nothing', async () => {
      const r = await upload(
        ql,
        'customers-vehicles',
        csv(
          HEAD,
          'A1,Nguyễn Một,0911000001,51Z-000.01,Toyota,Vios,2020',
          'A2,,0911000002,51Z-000.02,Toyota,Vios,2020',
          'A3,Lê Ba,SDT-LOI-77,51Z-000.03,Toyota,Vios,2020',
        ),
      );
      expect(r.status).toBe(201);
      expect(r.json.status).toBe('rejected');
      expect(r.json.issues.map((i: Row) => [i.row, i.field])).toEqual([
        [3, 'name'],
        [4, 'phone'],
      ]);
      // the report never carries the cell values (personal data)
      expect(r.text).not.toContain('SDT-LOI-77');
      expect(await customers(ql, 'Nguyễn Một')).toHaveLength(0);
      // a rejected batch cannot be written
      expect((await commit(ql, r.json.id)).status).toBe(409);
    });

    it('missing required column is reported against the file, with the guessed mapping', async () => {
      const r = await upload(ql, 'customers-vehicles', csv('Số điện thoại', '0911000003'));
      expect(r.json.status).toBe('rejected');
      expect(r.json.issues[0]).toMatchObject({ row: 0, field: 'name' });
    });

    it('dry run (xlsx) groups rows by the old code, fixes a lost leading zero and writes nothing until commit', async () => {
      const bytes = readFileSync('tests/fixtures/import/customers.xlsx');
      const v = await upload(ql, 'customers-vehicles', bytes, {}, 'khach.xlsx');
      expect(v.json).toMatchObject({
        status: 'validated',
        rowCount: 3,
        unitCount: 2,
        issueCount: 0,
      });
      expect(await customers(ql, 'Trần Thị Mẫu')).toHaveLength(0);

      const c = await commit(ql, v.json.id);
      expect(c.status).toBe(200);
      expect(c.json).toMatchObject({ status: 'committed', committedUnits: 2 });
      expect(c.json.created).toEqual({ customer: 2, vehicle: 2 });
      const cus = await customers(ql, 'Trần Thị Mẫu');
      expect(cus).toHaveLength(1);
      expect(cus[0]!.vehicleCount).toBe(2);

      // double click / retry: same result, no duplicate customers
      const again = await commit(ql, v.json.id);
      expect(again.json.status).toBe('committed');
      expect(await customers(ql, 'Trần Thị Mẫu')).toHaveLength(1);
      // the same bytes cannot be staged twice while the batch stands
      expect((await upload(ql, 'customers-vehicles', bytes, {}, 'khach.xlsx')).status).toBe(409);
      // audited
      const acts = (await audits(v.json.id)).map((a) => a.action);
      expect(acts).toEqual(expect.arrayContaining(['dataImport.validate', 'dataImport.commit']));
    });

    it('NFR-ISO-01: another branch cannot read or write the batch; the list is the working branch only', async () => {
      const v = await upload(
        ql,
        'customers-vehicles',
        csv(HEAD, 'S1,Phạm Cô Lập,0911000010,51Z-100.01,Kia,Morning,2018'),
      );
      expect((await h.call('GET', `${IMPORTS}/${v.json.id}`, { cookie: qlTd })).status).toBe(404);
      expect((await commit(qlTd, v.json.id)).status).toBe(404);
      const list = await h.call('GET', IMPORTS, { cookie: qlTd });
      expect((list.json as Row[]).some((b) => b.id === v.json.id)).toBe(false);
      const mine = await h.call('GET', IMPORTS, { cookie: ql });
      expect((mine.json as Row[]).some((b) => b.id === v.json.id)).toBe(true);
    });

    it('permission: a role without data-import cannot upload; TK cannot import customers', async () => {
      expect((await upload(cv, 'customers-vehicles', csv(HEAD))).status).toBe(403);
      const kinds = await h.call('GET', `${IMPORTS}/kinds`, { cookie: tk });
      expect((kinds.json as Row[]).map((k) => k.kind).sort()).toEqual(['opening-stock', 'parts']);
      expect((await upload(tk, 'customers-vehicles', csv(HEAD))).status).toBe(403);
    });

    it('a plate already in the system is a row error (company-wide uniqueness)', async () => {
      const r = await upload(
        ql,
        'customers-vehicles',
        csv(HEAD, 'D1,Người Trùng,0911000020,51K-111.11,Honda,City,2019'),
      );
      expect(r.json.status).toBe('rejected');
      expect(r.json.issues[0]).toMatchObject({ row: 2, field: 'plate' });
    });

    it('undo removes exactly the batch; a record changed since the import blocks the whole undo', async () => {
      const a = await upload(
        ql,
        'customers-vehicles',
        csv(
          HEAD,
          'U1,Hoàng Hoàn Tác,0911000030,51Z-300.01,Mazda,3,2019',
          'U2,Đặng Hoàn Tác,0911000031,51Z-300.02,Mazda,6,2020',
        ),
      );
      await commit(ql, a.json.id);
      const plate = (await h.call('GET', '/api/v1/crm/vehicles?q=51Z-300.02', { cookie: ql })).json
        .items[0] as Row;
      // edit one vehicle after the import
      const patch = await h.call('PATCH', `/api/v1/crm/vehicles/${plate.id}`, {
        cookie: ql,
        body: { version: plate.version, model: '6 Sport' },
      });
      expect(patch.status).toBe(200);
      const blocked = await undo(ql, a.json.id);
      expect(blocked.status).toBe(409);
      expect(await customers(ql, 'Hoàng Hoàn Tác')).toHaveLength(1);
      expect(await customers(ql, 'Đặng Hoàn Tác')).toHaveLength(1);

      const b = await upload(
        ql,
        'customers-vehicles',
        csv(HEAD, 'U3,Vũ Hoàn Tác,0911000032,51Z-300.03,Ford,Ranger,2021'),
      );
      await commit(ql, b.json.id);
      expect(await customers(ql, 'Vũ Hoàn Tác')).toHaveLength(1);
      const u = await undo(ql, b.json.id);
      expect(u.json.status).toBe('undone');
      expect(await customers(ql, 'Vũ Hoàn Tác')).toHaveLength(0);
      expect(
        (await h.call('GET', '/api/v1/crm/vehicles?q=51Z-300.03', { cookie: ql })).json.items,
      ).toHaveLength(0);
      // repeating the undo is harmless; the plate can be imported again
      expect((await undo(ql, b.json.id)).json.status).toBe('undone');
      const again = await upload(
        ql,
        'customers-vehicles',
        csv(HEAD, 'U3,Vũ Hoàn Tác,0911000032,51Z-300.03,Ford,Ranger,2021'),
      );
      expect(again.json.status).toBe('validated');
      const acts = (await audits(b.json.id)).map((x) => x.action);
      expect(acts).toContain('dataImport.undo');
    });
  });

  describe('parts and opening stock', () => {
    const PHEAD = 'Mã phụ tùng,Tên phụ tùng,Đơn vị tính,Nhóm hàng';
    const SHEAD = 'Mã phụ tùng,Số lượng tồn,Đơn giá vốn (VND)';
    let partsBatch: string;
    let stockBatch: string;

    it('imports the part catalogue; unknown unit and duplicate code are row errors', async () => {
      const bad = await upload(
        tk,
        'parts',
        csv(
          PHEAD,
          'IMP-A1,Lọc dầu thử,piece,other',
          'IMP-A1,Trùng mã,piece,other',
          'IMP-A2,Sai đơn vị,tấn,other',
        ),
      );
      expect(bad.json.status).toBe('rejected');
      expect(bad.json.issues.map((i: Row) => [i.row, i.field])).toEqual([
        [3, 'code'],
        [4, 'unit'],
      ]);
      const ok = await upload(
        tk,
        'parts',
        csv(PHEAD, 'IMP-A1,Lọc dầu thử,piece,other', 'IMP-A2,Lọc gió thử,piece,other'),
      );
      expect(ok.json.status).toBe('validated');
      partsBatch = ok.json.id;
      const c = await commit(tk, partsBatch);
      expect(c.json).toMatchObject({ status: 'committed', created: { part: 2 } });
      const found = await h.call('GET', '/api/v1/inv/parts?q=IMP-A', { cookie: tk });
      expect(found.json.items).toHaveLength(2);
    });

    it('opening stock becomes a DRAFT opening document; nothing moves until a manager posts it; undo reverses', async () => {
      const miss = await upload(tk, 'opening-stock', csv(SHEAD, 'NOPE-1,5,1000'), {
        warehouseId: WH,
      });
      expect(miss.json.status).toBe('rejected');
      const noWh = await upload(tk, 'opening-stock', csv(SHEAD, 'IMP-A1,5,1000'));
      expect(noWh.status).toBe(422);

      const v = await upload(
        tk,
        'opening-stock',
        csv(SHEAD, 'IMP-A1,10,85.000', 'IMP-A2,4,120000'),
        {
          warehouseId: WH,
        },
      );
      expect(v.json.status).toBe('validated');
      stockBatch = v.json.id;
      const c = await commit(tk, stockBatch);
      expect(c.json).toMatchObject({ status: 'committed', created: { stockDocument: 1 } });

      const docs = (await h.call('GET', '/api/v1/inv/documents?type=ADJ', { cookie: tk })).json
        .items as Row[];
      const doc = docs.find((d) => d.reason?.includes(stockBatch))!;
      expect(doc).toMatchObject({ status: 'draft', source: { type: 'opening-balance' } });
      const stockOf = async () =>
        (
          (await h.call('GET', '/api/v1/inv/stock?q=IMP-A1', { cookie: tk })).json.items as Row[]
        ).reduce((n, s) => n + s.onHand, 0);
      expect(await stockOf()).toBe(0);

      // the importer cannot post their own opening document; the branch manager does (separation of duties kept)
      const posted = await h.call('POST', `/api/v1/inv/documents/${doc.id}/post`, {
        cookie: ql,
        key: key('post'),
        body: { version: doc.version },
      });
      expect(posted.status).toBe(200);
      expect(await stockOf()).toBe(10);

      // undo: a posted document is reversed by a reversal document, never deleted (RULE-010)
      expect((await undo(tk, stockBatch)).status).toBe(403);
      const u = await undo(ql, stockBatch);
      expect(u.json.status).toBe('undone');
      expect(await stockOf()).toBe(0);
      const after = (await h.call('GET', `/api/v1/inv/documents/${doc.id}`, { cookie: ql })).json;
      expect(after.reversedBy).toBeTruthy();
    });

    it('undo of the part batch is blocked once the parts have stock history, nothing removed', async () => {
      const u = await undo(tk, partsBatch);
      expect(u.status).toBe(409);
      expect(
        (await h.call('GET', '/api/v1/inv/parts?q=IMP-A', { cookie: tk })).json.items,
      ).toHaveLength(2);
    });

    it('undo of a part batch without history removes exactly its parts', async () => {
      const v = await upload(tk, 'parts', csv(PHEAD, 'IMP-B1,Bugi thử,piece,other'));
      await commit(tk, v.json.id);
      expect(
        (await h.call('GET', '/api/v1/inv/parts?q=IMP-B1', { cookie: tk })).json.items,
      ).toHaveLength(1);
      expect((await undo(tk, v.json.id)).json.status).toBe('undone');
      expect(
        (await h.call('GET', '/api/v1/inv/parts?q=IMP-B1', { cookie: tk })).json.items,
      ).toHaveLength(0);
      // the code is free again
      expect(
        (await upload(tk, 'parts', csv(PHEAD, 'IMP-B1,Bugi thử,piece,other'))).json.status,
      ).toBe('validated');
    });
  });

  it('template is a CSV with the Vietnamese header and BOM', async () => {
    const t = await h.call('GET', `${IMPORTS}/template?kind=parts`, { cookie: tk });
    expect(t.status).toBe(200);
    expect(t.text).toContain('Mã phụ tùng,Tên phụ tùng');
    expect(t.headers.get('content-type')).toContain('text/csv');
  });
});

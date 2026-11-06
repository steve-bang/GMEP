import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { checkMerge } from '@/modules/crm';
import { journey, type Row, uniqueKey } from '../helpers/journey';
import { backends, createHarness, type Harness } from './harness';

/**
 * Slice 2.8b, FR-CRM-003: duplicate suggestions by phone and merge that keeps both records and every document (no hard
 * delete, BR-CRM-01, RULE-010), moves the source's vehicles by ownership records (FR-CRM-005 history), audits both
 * records in the same transaction (FR-SYS-003), and is limited to CH/QL in scope (RULE-012).
 */
describe('FR-CRM-003 merge rules (pure)', () => {
  const c = (id: string, extra: Row = {}) =>
    ({ id, status: 'active', type: 'individual', ...extra }) as Parameters<typeof checkMerge>[0];
  it('refuses the same record, a non-active record, different types and different tax codes', () => {
    expect(checkMerge(c('a'), c('a'))).toBe('merge_same_customer');
    expect(checkMerge(c('a'), c('b', { status: 'merged' }))).toBe('merge_not_active');
    expect(checkMerge(c('a'), c('b', { type: 'business' }))).toBe('merge_type_mismatch');
    expect(
      checkMerge(
        c('a', { type: 'business', taxCode: '0301' }),
        c('b', { type: 'business', taxCode: '0302' }),
      ),
    ).toBe('merge_tax_code_mismatch');
    expect(checkMerge(c('a'), c('b'))).toBeNull();
  });
});

describe.each(backends)('CRM customer merge [%s]', (backend) => {
  let h: Harness;
  let j: ReturnType<typeof journey>;
  let cv: string;
  let ql: string;
  let qlTd: string;

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);

  beforeAll(async () => {
    h = await createHarness(backend);
    j = journey(h);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
  });

  it('suggests the duplicate by phone, merges keeping both records, moves the vehicle, audits both; the merged record is read-only', async () => {
    const phone = '0912345678';
    const a = await j.post(cv, '/api/v1/crm/customers', {
      type: 'individual',
      name: 'Trần Văn Gộp',
      phone,
    });
    expect(a.status, a.text).toBe(201);
    const b = await j.post(cv, '/api/v1/crm/customers', {
      type: 'individual',
      name: 'Tran Van Gop',
      phone,
    });
    expect(b.status, b.text).toBe(201);
    const v = await j.post(cv, '/api/v1/crm/vehicles', {
      customerId: b.json.id,
      plate: '51M-246.80',
      make: 'Toyota',
      model: 'Vios',
      year: 2020,
      lastKm: 1000,
    });
    expect(v.status, v.text).toBe(201);

    const dup = await j.get(ql, `/api/v1/crm/customers/${a.json.id}/duplicates`);
    expect(dup.status, dup.text).toBe(200);
    expect(dup.json.items.map((x: Row) => x.id)).toEqual([b.json.id]);

    // CV may not merge; another branch cannot see the records
    const body = (bv: number) => ({
      sourceId: b.json.id,
      version: a.json.version as number,
      sourceVersion: bv,
      reason: 'Khách tạo trùng hai lần',
    });
    const bNow = (await j.get(ql, `/api/v1/crm/customers/${b.json.id}`)).json;
    expect(
      (await j.post(cv, `/api/v1/crm/customers/${a.json.id}/merge`, body(bNow.version))).status,
    ).toBe(403);
    expect(
      (await j.post(qlTd, `/api/v1/crm/customers/${a.json.id}/merge`, body(bNow.version))).status,
    ).toBe(404);

    const m = await h.call('POST', `/api/v1/crm/customers/${a.json.id}/merge`, {
      cookie: ql,
      key: uniqueKey('merge'),
      body: body(bNow.version),
    });
    expect(m.status, m.text).toBe(200);
    expect(m.json.movedVehicles).toEqual([v.json.id]);

    const src = (await j.get(ql, `/api/v1/crm/customers/${b.json.id}`)).json;
    expect(src).toMatchObject({ status: 'merged', mergedInto: a.json.id, vehicleCount: 0 });
    const dst = (await j.get(ql, `/api/v1/crm/customers/${a.json.id}`)).json;
    expect(dst).toMatchObject({ mergedFrom: [b.json.id], vehicleCount: 1 });
    // both records still exist; the vehicle's ownership history keeps the old owner (closed) and the new one
    expect(
      (await rows('customers')).filter((c) => [a.json.id, b.json.id].includes(c.id)),
    ).toHaveLength(2);
    const owns = (await rows('vehicleOwnerships')).filter((o) => o.vehicleId === v.json.id);
    expect(owns.map((o) => [o.customerId, o.to === null])).toEqual(
      expect.arrayContaining([
        [b.json.id, false],
        [a.json.id, true],
      ]),
    );
    const audit = (await rows('auditLogs')).filter((x) =>
      ['customer.merge', 'customer.merged_into'].includes(x.action),
    );
    expect(audit.map((x) => x.entityId).sort()).toEqual([a.json.id, b.json.id].sort());
    // the merged record is read-only and cannot be merged again
    const upd = await h.call('PATCH', `/api/v1/crm/customers/${b.json.id}`, {
      cookie: ql,
      key: uniqueKey('u'),
      body: { version: src.version, name: 'Đổi tên' },
    });
    expect(upd.status).toBe(409);
    const again = await h.call('POST', `/api/v1/crm/customers/${a.json.id}/merge`, {
      cookie: ql,
      key: uniqueKey('merge'),
      body: { ...body(src.version), version: dst.version },
    });
    expect(again.status).toBe(409);
  });
});

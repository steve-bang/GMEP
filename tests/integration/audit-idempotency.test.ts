import { beforeAll, describe, expect, it } from 'vitest';
import { allBranchesScope, branchesScope } from '@/platform/scope/scope';
import { backends, createHarness, type Harness } from './harness';

const body = (code: string, branchId = 'br_q7') => ({ branchId, code, name: `Kho ${code}` });

describe.each(backends)('FR-SYS-003 audit log and Idempotency-Key [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });

  const auditFor = (entityId: string, companyId = 'cmp_demo') =>
    h.container.sys.audit.list(
      allBranchesScope(companyId),
      { entityType: 'warehouse', entityId },
      50,
    );

  it('FR-SYS-003: a create writes its audit entry in the same transaction, with actor, branch, request id and after-state', async () => {
    const res = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_q7',
      key: 'audit-create-0001',
      body: body('AUD-001'),
    });
    expect(res.status).toBe(201);
    const entries = await auditFor(res.json.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'warehouse.create',
      actorId: 'u_ql_q7',
      branchId: 'br_q7',
      before: null,
      entityType: 'warehouse',
    });
    expect(entries[0]!.after).toMatchObject({ code: 'AUD-001', branchId: 'br_q7' });
    expect(entries[0]!.requestId).toBe(res.headers.get('x-request-id'));
    expect(entries[0]!.actorRoles).toContain('QL');
  });

  it('FR-SYS-003: nothing is audited (and nothing is written) when the business change fails', async () => {
    const first = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_q7',
      key: 'audit-dup-0000001',
      body: body('AUD-DUP'),
    });
    expect(first.status).toBe(201);
    const dup = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_q7',
      key: 'audit-dup-0000002',
      body: body('AUD-DUP'),
    });
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe('warehouse_code_exists');
    expect(await auditFor(first.json.id)).toHaveLength(1);
    // the failed attempt left no idempotency record either, so the key can be reused after fixing the input
    const retry = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_q7',
      key: 'audit-dup-0000002',
      body: body('AUD-DUP2'),
    });
    expect(retry.status).toBe(201);
  });

  it('FR-SYS-003: a transaction that throws after staging an audit entry leaves no audit entry (atomicity)', async () => {
    const { uow, audit, newId, clock } = h.container.sys;
    const id = newId();
    await expect(
      uow.run(async (tx) => {
        audit.record(tx, {
          id,
          at: clock.now(),
          companyId: 'cmp_demo',
          branchId: 'br_q7',
          actorId: 'u_owner',
          actorRoles: [],
          entityType: 'probe',
          entityId: 'p1',
          action: 'probe',
          before: null,
          after: null,
          requestId: 'r',
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(
      await audit.list(allBranchesScope('cmp_demo'), { entityType: 'probe' }, 10),
    ).toHaveLength(0);
  });

  it('FR-SYS-003: audit entries have no update/delete API and are scope-limited when read', async () => {
    const audit = h.container.sys.audit as unknown as Record<string, unknown>;
    expect(['update', 'delete', 'remove', 'set']).toSatisfy((names: string[]) =>
      names.every((n) => audit[n] === undefined),
    );
    const res = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_td',
      key: 'audit-scope-00001',
      body: body('AUD-TD', 'br_td'),
    });
    expect(res.status).toBe(201);
    const q7View = await h.container.sys.audit.list(
      branchesScope('cmp_demo', ['br_q7']),
      { entityId: res.json.id },
      10,
    );
    expect(q7View).toHaveLength(0);
    const tdView = await h.container.sys.audit.list(
      branchesScope('cmp_demo', ['br_td']),
      { entityId: res.json.id },
      10,
    );
    expect(tdView).toHaveLength(1);
  });

  it('plan 2.8: replaying the same Idempotency-Key returns the original result with one record and one audit entry', async () => {
    const opts = { as: 'u_ql_q7', key: 'idem-replay-00001', body: body('IDM-001') };
    const a = await h.call('POST', '/api/v1/sys/warehouses', opts);
    const b = await h.call('POST', '/api/v1/sys/warehouses', opts);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers.get('idempotent-replayed')).toBe('true');
    expect(a.headers.get('idempotent-replayed')).toBeNull();
    expect(b.json).toEqual(a.json);
    expect(await auditFor(a.json.id)).toHaveLength(1);
  });

  it('the same key with a different body is rejected (422 idempotency_key_reuse)', async () => {
    await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_q7',
      key: 'idem-reuse-00001',
      body: body('IDM-002'),
    });
    const r = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_q7',
      key: 'idem-reuse-00001',
      body: body('IDM-003'),
    });
    expect(r.status).toBe(422);
    expect(r.json.code).toBe('idempotency_key_reuse');
  });

  it('keys are scoped per user: another user reusing the key does not replay', async () => {
    const k = 'idem-peruser-0001';
    const a = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_q7',
      key: k,
      body: body('IDM-004'),
    });
    const b = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_owner',
      key: k,
      body: body('IDM-005'),
    });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.json.id).not.toBe(a.json.id);
  });

  it('missing or malformed key on a risky write -> 400', async () => {
    expect(
      (await h.call('POST', '/api/v1/sys/warehouses', { as: 'u_ql_q7', body: body('IDM-006') }))
        .json.code,
    ).toBe('idempotency_key_required');
    expect(
      (
        await h.call('POST', '/api/v1/sys/warehouses', {
          as: 'u_ql_q7',
          key: 'short',
          body: body('IDM-006'),
        })
      ).json.code,
    ).toBe('idempotency_key_invalid');
  });

  it('concurrency: 20 simultaneous requests with the same key create exactly one warehouse and one audit entry', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        h.call('POST', '/api/v1/sys/warehouses', {
          as: 'u_ql_q7',
          key: 'idem-parallel-0001',
          body: body('IDM-PAR'),
        }),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.json.id)).size).toBe(1);
    expect(results.filter((r) => r.headers.get('idempotent-replayed') === 'true')).toHaveLength(19);
    expect(await auditFor(results[0]!.json.id)).toHaveLength(1);
  });

  it('concurrency: parallel creates of the same business key (different Idempotency-Keys) yield one 201 and the rest 409', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        h.call('POST', '/api/v1/sys/warehouses', {
          as: 'u_ql_q7',
          key: `idem-biz-key-${String(i).padStart(4, '0')}`,
          body: body('IDM-BIZ'),
        }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
  });

  it('FR-SYS-011: a locked branch accepts no new documents but remains readable; unknown branch is 404', async () => {
    const locked = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_owner',
      key: 'locked-branch-0001',
      body: body('LCK-001', 'br_lk'),
    });
    expect(locked.status).toBe(409);
    expect(locked.json.code).toBe('branch_locked');
    expect(
      (await h.call('GET', '/api/v1/sys/warehouses/wh_br_lk_WH-CHINH', { as: 'u_owner' })).status,
    ).toBe(200);
    expect(
      (
        await h.call('POST', '/api/v1/sys/warehouses', {
          as: 'u_owner',
          key: 'unknown-branch-0001',
          body: body('LCK-002', 'br_nope'),
        })
      ).status,
    ).toBe(404);
  });

  it('validation errors are RFC 9457 problems with per-field errors', async () => {
    const r = await h.call('POST', '/api/v1/sys/warehouses', {
      as: 'u_ql_q7',
      key: 'validation-00001',
      body: { branchId: 'br_q7', code: 'bad code!', name: 'x' },
    });
    expect(r.status).toBe(422);
    expect(r.headers.get('content-type')).toBe('application/problem+json');
    expect(r.json).toMatchObject({
      code: 'validation_failed',
      status: 422,
      title: expect.any(String),
      traceId: expect.any(String),
    });
    expect(r.json.errors.map((e: { field: string }) => e.field).sort()).toEqual(['code', 'name']);
  });

  it('export is audited', async () => {
    await h.call('GET', '/api/v1/sys/warehouses/export', { as: 'u_owner' });
    const entries = await h.container.sys.audit.list(
      allBranchesScope('cmp_demo'),
      { entityType: 'warehouse', entityId: '*' },
      10,
    );
    expect(entries.some((e) => e.action === 'warehouse.export' && e.actorId === 'u_owner')).toBe(
      true,
    );
  });
});

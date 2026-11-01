import { beforeAll, describe, expect, it } from 'vitest';
import { backends, createHarness, listAll, type Harness } from './harness';

/** G4-SYS-01..07: users and role assignments, branches and states, warehouses lifecycle, catalogues, roles. */
describe.each(backends)(
  'SYS administration: users, branches, warehouses, catalogue [%s]',
  (backend) => {
    let h: Harness;
    beforeAll(async () => {
      h = await createHarness(backend);
    });
    const invite = (as: string, n: number, role: string, branch: string) =>
      h.call('POST', '/api/v1/sys/users', {
        as,
        key: `adm-inv-${n}-aaaaaaaa`,
        body: {
          email: `new${n}@demo.gmep.test`,
          employeeCode: `NV80${n}`,
          displayName: `Người ${n}`,
          assignments: [{ roleCode: role, branchId: branch }],
        },
      });

    describe('user and role-assignment rules (ba-answers §2.3)', () => {
      it('a branch manager invites operative roles in their own branch only; management roles need the owner', async () => {
        expect((await invite('u_ql_q7', 1, 'CV', 'br_q7')).status).toBe(201);
        expect((await invite('u_ql_q7', 2, 'CV', 'br_td')).status).toBe(403); // other branch
        expect((await invite('u_ql_q7', 3, 'KT', 'br_q7')).json.code).toBe('approval_required');
        expect((await invite('u_ad', 4, 'QL', 'br_q7')).json.code).toBe('approval_required'); // AD cannot grant management roles
        expect((await invite('u_ad', 5, 'TH', 'br_td')).status).toBe(201);
        expect((await invite('u_owner', 6, 'QL', 'br_td')).status).toBe(201);
        expect((await invite('u_cv_q7', 7, 'CV', 'br_q7')).status).toBe(403); // no user:create
        expect((await invite('u_ql_q7', 1, 'CV', 'br_q7')).status).toBe(201); // idempotent replay of the same key
      });
      it('email and employee code are unique; the code is immutable (not editable through the API)', async () => {
        const dup = await h.call('POST', '/api/v1/sys/users', {
          as: 'u_owner',
          key: 'adm-dup-0001-aaaaaa',
          body: {
            email: 'chu@demo.gmep.test',
            employeeCode: 'NV8999',
            displayName: 'Trùng',
            assignments: [{ roleCode: 'CV', branchId: 'br_q7' }],
          },
        });
        expect(dup.json.code).toBe('user_exists');
        const dupCode = await h.call('POST', '/api/v1/sys/users', {
          as: 'u_owner',
          key: 'adm-dup-0002-aaaaaa',
          body: {
            email: 'x9@demo.gmep.test',
            employeeCode: 'nv 0101',
            displayName: 'Trùng mã',
            assignments: [{ roleCode: 'CV', branchId: 'br_q7' }],
          },
        });
        expect(dupCode.json.code).toBe('user_exists');
        const u = await h.call('GET', '/api/v1/sys/users/u_cv_q7', { as: 'u_ql_q7' });
        const patched = await h.call('PATCH', '/api/v1/sys/users/u_cv_q7', {
          as: 'u_ql_q7',
          body: { displayName: 'Đổi tên', employeeCode: 'HACK', version: u.json.version },
        });
        expect(patched.status).toBe(200);
        expect(patched.json.employeeCode).toBe('NV0103');
        expect(
          (
            await h.call('PATCH', '/api/v1/sys/users/u_cv_q7', {
              as: 'u_ql_q7',
              body: { displayName: 'Lại đổi', version: u.json.version },
            })
          ).json.code,
        ).toBe('version_conflict');
      });
      it('nobody changes their own assignments; assignments are the union of permissions (FR-SYS-012)', async () => {
        expect(
          (
            await h.call('POST', '/api/v1/sys/users/u_ql_q7/assignments', {
              as: 'u_ql_q7',
              body: { roleCode: 'CV', branchId: 'br_q7' },
            })
          ).json.code,
        ).toBe('self_change');
        const add = await h.call('POST', '/api/v1/sys/users/u_tn_q7/assignments', {
          as: 'u_ql_q7',
          body: { roleCode: 'CV', branchId: 'br_q7' },
        });
        expect(add.status).toBe(201);
        expect(
          (
            await h.call('POST', '/api/v1/sys/users/u_tn_q7/assignments', {
              as: 'u_ql_q7',
              body: { roleCode: 'CV', branchId: 'br_q7' },
            })
          ).json.code,
        ).toBe('assignment_exists');
        // the new role is effective at the next request (permission cache dropped on change)
        const roles = await h.call('GET', '/api/v1/sys/users/u_tn_q7', { as: 'u_ql_q7' });
        expect(roles.json.assignments.map((a: { roleCode: string }) => a.roleCode).sort()).toEqual([
          'CV',
          'TN',
        ]);
        const rm = await h.call(
          'DELETE',
          `/api/v1/sys/users/u_tn_q7/assignments/${encodeURIComponent(add.json.id)}`,
          { as: 'u_ql_q7' },
        );
        expect(rm.status).toBe(200);
        // managers (owner-approved roles) are untouchable for a branch manager
        expect(
          (
            await h.call('POST', '/api/v1/sys/users/u_ql_td/assignments', {
              as: 'u_ql_q7',
              body: { roleCode: 'CV', branchId: 'br_q7' },
            })
          ).status,
        ).toBe(404);
      });
      it('user list and detail are branch scoped: out-of-scope users look missing', async () => {
        const q7 = await listAll(h, 'u_ql_q7', {}, 25, '/api/v1/sys/users');
        const codes = q7.items.map((u) => u.employeeCode);
        expect(codes).toContain('NV0103');
        expect(codes).toContain('NV801'); // invited through the API: assignments carry the sort key too
        expect(codes).not.toContain('NV0201'); // manager of another branch
        expect(codes).not.toContain('NV0001'); // owner has no assignment inside the branch scope
        expect((await h.call('GET', '/api/v1/sys/users/u_ql_td', { as: 'u_ql_q7' })).status).toBe(
          404,
        );
        expect((await h.call('GET', '/api/v1/sys/users/nope', { as: 'u_ql_q7' })).status).toBe(404);
        const all = await listAll(h, 'u_owner', {}, 5, '/api/v1/sys/users');
        expect(all.items.length).toBeGreaterThan(14);
        expect(new Set(all.items.map((u) => u.id)).size).toBe(all.items.length);
        expect(all.pages).toBeGreaterThan(1);
      });
      it('disabling a user kills their sessions at once; the account cannot log in until re-enabled', async () => {
        const cookie = await h.login('u_th_q7');
        expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(200);
        const u = await h.call('GET', '/api/v1/sys/users/u_th_q7', { as: 'u_ql_q7' });
        expect(
          (
            await h.call('POST', '/api/v1/sys/users/u_th_q7/status', {
              as: 'u_ql_q7',
              body: { status: 'disabled', version: u.json.version },
            })
          ).status,
        ).toBe(200);
        expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401);
        expect(
          (
            await h.call('POST', '/api/v1/auth/login', {
              body: { identifier: 'th.q7@demo.gmep.test', password: 'Demo!Pass-2026' },
              headers: { 'x-forwarded-for': '10.8.8.8' },
            })
          ).status,
        ).toBe(401);
        const u2 = await h.call('GET', '/api/v1/sys/users/u_th_q7', { as: 'u_ql_q7' });
        expect(
          (
            await h.call('POST', '/api/v1/sys/users/u_th_q7/status', {
              as: 'u_ql_q7',
              body: { status: 'active', version: u2.json.version },
            })
          ).status,
        ).toBe(200);
        expect(
          (
            await h.call('POST', '/api/v1/auth/login', {
              body: { identifier: 'th.q7@demo.gmep.test', password: 'Demo!Pass-2026' },
              headers: { 'x-forwarded-for': '10.8.8.8' },
            })
          ).status,
        ).toBe(200);
      });
      it('admin session list and forced logout (user:manage)', async () => {
        const cookie = await h.login('u_tk_q7');
        const sessions = await h.call('GET', '/api/v1/sys/users/u_tk_q7/sessions', {
          as: 'u_ql_q7',
        });
        expect(sessions.status).toBe(200);
        expect(sessions.json.items.length).toBeGreaterThan(0);
        expect(JSON.stringify(sessions.json)).not.toContain(
          cookie.split('=')[1]!.split('.').slice(1).join('.').slice(0, 20),
        ); // the provider token part never leaves the cookie; the random session id is only a handle
        expect(
          (await h.call('DELETE', '/api/v1/sys/users/u_tk_q7/sessions', { as: 'u_ql_q7' })).status,
        ).toBe(200);
        expect((await h.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401);
        expect(
          (await h.call('GET', '/api/v1/sys/users/u_tk_q7/sessions', { as: 'u_cv_q7' })).status,
        ).toBe(403);
      });
      it('a role change takes effect immediately in this process and grants only what the editor holds', async () => {
        const roles = await h.call('GET', '/api/v1/sys/roles', { as: 'u_ad' });
        expect(roles.json.items).toHaveLength(10);
        const tn = roles.json.items.find((r: { code: string }) => r.code === 'TN');
        // AD cannot grant approve rights it does not hold
        expect(
          (
            await h.call('PUT', '/api/v1/sys/roles/TN', {
              as: 'u_ad',
              body: { permissions: [...tn.permissions, 'tax-rate:approve'] },
            })
          ).json.code,
        ).toBe('grant_exceeds_own');
        expect(
          (
            await h.call('PUT', '/api/v1/sys/roles/TN', {
              as: 'u_ad',
              body: { permissions: [...tn.permissions, 'nonsense:view'] },
            })
          ).status,
        ).toBe(422);
        expect(
          (await h.call('PUT', '/api/v1/sys/roles/CH', { as: 'u_ad', body: { permissions: [] } }))
            .status,
        ).toBe(403); // owner role is protected
        const cookie = await h.login('u_tn_q7');
        expect((await h.call('GET', '/api/v1/sys/warehouses', { cookie })).status).toBe(403);
        const ok = await h.call('PUT', '/api/v1/sys/roles/TN', {
          as: 'u_ad',
          body: { permissions: [...tn.permissions, 'warehouse:view'] },
        });
        expect(ok.status).toBe(200);
        expect((await h.call('GET', '/api/v1/sys/warehouses', { cookie })).status).toBe(200);
        expect(
          (
            await h.call('PUT', '/api/v1/sys/roles/TN', {
              as: 'u_ad',
              body: { permissions: tn.permissions },
            })
          ).status,
        ).toBe(200);
        expect((await h.call('GET', '/api/v1/sys/warehouses', { cookie })).status).toBe(403);
        expect((await h.call('GET', '/api/v1/sys/roles', { as: 'u_ql_q7' })).status).toBe(403);
      });
    });

    describe('branches and states (FR-SYS-011, ba-answers §5)', () => {
      it('adding a branch is configuration only and the code is unique', async () => {
        const r = await h.call('POST', '/api/v1/sys/branches', {
          as: 'u_ad',
          key: 'br-create-0001-aaa',
          body: { code: 'bh', name: 'Chi nhánh Biên Hòa' },
        });
        expect(r.status).toBe(201);
        expect(r.json.code).toBe('BH');
        expect(
          (
            await h.call('POST', '/api/v1/sys/branches', {
              as: 'u_ad',
              key: 'br-create-0002-aaa',
              body: { code: 'BH', name: 'Trùng' },
            })
          ).json.code,
        ).toBe('branch_code_exists');
        expect(
          (
            await h.call('POST', '/api/v1/sys/branches', {
              as: 'u_ql_q7',
              key: 'br-create-0003-aaa',
              body: { code: 'XX', name: 'Không quyền' },
            })
          ).status,
        ).toBe(403);
        const list = await h.call('GET', '/api/v1/sys/branches', { as: 'u_owner' });
        expect(list.json.items.map((b: { code: string }) => b.code)).toContain('BH');
        // a branch manager sees only their branch
        expect(
          (await h.call('GET', '/api/v1/sys/branches', { as: 'u_ql_q7' })).json.items.map(
            (b: { id: string }) => b.id,
          ),
        ).toEqual(['br_q7']);
        expect((await h.call('GET', '/api/v1/sys/branches/br_td', { as: 'u_ql_q7' })).status).toBe(
          404,
        );
      });
      it("state changes follow the transition table and are an owner action; hours/contact are the manager's", async () => {
        const b = await h.call('GET', '/api/v1/sys/branches/br_td', { as: 'u_owner' });
        const to = (as: string, status: string, version: number, key: string) =>
          h.call('POST', '/api/v1/sys/branches/br_td/status', {
            as,
            key,
            body: { status, reason: 'kiểm thử', version },
          });
        expect((await to('u_ad', 'closing', b.json.version, 'br-st-0001-aaaaaa')).status).toBe(403);
        expect((await to('u_owner', 'locked', b.json.version, 'br-st-0002-aaaaaa')).json.code).toBe(
          'state_invalid',
        ); // active -> locked not allowed directly
        const closing = await to('u_owner', 'closing', b.json.version, 'br-st-0003-aaaaaa');
        expect(closing.status).toBe(200);
        // in `closing` new warehouses are blocked (BA §5), master data edits are admin-only
        const blocked = await h.call('POST', '/api/v1/sys/warehouses', {
          as: 'u_ad',
          key: 'br-st-wh-0001-aaa',
          body: { branchId: 'br_td', code: 'CLOSING-1', name: 'Kho khi ngừng nhận lệnh' },
        });
        expect(blocked.json.code).toBe('branch_closing');
        const edit = await h.call('PATCH', '/api/v1/sys/branches/br_td', {
          as: 'u_ql_td',
          body: { hours: '8-17', version: closing.json.version },
        });
        expect(edit.json.code).toBe('branch_closing');
        const locked = await to('u_owner', 'locked', closing.json.version, 'br-st-0004-aaaaaa');
        expect(locked.status).toBe(200);
        expect(
          (
            await h.call('POST', '/api/v1/sys/warehouses', {
              as: 'u_ad',
              key: 'br-st-wh-0002-aaa',
              body: { branchId: 'br_td', code: 'LOCKED-1', name: 'Kho khi khóa' },
            })
          ).json.code,
        ).toBe('branch_locked');
        // reads and login still work for a locked branch
        expect((await h.call('GET', '/api/v1/sys/warehouses', { as: 'u_ql_td' })).status).toBe(200);
        const reopen = await to('u_owner', 'active', locked.json.version, 'br-st-0005-aaaaaa');
        expect(reopen.status).toBe(200);
        const ok = await h.call('PATCH', '/api/v1/sys/branches/br_td', {
          as: 'u_ql_td',
          body: { hours: '8h-17h', contact: 'liên hệ mẫu', version: reopen.json.version },
        });
        expect(ok.status).toBe(200);
        // the manager may not rename the branch (org:update) but the admin may
        expect(
          (
            await h.call('PATCH', '/api/v1/sys/branches/br_td', {
              as: 'u_ql_td',
              body: { name: 'Đổi tên', version: ok.json.version },
            })
          ).status,
        ).toBe(403);
      });
      it('a pre-set closing branch (seed) blocks new warehouses; locked branch seed blocks too', async () => {
        expect(
          (
            await h.call('POST', '/api/v1/sys/warehouses', {
              as: 'u_ad',
              key: 'seed-cl-0001-aaaaaa',
              body: { branchId: 'br_cl', code: 'X-1', name: 'Kho X' },
            })
          ).json.code,
        ).toBe('branch_closing');
        expect(
          (
            await h.call('POST', '/api/v1/sys/warehouses', {
              as: 'u_ad',
              key: 'seed-lk-0001-aaaaaa',
              body: { branchId: 'br_lk', code: 'X-1', name: 'Kho X' },
            })
          ).json.code,
        ).toBe('branch_locked');
      });
    });

    describe('warehouse lifecycle (BA §3)', () => {
      it('manager edits name/note only (code immutable) with optimistic locking; the storekeeper cannot', async () => {
        const w = await h.call('GET', '/api/v1/sys/warehouses/wh_br_q7_WH-LOP', { as: 'u_ql_q7' });
        const ok = await h.call('PATCH', '/api/v1/sys/warehouses/wh_br_q7_WH-LOP', {
          as: 'u_ql_q7',
          body: { name: 'Kho lốp (đã đổi)', code: 'HACK', version: w.json.version },
        });
        expect(ok.status).toBe(200);
        expect(ok.json).toMatchObject({
          name: 'Kho lốp (đã đổi)',
          code: 'WH-LOP',
          version: w.json.version + 1,
        });
        expect(
          (
            await h.call('PATCH', '/api/v1/sys/warehouses/wh_br_q7_WH-LOP', {
              as: 'u_ql_q7',
              body: { name: 'Muộn', version: w.json.version },
            })
          ).json.code,
        ).toBe('version_conflict');
        expect(
          (
            await h.call('PATCH', '/api/v1/sys/warehouses/wh_br_q7_WH-LOP', {
              as: 'u_tk_q7',
              body: { name: 'Không quyền', version: ok.json.version },
            })
          ).status,
        ).toBe(403);
        expect(
          (
            await h.call('PATCH', '/api/v1/sys/warehouses/wh_br_td_WH-PT', {
              as: 'u_ql_q7',
              body: { name: 'Chi nhánh khác', version: 1 },
            })
          ).status,
        ).toBe(404);
        const search = await listAll(h, 'u_ql_q7', { q: 'kho lop' });
        expect(search.items).toHaveLength(1);
      });
      it('deactivate/reactivate needs the owner (warehouse:archive), is idempotent and audited; blockers come from the INV port', async () => {
        const w = await h.call('GET', '/api/v1/sys/warehouses/wh_br_q7_WH-SON', { as: 'u_owner' });
        expect(
          (
            await h.call('POST', '/api/v1/sys/warehouses/wh_br_q7_WH-SON/status', {
              as: 'u_ql_q7',
              key: 'wh-st-0001-aaaaaaa',
              body: { status: 'inactive', version: w.json.version },
            })
          ).status,
        ).toBe(403);
        const original = h.container.sys.warehouseActivity;
        h.container.sys.warehouseActivity = { blockers: async () => ['Còn tồn 3 sản phẩm'] };
        const refused = await h.call('POST', '/api/v1/sys/warehouses/wh_br_q7_WH-SON/status', {
          as: 'u_owner',
          key: 'wh-st-0002-aaaaaaa',
          body: { status: 'inactive', version: w.json.version },
        });
        expect(refused.json.code).toBe('warehouse_not_empty');
        h.container.sys.warehouseActivity = original;
        const ok = await h.call('POST', '/api/v1/sys/warehouses/wh_br_q7_WH-SON/status', {
          as: 'u_owner',
          key: 'wh-st-0003-aaaaaaa',
          body: { status: 'inactive', version: w.json.version },
        });
        expect(ok.status).toBe(200);
        expect(ok.json.status).toBe('inactive');
        const replay = await h.call('POST', '/api/v1/sys/warehouses/wh_br_q7_WH-SON/status', {
          as: 'u_owner',
          key: 'wh-st-0003-aaaaaaa',
          body: { status: 'inactive', version: w.json.version },
        });
        expect(replay.headers.get('idempotent-replayed')).toBe('true');
        const again = await h.call('POST', '/api/v1/sys/warehouses/wh_br_q7_WH-SON/status', {
          as: 'u_owner',
          key: 'wh-st-0004-aaaaaaa',
          body: { status: 'inactive', version: ok.json.version },
        });
        expect(again.json.code).toBe('state_invalid');
        const audit = await h.call(
          'GET',
          '/api/v1/sys/audit?entityType=warehouse&entityId=wh_br_q7_WH-SON',
          { as: 'u_owner' },
        );
        expect(audit.json.items.map((e: { action: string }) => e.action)).toContain(
          'warehouse.deactivate',
        );
      });
      it.todo(
        'INV slice: deactivation is refused while on-hand, reserved or in-transit quantities are non-zero or a stock document is open (WarehouseActivityPort stub returns no blockers today)',
      );
      it.todo(
        'REC/ACC/EIN slices: locking a branch is refused while open orders, unclosed receipts, goods in transit or failed invoices exist (BranchActivityPort stub)',
      );
    });

    describe('catalogue and price lists (company level, FR-INV-025 headers)', () => {
      it('service catalogue: create/search/update by owner, view for advisers, refused for others; codes are unique', async () => {
        const create = (code: string, key: string) =>
          h.call('POST', '/api/v1/sys/services', {
            as: 'u_owner',
            key,
            body: { code, name: `Thay dầu ${code}`, group: 'Bảo dưỡng' },
          });
        expect((await create('thay-dau', 'svc-create-0001-aaa')).status).toBe(201);
        expect((await create('thay-dau', 'svc-create-0002-aaa')).json.code).toBe('code_exists');
        expect(
          (
            await h.call('POST', '/api/v1/sys/services', {
              as: 'u_ql_q7',
              key: 'svc-create-0003-aaa',
              body: { code: 'qlcreate', name: 'Dịch vụ của chi nhánh', group: 'X' },
            })
          ).status,
        ).toBe(403); // not company-wide
        const list = await h.call('GET', '/api/v1/sys/services?q=thay%20dau', { as: 'u_cv_q7' });
        expect(list.status).toBe(200);
        expect(list.json.items).toHaveLength(1);
        expect((await h.call('GET', '/api/v1/sys/services', { as: 'u_th_q7' })).status).toBe(403);
        const svc = list.json.items[0];
        const upd = await h.call('PATCH', `/api/v1/sys/services/${encodeURIComponent(svc.id)}`, {
          as: 'u_owner',
          body: { status: 'inactive', version: svc.version },
        });
        expect(upd.json.status).toBe('inactive');
      });
      it('price list headers: only the owner creates today (AD/KT rights are an open question); sellers read', async () => {
        expect(
          (
            await h.call('POST', '/api/v1/sys/price-lists', {
              as: 'u_kt',
              key: 'pl-create-0002-aa',
              body: { code: 'kt', name: 'KT' },
            })
          ).status,
        ).toBe(403);
        expect(
          (
            await h.call('POST', '/api/v1/sys/price-lists', {
              as: 'u_owner',
              key: 'pl-create-0003-aa',
              body: { code: 'le', name: 'Bảng giá bán lẻ' },
            })
          ).status,
        ).toBe(201);
        expect(
          (await h.call('GET', '/api/v1/sys/price-lists', { as: 'u_tk_q7' })).json.items,
        ).toHaveLength(1);
      });
    });

    describe('RBAC matrix by role (resource x action) over the real endpoints', () => {
      // [user, method, path, expected status]
      const cases: [string, string, string, number][] = [
        ['u_owner', 'GET', '/api/v1/sys/warehouses', 200],
        ['u_qv', 'GET', '/api/v1/sys/warehouses', 200], // consolidating role (after choosing the merged view)
        ['u_cv_q7', 'GET', '/api/v1/sys/warehouses', 403],
        ['u_qd_q7', 'GET', '/api/v1/sys/warehouses', 403],
        ['u_th_q7', 'GET', '/api/v1/sys/warehouses', 403],
        ['u_tn_q7', 'GET', '/api/v1/sys/warehouses', 403],
        ['u_kt', 'GET', '/api/v1/sys/warehouses', 200],
        ['u_ad', 'GET', '/api/v1/sys/warehouses', 200],
        ['u_ql_q7', 'GET', '/api/v1/sys/users', 200],
        ['u_cv_q7', 'GET', '/api/v1/sys/users', 403],
        ['u_kt', 'GET', '/api/v1/sys/users', 403],
        ['u_tk_q7', 'GET', '/api/v1/sys/audit', 403],
        ['u_ql_q7', 'GET', '/api/v1/sys/audit', 200],
        ['u_kt', 'GET', '/api/v1/sys/audit', 422], // KT must pick an allowed entity type
        ['u_ad', 'GET', '/api/v1/sys/audit', 200],
        ['u_th_q7', 'GET', '/api/v1/sys/branches', 403],
        ['u_qv', 'GET', '/api/v1/sys/branches', 200],
        ['u_norole', 'GET', '/api/v1/sys/branches', 403],
        ['u_cv_q7', 'GET', '/api/v1/sys/config/tax-rate', 200],
        ['u_th_q7', 'GET', '/api/v1/sys/config/tax-rate', 403],
        ['u_tn_q7', 'GET', '/api/v1/sys/config/doc-template', 200],
        ['u_tn_q7', 'GET', '/api/v1/sys/config/price-item', 403],
      ];
      it.each(cases)('%s %s %s -> %i', async (user, method, path, status) => {
        if (user === 'u_qv') await h.loginAt('u_qv', 'all');
        const r = await h.call(method, path, { as: user });
        expect(r.status).toBe(status);
      });
      it('export of the audit log is limited to CH and AD, with a reason, capped and itself audited', async () => {
        const exp = (as: string, body: object) =>
          h.call('POST', '/api/v1/sys/audit/export', { as, body });
        expect((await exp('u_ql_q7', { reason: 'kiểm tra định kỳ' })).status).toBe(403);
        expect((await exp('u_kt', { reason: 'kiểm tra định kỳ' })).status).toBe(403);
        expect((await exp('u_owner', {})).status).toBe(422); // reason required
        expect((await exp('u_owner', { reason: 'abc' })).status).toBe(422);
        const ok = await exp('u_ad', { reason: 'kiểm tra định kỳ', entityType: 'branch' });
        expect(ok.status).toBe(200);
        expect(ok.headers.get('content-type')).toContain('text/csv');
        expect(ok.text).toContain('branch.create');
        expect(ok.text).not.toMatch(/"after"|nameNorm/); // event columns only, no values
        const log = await h.call('GET', '/api/v1/sys/audit?entityType=audit', { as: 'u_owner' });
        expect(log.json.items[0]).toMatchObject({
          action: 'audit.export',
          reason: 'kiểm tra định kỳ',
        });
        expect(log.json.items[0].after.rows).toBeGreaterThan(0);
      });
      it('export over the row cap is refused (configuration), page sizes are 25 or 100 only', async () => {
        h.container.sys.config.exportMaxRows = 3;
        const r = await h.call('POST', '/api/v1/sys/audit/export', {
          as: 'u_owner',
          body: { reason: 'xuất toàn bộ' },
        });
        expect(r.status).toBe(422);
        expect(r.json.code).toBe('export_too_large');
        h.container.sys.config.exportMaxRows = 5000;
        expect((await h.call('GET', '/api/v1/sys/audit?limit=50', { as: 'u_owner' })).status).toBe(
          422,
        );
        const p100 = await h.call('GET', '/api/v1/sys/audit?limit=100', { as: 'u_owner' });
        expect(p100.status).toBe(200);
        expect(p100.json.items.length).toBeLessThanOrEqual(100);
      });
      it("audit viewer is branch scoped: a branch manager never sees another branch's entries", async () => {
        await h.call('POST', '/api/v1/sys/warehouses', {
          as: 'u_ad',
          key: 'aud-scope-0001-aaa',
          body: { branchId: 'br_td', code: 'AUD-TD', name: 'Kho kiểm toán TD' },
        });
        const q7 = await h.call('GET', '/api/v1/sys/audit?entityType=warehouse&limit=100', {
          as: 'u_ql_q7',
        });
        expect(q7.status).toBe(200);
        expect(q7.json.items.every((e: { branchId: string }) => e.branchId === 'br_q7')).toBe(true);
        expect(JSON.stringify(q7.json)).not.toContain('AUD-TD');
        const td = await h.call('GET', '/api/v1/sys/audit?entityType=warehouse&limit=100', {
          as: 'u_ql_td',
        });
        expect(JSON.stringify(td.json)).toContain('AUD-TD');
      });
    });
  },
);

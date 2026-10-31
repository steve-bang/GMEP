/**
 * FAKE demo/test data (no real people, phones or addresses). Used by in-memory tests, the
 * emulator seed script and e2e. The password below is a throw-away value for the emulator only.
 */
import type { Branch, Role, User } from '@/modules/sys';

export const DEMO_PASSWORD = 'Demo!Pass-2026';
export const DEMO_COMPANY = 'cmp_demo';

export const demoBranches: Branch[] = [
  { id: 'br_q7', companyId: DEMO_COMPANY, code: 'Q7', name: 'Chi nhánh Quận 7', status: 'active' },
  { id: 'br_td', companyId: DEMO_COMPANY, code: 'TD', name: 'Chi nhánh Thủ Đức', status: 'active' },
  { id: 'br_lk', companyId: DEMO_COMPANY, code: 'LK', name: 'Chi nhánh Đã khóa', status: 'locked' },
];

/**
 * Seed role data. Permission contents are PLACEHOLDERS: the real matrix (FRD §2, FR-SYS-013)
 * is pending ba; see docs/dev/open-questions-for-ba.md.
 */
export const demoRoles: Role[] = [
  {
    code: 'CH',
    name: 'Chủ garage',
    permissions: ['warehouse:view', 'warehouse:create', 'warehouse:export'],
  },
  {
    code: 'QL',
    name: 'Quản lý chi nhánh',
    permissions: ['warehouse:view', 'warehouse:create', 'warehouse:export'],
  },
  { code: 'TK', name: 'Thủ kho', permissions: ['warehouse:view'] },
];

const u = (
  id: string,
  code: string,
  email: string,
  name: string,
  status: User['status'] = 'active',
): User => ({
  id,
  companyId: DEMO_COMPANY,
  email,
  employeeCode: code,
  displayName: name,
  status,
});

export const demoUsers: User[] = [
  u('u_owner', 'NV0001', 'chu@demo.gmep.test', 'Chủ Garage Demo'),
  u('u_ql_q7', 'NV0101', 'ql.q7@demo.gmep.test', 'Quản lý Quận 7'),
  u('u_ql_td', 'NV0201', 'ql.td@demo.gmep.test', 'Quản lý Thủ Đức'),
  u('u_tk_q7', 'NV0102', 'tk.q7@demo.gmep.test', 'Thủ kho Quận 7'),
  u('u_multi', 'NV0301', 'multi@demo.gmep.test', 'Nhiều vai trò'),
  u('u_norole', 'NV0900', 'norole@demo.gmep.test', 'Không vai trò'),
  u('u_disabled', 'NV0999', 'disabled@demo.gmep.test', 'Đã khóa', 'disabled'),
];

export interface DemoAssignment {
  id: string;
  userId: string;
  companyId: string;
  roleCode: string;
  branchId: string;
}

const a = (userId: string, roleCode: string, branchId: string): DemoAssignment => ({
  id: `ra_${userId}_${roleCode}_${branchId}`.replace('*', 'all'),
  userId,
  companyId: DEMO_COMPANY,
  roleCode,
  branchId,
});

export const demoAssignments: DemoAssignment[] = [
  a('u_owner', 'CH', '*'),
  a('u_ql_q7', 'QL', 'br_q7'),
  a('u_ql_td', 'QL', 'br_td'),
  a('u_tk_q7', 'TK', 'br_q7'),
  // FR-SYS-012: union per branch - manager at Q7, storekeeper (view only) at Thu Duc
  a('u_multi', 'QL', 'br_q7'),
  a('u_multi', 'TK', 'br_td'),
  a('u_disabled', 'QL', 'br_q7'),
];

export const demoWarehouseSeeds: { branchId: string; code: string; name: string }[] = [
  { branchId: 'br_q7', code: 'WH-CHINH', name: 'Kho chính Quận 7' },
  { branchId: 'br_q7', code: 'WH-LOP', name: 'Kho lốp' },
  { branchId: 'br_q7', code: 'WH-SON', name: 'Kho sơn đồng' },
  { branchId: 'br_td', code: 'WH-CHINH', name: 'Kho chính Thủ Đức' },
  { branchId: 'br_td', code: 'WH-PT', name: 'Kho phụ tùng điện' },
  { branchId: 'br_lk', code: 'WH-CHINH', name: 'Kho chi nhánh đã khóa' },
];

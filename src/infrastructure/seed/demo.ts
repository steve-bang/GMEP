/**
 * FAKE demo/test data (no real people, phones or addresses). Used by in-memory tests, the
 * emulator seed script and e2e. The password below is a throw-away value for the emulator only.
 */
import {
  defaultRoleSeeds,
  roleDocId,
  roleAssignmentId,
  warehouseId,
  type Branch,
  type User,
  type Warehouse,
} from '@/modules/sys';
import { normalizeSearch } from '@/platform/text/normalize';
import { userToDoc, warehouseToDoc } from '../repos/repos';
import { COL } from '../repos/queries';
import { crmDemoDocs } from './crmDemo';
import { demoTenant2Docs, demoTenant2Users } from './tenantDemo';
import { invDemoDocs } from './invDemo';
import { hrmDemoDocs } from './hrmDemo';
import { recDemoDocs } from './recDemo';
import type { SeedDoc } from './types';
import type { DocData } from '@/platform/store/docStore';

export const DEMO_PASSWORD = 'Demo!Pass-2026';
export const DEMO_TENANT = 'tnt_demo';
/** fixed demo "Mã công ty" (owner decision 07/11/2026); real tenants get a cryptographic random code at provisioning */
export const DEMO_TENANT_CODE = '482913';
const SEED_TIME = new Date('2026-10-01T00:00:00.000Z');

const b = (id: string, code: string, name: string, status: Branch['status']): Branch => ({
  id,
  tenantId: DEMO_TENANT,
  code,
  name,
  status,
  createdAt: SEED_TIME,
  createdBy: 'seed',
  updatedAt: SEED_TIME,
  updatedBy: 'seed',
  version: 1,
});

export const demoBranches: Branch[] = [
  b('br_q7', 'Q7', 'Chi nhánh Quận 7', 'active'),
  b('br_td', 'TD', 'Chi nhánh Thủ Đức', 'active'),
  b('br_lk', 'LK', 'Chi nhánh Đã khóa', 'locked'),
  b('br_cl', 'CL', 'Chi nhánh Ngừng nhận lệnh', 'closing'),
];

const u = (
  id: string,
  code: string,
  email: string,
  name: string,
  status: User['status'] = 'active',
  phone?: string,
): User => ({
  id,
  tenantId: DEMO_TENANT,
  email,
  employeeCode: code,
  displayName: name,
  ...(phone ? { phone } : {}),
  status,
  createdAt: SEED_TIME,
  createdBy: 'seed',
  updatedAt: SEED_TIME,
  updatedBy: 'seed',
  version: 1,
});

export const demoUsers: User[] = [
  u('u_owner', 'NV0001', 'chu@demo.gmep.test', 'Chủ Garage Demo', 'active', '0900000001'),
  u('u_ql_q7', 'NV0101', 'ql.q7@demo.gmep.test', 'Quản lý Quận 7', 'active', '0900000101'),
  u('u_ql_td', 'NV0201', 'ql.td@demo.gmep.test', 'Quản lý Thủ Đức', 'active', '0900000201'),
  u('u_tk_q7', 'NV0102', 'tk.q7@demo.gmep.test', 'Thủ kho Quận 7'),
  u('u_multi', 'NV0301', 'multi@demo.gmep.test', 'Nhiều vai trò'),
  u('u_norole', 'NV0900', 'norole@demo.gmep.test', 'Không vai trò'),
  u('u_disabled', 'NV0999', 'disabled@demo.gmep.test', 'Đã khóa', 'disabled'),
  u('u_qv', 'NV0401', 'qv@demo.gmep.test', 'Quản lý vùng'),
  u('u_cv_q7', 'NV0103', 'cv.q7@demo.gmep.test', 'Cố vấn Quận 7', 'active', '0900000103'),
  u('u_qd_q7', 'NV0104', 'qd.q7@demo.gmep.test', 'Quản đốc Quận 7'),
  u('u_th_q7', 'NV0105', 'th.q7@demo.gmep.test', 'Thợ Quận 7'),
  u('u_tn_q7', 'NV0106', 'tn.q7@demo.gmep.test', 'Thu ngân Quận 7'),
  u('u_kt', 'NV0501', 'kt@demo.gmep.test', 'Kế toán'),
  u('u_ad', 'NV0601', 'ad@demo.gmep.test', 'Quản trị hệ thống'),
  u('u_invited', 'NV0701', 'moi.q7@demo.gmep.test', 'Nhân viên mới Quận 7', 'invited'),
];

/** Fake "last login" instants so the user list (G4-SYS-01) has something to sort by. */
const LAST_LOGIN: Record<string, string> = {
  u_owner: '2026-10-30T01:55:00Z',
  u_ql_q7: '2026-10-30T01:30:00Z',
  u_cv_q7: '2026-10-29T00:50:00Z',
  u_kt: '2026-10-29T10:40:00Z',
  u_disabled: '2026-10-26T09:02:00Z',
};
for (const x of demoUsers) if (LAST_LOGIN[x.id]) x.lastLoginAt = new Date(LAST_LOGIN[x.id]!);

const a = (userId: string, roleCode: string, branchId: string) => ({
  id: roleAssignmentId(userId, roleCode, branchId),
  userId,
  tenantId: DEMO_TENANT,
  roleCode,
  branchId,
});

export const demoAssignments = [
  a('u_owner', 'CH', '*'),
  a('u_ql_q7', 'QL', 'br_q7'),
  a('u_ql_td', 'QL', 'br_td'),
  a('u_tk_q7', 'TK', 'br_q7'),
  // FR-SYS-012: union per branch - manager at Q7, storekeeper (view only) at Thu Duc
  a('u_multi', 'QL', 'br_q7'),
  a('u_multi', 'TK', 'br_td'),
  a('u_disabled', 'QL', 'br_q7'),
  a('u_qv', 'QV', 'br_q7'),
  a('u_qv', 'QV', 'br_td'),
  a('u_cv_q7', 'CV', 'br_q7'),
  a('u_qd_q7', 'QD', 'br_q7'),
  a('u_th_q7', 'TH', 'br_q7'),
  a('u_tn_q7', 'TN', 'br_q7'),
  a('u_kt', 'KT', '*'),
  a('u_ad', 'AD', '*'),
  a('u_invited', 'CV', 'br_q7'),
];

const codeOf = new Map(demoUsers.map((x) => [x.id, x.employeeCode]));

export const demoWarehouseSeeds: { branchId: string; code: string; name: string }[] = [
  { branchId: 'br_q7', code: 'WH-CHINH', name: 'Kho chính Quận 7' },
  { branchId: 'br_q7', code: 'WH-LOP', name: 'Kho lốp' },
  { branchId: 'br_q7', code: 'WH-SON', name: 'Kho sơn đồng' },
  { branchId: 'br_td', code: 'WH-CHINH', name: 'Kho chính Thủ Đức' },
  { branchId: 'br_td', code: 'WH-PT', name: 'Kho phụ tùng điện' },
  { branchId: 'br_lk', code: 'WH-CHINH', name: 'Kho chi nhánh đã khóa' },
];

export function demoWarehouses(): Warehouse[] {
  return demoWarehouseSeeds.map((w) => ({
    id: warehouseId(w.branchId, w.code),
    tenantId: DEMO_TENANT,
    branchId: w.branchId,
    code: w.code,
    name: w.name,
    nameNorm: normalizeSearch(w.name),
    status: 'active',
    // R39: the branch's default warehouse is the one stock is held from; the main warehouse of each branch is marked
    isDefault: w.code === 'WH-CHINH',
    createdAt: SEED_TIME,
    createdBy: 'seed',
    updatedAt: SEED_TIME,
    updatedBy: 'seed',
    version: 1,
  }));
}

/** Every demo account of every demo tenant (identity provider seeding, test logins). */
export const allDemoUsers: User[] = [...demoUsers, ...demoTenant2Users];

export type { SeedDoc };

/** Every demo document, backend independent (memory and Firestore are seeded from the same list). */
export function demoDocs(): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const put = (collection: string, id: string, data: DocData) =>
    docs.push({ collection, id, data });
  put(COL.tenantCodes, DEMO_TENANT_CODE, {
    tenantId: DEMO_TENANT,
    state: 'active',
    assignedAt: SEED_TIME,
  });
  put(COL.tenants, DEMO_TENANT, {
    tenantCode: DEMO_TENANT_CODE,
    name: 'Garage Demo',
    legalEntityIds: [],
    status: 'active',
    plan: 'free',
    subscriptionStatus: 'none',
    environment: 'demo',
    placement: 'pooled',
    legalHold: false,
    provisionRequestKey: 'seed',
    provisioning: {},
    createdAt: SEED_TIME,
    createdBy: 'seed',
    updatedAt: SEED_TIME,
    updatedBy: 'seed',
    version: 1,
  });
  for (const r of defaultRoleSeeds())
    put(COL.roles, roleDocId(DEMO_TENANT, r.code), {
      tenantId: DEMO_TENANT,
      code: r.code,
      name: r.name,
      permissions: r.permissions,
      canConsolidate: r.canConsolidate,
      appliedTopUps: r.appliedTopUps,
    });
  for (const br of demoBranches) {
    const { id, ...rest } = br;
    put(COL.branches, id, rest);
    put('branchCodes', `${br.tenantId}__${br.code}`, { branchId: id });
  }
  for (const x of demoUsers) {
    put(COL.users, x.id, userToDoc(x));
    put(COL.userKeys, `email__${x.email.toLowerCase()}`, {
      zone: 'tenant',
      identityId: x.id,
      userId: x.id,
    });
    put(COL.userKeys, `code__${x.tenantId}__${x.employeeCode}`, { userId: x.id });
  }
  for (const x of demoAssignments) {
    const { id, ...rest } = x;
    put(COL.roleAssignments, id, {
      ...rest,
      employeeCode: codeOf.get(x.userId),
      createdAt: SEED_TIME,
      createdBy: 'seed',
    });
  }
  for (const w of demoWarehouses()) put(COL.warehouses, w.id, warehouseToDoc(w));
  docs.push(...crmDemoDocs());
  docs.push(...invDemoDocs());
  docs.push(...recDemoDocs());
  docs.push(...hrmDemoDocs());
  docs.push(...demoTenant2Docs());
  return docs;
}

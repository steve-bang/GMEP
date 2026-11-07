import {
  defaultRoleSeeds,
  roleAssignmentId,
  roleDocId,
  warehouseId,
  type Branch,
  type User,
  type Warehouse,
} from '@/modules/sys';
import { normalizeSearch } from '@/platform/text/normalize';
import { COL } from '../repos/queries';
import { userToDoc, warehouseToDoc } from '../repos/repos';
import type { SeedDoc } from './types';

/**
 * Second demo tenant (NFR-TEN-01: seed and tests always have two tenants or more). Deliberately small, and deliberately
 * REUSING the first tenant's employee code NV0001 and branch code Q7: codes are unique per tenant only (RULE-018).
 * `pnpm seed` loads it next to the first; it shares nothing with it except the platform itself.
 */
export const DEMO_TENANT_2 = 'tnt_demo2';
export const DEMO_PASSWORD_2 = 'Demo!Pass-2026';
/** fixed demo "Mã công ty" of the second tenant (owner decision 07/11/2026) */
export const DEMO_TENANT_2_CODE = '730561';
const SEED_TIME = new Date('2026-10-01T00:00:00.000Z');
const audit = {
  createdAt: SEED_TIME,
  createdBy: 'seed',
  updatedAt: SEED_TIME,
  updatedBy: 'seed',
  version: 1,
};

export const demoTenant2Branch: Branch = {
  id: 'br_d2_q7',
  tenantId: DEMO_TENANT_2,
  code: 'Q7',
  name: 'Chi nhánh Quận 7 (Garage Demo 2)',
  status: 'active',
  ...audit,
};

export const demoTenant2Users: User[] = [
  {
    id: 'u_owner_b',
    tenantId: DEMO_TENANT_2,
    email: 'chu@demo2.gmep.test',
    employeeCode: 'NV0001',
    displayName: 'Chủ Garage Demo 2',
    status: 'active',
    ...audit,
  },
];

export function demoTenant2Docs(): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const put = (collection: string, id: string, data: SeedDoc['data']) =>
    docs.push({ collection, id, data });
  put(COL.tenantCodes, DEMO_TENANT_2_CODE, {
    tenantId: DEMO_TENANT_2,
    state: 'active',
    assignedAt: SEED_TIME,
  });
  put(COL.tenants, DEMO_TENANT_2, {
    tenantCode: DEMO_TENANT_2_CODE,
    name: 'Garage Demo 2',
    legalEntityIds: [],
    status: 'active',
    plan: 'free',
    subscriptionStatus: 'none',
    environment: 'demo',
    placement: 'pooled',
    legalHold: false,
    provisionRequestKey: 'seed',
    provisioning: {},
    ...audit,
  });
  for (const r of defaultRoleSeeds())
    put(COL.roles, roleDocId(DEMO_TENANT_2, r.code), {
      tenantId: DEMO_TENANT_2,
      code: r.code,
      name: r.name,
      permissions: r.permissions,
      canConsolidate: r.canConsolidate,
      appliedTopUps: r.appliedTopUps,
    });
  const { id: branchId, ...branch } = demoTenant2Branch;
  put(COL.branches, branchId, branch);
  put('branchCodes', `${DEMO_TENANT_2}__${demoTenant2Branch.code}`, { branchId });
  for (const x of demoTenant2Users) {
    put(COL.users, x.id, userToDoc(x));
    put(COL.userKeys, `email__${x.email.toLowerCase()}`, {
      zone: 'tenant',
      identityId: x.id,
      userId: x.id,
    });
    put(COL.userKeys, `code__${x.tenantId}__${x.employeeCode}`, { userId: x.id });
    put(COL.roleAssignments, roleAssignmentId(x.id, 'CH', '*'), {
      userId: x.id,
      tenantId: DEMO_TENANT_2,
      roleCode: 'CH',
      branchId: '*',
      employeeCode: x.employeeCode,
      createdAt: SEED_TIME,
      createdBy: 'seed',
    });
  }
  const wh: Warehouse = {
    id: warehouseId(branchId, 'WH-CHINH'),
    tenantId: DEMO_TENANT_2,
    branchId,
    code: 'WH-CHINH',
    name: 'Kho chính (Garage Demo 2)',
    nameNorm: normalizeSearch('Kho chính (Garage Demo 2)'),
    status: 'active',
    isDefault: true,
    ...audit,
  };
  put(COL.warehouses, wh.id, warehouseToDoc(wh));
  return docs;
}

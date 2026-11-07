/**
 * FAKE HRM demo data (slice 2.6a). EVERY number here is a SAMPLE ("minh họa") for tests and the demo: the client's labor
 * formula is not decided (Q73) and the accountant has signed no example (UAT-11 stays open). They are config versions
 * like any other, so nothing in code reads these numbers; real rules arrive through the approved configuration screens.
 */
import { configVersionId } from '@/modules/sys';
import { normalizeSearch } from '@/platform/text/normalize';
import { DEMO_TENANT_2 } from './tenantDemo';
import { COL } from '../repos/queries';
import type { SeedDoc } from './types';

const AT = new Date('2026-10-01T00:00:00.000Z');
const TENANT = 'tnt_demo';
const DAY = '2026-10-01';

export function hrmDemoDocs(): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const put = (collection: string, id: string, data: Record<string, unknown>) =>
    docs.push({ collection, id, data });
  const cfg = (
    type: string,
    scopeKey: string,
    payload: Record<string, unknown>,
    tenant: string = TENANT,
  ) =>
    put(COL.configVersions, configVersionId(tenant, type, scopeKey, DAY), {
      tenantId: tenant,
      type,
      scopeKey,
      effectiveFrom: DAY,
      status: 'approved',
      payload,
      proposedBy: 'seed',
      proposedAt: AT,
      reason: 'Dữ liệu minh họa (chưa được kế toán khách xác nhận, UAT-11 chưa đóng)',
      decidedBy: 'seed',
      decidedAt: AT,
      decisionNote: null,
      version: 1,
    });
  // positions with a sample coefficient (basis points)
  cfg('labor-position', 'position:mechanic3', {
    name: 'Thợ máy bậc 3 (minh họa)',
    status: 'active',
    coefficientBp: 10_000,
  });
  cfg('labor-position', 'position:mechanic4', {
    name: 'Thợ máy bậc 4 (minh họa)',
    status: 'active',
    coefficientBp: 12_000,
  });
  cfg('labor-position', 'position:apprentice', {
    name: 'Thợ học việc (minh họa)',
    status: 'active',
    coefficientBp: 6_000,
  });
  cfg('labor-position', 'position:advisor', {
    name: 'Cố vấn dịch vụ (minh họa)',
    status: 'active',
    coefficientBp: 10_000,
  });
  // the second demo tenant has its own position catalogue (isolation tests: same code, two tenants, two records)
  cfg(
    'labor-position',
    'position:mechanic3',
    { name: 'Thợ máy bậc 3 (minh họa)', status: 'active', coefficientBp: 10_000 },
    DEMO_TENANT_2,
  );
  // one method per service type, to show every method kind (sample rates)
  cfg('labor-method', 'svc:maintenance', { method: 'standard_hours', hourlyRateVnd: 100_000 });
  cfg('labor-method', 'svc:general_repair', {
    method: 'approved_actual',
    hourlyRateVnd: 100_000,
    capBp: 12_000,
  });
  cfg('labor-method', 'svc:tire_wheel', { method: 'flat', amountVnd: 20_000 });
  cfg('labor-method', 'svc:body_paint', { method: 'percent', rateBp: 2_000 });
  cfg('labor-policy', 'tenant', {
    roundingMode: 'half_up',
    moneyStepVnd: 1,
    minutesStep: 1,
    adjustThresholdMinutes: 60,
    adjustThresholdVnd: 300_000,
    reworkMode: 'keep_original',
  });
  // the demo technician of branch Q7 as a staff record linked to the login account
  put(COL.employees, 'emp_demo_th_q7', {
    tenantId: TENANT,
    branchId: 'br_q7',
    code: 'NV0105',
    fullName: 'Thợ Quận 7',
    nameNorm: normalizeSearch('Thợ Quận 7'),
    status: 'active',
    positionCode: 'mechanic4',
    positions: [{ positionCode: 'mechanic4', from: '2021-06-12', to: null }],
    joinedOn: '2021-06-12',
    leftOn: null,
    leftReason: null,
    userId: 'u_th_q7',
    certificates: [],
    createdAt: AT,
    createdBy: 'seed',
    updatedAt: AT,
    updatedBy: 'seed',
    version: 1,
  });
  put(COL.employeePii, 'emp_demo_th_q7', {
    tenantId: TENANT,
    branchId: 'br_q7',
    phone: '0900000105',
    nationalId: null,
    address: null,
    birthDate: null,
  });
  put(COL.employeeCodes, `${TENANT}__NV0105`, {
    tenantId: TENANT,
    branchId: 'br_q7',
    employeeId: 'emp_demo_th_q7',
  });
  put(COL.employeeUserLinks, `${TENANT}__u_th_q7`, {
    tenantId: TENANT,
    branchId: 'br_q7',
    employeeId: 'emp_demo_th_q7',
  });
  return docs;
}

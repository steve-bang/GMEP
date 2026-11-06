/**
 * HRM module public surface (the only file other modules, composition and infrastructure import).
 * Slice 2.6a "Nhân công, lõi tính công" (FR-HRM-001, 004, 005, 006, 007, 008, 015, 020; RULE-038): staff records
 * (HRM-001), the effective-dated labor method per (service type x position x branch) with its priority order and
 * rounding policy, labor lines recorded when an item passes QC and undone when the order is cancelled, manual
 * adjustment with owner approval. No payroll, insurance or tax (BRD §4); period close, commission, productivity and
 * attendance are slice 2.6b.
 */
export const MODULE_CODE = 'HRM' as const;

export * from './domain/employee';
export * from './domain/labor';
export * from './ports/ports';
export { DEFAULT_HRM_CONFIG } from './ports/deps';
export type { HrmDeps, HrmConfig } from './ports/deps';

export {
  createEmployee,
  updateEmployee,
  leaveEmployee,
  listEmployees,
  getEmployee,
  revealEmployeeField,
} from './application/employees';
export type { EmployeeDto } from './application/employees';
export { prepareQcPass, prepareQcFail, prepareCancel } from './application/labor';
export type { LaborCall, LaborOrderRef, StagedLabor } from './application/labor';
export { adjustLabor, hrmApprovalHandlers } from './application/adjustments';
export { listLaborLines, getOrderLabor } from './application/reads';
export type {
  LaborLineDto,
  LaborListDto,
  LaborTotals,
  OrderLaborDto,
  PendingItemDto,
} from './application/reads';
export { getLaborRules, simulateLabor } from './application/rules';
export type { LaborRulesDto } from './application/rules';

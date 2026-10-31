/**
 * SYS module public surface: identity/session, RBAC data, organisation (branch, warehouse), audit.
 * Other modules and infrastructure/composition import only from here.
 */
export const MODULE_CODE = 'SYS' as const;

export * from './domain/entities';
export * from './ports/ports';
export type { SysDeps, SysConfig } from './ports/deps';
export { login, logout, resolveSession, revokeAllSessions } from './application/auth';
export type { LoginInput, LoginResult, Session } from './application/auth';
export {
  listWarehouses,
  getWarehouse,
  createWarehouse,
  exportWarehousesCsv,
  toWarehouseDto,
  warehouseListInputSchema,
  createWarehouseSchema,
} from './application/warehouses';
export type {
  WarehouseDto,
  WarehouseListInput,
  CreateWarehouseInput,
} from './application/warehouses';
export { getShellInfo } from './application/shell';
export type { ShellInfo } from './application/shell';

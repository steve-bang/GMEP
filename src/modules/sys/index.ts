/**
 * SYS module public surface: identity/session, RBAC data, organisation (branch, warehouse), audit,
 * effective-dated configuration, numbering, notifications, PII. Other modules and infrastructure/
 * composition import only from here.
 */
export const MODULE_CODE = 'SYS' as const;

export * from './domain/entities';
export * from './domain/permissions';
export * from './domain/branchState';
export * from './domain/sessionPolicy';
export * from './domain/passwordPolicy';
export * from './domain/config';
export * from './ports/ports';
export type { SysDeps, SysConfig, SysCaches, CachedSession } from './ports/deps';

export {
  login,
  logout,
  resolveSession,
  revokeAllSessions,
  invalidateUser,
  invalidateRole,
  loadActor,
} from './application/auth';
export type { LoginInput, LoginResult, Session } from './application/auth';
export { forgotPassword, resetPassword, activateAccount, peekToken } from './application/recovery';
export type { TokenPeek, TokenState } from './application/recovery';
export { getScopeInfo, setWorkingScope } from './application/scope';
export type { ScopeInfo, ScopeOption } from './application/scope';
export { getShellInfo } from './application/shell';
export type { ShellInfo } from './application/shell';

export {
  listWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  setWarehouseStatus,
  exportWarehousesCsv,
  toWarehouseDto,
  warehouseListInputSchema,
  createWarehouseSchema,
  csvCell,
} from './application/warehouses';
export type {
  WarehouseDto,
  WarehouseListInput,
  CreateWarehouseInput,
} from './application/warehouses';

export {
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  setBranchStatus,
} from './application/branches';
export type { BranchDto } from './application/branches';
export {
  listUsers,
  getUser,
  inviteUser,
  resendInvite,
  updateUser,
  setUserStatus,
  addAssignment,
  removeAssignment,
  unlockUser,
  listUserSessions,
  revokeUserSessions,
} from './application/users';
export type { UserDto, AssignmentDto, SessionDto } from './application/users';
export { listRoles, updateRole } from './application/roles';
export type { RoleDto } from './application/roles';
export {
  listServices,
  getService,
  createService,
  updateService,
  listPriceLists,
  createPriceList,
  updatePriceList,
} from './application/catalog';
export type { ServiceDto, PriceListDto } from './application/catalog';

export {
  listConfigVersions,
  proposeConfig,
  decideConfig,
  resolveConfigAt,
  snapshotOf,
  canViewConfig,
} from './application/config';
export type { ConfigVersionDto } from './application/config';
export { allocateDocumentNumber, resolveNumberingSeries } from './application/numbering';
export {
  notifyUsers,
  listMyNotifications,
  markNotificationRead,
} from './application/notifications';
export type { NotificationDto } from './application/notifications';
export { revealPii, userPiiSource } from './application/pii';
export { listAudit, exportAuditCsv, AUDIT_PAGE_SIZES } from './application/audit';
export type { AuditRowDto } from './application/audit';
export { assertBranchWritable } from './domain/branchState';

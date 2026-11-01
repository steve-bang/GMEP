import { defineQuery, type QueryFamily } from '@/platform/store/docStore';

/**
 * THE query catalogue (H3). Every Firestore query the repositories issue is declared here; the
 * store refuses shapes that are not registered, and scripts/check-indexes.ts derives the required
 * composite indexes from this registry. Add a query here first, then use it in a repository.
 */
export const COL = {
  users: 'users',
  userKeys: 'userKeys',
  userSecurity: 'userSecurity',
  roles: 'roles',
  roleAssignments: 'roleAssignments',
  companies: 'companies',
  branches: 'branches',
  warehouses: 'warehouses',
  sessions: 'sessions',
  authTokens: 'authTokens',
  configVersions: 'configVersions',
  notifications: 'notifications',
  services: 'services',
  priceLists: 'priceLists',
  auditLogs: 'auditLogs',
  accessLogs: 'accessLogs',
  idempotencyKeys: 'idempotencyKeys',
  emailOutbox: 'emailOutbox',
  counters: 'counters',
} as const;

type Dir = 'asc' | 'desc';
const listFamilies = (
  collection: string,
  name: string,
  optionalEq: string[],
  scopeField?: string,
) => {
  const out: Record<string, QueryFamily> = {};
  for (const [field, key] of [
    ['code', 'code'],
    ['nameNorm', 'name'],
  ] as const)
    for (const dir of ['asc', 'desc'] as Dir[])
      out[`${key}.${dir}`] = defineQuery({
        name: `${name}.${field}.${dir}`,
        collection,
        eq: ['companyId'],
        optionalEq,
        ...(scopeField ? { scopeField } : {}),
        range: field === 'nameNorm',
        order: { field, dir, type: 'string' },
      });
  return out;
};

export const Q = {
  warehouses: listFamilies(COL.warehouses, 'warehouses.list', [], 'branchId'),
  services: listFamilies(COL.services, 'services.list', ['group']),
  priceLists: listFamilies(COL.priceLists, 'priceLists.list', []),
  roles: defineQuery({
    name: 'roles.list',
    collection: COL.roles,
    order: { field: 'name', dir: 'asc', type: 'string' },
  }),
  /** all branches of a company (a few tens), sorted by code; branch scopes read by id */
  branchesByCompany: defineQuery({
    name: 'branches.byCompany',
    collection: COL.branches,
    eq: ['companyId'],
    order: { field: 'code', dir: 'asc', type: 'string' },
  }),
  audit: defineQuery({
    name: 'auditLogs.list',
    collection: COL.auditLogs,
    eq: ['companyId'],
    optionalEq: ['entityType', 'entityId', 'actorId', 'action'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'at', dir: 'desc', type: 'date' },
  }),
  /** users of a company ordered by employee code (company-wide scope) */
  usersByCompany: defineQuery({
    name: 'users.byCompany',
    collection: COL.users,
    eq: ['companyId'],
    order: { field: 'employeeCode', dir: 'asc', type: 'string' },
  }),
  /** role assignments inside a branch scope, ordered by the (immutable) employee code of the user */
  assignmentsByBranch: defineQuery({
    name: 'roleAssignments.byBranch',
    collection: COL.roleAssignments,
    eq: ['companyId'],
    scopeField: 'branchId',
    order: { field: 'employeeCode', dir: 'asc', type: 'string' },
  }),
  assignmentsByRole: defineQuery({
    name: 'roleAssignments.byRole',
    collection: COL.roleAssignments,
    eq: ['companyId', 'roleCode'],
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  assignmentsByUser: defineQuery({
    name: 'roleAssignments.byUser',
    collection: COL.roleAssignments,
    eq: ['userId'],
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  userByEmail: defineQuery({
    name: 'users.byEmail',
    collection: COL.users,
    eq: ['email'],
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  userByCode: defineQuery({
    name: 'users.byEmployeeCode',
    collection: COL.users,
    eq: ['employeeCode'],
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  sessionsByUser: defineQuery({
    name: 'sessions.byUser',
    collection: COL.sessions,
    eq: ['userId'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  tokensByUserKind: defineQuery({
    name: 'authTokens.byUserKind',
    collection: COL.authTokens,
    eq: ['userId', 'kind'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  configScope: defineQuery({
    name: 'configVersions.byScope',
    collection: COL.configVersions,
    eq: ['companyId', 'type', 'scopeKey'],
    order: { field: 'effectiveFrom', dir: 'desc', type: 'string' },
  }),
  configType: defineQuery({
    name: 'configVersions.byType',
    collection: COL.configVersions,
    eq: ['companyId', 'type'],
    optionalEq: ['status'],
    order: { field: 'effectiveFrom', dir: 'desc', type: 'string' },
  }),
  notificationsByUser: defineQuery({
    name: 'notifications.byUser',
    collection: COL.notifications,
    eq: ['userId'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  countersByBranch: defineQuery({
    name: 'counters.byBranch',
    collection: COL.counters,
    eq: ['companyId', 'branchId'],
    order: { field: 'updatedAt', dir: 'desc', type: 'date' },
  }),
};

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
  customers: 'customers',
  customerPii: 'customerPii',
  customerLinks: 'customerLinks',
  vehicles: 'vehicles',
  vehicleLinks: 'vehicleLinks',
  vehiclePlates: 'vehiclePlates',
  /** C11: company-wide VIN uniqueness registry, same pattern as vehiclePlates */
  vehicleVins: 'vehicleVins',
  vehicleOwnerships: 'vehicleOwnerships',
  consents: 'consents',
  dataSubjectRequests: 'dataSubjectRequests',
  vehicleHistory: 'vehicleHistory',
  parts: 'parts',
  partCodes: 'partCodes',
  partBarcodes: 'partBarcodes',
  partCompat: 'partCompat',
  stockBalances: 'stockBalances',
  stockMovements: 'stockMovements',
  stockDocuments: 'stockDocuments',
  stockReservations: 'stockReservations',
  issueReturns: 'issueReturns',
  intakes: 'intakes',
  quotes: 'quotes',
  quoteVersions: 'quoteVersions',
  quoteLinks: 'quoteLinks',
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

/** asc/desc list families over one string field (CRM lists), optionally branch scoped */
function dirFamilies(
  name: string,
  collection: string,
  field: string,
  optionalEq: string[],
  scopeField?: string,
) {
  const out: Record<Dir, QueryFamily> = {} as Record<Dir, QueryFamily>;
  for (const dir of ['asc', 'desc'] as Dir[])
    out[dir] = defineQuery({
      name: `${name}.${dir}`,
      collection,
      eq: ['companyId'],
      optionalEq,
      ...(scopeField ? { scopeField } : {}),
      range: true,
      order: { field, dir, type: 'string' },
    });
  return out;
}

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
  // ---- CRM (slice 1.3) ----
  /** company-wide customer list (scope 'all'), prefix search on nameNorm */
  customersByName: dirFamilies('customers.list.name', COL.customers, 'nameNorm', ['type']),
  /** branch-scoped customer list through relation links (BA §10.1.5) */
  customerLinksByName: dirFamilies(
    'customerLinks.list.name',
    COL.customerLinks,
    'nameNorm',
    ['type'],
    'branchId',
  ),
  /** contact data is searched by normalised phone prefix; scope is applied by the caller through links */
  customerPiiByPhone: defineQuery({
    name: 'customerPii.byPhone',
    collection: COL.customerPii,
    eq: ['companyId'],
    range: true,
    order: { field: 'phoneNorm', dir: 'asc', type: 'string' },
  }),
  vehiclesByPlate: dirFamilies('vehicles.list.plate', COL.vehicles, 'plateNorm', []),
  vehicleLinksByPlate: dirFamilies(
    'vehicleLinks.list.plate',
    COL.vehicleLinks,
    'plateNorm',
    [],
    'branchId',
  ),
  vehiclesByOwner: defineQuery({
    name: 'vehicles.byOwner',
    collection: COL.vehicles,
    eq: ['companyId', 'currentOwnerId'],
    order: { field: 'plateNorm', dir: 'asc', type: 'string' },
  }),
  ownershipsByVehicle: defineQuery({
    name: 'vehicleOwnerships.byVehicle',
    collection: COL.vehicleOwnerships,
    eq: ['companyId', 'vehicleId'],
    order: { field: 'from', dir: 'desc', type: 'string' },
  }),
  ownershipsByCustomer: defineQuery({
    name: 'vehicleOwnerships.byCustomer',
    collection: COL.vehicleOwnerships,
    eq: ['companyId', 'customerId'],
    order: { field: 'from', dir: 'desc', type: 'string' },
  }),
  consentsByCustomer: defineQuery({
    name: 'consents.byCustomer',
    collection: COL.consents,
    eq: ['companyId', 'customerId'],
    order: { field: 'grantedAt', dir: 'desc', type: 'date' },
  }),
  dataRequests: defineQuery({
    name: 'dataSubjectRequests.list',
    collection: COL.dataSubjectRequests,
    eq: ['companyId'],
    optionalEq: ['status', 'customerId'],
    scopeField: 'branchId',
    order: { field: 'receivedAt', dir: 'desc', type: 'date' },
  }),
  vehicleHistory: defineQuery({
    name: 'vehicleHistory.byVehicle',
    collection: COL.vehicleHistory,
    eq: ['companyId', 'vehicleId'],
    order: { field: 'date', dir: 'desc', type: 'string' },
  }),
  // ---- INV (slice 1.4) ----
  /** part catalogue, company level: prefix search by normalised code or name */
  partsByCode: defineQuery({
    name: 'parts.list.code',
    collection: COL.parts,
    eq: ['companyId'],
    optionalEq: ['group', 'status'],
    range: true,
    order: { field: 'code', dir: 'asc', type: 'string' },
  }),
  partsByName: defineQuery({
    name: 'parts.list.name',
    collection: COL.parts,
    eq: ['companyId'],
    optionalEq: ['group', 'status'],
    range: true,
    order: { field: 'nameNorm', dir: 'asc', type: 'string' },
  }),
  /** parts compatible with a vehicle line (link documents), ordered by code */
  partCompatByModel: defineQuery({
    name: 'partCompat.byModel',
    collection: COL.partCompat,
    eq: ['companyId', 'compatKey'],
    order: { field: 'code', dir: 'asc', type: 'string' },
  }),
  /** stock list and reorder list: balances of the scope ordered by part code */
  stockByPart: defineQuery({
    name: 'stockBalances.list.code',
    collection: COL.stockBalances,
    eq: ['companyId'],
    optionalEq: ['warehouseId', 'lowStock'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'partCodeNorm', dir: 'asc', type: 'string' },
  }),
  /** all warehouses of one part inside the scope */
  stockOfPart: defineQuery({
    name: 'stockBalances.byPart',
    collection: COL.stockBalances,
    eq: ['companyId', 'partId'],
    scopeField: 'branchId',
    order: { field: 'warehouseId', dir: 'asc', type: 'string' },
  }),
  /** FR-SYS-029 guard: any non-zero balance in a warehouse */
  stockNonZero: defineQuery({
    name: 'stockBalances.nonZero',
    collection: COL.stockBalances,
    eq: ['companyId', 'warehouseId', 'nonZero'],
    order: { field: 'partCodeNorm', dir: 'asc', type: 'string' },
  }),
  /** the stock card of one warehouse x part, newest first */
  movementsByBalance: defineQuery({
    name: 'stockMovements.byBalance',
    collection: COL.stockMovements,
    eq: ['companyId', 'warehouseId', 'partId'],
    scopeField: 'branchId',
    order: { field: 'seqKey', dir: 'desc', type: 'string' },
  }),
  stockDocuments: defineQuery({
    name: 'stockDocuments.list',
    collection: COL.stockDocuments,
    eq: ['companyId'],
    optionalEq: ['type', 'status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  /** open (draft) documents of a warehouse */
  stockDocumentsOpen: defineQuery({
    name: 'stockDocuments.openByWarehouse',
    collection: COL.stockDocuments,
    eq: ['companyId', 'warehouseId', 'status'],
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  reservationsBySource: defineQuery({
    name: 'stockReservations.bySource',
    collection: COL.stockReservations,
    eq: ['companyId', 'sourceType', 'sourceId'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  reservationsOpen: defineQuery({
    name: 'stockReservations.open',
    collection: COL.stockReservations,
    eq: ['companyId', 'status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  reservationsByPart: defineQuery({
    name: 'stockReservations.byPart',
    collection: COL.stockReservations,
    eq: ['companyId', 'partId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    order: { field: 'updatedAt', dir: 'desc', type: 'date' },
  }),
  /** REC (slice 1.5): intakes and quotes, newest first, by plate prefix or by number prefix */
  intakes: defineQuery({
    name: 'intakes.list',
    collection: COL.intakes,
    eq: ['companyId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  intakesByPlate: defineQuery({
    name: 'intakes.byPlate',
    collection: COL.intakes,
    eq: ['companyId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'plateNorm', dir: 'asc', type: 'string' },
  }),
  intakesByNumber: defineQuery({
    name: 'intakes.byNumber',
    collection: COL.intakes,
    eq: ['companyId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'number', dir: 'asc', type: 'string' },
  }),
  /** C17: the retention gate asks REC for open files of one customer, company-wide */
  intakesByCustomer: defineQuery({
    name: 'intakes.byCustomer',
    collection: COL.intakes,
    eq: ['companyId', 'customerId', 'status'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  quotesByCustomer: defineQuery({
    name: 'quotes.byCustomer',
    collection: COL.quotes,
    eq: ['companyId', 'customerId', 'status'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  quotes: defineQuery({
    name: 'quotes.list',
    collection: COL.quotes,
    eq: ['companyId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  quotesByPlate: defineQuery({
    name: 'quotes.byPlate',
    collection: COL.quotes,
    eq: ['companyId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'plateNorm', dir: 'asc', type: 'string' },
  }),
  quotesByNumber: defineQuery({
    name: 'quotes.byNumber',
    collection: COL.quotes,
    eq: ['companyId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'number', dir: 'asc', type: 'string' },
  }),
};

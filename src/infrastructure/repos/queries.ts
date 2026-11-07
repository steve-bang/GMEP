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
  tenants: 'tenants',
  /** owner decision 07/11/2026: lock documents of the six-digit tenant codes, read BY KEY only (no query shape) */
  tenantCodes: 'tenantCodes',
  // platform zone (FR-TEN-011, 013): staff identities and the immutable platform audit; never tenant business data
  platformIdentities: 'platformIdentities',
  platformAuditLogs: 'platformAuditLogs',
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
  // A4: dev outbox of sms/zalo, one-time approval codes, quote-link deliveries and their per-branch retry queue (all read BY KEY, no query shape)
  messageOutbox: 'messageOutbox',
  quoteOtps: 'quoteOtps',
  messageDeliveries: 'messageDeliveries',
  messageQueues: 'messageQueues',
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
  repairOrders: 'repairOrders',
  repairItems: 'repairItems',
  partRequests: 'partRequests',
  // SYS approvals (FR-SYS-004) and ACC (slice 1.7)
  approvals: 'approvals',
  approvalSlots: 'approvalSlots',
  approvalDelegations: 'approvalDelegations',
  payments: 'payments',
  paymentReversals: 'paymentReversals',
  orderAccounts: 'orderAccounts',
  cashDrawers: 'cashDrawers',
  cashEntries: 'cashEntries',
  cashShifts: 'cashShifts',
  dayCloses: 'dayCloses',
  debts: 'debts',
  // EIN slice 1.8
  invoices: 'invoices',
  invoicePii: 'invoicePii',
  invoiceArtifacts: 'invoiceArtifacts',
  invoiceRequests: 'invoiceRequests',
  invoiceQueues: 'invoiceQueues',
  einOrders: 'einOrders',
  // SYS data import (FR-SYS-007): batches, file slots and staged units are read BY KEY; only the batch history list is queried
  importBatches: 'importBatches',
  importFileSlots: 'importFileSlots',
  importUnits: 'importUnits',
  // RPT slice 1.9 (R68 rule 3): daily rollups, read BY KEY (`<branchId>_<yyyyMMdd>`), no query shape, no index
  rollups: 'rollups',
  // HRM slice 2.6a: staff records and their personal data, the unique-code and account-link slots (read BY KEY), and one
  // labor sheet per repair order (id = order id). Only two shapes are queried (see Q.employees, Q.laborSheetsByBranch)
  employees: 'employees',
  employeePii: 'employeePii',
  employeeCodes: 'employeeCodes',
  employeeUserLinks: 'employeeUserLinks',
  laborSheets: 'laborSheets',
  // REC slice 2.8b: appointments (FR-REC-019, 027); one shape, Q.appointmentsByDate
  appointments: 'appointments',
  // REC slice 2.8b: warranty records (projection P4, one per delivered order); one shape, Q.warrantiesByVehicle
  warranties: 'warranties',
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
        eq: ['tenantId'],
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
      eq: ['tenantId'],
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
  /** platform screens and the scheduler: tenants are few; ordered by creation, no equality field, no composite index */
  tenants: defineQuery({
    name: 'tenants.list',
    collection: COL.tenants,
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  /** FR-TEN-013: newest first; the tenant filter is applied in memory on the bounded window (no composite index) */
  platformAudit: defineQuery({
    name: 'platformAuditLogs.list',
    collection: COL.platformAuditLogs,
    order: { field: 'at', dir: 'desc', type: 'date' },
  }),
  /** a tenant's roles (a few tens): ordered by the equality field itself, so no composite index is needed */
  roles: defineQuery({
    name: 'roles.list',
    collection: COL.roles,
    eq: ['tenantId'],
    order: { field: 'tenantId', dir: 'asc', type: 'string' },
  }),
  /** all branches of a company (a few tens), sorted by code; branch scopes read by id */
  branchesByTenant: defineQuery({
    name: 'branches.byTenant',
    collection: COL.branches,
    eq: ['tenantId'],
    order: { field: 'code', dir: 'asc', type: 'string' },
  }),
  audit: defineQuery({
    name: 'auditLogs.list',
    collection: COL.auditLogs,
    eq: ['tenantId'],
    // actorId and action are filtered in memory (DocAuditLog.list): 32 -> 8 composite indexes (slice 2.1)
    optionalEq: ['entityType', 'entityId'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'at', dir: 'desc', type: 'date' },
  }),
  /** users of a company ordered by employee code (company-wide scope) */
  usersByTenant: defineQuery({
    name: 'users.byTenant',
    collection: COL.users,
    eq: ['tenantId'],
    order: { field: 'employeeCode', dir: 'asc', type: 'string' },
  }),
  /** role assignments inside a branch scope, ordered by the (immutable) employee code of the user */
  assignmentsByBranch: defineQuery({
    name: 'roleAssignments.byBranch',
    collection: COL.roleAssignments,
    eq: ['tenantId'],
    scopeField: 'branchId',
    order: { field: 'employeeCode', dir: 'asc', type: 'string' },
  }),
  assignmentsByRole: defineQuery({
    name: 'roleAssignments.byRole',
    collection: COL.roleAssignments,
    eq: ['tenantId', 'roleCode'],
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
    eq: ['tenantId', 'type', 'scopeKey'],
    order: { field: 'effectiveFrom', dir: 'desc', type: 'string' },
  }),
  configType: defineQuery({
    name: 'configVersions.byType',
    collection: COL.configVersions,
    eq: ['tenantId', 'type'],
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
    eq: ['tenantId', 'branchId'],
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
    eq: ['tenantId'],
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
    eq: ['tenantId', 'currentOwnerId'],
    order: { field: 'plateNorm', dir: 'asc', type: 'string' },
  }),
  ownershipsByVehicle: defineQuery({
    name: 'vehicleOwnerships.byVehicle',
    collection: COL.vehicleOwnerships,
    eq: ['tenantId', 'vehicleId'],
    order: { field: 'from', dir: 'desc', type: 'string' },
  }),
  ownershipsByCustomer: defineQuery({
    name: 'vehicleOwnerships.byCustomer',
    collection: COL.vehicleOwnerships,
    eq: ['tenantId', 'customerId'],
    order: { field: 'from', dir: 'desc', type: 'string' },
  }),
  consentsByCustomer: defineQuery({
    name: 'consents.byCustomer',
    collection: COL.consents,
    eq: ['tenantId', 'customerId'],
    order: { field: 'grantedAt', dir: 'desc', type: 'date' },
  }),
  dataRequests: defineQuery({
    name: 'dataSubjectRequests.list',
    collection: COL.dataSubjectRequests,
    eq: ['tenantId'],
    optionalEq: ['status', 'customerId'],
    scopeField: 'branchId',
    order: { field: 'receivedAt', dir: 'desc', type: 'date' },
  }),
  vehicleHistory: defineQuery({
    name: 'vehicleHistory.byVehicle',
    collection: COL.vehicleHistory,
    eq: ['tenantId', 'vehicleId'],
    order: { field: 'date', dir: 'desc', type: 'string' },
  }),
  // ---- INV (slice 1.4) ----
  /** part catalogue, company level: prefix search by normalised code or name */
  partsByCode: defineQuery({
    name: 'parts.list.code',
    collection: COL.parts,
    eq: ['tenantId'],
    optionalEq: ['group', 'status'],
    range: true,
    order: { field: 'code', dir: 'asc', type: 'string' },
  }),
  partsByName: defineQuery({
    name: 'parts.list.name',
    collection: COL.parts,
    eq: ['tenantId'],
    optionalEq: ['group', 'status'],
    range: true,
    order: { field: 'nameNorm', dir: 'asc', type: 'string' },
  }),
  /** parts compatible with a vehicle line (link documents), ordered by code */
  partCompatByModel: defineQuery({
    name: 'partCompat.byModel',
    collection: COL.partCompat,
    eq: ['tenantId', 'compatKey'],
    order: { field: 'code', dir: 'asc', type: 'string' },
  }),
  /** stock list and reorder list: balances of the scope ordered by part code */
  stockByPart: defineQuery({
    name: 'stockBalances.list.code',
    collection: COL.stockBalances,
    eq: ['tenantId'],
    optionalEq: ['warehouseId', 'lowStock'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'partCodeNorm', dir: 'asc', type: 'string' },
  }),
  /** all warehouses of one part inside the scope */
  stockOfPart: defineQuery({
    name: 'stockBalances.byPart',
    collection: COL.stockBalances,
    eq: ['tenantId', 'partId'],
    scopeField: 'branchId',
    order: { field: 'warehouseId', dir: 'asc', type: 'string' },
  }),
  /** FR-SYS-029 guard: any non-zero balance in a warehouse */
  stockNonZero: defineQuery({
    name: 'stockBalances.nonZero',
    collection: COL.stockBalances,
    eq: ['tenantId', 'warehouseId', 'nonZero'],
    order: { field: 'partCodeNorm', dir: 'asc', type: 'string' },
  }),
  /** the stock card of one warehouse x part, newest first */
  movementsByBalance: defineQuery({
    name: 'stockMovements.byBalance',
    collection: COL.stockMovements,
    eq: ['tenantId', 'warehouseId', 'partId'],
    scopeField: 'branchId',
    order: { field: 'seqKey', dir: 'desc', type: 'string' },
  }),
  stockDocuments: defineQuery({
    name: 'stockDocuments.list',
    collection: COL.stockDocuments,
    eq: ['tenantId'],
    optionalEq: ['type', 'status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  /** open (draft) documents of a warehouse */
  stockDocumentsOpen: defineQuery({
    name: 'stockDocuments.openByWarehouse',
    collection: COL.stockDocuments,
    eq: ['tenantId', 'warehouseId', 'status'],
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  reservationsBySource: defineQuery({
    name: 'stockReservations.bySource',
    collection: COL.stockReservations,
    eq: ['tenantId', 'sourceType', 'sourceId'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  reservationsOpen: defineQuery({
    name: 'stockReservations.open',
    collection: COL.stockReservations,
    eq: ['tenantId', 'status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  reservationsByPart: defineQuery({
    name: 'stockReservations.byPart',
    collection: COL.stockReservations,
    eq: ['tenantId', 'partId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    order: { field: 'updatedAt', dir: 'desc', type: 'date' },
  }),
  /** REC (slice 1.5): intakes and quotes, newest first, by plate prefix or by number prefix */
  intakes: defineQuery({
    name: 'intakes.list',
    collection: COL.intakes,
    eq: ['tenantId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  intakesByPlate: defineQuery({
    name: 'intakes.byPlate',
    collection: COL.intakes,
    eq: ['tenantId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'plateNorm', dir: 'asc', type: 'string' },
  }),
  intakesByNumber: defineQuery({
    name: 'intakes.byNumber',
    collection: COL.intakes,
    eq: ['tenantId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'number', dir: 'asc', type: 'string' },
  }),
  /** C17: the retention gate asks REC for open files of one customer, company-wide */
  intakesByCustomer: defineQuery({
    name: 'intakes.byCustomer',
    collection: COL.intakes,
    eq: ['tenantId', 'customerId', 'status'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  quotesByCustomer: defineQuery({
    name: 'quotes.byCustomer',
    collection: COL.quotes,
    eq: ['tenantId', 'customerId', 'status'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  quotes: defineQuery({
    name: 'quotes.list',
    collection: COL.quotes,
    eq: ['tenantId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  quotesByPlate: defineQuery({
    name: 'quotes.byPlate',
    collection: COL.quotes,
    eq: ['tenantId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'plateNorm', dir: 'asc', type: 'string' },
  }),
  quotesByNumber: defineQuery({
    name: 'quotes.byNumber',
    collection: COL.quotes,
    eq: ['tenantId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'number', dir: 'asc', type: 'string' },
  }),
  // ---- REC slice 1.6: repair orders, items, part requests ----
  repairOrders: defineQuery({
    name: 'repairOrders.list',
    collection: COL.repairOrders,
    eq: ['tenantId'],
    optionalEq: ['status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  repairOrdersByNumber: defineQuery({
    name: 'repairOrders.byNumber',
    collection: COL.repairOrders,
    eq: ['tenantId'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'number', dir: 'asc', type: 'string' },
  }),
  repairOrdersByPlate: defineQuery({
    name: 'repairOrders.byPlate',
    collection: COL.repairOrders,
    eq: ['tenantId'],
    scopeField: 'branchId',
    range: true,
    order: { field: 'plateNorm', dir: 'asc', type: 'string' },
  }),
  /** dispatch board: open orders of the scope */
  repairOrdersOpen: defineQuery({
    name: 'repairOrders.open',
    collection: COL.repairOrders,
    eq: ['tenantId', 'open'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  /** C17 retention gate: open orders of one customer, company-wide */
  repairOrdersByCustomer: defineQuery({
    name: 'repairOrders.byCustomer',
    collection: COL.repairOrders,
    eq: ['tenantId', 'customerId', 'open'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  repairItemsByOrder: defineQuery({
    name: 'repairItems.byOrder',
    collection: COL.repairItems,
    eq: ['tenantId', 'orderId'],
    scopeField: 'branchId',
    order: { field: 'seqKey', dir: 'asc', type: 'string' },
  }),
  repairItemsByTechnician: defineQuery({
    name: 'repairItems.byTechnician',
    collection: COL.repairItems,
    eq: ['tenantId', 'technicianId', 'active'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  partRequestsByOrder: defineQuery({
    name: 'partRequests.byOrder',
    collection: COL.partRequests,
    eq: ['tenantId', 'orderId'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  partRequestsByStatus: defineQuery({
    name: 'partRequests.byStatus',
    collection: COL.partRequests,
    eq: ['tenantId', 'status'],
    scopeField: 'branchId',
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  // ---- SYS approvals and ACC slice 1.7: few shapes on purpose (the composite-index budget is 200 per database).
  // The branch is an EQUALITY field here (money screens work in one working branch); the repository checks
  // the Scope against it before querying.
  approvalsByBranchStatus: defineQuery({
    name: 'approvals.byBranchStatus',
    collection: COL.approvals,
    eq: ['tenantId', 'branchId', 'status'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  approvalsByRequester: defineQuery({
    name: 'approvals.byRequester',
    collection: COL.approvals,
    eq: ['tenantId', 'requestedBy'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  // FR-SYS-033 (slice 2.5): a tenant has a handful of delegations; read by tenant, filter in memory.
  // Single-field order (like roles.list): NO composite index.
  approvalDelegationsByTenant: defineQuery({
    name: 'approvalDelegations.byTenant',
    collection: COL.approvalDelegations,
    eq: ['tenantId'],
    order: { field: 'tenantId', dir: 'asc', type: 'string' },
  }),
  paymentsByOrder: defineQuery({
    name: 'payments.byOrder',
    collection: COL.payments,
    eq: ['tenantId', 'orderId'],
    order: { field: 'createdAt', dir: 'asc', type: 'date' },
  }),
  paymentsByBranch: defineQuery({
    name: 'payments.byBranch',
    collection: COL.payments,
    eq: ['tenantId', 'branchId'],
    range: true,
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  cashEntriesByDay: defineQuery({
    name: 'cashEntries.byDay',
    collection: COL.cashEntries,
    eq: ['tenantId', 'branchId', 'businessDate'],
    order: { field: 'seqKey', dir: 'asc', type: 'string' },
  }),
  cashShiftsByBranch: defineQuery({
    name: 'cashShifts.byBranch',
    collection: COL.cashShifts,
    eq: ['tenantId', 'branchId'],
    range: true,
    order: { field: 'openedAt', dir: 'desc', type: 'date' },
  }),
  debtsByBranchStatus: defineQuery({
    name: 'debts.byBranchStatus',
    collection: COL.debts,
    eq: ['tenantId', 'branchId', 'status'],
    order: { field: 'dueDate', dir: 'asc', type: 'string' },
  }),
  // ---- EIN slice 1.8 (R68): ONE query shape and ONE index for the whole slice. Everything else is read by document id:
  // the order -> invoice lookup (`einOrders/<orderId>`), the error queue (`invoiceQueues/<branchId>`), requests and
  // artifacts (deterministic ids). The list is one branch (equality), newest first; status / text filters run in memory
  // over a bounded window (rule 2), so no status / buyer index is needed.
  invoicesByBranch: defineQuery({
    name: 'invoices.byBranch',
    collection: COL.invoices,
    eq: ['tenantId', 'branchId'],
    range: true,
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  /** FR-SYS-007: batch history of ONE branch, newest first (one index); everything else is read by key */
  importBatchesByBranch: defineQuery({
    name: 'importBatches.byBranch',
    collection: COL.importBatches,
    eq: ['tenantId', 'branchId'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  /** FR-SYS-007 R99: batches of ONE branch in one status (the abandoned-dry-run purge), newest first */
  importBatchesByBranchStatus: defineQuery({
    name: 'importBatches.byBranchStatus',
    collection: COL.importBatches,
    eq: ['tenantId', 'branchId', 'status'],
    order: { field: 'createdAt', dir: 'desc', type: 'date' },
  }),
  // ---- HRM slice 2.6a (index budget: ONE composite index for the whole slice) ----
  /** a tenant's staff (a few hundred): ordered by the equality field itself, so no composite index; cut to the scope in memory */
  employees: defineQuery({
    name: 'employees.byTenant',
    collection: COL.employees,
    eq: ['tenantId'],
    order: { field: 'tenantId', dir: 'asc', type: 'string' },
  }),
  /**
   * Labor sheets (one per order) of ONE branch whose last line is at or after a date, newest first. The technician,
   * status and exact period filters run in memory over the lines of this bounded window; by order it is a read by key.
   */
  laborSheetsByBranch: defineQuery({
    name: 'laborSheets.byBranch',
    collection: COL.laborSheets,
    eq: ['tenantId', 'branchId'],
    range: true,
    order: { field: 'recordedAt', dir: 'desc', type: 'date' },
  }),
  /**
   * REC slice 2.8b (FR-REC-019, 027): the calendar of ONE branch over a date range (day or week). ONE composite index
   * (tenantId, branchId, date); status filter and time order run in memory over the bounded window (`appointments.listMax`).
   */
  appointmentsByDate: defineQuery({
    name: 'appointments.byDate',
    collection: COL.appointments,
    eq: ['tenantId', 'branchId'],
    range: true,
    order: { field: 'date', dir: 'asc', type: 'string' },
  }),
  /**
   * REC slice 2.8b / FR-REC-044: appointments of ONE branch in ONE status over a date range, date ascending. Feeds the
   * "Trễ hẹn" tab (pending, every day up to today, not bounded by the viewed day). ONE composite index
   * (tenantId, branchId, status, date); the overdue minute test runs in memory over the bounded window.
   */
  appointmentsByStatus: defineQuery({
    name: 'appointments.byStatus',
    collection: COL.appointments,
    eq: ['tenantId', 'branchId', 'status'],
    range: true,
    order: { field: 'date', dir: 'asc', type: 'string' },
  }),
  /** REC slice 2.8b (FR-REC-018, 036): warranty records of one vehicle in the tenant, newest first (projection P4) */
  warrantiesByVehicle: defineQuery({
    name: 'warranties.byVehicle',
    collection: COL.warranties,
    eq: ['tenantId', 'vehicleId'],
    order: { field: 'startDate', dir: 'desc', type: 'string' },
  }),
};

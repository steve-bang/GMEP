/**
 * CRM module public surface (the only file other modules, composition and infrastructure import).
 * Slice 1.3: customers, vehicles, effective-dated ownership, cross-branch history projection,
 * consents, data-subject requests, exact cross-branch lookup, customer export.
 */
export const MODULE_CODE = 'CRM' as const;

export * from './domain/entities';
export * from './domain/consent';
export * from './domain/dataRequest';
export * from './domain/ownership';
export * from './domain/normalize';
export { ANONYMIZED_NAME, anonymizedPatch } from './domain/anonymize';
export * from './ports/ports';
export { DEFAULT_CRM_CONFIG } from './ports/deps';
export type { CrmConfig, CrmDeps } from './ports/deps';

export {
  listCustomers,
  listCustomerDtos,
  getCustomer,
  createCustomer,
  updateCustomer,
  toCustomerDto,
  searchMode,
} from './application/customers';
export type { CustomerDto } from './application/customers';
export {
  listVehicles,
  getVehicle,
  listCustomerVehicles,
  listVehicleOwnerships,
  createVehicle,
  updateVehicle,
  changePlate,
  changeOwner,
} from './application/vehicles';
export type { VehicleDto, OwnershipDto } from './application/vehicles';
export {
  listConsents,
  recordConsent,
  withdrawConsent,
  selectMarketingAudience,
  listEvidenceKinds,
} from './application/consents';
export type { ConsentDto, AudienceResult, EvidenceKindOption } from './application/consents';
export { recordOdometer } from './application/odometer';
export type { OdometerResult } from './application/odometer';
export { checkOdometer } from './domain/odometer';
export type { OdometerCheck, OdometerReason } from './domain/odometer';
export { listVehicleHistory, toHistoryDto } from './application/history';
export type { HistoryDto } from './application/history';
export { lookupExact, relateToWorkingBranch } from './application/lookup';
export type { LookupResult, CustomerProjection, VehicleProjection } from './application/lookup';
export {
  listDataRequests,
  getDataRequest,
  createDataRequest,
  assignDataRequest,
  closeDataRequest,
} from './application/dataRequests';
export type { DataRequestDto } from './application/dataRequests';
export { exportCustomersCsv } from './application/export';
export { customerPiiSource } from './application/piiSource';
export { buildCustomerImport, CUSTOMER_IMPORT_COLUMNS } from './application/importer';

// slice 2.8b: duplicate suggestions and merge (FR-CRM-003)
export { checkMerge, mergedBranchIds } from './domain/merge';
export type { MergeRefusal } from './domain/merge';
export { listDuplicateCandidates, mergeCustomers } from './application/merge';

/**
 * INV module public surface (the only file other modules, composition and infrastructure import).
 * Slice 1.4: part catalogue, per-warehouse balances with the four numbers, stock documents
 * (GRN, GIN, RTN, ADJ), append-only ledger, reservations, weighted-average cost behind a
 * configurable CostMethod, reorder alert on available.
 *
 * For REC (slices 1.5/1.6): `holdStock` / `holdStockInTx` (reserve, target semantics),
 * `releaseStock` (cancel / reject), `issueForOrder` (GIN for a repair order, consumes the order's
 * hold), `getAvailability` (available only), `reverseDocument` / RTN via `createDocument`.
 */
export const MODULE_CODE = 'INV' as const;

export * from './domain/entities';
export * from './domain/normalize';
export * from './domain/cost';
export * from './domain/reservationEvents';
export {
  InvRuleError,
  applyEffect,
  availableOf,
  issue as issueStock,
  receive as receiveStock,
  planHold,
  holdStatus,
  remainingDemand,
  surplusValue,
  receiveValue,
} from './domain/ledger';
export {
  approvalReasons,
  checkLines,
  checkSource,
  assertTransition,
  DOC_TRANSITIONS,
  varianceBp,
} from './domain/document';
export * from './ports/ports';
export { DEFAULT_INV_CONFIG } from './ports/deps';
export type { InvConfig, InvDeps, OrderAdvisorPort } from './ports/deps';

export {
  listParts,
  getPart,
  createPart,
  updatePart,
  setPartStatus,
  getPartPrices,
  partSearchMode,
  toPartDto,
} from './application/parts';
export type { PartDto, PartPriceDto } from './application/parts';
export { getPartCatalogs, resolveCatalog } from './application/catalog';
export type { CatalogEntry, CatalogKind } from './application/catalog';
export {
  listStock,
  getPartStock,
  listStockCard,
  setStockLevels,
  getAvailability,
  parseAvailabilityQuery,
  toStockDto,
  stockStatus,
} from './application/balances';
export type { StockDto, MovementDto, AvailabilityDto, StockStatus } from './application/balances';
export {
  createDocument,
  updateDocument,
  cancelDocument,
  postDocument,
  reverseDocument,
  issueForOrder,
  getDocument,
  listDocuments,
} from './application/documents';
export type { DocumentDto, DocLineDto } from './application/documents';
export {
  holdStock,
  holdStockInTx,
  holdForApproval,
  holdForApprovalStandalone,
  holdForApprovalSchema,
  releaseStock,
  listOpenReservations,
  listReservationsByPart,
  listReservationsBySource,
  toReservationDto,
} from './application/reservations';
export type {
  ReservationDto,
  HoldInput,
  HoldForApprovalInput,
  OpenReservationDto,
} from './application/reservations';
export { resolveCostMethod } from './application/config';
export { invWarehouseActivity } from './application/warehouseActivity';

/**
 * EIN module public surface (the only file other modules, composition and infrastructure import).
 * Slice 1.8 "Hóa đơn cơ bản": issue from a repair order through the provider-agnostic `EInvoiceProvider` port
 * (FR-EIN-001..004, 011, 013), status sync and local XML/PDF (005, 006), the warning list and the error queue (009, 010),
 * and adjust / replace / cancel with approval (007 minimal). The invoice is its own object with its own states.
 */
export const MODULE_CODE = 'EIN' as const;

export * from './domain/invoice';
export * from './domain/state';
export * from './domain/build';
export * from './domain/eligibility';
export type {
  BuyerSource,
  InvoiceableOrder,
  InvoiceOrderSource,
  InvoiceQueueRepository,
  InvoiceRepository,
  InvoiceRequestRepository,
  OrderInvoiceIndexRepository,
} from './ports/ports';
export * from './ports/provider';
export { DEFAULT_EIN_CONFIG } from './ports/deps';
export type { EinConfig, EinDeps } from './ports/deps';

export { DEFAULT_EIN_POLICY, defaultTaxChangePolicy } from './application/config';
export type { EinPolicy } from './application/config';
export { previewIssue, issueInvoice, issueSchema } from './application/issue';
export type { IssueCheckDto, IssueOutcome } from './application/issue';
export {
  retryRequest,
  fixBuyer,
  cancelRequest,
  syncInvoice,
  runDueRequests,
} from './application/retry';
export {
  requestCorrection,
  executeCorrection,
  reportInvoiceError,
  CORRECTION_REASONS,
} from './application/corrections';
export {
  listInvoices,
  getInvoice,
  readInvoiceFile,
  listWarnings,
  listQueue,
  getConnection,
  hasValidInvoice,
  listOrderInvoices,
  displayStatusOf,
  toInvoiceDto,
} from './application/read';
export type {
  InvoiceDto,
  InvoiceDetailDto,
  InvoiceListDto,
  InvoiceListQuery,
  DisplayStatus,
  QueueRowDto,
  WarningRow,
  WarningsDto,
  ConnectionDto,
  OrderInvoicesDto,
  RequestDto,
} from './application/read';

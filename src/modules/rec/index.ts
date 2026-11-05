/**
 * REC module public surface (the only file other modules, composition and infrastructure import).
 * Slice 1.5: intake (FR-REC-001, 002, 003), quote (FR-REC-004, 005, 007) with its own state machine,
 * versions, priced snapshot and role-limited discounts, and approval (FR-REC-008, 009, 023, 026, 031):
 * customer link, counter approval, approved lines for the repair order. Repair orders and items are
 * slice 1.6 (plan §7) and consume `getApprovedQuote`, `allocateRepairOrderNumber` and `getServiceWorkflow`.
 */
export const MODULE_CODE = 'REC' as const;

export * from './domain/entities';
export {
  transitionQuote,
  transitionIntake,
  isQuoteExpired,
  quoteDuePhase,
  effectiveQuoteStatus,
  editMode,
  allowedQuoteActions,
  allowedIntakeActions,
  QUOTE_TRANSITIONS,
  INTAKE_TRANSITIONS,
  QUOTE_EVENTS,
} from './domain/quoteState';
export type { QuoteEvent, IntakeEvent, Transition, QuoteDuePhase } from './domain/quoteState';
export { runQuoteExpiry } from './application/quoteExpiry';
export type { QuoteExpiryResult } from './application/quoteExpiry';
export {
  computeTotals,
  laborAmount,
  partAmount,
  discountBpOf,
  maxDiscountBp,
  roundDiv,
  defaultSelected,
  taxOf,
  standardHoursDelta,
  PricingError,
} from './domain/pricing';
export { decideApproval, splitGross, approvedLinesOf, lineKeyOf } from './domain/approval';
export type { ApprovalDecision, DeclineInput, GrossSplit, ItemGross } from './domain/approval';
export * from './domain/order';
export * from './domain/orderState';
export { checkKm } from './domain/intake';
export * from './ports/ports';
export { DEFAULT_REC_CONFIG } from './ports/deps';
export type { RecConfig, RecDeps } from './ports/deps';

export {
  listIntakes,
  getIntake,
  createIntake,
  updateIntake,
  completeIntake,
  cancelIntake,
  toIntakeDto,
  listServiceTypes,
} from './application/intakes';
export type { IntakeDto, ServiceTypeOption } from './application/intakes';
export {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  sendQuote,
  rejectQuote,
} from './application/quotes';
export {
  buildQuotePrintModel,
  getQuotePrintModel,
  recordQuotePrint,
  isReprint,
} from './application/quotePrint';
export type { QuotePrintContext } from './application/quotePrint';
export type {
  QuoteDto,
  QuoteDetailDto,
  VersionDto,
  VersionSummaryDto,
  QuoteItemDto,
  QuoteLineDto,
  QuoteWarning,
} from './application/quotes';
export {
  approveQuote,
  issueQuoteLink,
  viewPublicQuote,
  approveViaLink,
  requestQuoteOtp,
  rejectViaLink,
  getApprovedQuote,
  approvalPolicyOf,
  tokenHashOf,
} from './application/approval';
export type {
  ApprovalPolicy,
  ApprovedQuoteDto,
  DeclineReasonOption,
  PublicQuoteDto,
  PublicItemDto,
  PublicLineDto,
  PublicState,
} from './application/approval';
export { sendQuoteLink, runMessageRetry, availableMessageChannels } from './application/messaging';
export type { SendLinkResult, MessageRetryResult } from './application/messaging';
export * from './domain/otp';
export type * from './domain/messaging';
export {
  allocateRepairOrderNumber,
  getServiceWorkflow,
  listServiceWorkflows,
} from './application/orderSupport';
export type { ServiceWorkflowDto, WorkflowStep } from './application/orderSupport';
export { pickServices, pickParts } from './application/catalog';
export { recCustomerRetention } from './application/retention';
export type { ServicePick, PartPick } from './application/catalog';

// ---- slice 1.6: repair order, items, execution, QC, handover --------------------------------------------
export {
  openOrderForQuote,
  afterQuoteApproved,
  createOrderForQuote,
  listOrders,
  getOrder,
  getBoard,
  pauseOrder,
  resumeOrder,
  submitForQc,
  recheckParts,
  cancelOrder,
  cancelOrderSchema,
  toOrderDto,
} from './application/orders';
export type {
  OrderDto,
  OrderDetailDto,
  ItemDto,
  PartRequestDto,
  BoardDto,
  BoardCard,
  OpenedOrder,
} from './application/orders';
export {
  listTechnicians,
  assignTechnician,
  listMyWork,
  itemAction,
  undoItemAction,
  createPartRequest,
  listPartRequests,
  decidePartRequest,
} from './application/workItems';
export type { TechnicianOption, WorkItemDto } from './application/workItems';
export {
  createProposal,
  dismissProposal,
  createSupplementaryQuote,
  appendSupplement,
  prepareCloseSupplements,
  assertSupplementOrderOpen,
} from './application/supplement';
export { addPhoto, hidePhoto, listPhotos, readPhoto, type PhotoParent } from './application/photos';
export {
  getQcChecklist,
  runQc,
  handoverVehicle,
  getHandoverPrint,
  logHandoverPrint,
} from './application/quality';
export type { QcChecklistDto, HandoverPrintDto } from './application/quality';
export { systemActor } from './application/orderHelpers';
export { recOrderAdvisors } from './application/orderAdvisors';

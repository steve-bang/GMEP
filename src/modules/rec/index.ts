/**
 * REC module public surface (the only file other modules, composition and infrastructure import).
 * Slice 1.5 (first part): intake (FR-REC-001, 002, 003) and quote (FR-REC-004, 005, 007) with its own
 * state machine, versions, priced snapshot and role-limited discounts. Repair orders, items,
 * approval, the customer page and printing follow in the next parts (plan §7, rows 1.5 and 1.6).
 */
export const MODULE_CODE = 'REC' as const;

export * from './domain/entities';
export {
  transitionQuote,
  transitionIntake,
  editMode,
  allowedQuoteActions,
  allowedIntakeActions,
  QUOTE_TRANSITIONS,
  INTAKE_TRANSITIONS,
  QUOTE_EVENTS,
} from './domain/quoteState';
export type { QuoteEvent, IntakeEvent, Transition } from './domain/quoteState';
export {
  computeTotals,
  laborAmount,
  partAmount,
  discountBpOf,
  maxDiscountBp,
  roundDiv,
  defaultSelected,
  taxOf,
  PricingError,
} from './domain/pricing';
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
} from './application/intakes';
export type { IntakeDto } from './application/intakes';
export {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  sendQuote,
  rejectQuote,
} from './application/quotes';
export type {
  QuoteDto,
  QuoteDetailDto,
  VersionDto,
  VersionSummaryDto,
  QuoteItemDto,
  QuoteLineDto,
} from './application/quotes';
export { pickServices, pickParts } from './application/catalog';
export type { ServicePick, PartPick } from './application/catalog';

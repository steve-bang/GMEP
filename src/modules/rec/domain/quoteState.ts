import type { IntakeStatus, QuoteStatus } from './entities';

/**
 * Pure state machines (plan §2: `transition(state, event, ctx) -> {state} | Rejection(reasonCode)`).
 * The tables are the single source of `actions.allowed`. Quote and intake are separate objects: the
 * repair order (slice 1.6) has its own table and never shares these states.
 */
export type QuoteEvent = 'send' | 'approve_full' | 'approve_partial' | 'reject' | 'expire';
export const QUOTE_EVENTS: readonly QuoteEvent[] = [
  'send',
  'approve_full',
  'approve_partial',
  'reject',
  'expire',
];

export type Transition<S> = { ok: true; state: S } | { ok: false; reason: string };

export const QUOTE_TRANSITIONS: Readonly<
  Record<QuoteStatus, Partial<Record<QuoteEvent, QuoteStatus>>>
> = {
  draft: { send: 'sent' },
  sent: {
    approve_full: 'approved_full',
    approve_partial: 'approved_partial',
    reject: 'rejected',
    expire: 'expired',
  },
  approved_full: {},
  approved_partial: {},
  rejected: {},
  expired: {},
};

export interface QuoteCtx {
  /** at least one line (FR-REC-004) */
  hasLines?: boolean;
}

export function transitionQuote(
  state: QuoteStatus,
  event: QuoteEvent,
  ctx: QuoteCtx = {},
): Transition<QuoteStatus> {
  const next = QUOTE_TRANSITIONS[state][event];
  if (!next) return { ok: false, reason: 'state_invalid' };
  if (event === 'send' && !ctx.hasLines) return { ok: false, reason: 'quote_empty' };
  return { ok: true, state: next };
}

/**
 * Editing (ba-answers-03 Câu 1): a draft is edited in place; a sent, rejected or expired version
 * is never changed - the edit becomes the next version. Once any item is approved the content is
 * locked and changes go through a supplementary quote (RULE-005/006).
 */
export type EditMode = 'in_place' | 'new_version' | 'locked';
export function editMode(state: QuoteStatus): EditMode {
  if (state === 'draft') return 'in_place';
  if (state === 'sent' || state === 'rejected' || state === 'expired') return 'new_version';
  return 'locked';
}

export type QuoteAction = 'edit' | 'send' | 'reject' | 'revise';
export function allowedQuoteActions(state: QuoteStatus): QuoteAction[] {
  const out: QuoteAction[] = [];
  if (state === 'draft') out.push('edit', 'send');
  if (state === 'sent') out.push('reject');
  if (editMode(state) === 'new_version') out.push('revise');
  return out;
}

// ---- intake -----------------------------------------------------------------------------

export type IntakeEvent = 'complete' | 'cancel';
export const INTAKE_TRANSITIONS: Readonly<
  Record<IntakeStatus, Partial<Record<IntakeEvent, IntakeStatus>>>
> = {
  draft: { complete: 'completed', cancel: 'cancelled' },
  completed: { cancel: 'cancelled' },
  cancelled: {},
};

export function transitionIntake(
  state: IntakeStatus,
  event: IntakeEvent,
  ctx: { hasQuote?: boolean } = {},
): Transition<IntakeStatus> {
  const next = INTAKE_TRANSITIONS[state][event];
  if (!next) return { ok: false, reason: 'state_invalid' };
  // a quote exists for the visit: cancel the quote path first (the order does not exist yet)
  if (event === 'cancel' && state === 'completed' && ctx.hasQuote)
    return { ok: false, reason: 'intake_has_quote' };
  return { ok: true, state: next };
}

export type IntakeAction = 'edit' | 'complete' | 'cancel' | 'quote';
export function allowedIntakeActions(
  state: IntakeStatus,
  ctx: { hasQuote?: boolean } = {},
): IntakeAction[] {
  const out: IntakeAction[] = [];
  if (state === 'draft') out.push('edit', 'complete');
  if (transitionIntake(state, 'cancel', ctx).ok) out.push('cancel');
  if (state === 'completed' && !ctx.hasQuote) out.push('quote');
  return out;
}

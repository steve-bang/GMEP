import type { IntakeStatus, QuoteStatus } from './entities';

/**
 * Pure state machines (plan §2: `transition(state, event, ctx) -> {state} | Rejection(reasonCode)`).
 * The tables are the single source of `actions.allowed`. Quote and intake are separate objects: the
 * repair order (slice 1.6) has its own table and never shares these states.
 */
export type QuoteEvent =
  | 'send'
  | 'approve_full'
  | 'approve_partial'
  | 'reject'
  | 'expire'
  | 'close';
export const QUOTE_EVENTS: readonly QuoteEvent[] = [
  'send',
  'approve_full',
  'approve_partial',
  'reject',
  'expire',
  'close',
];

export type Transition<S> = { ok: true; state: S } | { ok: false; reason: string };

export const QUOTE_TRANSITIONS: Readonly<
  Record<QuoteStatus, Partial<Record<QuoteEvent, QuoteStatus>>>
> = {
  // `close` (R47): a supplementary quote is closed, with a reason, when its repair order completes or is cancelled
  draft: { send: 'sent', close: 'expired' },
  sent: {
    approve_full: 'approved_full',
    approve_partial: 'approved_partial',
    reject: 'rejected',
    expire: 'expired',
    close: 'expired',
  },
  approved_full: {},
  approved_partial: {},
  rejected: {},
  expired: {},
};

export interface QuoteCtx {
  /** at least one line (FR-REC-004) */
  hasLines?: boolean;
  /** R10: the sent version is past its `validUntil` (computed at the moment of the command, not by a job) */
  expired?: boolean;
}

/**
 * R10: "Hết hạn" is derived. A version in `sent` whose `validUntil` is before `today` is expired for
 * every reader and for the approve command, whatever the stored status says; a background job may later
 * store the status and send reminders but is never what makes the rule true.
 */
export function isQuoteExpired(
  state: QuoteStatus,
  validUntil: string | undefined,
  today: string,
): boolean {
  return state === 'sent' && !!validUntil && today > validUntil;
}

export function effectiveQuoteStatus(
  state: QuoteStatus,
  validUntil: string | undefined,
  today: string,
): QuoteStatus {
  return isQuoteExpired(state, validUntil, today) ? 'expired' : state;
}

/** Calendar-day shift of an ISO business date (UTC arithmetic on a date-only string, no time zone involved). */
function shiftIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type QuoteDuePhase = 'expire' | 'remind';

/**
 * R10 / R17 background job, pure selection: what the job must do with a quote of the current version.
 *  - `expire`: stored `sent` and past `validUntil` (same rule as `isQuoteExpired`) -> apply event `expire`;
 *  - `remind`: still valid but `validUntil` is within `leadDays` days (0 = on the last day) and this `validUntil` has not
 *    been reminded yet (`remindedFor` holds the `validUntil` already reminded, so a new version reminds again).
 * Anything else (draft, decided, no validity, already reminded) is left alone, which makes a repeat run a no-op.
 */
export function quoteDuePhase(
  q: { status: QuoteStatus; validUntil?: string | undefined; remindedFor?: string | undefined },
  today: string,
  leadDays: number,
): QuoteDuePhase | null {
  if (q.status !== 'sent' || !q.validUntil) return null;
  if (isQuoteExpired(q.status, q.validUntil, today)) return 'expire';
  if (q.remindedFor === q.validUntil) return null;
  return today >= shiftIsoDate(q.validUntil, -Math.max(0, leadDays)) ? 'remind' : null;
}

export function transitionQuote(
  state: QuoteStatus,
  event: QuoteEvent,
  ctx: QuoteCtx = {},
): Transition<QuoteStatus> {
  const next = QUOTE_TRANSITIONS[state][event];
  if (!next) return { ok: false, reason: 'state_invalid' };
  if (event === 'send' && !ctx.hasLines) return { ok: false, reason: 'quote_empty' };
  // R10 (FR-REC-011): an expired quote cannot be approved; reject stays allowed (the customer said no)
  if ((event === 'approve_full' || event === 'approve_partial') && ctx.expired)
    return { ok: false, reason: 'quote_expired' };
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

export type QuoteAction = 'edit' | 'send' | 'approve' | 'link' | 'reject' | 'revise';
/**
 * `expired` = the derived expiry (R10): a quote past its validity offers a new version, not an approval.
 * `approve` = the counter approval recorded by staff (FR-REC-009, 026); `link` = issue the customer link (FR-REC-008).
 */
export function allowedQuoteActions(state: QuoteStatus, expired = false): QuoteAction[] {
  const out: QuoteAction[] = [];
  if (state === 'draft') out.push('edit', 'send');
  if (state === 'sent' && !expired) out.push('approve', 'link', 'reject');
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

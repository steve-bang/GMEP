import { createHash, randomBytes } from 'node:crypto';
import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import type { AuditEntry } from '@/platform/audit/audit';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { branchesScope, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { notifyUsers, resolveCatalogAt, resolveConfigAt, usersWithRole } from '@/modules/sys';
import {
  versionId,
  type ApprovalMethod,
  type ApprovedLine,
  type DeclinedItem,
  type Quote,
  type QuoteApproval,
  type QuoteItem,
  type QuoteVersion,
} from '../domain/entities';
import { approvedLinesOf, decideApproval, type DeclineInput } from '../domain/approval';
import { isQuoteExpired, transitionQuote } from '../domain/quoteState';
import { otpRequired, type OtpMode } from '../domain/otp';
import { afterQuoteApproved } from './orders';
import { consumeOtp, issueOtp, selectionHashOf, verifyOtp } from './otp';
import { assertSupplementOrderOpen } from './supplement';
import type { RecDeps } from '../ports/deps';
import { loadPublicPhotoSources, toPublicPhotoDto, type PublicPhotoDto } from './publicPhotos';
import {
  assertWritable,
  auditEntry,
  AppError,
  idemOf,
  notFound,
  parseInput,
  requireWorkingBranch,
  roleAtBranch,
  validationFailed,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

/**
 * Quote approval (FR-REC-008, 009, 026; RULE-005, 006, 007). Three ways in, ONE core:
 *  - the customer through a tokenised link (no account);
 *  - staff recording a signature at the counter;
 *  - staff recording a verbal approval (an exception that the manager reviews).
 * The core moves the quote through its state machine, writes the evidence once on the version
 * (content locked from then on), keeps only the approved items for the repair order and notifies the
 * advisor and the branch manager. The order itself is created in slice 1.6 from `getApprovedQuote`.
 */

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
export const tokenHashOf = (token: string): string => sha256(token);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

// ---- policy (config, effective-dated) ----------------------------------------------------------

export interface DeclineReasonOption {
  code: string;
  name: string;
  noteRequired: boolean;
}

export interface ApprovalPolicy {
  allowDeclineRequired: boolean;
  verbalApproval: boolean;
  /** QUO-04/05: when the customer's online approval needs a one-time code */
  otpMode: OtpMode;
  /** `above_threshold`: approved total (tax included) strictly above this, integer VND [Cần xác nhận: Chủ dự án] */
  otpThresholdVnd?: number;
  /** seconds the code stays valid; unset = the REC default (5 minutes) */
  otpTtlSeconds?: number;
  /** R29: above this approved total a verbal approval must be recorded by a manager; unset = no limit */
  verbalApprovalMaxVnd?: number;
  reasons: DeclineReasonOption[];
}

/** Branch override, then company, then the documented default (Câu 2: the customer may refuse a required item). */
export async function approvalPolicyOf(
  deps: RecDeps,
  companyId: string,
  branchId: string,
  date: string,
): Promise<ApprovalPolicy> {
  const cfg = (
    await resolveConfigAt(deps.sys, {
      companyId,
      type: 'quote-approval',
      scopeKey: 'company',
      date,
      branchId,
    })
  )?.payload as Partial<ApprovalPolicy> | undefined;
  const rows = await resolveCatalogAt(deps.sys, { companyId, type: 'decline-reason', date });
  return {
    allowDeclineRequired: cfg?.allowDeclineRequired ?? deps.rec.approval.allowDeclineRequired,
    verbalApproval: cfg?.verbalApproval ?? deps.rec.approval.verbalApproval,
    otpMode: cfg?.otpMode ?? deps.rec.approval.otpMode,
    ...(cfg?.otpThresholdVnd !== undefined ? { otpThresholdVnd: cfg.otpThresholdVnd } : {}),
    ...(cfg?.otpTtlSeconds !== undefined ? { otpTtlSeconds: cfg.otpTtlSeconds } : {}),
    ...(cfg?.verbalApprovalMaxVnd !== undefined
      ? { verbalApprovalMaxVnd: cfg.verbalApprovalMaxVnd }
      : {}),
    reasons: rows
      .filter((r) => r.payload.status !== 'inactive')
      .map((r) => ({
        code: r.code,
        name: String(r.payload.name ?? r.code),
        noteRequired: r.payload.noteRequired === true,
      })),
  };
}

// ---- shared pieces ---------------------------------------------------------------------------

const declineSchema = z.object({
  itemNo: z.number().int().min(1).max(1000),
  reasonCode: z.string().trim().max(30).optional(),
  reasonNote: z.string().trim().max(300).optional(),
});
const selectionShape = {
  /** item numbers the customer approves; everything else is declined */
  selectedItemNos: z.array(z.number().int().min(1).max(1000)).min(1).max(100),
  declines: z.array(declineSchema).max(100).default([]),
};

function decisionOrThrow(
  items: readonly QuoteItem[],
  input: { selectedItemNos: number[]; declines: DeclineInput[] },
  policy: ApprovalPolicy,
) {
  const d = decideApproval(items, input.selectedItemNos, input.declines, {
    allowDeclineRequired: policy.allowDeclineRequired,
    reasonCodes: new Set(policy.reasons.map((r) => r.code)),
  });
  if (!d.ok) {
    const field = d.itemNo ? `declines.${d.itemNo}` : 'selectedItemNos';
    if (d.reason === 'required_item_locked') throw new AppError('required_item_locked', 409);
    throw validationFailed([{ field, message: REASON_TEXT[d.reason] }]);
  }
  // a catch-all reason ("khác") needs its note
  for (const x of d.declined) {
    const r = policy.reasons.find((o) => o.code === x.reasonCode);
    if (r?.noteRequired && !x.reasonNote)
      throw validationFailed([
        { field: `declines.${x.itemNo}`, message: 'Cần ghi chú cho lý do này.' },
      ]);
  }
  return d;
}

const REASON_TEXT = {
  nothing_selected: 'Chọn ít nhất một hạng mục, hoặc từ chối toàn bộ báo giá.',
  unknown_item: 'Hạng mục không có trong phiên bản báo giá này.',
  required_item_locked: 'Hạng mục bắt buộc không được bỏ riêng.',
  decline_reason_missing: 'Hạng mục bắt buộc bị bỏ cần chọn lý do.',
} as const;

interface CoreInput {
  q: Quote;
  cur: QuoteVersion;
  link: { id: string } | null;
  /** the link of the live version when staff decide at the counter: it stops working */
  liveLink: { id: string } | null;
  method: ApprovalMethod;
  recordedBy: string | null;
  /** R29: the role the person acted in at the working branch (CV or QL) */
  recordedByRole?: string;
  decision: Extract<ReturnType<typeof decideApproval>, { ok: true }>;
  extra: Partial<
    Pick<QuoteApproval, 'signerName' | 'evidenceRef' | 'note' | 'readBack' | 'otp'>
  > & {
    exception: boolean;
  };
  actor: Actor | null;
  ctx: RequestCtx;
  recipients: string[];
  now: Date;
}

function evidence(q: Quote, cur: QuoteVersion, a: Omit<QuoteApproval, 'hash'>): QuoteApproval {
  const hash = fingerprintOf({
    number: q.number,
    n: cur.n,
    method: a.method,
    mode: a.mode,
    at: a.decidedAt.toISOString(),
    by: a.recordedBy,
    role: a.recordedByRole ?? null,
    link: a.linkId ?? null,
    // QUO-04/05: a verified one-time code is part of the evidence (only for approvals that needed one: older hashes stay valid)
    ...(a.otp ? { otp: [a.otp.channel, a.otp.verifiedAt.toISOString()] } : {}),
    approved: a.approvedItemNos,
    declined: a.declined.map((d) => [d.itemNo, d.reasonCode ?? null, d.safety]),
    totals: [a.approvedSubtotalVnd, a.approvedTaxVnd, a.approvedTotalVnd],
    lines: a.lines.map((l) => [l.lineKey, l.amountVnd, l.taxRateBp, l.priceVersionId]),
  });
  return { ...a, hash };
}

/** The state machine answers first (expired, decided, draft), before the choice is looked at. */
function assertApprovable(cur: QuoteVersion, today: string): void {
  const t = transitionQuote(cur.status, 'approve_full', {
    expired: isQuoteExpired(cur.status, cur.validUntil, today),
  });
  if (!t.ok) throw new AppError(t.reason, 409);
}

/** Writes the approval: state, evidence, link bookkeeping, audit and notification (inside the caller's transaction). */
function applyApproval(deps: RecDeps, tx: Tx, c: CoreInput) {
  const { q, cur, now } = c;
  const today = businessDate(now);
  const t = transitionQuote(
    cur.status,
    c.decision.mode === 'full' ? 'approve_full' : 'approve_partial',
    {
      expired: isQuoteExpired(cur.status, cur.validUntil, today),
    },
  );
  if (!t.ok) throw new AppError(t.reason, 409);
  const split = c.decision.split;
  const approval = evidence(q, cur, {
    method: c.method,
    mode: c.decision.mode,
    decidedAt: now,
    recordedBy: c.recordedBy,
    ...(c.recordedByRole ? { recordedByRole: c.recordedByRole } : {}),
    ...(c.link ? { linkId: c.link.id.slice(0, 16) } : {}),
    approvedItemNos: c.decision.approved.map((i) => i.no),
    declined: c.decision.declined,
    approvedSubtotalVnd: split.netVnd,
    approvedTaxVnd: split.taxVnd,
    approvedTotalVnd: split.totalVnd,
    lines: approvedLinesOf(q.id, cur.n, c.decision.approved),
    ...(c.extra.signerName ? { signerName: c.extra.signerName } : {}),
    ...(c.extra.evidenceRef ? { evidenceRef: c.extra.evidenceRef } : {}),
    ...(c.extra.note ? { note: c.extra.note } : {}),
    ...(c.extra.readBack !== undefined ? { readBack: c.extra.readBack } : {}),
    ...(c.extra.otp ? { otp: c.extra.otp } : {}),
    exception: c.extra.exception,
  });
  const by = c.recordedBy ?? 'customer-link';
  deps.versions.update(tx, cur.id, {
    status: t.state,
    approval,
    updatedAt: now,
    updatedBy: by,
    version: cur.version + 1,
  });
  deps.quotes.update(tx, q.id, {
    status: t.state,
    approvedTotalVnd: split.totalVnd,
    updatedAt: now,
    updatedBy: by,
    version: q.version + 1,
  });
  if (c.link) deps.links.update(tx, c.link.id, { usedAt: now });
  else if (c.liveLink)
    deps.links.update(tx, c.liveLink.id, { revokedAt: now, revokedReason: 'decided_at_counter' });
  const entry = decisionAudit(deps, c, t.state, approval);
  deps.sys.audit.record(tx, entry);
  if (c.recipients.length > 0)
    notifyUsers(deps.sys, tx, {
      companyId: q.companyId,
      userIds: c.recipients,
      kind: 'rec.quote_decided',
      titleKey: c.extra.exception
        ? 'notifications.quoteApprovedVerbal'
        : c.decision.mode === 'full'
          ? 'notifications.quoteApprovedFull'
          : 'notifications.quoteApprovedPartial',
      // no names, phones or addresses in a notification (BA §7.1)
      params: { number: q.number, n: String(cur.n) },
      link: `/rec/quotes/${q.id}`,
      branchId: q.branchId,
    });
  return { status: t.state, approval };
}

function decisionAudit(
  deps: RecDeps,
  c: CoreInput,
  status: string,
  approval: QuoteApproval,
): AuditEntry {
  const base = {
    branchId: c.q.branchId,
    entityType: 'quote',
    entityId: c.q.id,
    action: `quote.approve_${c.method}`,
    before: { n: c.cur.n, status: c.cur.status },
    after: {
      n: c.cur.n,
      status,
      method: approval.method,
      mode: approval.mode,
      approvedItems: approval.approvedItemNos,
      declinedItems: approval.declined.map((d) => ({
        itemNo: d.itemNo,
        reasonCode: d.reasonCode ?? null,
        safety: d.safety,
      })),
      approvedTotalVnd: approval.approvedTotalVnd,
      hash: approval.hash,
      exception: approval.exception,
      // the code itself is never recorded; only that it was verified and over which channel
      ...(approval.otp ? { otpVerified: true, otpChannel: approval.otp.channel } : {}),
    },
    ...(c.extra.note ? { reason: c.extra.note } : {}),
  };
  if (c.actor) return auditEntry(deps.sys, c.actor, c.ctx, base);
  // the customer acting through the link has no account: the actor is the link, never a person
  return {
    id: deps.sys.newId(),
    at: c.now,
    companyId: c.q.companyId,
    branchId: c.q.branchId,
    actorId: `customer-link:${c.link!.id.slice(0, 16)}`,
    actorRoles: ['customer-link'],
    actorType: 'customer-link',
    entityType: base.entityType,
    entityId: base.entityId,
    action: base.action,
    before: base.before,
    after: base.after,
    requestId: c.ctx.requestId,
  };
}

/** Advisor and branch managers, minus the person acting; read before the transaction's first write. */
async function recipientsOf(deps: RecDeps, q: Quote, exceptId: string | null): Promise<string[]> {
  const managers = await usersWithRole(deps.sys, q.companyId, ['QL'], q.branchId);
  return [...new Set([q.advisorId, ...managers])].filter((id) => id !== exceptId);
}

// ---- staff: counter approval (FR-REC-009, 026) -------------------------------------------------

export const approveQuoteSchema = z.object({
  /** version of the quote head (optimistic lock) */
  version: z.number().int().min(1),
  method: z.enum(['counter_signature', 'counter_verbal']),
  ...selectionShape,
  signerName: z.string().trim().min(2).max(120).optional(),
  evidenceRef: z.string().trim().min(1).max(60).optional(),
  note: z.string().trim().max(500).optional(),
  readBack: z.boolean().optional(),
});

/**
 * Staff records the approval the customer gave at the counter. Signature: who signed (and a paper
 * reference); verbal: a note and the read-back tick are mandatory and the approval is an exception
 * the manager reviews (FR-REC-026, QUO-05). Idempotent by key; a second approval of an already approved
 * version is refused (409 `state_invalid`), never a second effect.
 */
export async function approveQuote(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'quote:approve');
  const data = parseInput(approveQuoteSchema, input);
  const head = await deps.quotes.get(scope, id);
  if (!head) throw notFound();
  const today = businessDate(deps.sys.clock.now());
  const policy = await approvalPolicyOf(deps, actor.companyId, head.branchId, today);
  const errors: { field: string; message: string }[] = [];
  if (data.method === 'counter_signature' && !data.signerName)
    errors.push({ field: 'signerName', message: 'Ghi họ tên người ký.' });
  if (data.method === 'counter_verbal') {
    if (!policy.verbalApproval) throw new AppError('verbal_approval_disabled', 409);
    if ((data.note ?? '').length < deps.rec.verbalNoteMinLength)
      errors.push({
        field: 'note',
        message: `Ghi chú xác nhận bằng lời tối thiểu ${deps.rec.verbalNoteMinLength} ký tự.`,
      });
    if (data.readBack !== true)
      errors.push({
        field: 'readBack',
        message: 'Tick xác nhận đã đọc lại hạng mục và tổng tiền.',
      });
  }
  if (errors.length > 0) throw validationFailed(errors);
  const recipients = await recipientsOf(deps, head, actor.userId);
  const done = await runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/quotes/${id}/approve`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const q = await deps.quotes.getInTx(tx, scope, id);
      if (!q) throw notFound();
      if (q.version !== data.version) throw versionConflict();
      await assertWritable(deps, tx, actor, scope, q.branchId, 'edit_open_order');
      if (q.branchId !== requireWorkingBranch(actor)) throw notFound();
      // R47: no approval for a supplement whose order has closed (same transaction as the approval itself)
      await assertSupplementOrderOpen(deps, tx, scope, q);
      const cur = await deps.versions.getInTx(tx, scope, versionId(id, q.currentN));
      if (!cur) throw notFound();
      const live = cur.linkHash ? await deps.links.findInTx(tx, cur.linkHash) : null;
      assertApprovable(cur, businessDate(deps.sys.clock.now()));
      const decision = decisionOrThrow(cur.items, data, policy);
      // R29: above the optional threshold only a manager may record a verbal approval
      if (
        data.method === 'counter_verbal' &&
        policy.verbalApprovalMaxVnd !== undefined &&
        decision.split.totalVnd > policy.verbalApprovalMaxVnd &&
        !hasPermission(actor, 'quote-verbal-over-limit:approve')
      )
        throw new AppError('verbal_needs_manager', 409);
      const now = deps.sys.clock.now();
      const r = applyApproval(deps, tx, {
        q,
        cur,
        link: null,
        liveLink: live && !live.revokedAt ? live : null,
        method: data.method,
        recordedBy: actor.userId,
        recordedByRole: roleAtBranch(actor, 'quote:approve', q.branchId),
        decision,
        extra: {
          ...(data.signerName ? { signerName: data.signerName } : {}),
          ...(data.evidenceRef ? { evidenceRef: data.evidenceRef } : {}),
          ...(data.note ? { note: data.note } : {}),
          ...(data.readBack !== undefined ? { readBack: data.readBack } : {}),
          exception: data.method === 'counter_verbal',
        },
        actor,
        ctx,
        recipients,
        now,
      });
      return {
        status: 200,
        body: {
          id: q.id,
          number: q.number,
          n: cur.n,
          status: r.status,
          mode: r.approval.mode,
          approvedTotalVnd: r.approval.approvedTotalVnd,
          hash: r.approval.hash,
        },
      };
    },
  );
  // R37: the approval has committed; now the order and the stock hold (a failure here never undoes the approval)
  const order = await afterQuoteApproved(deps, head, actor, ctx);
  return order
    ? {
        ...done,
        response: {
          ...done.response,
          body: {
            ...(done.response.body as Record<string, unknown>),
            orderId: order.orderId,
            orderNumber: order.number,
            unmetLines: order.unmetLines,
          },
        },
      }
    : done;
}

// ---- staff: customer link (FR-REC-008) -----------------------------------------------------------

/**
 * Revokes the previous link of the version and stores the new one (hash only). Reads the old link first (Firestore
 * transaction rule), then writes. Shared by "create link" and "send link" (A4); the caller writes the audit entry.
 */
export async function replaceQuoteLink(
  deps: RecDeps,
  tx: Tx,
  a: { q: Quote; cur: QuoteVersion; now: Date; by: string; hash: string },
): Promise<{ replaced: boolean }> {
  const { q, cur, now, by, hash } = a;
  const old = cur.linkHash ? await deps.links.findInTx(tx, cur.linkHash) : null;
  if (old && !old.revokedAt)
    deps.links.update(tx, old.id, { revokedAt: now, revokedReason: 'replaced' });
  deps.links.create(tx, {
    id: hash,
    companyId: q.companyId,
    branchId: q.branchId,
    quoteId: q.id,
    n: cur.n,
    createdAt: now,
    createdBy: by,
  });
  deps.versions.update(tx, cur.id, {
    linkHash: hash,
    sentVia: cur.sentVia && cur.sentVia !== 'none' ? cur.sentVia : 'link',
    version: cur.version + 1,
    updatedAt: now,
    updatedBy: by,
  });
  return { replaced: !!old };
}

export const issueLinkSchema = z.object({ version: z.number().int().min(1) });

/**
 * Issues the login-free link of the CURRENT sent version. The token is random (>= 128 bit), only its
 * SHA-256 is stored, and the raw value is returned exactly once. Issuing again replaces the link: the old
 * one stops working at once. The link lives as long as the version's validity and dies when the version
 * is superseded, decided or expires (checked on every use).
 */
export async function issueQuoteLink(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
) {
  const scope = resolveScope(actor, 'quote:update');
  const data = parseInput(issueLinkSchema, input);
  const token = randomBytes(deps.rec.linkTokenBytes).toString('base64url');
  const hash = tokenHashOf(token);
  return deps.sys.uow.run(async (tx) => {
    const q = await deps.quotes.getInTx(tx, scope, id);
    if (!q) throw notFound();
    if (q.version !== data.version) throw versionConflict();
    await assertWritable(deps, tx, actor, scope, q.branchId, 'edit_open_order');
    const cur = await deps.versions.getInTx(tx, scope, versionId(id, q.currentN));
    if (!cur) throw notFound();
    const now = deps.sys.clock.now();
    const today = businessDate(now);
    if (cur.status !== 'sent') throw new AppError('state_invalid', 409);
    if (isQuoteExpired(cur.status, cur.validUntil, today)) throw new AppError('quote_expired', 409);
    const { replaced } = await replaceQuoteLink(deps, tx, {
      q,
      cur,
      now,
      by: actor.userId,
      hash,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: q.branchId,
        entityType: 'quote',
        entityId: q.id,
        action: 'quote.link_issue',
        // the token is a secret: only a short fingerprint of its hash is logged
        after: { n: cur.n, link: hash.slice(0, 8), replaced },
      }),
    );
    return { token, path: `/b/${token}`, n: cur.n, validUntil: cur.validUntil ?? null };
  });
}

// ---- customer: the public page (FR-REC-008, 009) --------------------------------------------------

export type PublicState = 'open' | 'approved' | 'rejected' | 'expired' | 'superseded';

export interface PublicLineDto {
  kind: 'labor' | 'part';
  name: string;
  /** minutes for labor, stored quantity for parts */
  qty: number;
  qtyScale: number;
  unitVnd: number;
  amountVnd: number;
  taxRateBp: number;
}
export interface PublicItemDto {
  no: number;
  name: string;
  necessity: 'required' | 'optional';
  customerRequested: boolean;
  /** pre-ticked: required items, and optional ones the customer asked for (Câu 2) */
  defaultSelected: boolean;
  lines: PublicLineDto[];
}

/** Everything the customer page may show. No phone, address, cost, list price, stock or staff names. */
export interface PublicQuoteDto {
  state: PublicState;
  number: string;
  n: number;
  branchName: string;
  plate: string;
  vehicleLabel: string;
  /** given name only (the last word of the full name) */
  customerGivenName: string;
  validUntil: string | null;
  items: PublicItemDto[];
  /** FR-REC-034: information only; shown with the items, empty when the quote shows none */
  photos: PublicPhotoDto[];
  policy: { allowDeclineRequired: boolean; reasons: DeclineReasonOption[] };
  /** only for state = approved */
  approved: null | {
    mode: 'full' | 'partial';
    decidedAt: string;
    itemNos: number[];
    totalVnd: number;
    taxVnd: number;
  };
}

const given = (full: string): string => full.trim().split(/\s+/).at(-1) ?? '';

export interface Resolved {
  link: NonNullable<Awaited<ReturnType<RecDeps['links']['find']>>>;
  scope: Scope;
  q: Quote;
  cur: QuoteVersion;
  state: PublicState;
}

/** R34: the limits come from the `public-rate-limit` config when one is in force, else the built-in defaults. */
async function publicLimits(deps: RecDeps, companyId: string) {
  const c = (
    await resolveConfigAt(deps.sys, {
      companyId,
      type: 'public-rate-limit',
      scopeKey: 'company',
      date: businessDate(deps.sys.clock.now()),
    })
  )?.payload as
    | {
        viewLimit: number;
        viewWindowSeconds: number;
        decideLimit: number;
        decideWindowMinutes: number;
      }
    | undefined;
  return c
    ? {
        view: { limit: c.viewLimit, windowMs: c.viewWindowSeconds * 1000 },
        decide: { limit: c.decideLimit, windowMs: c.decideWindowMinutes * 60_000 },
      }
    : { view: undefined, decide: undefined };
}

async function throttle(
  deps: RecDeps,
  address: string,
  hash: string,
  decide: boolean,
  companyId: string | null,
) {
  // per address (generous: a counter's Wi-Fi shares one address) and per token; a decision is also tight per token
  const lim = companyId
    ? await publicLimits(deps, companyId)
    : { view: undefined, decide: undefined };
  await deps.sys.limiter.hit('customer-link', `ip:${address}`, lim.view);
  await deps.sys.limiter.hit('customer-link', `tok:${hash.slice(0, 24)}`, lim.view);
  if (decide)
    await deps.sys.limiter.hit('customer-link-decide', `tok:${hash.slice(0, 24)}`, lim.decide);
}

/** Unknown, revoked and malformed tokens look identical (404) so a token cannot be probed. */
export async function resolveLink(
  deps: RecDeps,
  token: string,
  address: string,
  decide = false,
): Promise<Resolved> {
  const hash = tokenHashOf(token);
  const wellFormed = TOKEN_PATTERN.test(token);
  const link = wellFormed ? await deps.links.find(hash) : null;
  // the same throttle applies to unknown and known tokens so a token cannot be probed (R34: numbers from config)
  await throttle(deps, address, hash, decide, link?.companyId ?? null);
  if (!link || link.revokedAt) throw notFound();
  const scope = branchesScope(link.companyId, [link.branchId]);
  const q = await deps.quotes.get(scope, link.quoteId);
  if (!q) throw notFound();
  const cur = await deps.versions.get(scope, versionId(q.id, link.n));
  if (!cur) throw notFound();
  const state = publicStateOf(q, cur, businessDate(deps.sys.clock.now()));
  // R38: an expired link is read-only; a decision looks exactly like an unknown link
  if (decide && state === 'expired') throw notFound();
  return { link, scope, q, cur, state };
}

function publicStateOf(q: Quote, cur: QuoteVersion, today: string): PublicState {
  if (cur.status === 'approved_full' || cur.status === 'approved_partial') return 'approved';
  if (cur.status === 'rejected') return 'rejected';
  if (q.currentN !== cur.n || cur.replacedByN !== undefined) return 'superseded';
  if (cur.status === 'expired' || isQuoteExpired(cur.status, cur.validUntil, today))
    return 'expired';
  return cur.status === 'sent' ? 'open' : 'superseded';
}

export async function viewPublicQuote(
  deps: RecDeps,
  token: string,
  ctx: { address: string },
): Promise<PublicQuoteDto> {
  const r = await resolveLink(deps, token, ctx.address);
  const today = businessDate(deps.sys.clock.now());
  const branch = await deps.sys.branches.get(r.scope, r.q.branchId);
  const policy = await approvalPolicyOf(deps, r.q.companyId, r.q.branchId, today);
  // a superseded / expired / decided link reveals no content beyond what the customer already saw
  const showItems = r.state === 'open' || r.state === 'approved';
  const a = r.cur.approval;
  return {
    state: r.state,
    number: r.q.number,
    n: r.cur.n,
    branchName: branch?.name ?? '',
    plate: r.q.plate,
    vehicleLabel: r.q.vehicleLabel,
    customerGivenName: given(r.q.customerName),
    validUntil: r.cur.validUntil ?? null,
    items: showItems
      ? r.cur.items.map((i) => ({
          no: i.no,
          name: i.name,
          necessity: i.necessity,
          customerRequested: i.customerRequested,
          defaultSelected: i.selected,
          lines: i.lines.map((l) => ({
            kind: l.kind,
            name: l.name,
            qty: l.kind === 'labor' ? l.minutes : l.qty,
            qtyScale: l.kind === 'labor' ? 60 : l.qtyScale,
            unitVnd: l.unitVnd,
            amountVnd: l.amountVnd,
            taxRateBp: l.taxRateBp,
          })),
        }))
      : [],
    photos: showItems
      ? (await loadPublicPhotoSources(deps, r.scope, r.q)).map(toPublicPhotoDto)
      : [],
    policy: { allowDeclineRequired: policy.allowDeclineRequired, reasons: policy.reasons },
    approved:
      r.state === 'approved' && a
        ? {
            mode: a.mode,
            decidedAt: a.decidedAt.toISOString(),
            itemNos: a.approvedItemNos,
            totalVnd: a.approvedTotalVnd,
            taxVnd: a.approvedTaxVnd,
          }
        : null,
  };
}

export const linkApproveSchema = z.object({
  ...selectionShape,
  /** QUO-04/05: the 6-digit code, when the policy asks for one */
  otp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
const otpRequestSchema = z.object(selectionShape);
export const linkRejectSchema = z.object({ reason: z.string().trim().min(3).max(300).optional() });

/**
 * The customer approves the items they ticked (FR-REC-009). Idempotent twice over: the HTTP key caches
 * the response, and even with a different key a repeat of the SAME selection on an already approved
 * version returns the stored result with no second effect (a double tap, a retry after a timeout);
 * a different selection is a conflict (409 `quote_already_decided`).
 */
export async function approveViaLink(
  deps: RecDeps,
  token: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string; address: string },
) {
  const { otp, ...data } = parseInput(linkApproveSchema, input);
  const r0 = await resolveLink(deps, token, ctx.address, true);
  const policy = await approvalPolicyOf(
    deps,
    r0.q.companyId,
    r0.q.branchId,
    businessDate(deps.sys.clock.now()),
  );
  const recipients = await recipientsOf(deps, r0.q, null);
  // QUO-04/05: when the approved total needs a code it must be verified BEFORE the approval transaction (a wrong try
  // is counted in its own transaction). An already approved version skips this: a repeat or replay needs no code.
  const otpSelection = selectionHashOf(r0.cur.n, data.selectedItemNos);
  if (r0.state === 'open' && !r0.cur.approval) {
    const d0 = decisionOrThrow(r0.cur.items, data, policy);
    if (otpRequired(policy.otpMode, policy.otpThresholdVnd, d0.split.totalVnd)) {
      if (!otp) throw new AppError('otp_required', 428);
      await verifyOtp(
        deps,
        { link: r0.link, n: r0.cur.n, selectionHash: otpSelection, code: otp },
        ctx,
      );
    }
  }
  const done = await runIdempotent(
    idemOf(deps),
    {
      userId: `link:${r0.link.id.slice(0, 16)}`,
      route: 'POST /api/v1/rec/public/quote/approve',
      key: ctx.idempotencyKey,
      // the code is not part of the fingerprint: a retry with the same key replays whatever the code was
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const link = await deps.links.findInTx(tx, r0.link.id);
      if (!link || link.revokedAt) throw notFound();
      const q = await deps.quotes.getInTx(tx, r0.scope, link.quoteId);
      const cur = q ? await deps.versions.getInTx(tx, r0.scope, versionId(q.id, link.n)) : null;
      if (!q || !cur) throw notFound();
      const now = deps.sys.clock.now();
      if (!cur.approval) await assertSupplementOrderOpen(deps, tx, r0.scope, q);
      if (cur.approval) {
        // already decided: the same selection is a repeat, anything else a conflict
        const same =
          cur.approval.method === 'link' &&
          cur.approval.linkId === link.id.slice(0, 16) &&
          sameSet(cur.approval.approvedItemNos, data.selectedItemNos);
        if (!same) throw new AppError('quote_already_decided', 409);
        return { status: 200, body: approvedBody(q, cur, cur.approval, true) };
      }
      if (q.currentN !== cur.n || cur.replacedByN !== undefined)
        throw new AppError('quote_superseded', 409);
      assertApprovable(cur, businessDate(now));
      const decision = decisionOrThrow(cur.items, data, policy);
      // the code verified above is consumed here (read before the first write); it must match this selection
      const otpEvidence = otpRequired(
        policy.otpMode,
        policy.otpThresholdVnd,
        decision.split.totalVnd,
      )
        ? await consumeOtp(deps, tx, {
            linkId: link.id,
            n: cur.n,
            selectionHash: otpSelection,
            now,
          })
        : null;
      const res = applyApproval(deps, tx, {
        q,
        cur,
        link,
        liveLink: null,
        method: 'link',
        recordedBy: null,
        decision,
        extra: { exception: false, ...(otpEvidence ? { otp: otpEvidence } : {}) },
        actor: null,
        ctx,
        recipients,
        now,
      });
      return { status: 200, body: approvedBody(q, cur, res.approval, false) };
    },
  );
  // R37: no staff member is present, so the order is opened by the system on the customer's approval
  await afterQuoteApproved(deps, r0.q, null, ctx);
  return done;
}

/**
 * The customer asks for the one-time code (QUO-04/05). The code goes to the contact on file, never to anything typed on
 * this page. `required: false` when the approved total of this selection does not need one. Asking again for the same
 * selection inside the cooldown sends nothing new (a double tap); limits per link and per address apply.
 */
export async function requestQuoteOtp(
  deps: RecDeps,
  token: string,
  input: unknown,
  ctx: RequestCtx & { address: string },
) {
  const data = parseInput(otpRequestSchema, input);
  const r = await resolveLink(deps, token, ctx.address);
  // only an open version can still be approved; anything else answers like an unknown link (R38)
  if (r.state !== 'open') throw notFound();
  const policy = await approvalPolicyOf(
    deps,
    r.q.companyId,
    r.q.branchId,
    businessDate(deps.sys.clock.now()),
  );
  const d = decisionOrThrow(r.cur.items, data, policy);
  if (!otpRequired(policy.otpMode, policy.otpThresholdVnd, d.split.totalVnd))
    return { required: false as const };
  const out = await issueOtp(
    deps,
    {
      link: r.link,
      customerId: r.q.customerId,
      n: r.cur.n,
      selectionHash: selectionHashOf(r.cur.n, data.selectedItemNos),
      address: ctx.address,
      ...(policy.otpTtlSeconds ? { ttlSeconds: policy.otpTtlSeconds } : {}),
    },
    ctx,
  );
  return {
    required: true as const,
    sent: out.sent,
    channel: out.channel,
    destination: out.destination,
    expiresAt: out.codeExpiresAt.toISOString(),
    resendAfter: out.resendAfter.toISOString(),
  };
}

const sameSet = (a: readonly number[], b: readonly number[]): boolean => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((n) => y.has(n));
};

function approvedBody(q: Quote, cur: QuoteVersion, a: QuoteApproval, replay: boolean) {
  return {
    number: q.number,
    n: cur.n,
    state: 'approved',
    mode: a.mode,
    approvedTotalVnd: a.approvedTotalVnd,
    approvedTaxVnd: a.approvedTaxVnd,
    itemNos: a.approvedItemNos,
    repeated: replay,
  };
}

/** "Từ chối toàn bộ báo giá" on the customer page: always the whole quote (Câu 2). */
export async function rejectViaLink(
  deps: RecDeps,
  token: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string; address: string },
) {
  const data = parseInput(linkRejectSchema, input);
  const r0 = await resolveLink(deps, token, ctx.address, true);
  const recipients = await recipientsOf(deps, r0.q, null);
  return runIdempotent(
    idemOf(deps),
    {
      userId: `link:${r0.link.id.slice(0, 16)}`,
      route: 'POST /api/v1/rec/public/quote/reject',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const link = await deps.links.findInTx(tx, r0.link.id);
      if (!link || link.revokedAt) throw notFound();
      const q = await deps.quotes.getInTx(tx, r0.scope, link.quoteId);
      const cur = q ? await deps.versions.getInTx(tx, r0.scope, versionId(q.id, link.n)) : null;
      if (!q || !cur) throw notFound();
      if (cur.status === 'rejected' && cur.rejectedBy === null)
        return {
          status: 200,
          body: { number: q.number, n: cur.n, state: 'rejected', repeated: true },
        };
      if (q.currentN !== cur.n || cur.replacedByN !== undefined)
        throw new AppError('quote_superseded', 409);
      const now = deps.sys.clock.now();
      const t = transitionQuote(cur.status, 'reject');
      if (!t.ok) throw new AppError(cur.approval ? 'quote_already_decided' : t.reason, 409);
      const reason = data.reason ?? 'Khách từ chối qua liên kết';
      deps.versions.update(tx, cur.id, {
        status: t.state,
        rejectedAt: now,
        rejectReason: reason,
        rejectedBy: null,
        updatedAt: now,
        updatedBy: 'customer-link',
        version: cur.version + 1,
      });
      deps.quotes.update(tx, q.id, {
        status: t.state,
        updatedAt: now,
        updatedBy: 'customer-link',
        version: q.version + 1,
      });
      deps.links.update(tx, link.id, { usedAt: now });
      deps.sys.audit.record(tx, {
        id: deps.sys.newId(),
        at: now,
        companyId: q.companyId,
        branchId: q.branchId,
        actorId: `customer-link:${link.id.slice(0, 16)}`,
        actorRoles: ['customer-link'],
        actorType: 'customer-link',
        entityType: 'quote',
        entityId: q.id,
        action: 'quote.reject_link',
        before: { n: cur.n, status: cur.status },
        after: { n: cur.n, status: t.state },
        reason,
        requestId: ctx.requestId,
      });
      if (recipients.length > 0)
        notifyUsers(deps.sys, tx, {
          companyId: q.companyId,
          userIds: recipients,
          kind: 'rec.quote_decided',
          titleKey: 'notifications.quoteRejected',
          params: { number: q.number, n: String(cur.n) },
          link: `/rec/quotes/${q.id}`,
          branchId: q.branchId,
        });
      return {
        status: 200,
        body: { number: q.number, n: cur.n, state: 'rejected', repeated: false },
      };
    },
  );
}

// ---- for slice 1.6: the approved lines -------------------------------------------------------------

export interface ApprovedQuoteDto {
  quoteId: string;
  number: string;
  versionN: number;
  branchId: string;
  intakeId: string;
  vehicleId: string;
  customerId: string;
  advisorId: string;
  approvedAt: string;
  method: ApprovalMethod;
  mode: 'full' | 'partial';
  /** tax-inclusive total of the approved items (what the order is worth) */
  approvedTotalVnd: number;
  approvedSubtotalVnd: number;
  approvedTaxVnd: number;
  /** evidence fingerprint to quote on the order */
  evidenceHash: string;
  /** only approved lines; each carries the immutable `lineKey` (I20), price version and tax key */
  lines: ApprovedLine[];
  /** declined items stay for the reminder list (BR-REC-11); they are NOT part of the order */
  declined: DeclinedItem[];
}

/**
 * The application-level hand-over to the repair order (slice 1.6, RULE-005/007): approved lines of the
 * approved version with their price and tax snapshot. Reads with the caller's Scope; a quote that is
 * not approved (or is out of scope) yields 404 / 409.
 */
export async function getApprovedQuote(
  deps: RecDeps,
  actor: Actor,
  quoteId: string,
): Promise<ApprovedQuoteDto> {
  const scope = resolveScope(actor, 'quote:view');
  const q = await deps.quotes.get(scope, quoteId);
  if (!q) throw notFound();
  const versions = await deps.versions.listByQuote(scope, quoteId, q.currentN);
  const v = versions.find((x) => x.approval);
  if (!v?.approval) throw new AppError('quote_not_approved', 409);
  const a = v.approval;
  return {
    quoteId: q.id,
    number: q.number,
    versionN: v.n,
    branchId: q.branchId,
    intakeId: q.intakeId,
    vehicleId: q.vehicleId,
    customerId: q.customerId,
    advisorId: q.advisorId,
    approvedAt: a.decidedAt.toISOString(),
    method: a.method,
    mode: a.mode,
    approvedTotalVnd: a.approvedTotalVnd,
    approvedSubtotalVnd: a.approvedSubtotalVnd,
    approvedTaxVnd: a.approvedTaxVnd,
    evidenceHash: a.hash,
    lines: a.lines,
    declined: a.declined,
  };
}

/** Approval evidence for the staff detail screen (QUO-03): who/when/how, never the link or token. */
export function toApprovalDto(a: QuoteApproval, recordedByName: string | null) {
  return {
    method: a.method,
    mode: a.mode,
    decidedAt: a.decidedAt.toISOString(),
    recordedBy: a.recordedBy,
    recordedByRole: a.recordedByRole ?? null,
    recordedByName,
    approvedItemNos: a.approvedItemNos,
    declined: a.declined,
    approvedSubtotalVnd: a.approvedSubtotalVnd,
    approvedTaxVnd: a.approvedTaxVnd,
    approvedTotalVnd: a.approvedTotalVnd,
    signerName: a.signerName ?? null,
    evidenceRef: a.evidenceRef ?? null,
    note: a.note ?? null,
    readBack: a.readBack ?? null,
    exception: a.exception,
    /** QUO-04/05: a one-time code was verified (never the code itself) */
    otp: a.otp ? { channel: a.otp.channel, verifiedAt: a.otp.verifiedAt.toISOString() } : null,
    hash: a.hash,
  };
}

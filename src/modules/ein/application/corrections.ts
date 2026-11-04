import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import {
  allocateDocumentNumber,
  approvalLimitsOf,
  consumeApprovalInTx,
  loadApprovalForUse,
  notifyUsers,
  openApprovalInTx,
  reauthenticate,
  usersWithRole,
  type ApprovalKind,
} from '@/modules/sys';
import { buildAdjustmentContent } from '../domain/build';
import { checkEligibility, mergeBuyer } from '../domain/eligibility';
import {
  correctionRequestId,
  idempotencyKeyOf,
  invoiceIdOf,
  type Invoice,
  type InvoicePurpose,
  type InvoiceRequest,
} from '../domain/invoice';
import { isOpenRequest } from '../domain/state';
import type { EinDeps } from '../ports/deps';
import { einPolicyOf } from './config';
import { dispatchRequest } from './dispatch';
import { buyerOverrideSchema } from './issue';
import { queueWith, readQueue } from './queue';
import {
  AppError,
  assertWritable,
  auditEntry,
  einBranch,
  idemOf,
  notFound,
  parseInput,
  z,
  type RequestCtx,
} from './support';

/**
 * Adjust, replace, cancel an ISSUED invoice (FR-EIN-007, BR-EIN-02; UAT-08, minimal). The original is never edited. The accountant
 * proposes with a reason; a different person holding the chief-accountant right (`invoice:approve`) decides in the SYS approval
 * workflow; only then is anything sent to the provider, by the proposer, once (the approval is consumed once). A cancel also
 * asks for the password again (step-up, ba-answers §1). The thirteen wrong-invoice cases of Thông tư 91/2026 are
 * [Cần kế toán xác nhận]; this slice supports three: amounts (adjust), buyer or other data (replace), invalid (cancel).
 */

export const CORRECTION_REASONS = [
  'buyer_info',
  'amounts',
  'tax_rate',
  'duplicate',
  'other',
] as const;

const KIND_OF: Record<Exclude<InvoicePurpose, 'issue'>, ApprovalKind> = {
  adjust: 'invoice_adjust',
  replace: 'invoice_replace',
  cancel: 'invoice_cancel',
};

export const correctionSchema = z
  .object({
    purpose: z.enum(['adjust', 'replace', 'cancel']),
    reasonCode: z.enum(CORRECTION_REASONS),
    reason: z.string().trim().min(5).max(300),
    /** replace: the corrected buyer fields */
    buyer: buyerOverrideSchema.optional(),
    /** adjust: signed amounts per tax rate of the original (index into its tax summary); at least one non-zero */
    deltas: z
      .array(
        z.object({
          rateIndex: z.number().int().min(0).max(9),
          description: z.string().trim().min(2).max(200),
          netVnd: z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000),
        }),
      )
      .max(6)
      .optional(),
  })
  .strict();
export type CorrectionInput = z.infer<typeof correctionSchema>;

export async function requestCorrection(
  deps: EinDeps,
  actor: Actor,
  invoiceId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'invoice-correction:create');
  const branchId = einBranch(actor, scope);
  const data = parseInput(correctionSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/ein/invoices/${invoiceId}/corrections`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ invoiceId, ...data }),
    },
    async (tx) => {
      const inv = await deps.invoices.getInTx(tx, scope, invoiceId);
      if (!inv || inv.branchId !== branchId) throw notFound();
      if (inv.status !== 'issued') throw new AppError('invoice_not_issued', 409);
      if (inv.docType === 'adjustment') throw new AppError('adjustment_not_correctable', 409);
      if (inv.replacedBy) throw new AppError('invoice_replaced', 409);
      // one correction at a time per invoice: no open request may be targeting it
      const idx = await deps.index.getInTx(tx, scope, inv.orderId);
      const open = (await deps.requests.getMany(scope, idx?.requestIds ?? [])).filter(
        (r) =>
          (r.targetInvoiceId === inv.id || r.invoiceId === inv.id) &&
          isOpenRequest(r.status) &&
          r.purpose !== 'issue',
      );
      if (open.length) throw new AppError('correction_in_progress', 409);
      let valueVnd = inv.totalVnd;
      if (data.purpose === 'adjust') {
        const deltas = data.deltas ?? [];
        if (deltas.length === 0 || deltas.every((d) => d.netVnd === 0))
          throw new AppError('adjustment_needs_amounts', 422);
        for (const d of deltas)
          if (!inv.taxSummary[d.rateIndex]) throw new AppError('adjustment_rate_unknown', 422);
        const built = buildAdjustmentContent(
          deltas.map((d) => ({
            description: d.description,
            netVnd: d.netVnd,
            taxKey: inv.taxSummary[d.rateIndex]!.taxKey,
            taxVersionId: inv.taxSummary[d.rateIndex]!.taxVersionId,
            rateBp: inv.taxSummary[d.rateIndex]!.rateBp,
          })),
        );
        valueVnd = Math.abs(built.totalVnd);
        // a correction that would take the invoice below zero is not an adjustment (cancel / replace instead)
        if (inv.totalVnd + built.totalVnd < 0) throw new AppError('adjustment_below_zero', 422);
      }
      if (data.purpose === 'replace' && !data.buyer)
        throw new AppError('replacement_needs_changes', 422);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const kind = KIND_OF[data.purpose];
      const limits = await approvalLimitsOf(
        deps.sys,
        actor.companyId,
        kind,
        businessDate(deps.sys.clock.now()),
      );
      const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
        kind,
        level: 1,
        limits,
        branch,
        subjectType: 'invoice',
        subjectId: `${inv.id}:${data.purpose}`,
        subjectLabel: `${inv.number ?? inv.requestNumber} (${inv.orderNumber})`.slice(0, 60),
        valueVnd,
        reason: data.reason,
        payload: { invoiceId: inv.id, ...data },
        link: `/ein/invoices/${inv.id}`,
      });
      return {
        status: 202,
        body: { status: 'pending_approval', approvalId: req.id, number: req.number, kind },
      };
    },
  );
}

export const executeSchema = z.object({
  approvalId: z.string().trim().min(1).max(128),
  /** a cancel asks for the password again (step-up) */
  password: z.string().max(200).optional(),
});

/** Runs an APPROVED correction once: creates the request (and the new invoice document), then sends it. */
export async function executeCorrection(
  deps: EinDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'invoice-correction:create');
  const branchId = einBranch(actor, scope);
  const data = parseInput(executeSchema, input);
  const peek = await deps.sys.approvals.get(scope, data.approvalId);
  if (!peek || peek.branchId !== branchId) throw notFound();
  const kind = (['invoice_adjust', 'invoice_replace', 'invoice_cancel'] as const).find(
    (k) => k === peek.kind,
  );
  if (!kind) throw notFound();
  if (peek.requestedBy !== actor.userId) throw new AppError('forbidden', 403);
  // state first, so a pending / rejected / used request is told as such before any password is asked
  if (peek.status === 'pending') throw new AppError('approval_pending', 409);
  if (peek.status !== 'approved') throw new AppError('approval_not_approved', 409);
  if (peek.consumedAt) throw new AppError('approval_already_used', 409);
  if (kind === 'invoice_cancel') await reauthenticate(deps.sys, actor, data.password);
  const toNotify = await usersWithRole(deps.sys, actor.companyId, ['KT'], branchId);
  const res = await runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/ein/corrections/execute',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ approvalId: data.approvalId }),
    },
    async (tx) => {
      const ap = await loadApprovalForUse(deps.sys, tx, scope, {
        id: data.approvalId,
        kind,
        branchId,
      });
      const parsed = correctionSchema.safeParse({
        purpose: ap.payload.purpose,
        reasonCode: ap.payload.reasonCode,
        reason: ap.payload.reason,
        buyer: ap.payload.buyer,
        deltas: ap.payload.deltas,
      });
      if (!parsed.success) throw new AppError('approval_payload_invalid', 409);
      const c = parsed.data;
      const invoiceId = String(ap.payload.invoiceId);
      const orig = await deps.invoices.getInTx(tx, scope, invoiceId);
      if (!orig || orig.branchId !== branchId) throw notFound();
      if (orig.status !== 'issued') throw new AppError('invoice_not_issued', 409);
      const pii = await deps.invoices.getPiiInTx(tx, scope, orig.id);
      const idx = await deps.index.getInTx(tx, scope, orig.orderId);
      const now = deps.sys.clock.now();
      const q = await readQueue(deps, tx, scope, actor.companyId, branchId, now);
      if (Object.keys(q.items).length >= deps.ein.queueMax)
        throw new AppError('invoice_queue_full', 409);
      const policy = await einPolicyOf(deps, actor.companyId, branchId, businessDate(now));
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const requestId = correctionRequestId(orig.id, c.purpose, ap.id);
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'invoice-request',
        businessDate: businessDate(now),
        stage: 'create',
        documentId: requestId,
        requestKey: `${ctx.idempotencyKey}:yh`,
      });
      let valueVnd = orig.totalVnd;
      let newInvoice: Invoice | null = null;
      const newId = invoiceIdOf(requestId);
      if (c.purpose === 'adjust') {
        const built = buildAdjustmentContent(
          (c.deltas ?? []).map((d) => ({
            description: d.description,
            netVnd: d.netVnd,
            taxKey: orig.taxSummary[d.rateIndex]!.taxKey,
            taxVersionId: orig.taxSummary[d.rateIndex]!.taxVersionId,
            rateBp: orig.taxSummary[d.rateIndex]!.rateBp,
          })),
        );
        valueVnd = built.totalVnd;
        newInvoice = {
          ...baseOf(orig, newId, requestId, num.number!, actor, now),
          docType: 'adjustment',
          lineMode: 'per-line',
          lines: built.lines,
          taxSummary: built.taxSummary,
          netVnd: built.netVnd,
          taxVnd: built.taxVnd,
          totalVnd: built.totalVnd,
        };
      } else if (c.purpose === 'replace') {
        const buyer = mergeBuyer(
          {
            kind: orig.buyer.kind,
            name: orig.buyer.name,
            ...(orig.buyer.taxCode ? { taxCode: orig.buyer.taxCode } : {}),
            ...(pii?.address ? { address: pii.address } : {}),
            ...(pii?.email ? { email: pii.email } : {}),
          },
          c.buyer,
        );
        const check = checkEligibility({
          providerActive: true,
          issuerComplete: true,
          order: {
            status: 'ok',
            qcPassed: true,
            completed: true,
            cancelled: false,
            totalVnd: orig.totalVnd,
            hasLines: true,
          },
          buyer,
          lines: [],
          built: null,
          existing: 'none',
          currentRates: new Map(),
          policy,
        });
        const bad = check.issues.filter((i) => i.code.startsWith('buyer_'));
        if (bad.length)
          throw new AppError(
            'invoice_not_eligible',
            422,
            bad.map((i) => ({ field: i.field ?? 'buyer', message: i.code })),
          );
        newInvoice = {
          ...baseOf(orig, newId, requestId, num.number!, actor, now),
          docType: 'replacement',
          buyer: {
            kind: buyer.kind,
            name: buyer.name,
            ...(buyer.taxCode ? { taxCode: buyer.taxCode } : {}),
          },
          lineMode: orig.lineMode,
          lines: orig.lines,
          taxSummary: orig.taxSummary,
          netVnd: orig.netVnd,
          taxVnd: orig.taxVnd,
          totalVnd: orig.totalVnd,
        };
        deps.invoices.savePii(tx, {
          id: newId,
          companyId: orig.companyId,
          branchId: orig.branchId,
          ...(buyer.address ? { address: buyer.address } : {}),
          ...(buyer.email ? { email: buyer.email } : {}),
        });
      }
      const req: InvoiceRequest = {
        id: requestId,
        companyId: actor.companyId,
        branchId,
        number: num.number!,
        purpose: c.purpose,
        orderId: orig.orderId,
        orderNumber: orig.orderNumber,
        invoiceId: newInvoice ? newId : orig.id,
        targetInvoiceId: orig.id,
        approvalId: ap.id,
        reasonCode: c.reasonCode,
        reason: c.reason,
        idempotencyKey: idempotencyKeyOf(actor.companyId, requestId),
        status: 'pending',
        attemptCount: 0,
        maxAttempts: policy.maxAttempts,
        attempts: [],
        valueVnd: Math.abs(valueVnd),
        createdAt: now,
        createdBy: actor.userId,
        createdByName: actor.displayName,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.requests.create(tx, req);
      if (newInvoice) deps.invoices.create(tx, newInvoice);
      deps.invoices.update(tx, orig.id, {
        history: [
          ...orig.history,
          { at: now, event: `${c.purpose}_requested`, by: actor.userId, note: c.reason },
        ].slice(-40),
        updatedAt: now,
        updatedBy: actor.userId,
        version: orig.version + 1,
      });
      if (idx)
        deps.index.save(tx, {
          ...idx,
          invoiceIds: newInvoice ? [...idx.invoiceIds, newInvoice.id] : idx.invoiceIds,
          requestIds: [...idx.requestIds, requestId],
          updatedAt: now,
          version: idx.version + 1,
        });
      deps.queue.save(tx, queueWith(q, req, now));
      consumeApprovalInTx(deps.sys, tx, actor, ctx, ap, requestId);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'invoice',
          entityId: orig.id,
          action: `invoice.${c.purpose}_request`,
          after: { request: req.number, approval: ap.number, invoice: newInvoice?.id ?? null },
          reason: c.reason,
        }),
      );
      notifyUsers(deps.sys, tx, {
        companyId: actor.companyId,
        userIds: toNotify.filter((u) => u !== actor.userId),
        kind: 'ein.issue',
        titleKey: 'notifications.einvoiceCorrection',
        params: { number: req.number },
        link: `/ein/invoices/${orig.id}`,
        branchId,
      });
      return { status: 201, body: { requestId, invoiceId: req.invoiceId } };
    },
  );
  const body = res.response.body as { requestId: string };
  if (!res.replayed) await dispatchRequest(deps, actor, scope, ctx, body.requestId, 'manual');
  return res;
}

function baseOf(
  orig: Invoice,
  id: string,
  requestId: string,
  requestNumber: string,
  actor: Actor,
  now: Date,
): Invoice {
  return {
    id,
    companyId: orig.companyId,
    branchId: orig.branchId,
    orderId: orig.orderId,
    orderNumber: orig.orderNumber,
    plate: orig.plate,
    customerId: orig.customerId,
    docType: 'original',
    status: 'not_issued',
    sync: 'queued',
    originalInvoiceId: orig.id,
    requestId,
    requestNumber,
    issuer: orig.issuer,
    buyer: orig.buyer,
    lineMode: orig.lineMode,
    lines: [],
    taxSummary: [],
    netVnd: 0,
    taxVnd: 0,
    totalVnd: 0,
    adjustedBy: [],
    artifactsReady: false,
    history: [{ at: now, event: 'requested', by: actor.userId }],
    createdAt: now,
    createdBy: actor.userId,
    createdByName: actor.displayName,
    updatedAt: now,
    updatedBy: actor.userId,
    version: 1,
  };
}

export const reportErrorSchema = z.object({ note: z.string().trim().min(5).max(300) });

/** The cashier cannot correct an invoice: this only tells the accountant (design EIN-03 "Báo kế toán"). No request is created. */
export async function reportInvoiceError(
  deps: EinDeps,
  actor: Actor,
  invoiceId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'invoice-report:create');
  const branchId = einBranch(actor, scope);
  const data = parseInput(reportErrorSchema, input);
  const to = await usersWithRole(deps.sys, actor.companyId, ['KT'], branchId);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/ein/invoices/${invoiceId}/report-error`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ invoiceId, ...data }),
    },
    async (tx) => {
      const inv = await deps.invoices.getInTx(tx, scope, invoiceId);
      if (!inv || inv.branchId !== branchId) throw notFound();
      notifyUsers(deps.sys, tx, {
        companyId: actor.companyId,
        userIds: to,
        kind: 'ein.issue',
        titleKey: 'notifications.einvoiceReported',
        params: { number: inv.number ?? inv.requestNumber, order: inv.orderNumber },
        link: `/ein/invoices/${inv.id}`,
        branchId,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'invoice',
          entityId: inv.id,
          action: 'invoice.error_reported',
          reason: data.note,
        }),
      );
      return { status: 200, body: { notified: to.length } };
    },
  );
}

import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { Scope } from '@/platform/scope/scope';
import { allocateDocumentNumber, resolveConfigAt } from '@/modules/sys';
import { buildInvoiceContent, type BuiltInvoice } from '../domain/build';
import {
  checkEligibility,
  mergeBuyer,
  type EligibilityIssue,
  type EligibilityResult,
  type EligibilityWarning,
} from '../domain/eligibility';
import {
  idempotencyKeyOf,
  invoiceIdOf,
  issueRequestId,
  type Invoice,
  type InvoiceBuyer,
  type InvoiceRequest,
  type OrderInvoiceIndex,
} from '../domain/invoice';
import { isOpenRequest } from '../domain/state';
import type { EinDeps } from '../ports/deps';
import type { InvoiceableOrder } from '../ports/ports';
import { einPolicyOf, issuerOf, providerActive, type EinPolicy, type IssuerConfig } from './config';
import { dispatchRequest } from './dispatch';
import { readQueue, queueWith } from './queue';
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
 * Issue an invoice from a repair order (FR-EIN-001, 002, 003, 011, 013; RULE-005/007). The order is the only source:
 * buyer, lines and tax come from it and the customer record; nothing is typed again. Issuing is idempotent by BUSINESS key
 * (one open or valid issue request per order, a deterministic document id created in the same transaction), so a repeated
 * click, a retry after a timeout or two sessions at once can never create a second invoice, whatever Idempotency-Key they carry.
 */

export const buyerOverrideSchema = z
  .object({
    kind: z.enum(['retail', 'business']),
    name: z.string().trim().max(200),
    taxCode: z.string().trim().max(20),
    address: z.string().trim().max(300),
    email: z.string().trim().max(200),
  })
  .partial()
  .strict();
export const issueSchema = z.object({ buyer: buyerOverrideSchema.optional() }).strict();
export type BuyerOverride = z.infer<typeof buyerOverrideSchema>;

export interface Assembled {
  order: InvoiceableOrder;
  issuer: IssuerConfig | null;
  policy: EinPolicy;
  buyer: InvoiceBuyer & { address?: string; email?: string };
  built: BuiltInvoice | null;
  check: EligibilityResult;
  index: OrderInvoiceIndex | null;
  openRequest: InvoiceRequest | null;
}

/** Reads everything the decision needs; writes nothing. */
export async function assemble(
  deps: EinDeps,
  scope: Scope,
  orderId: string,
  override: BuyerOverride | undefined,
  tx: Parameters<EinDeps['index']['getInTx']>[0] | null,
): Promise<Assembled> {
  const order = await deps.orders.get(scope, orderId);
  if (!order) throw notFound();
  const date = businessDate(deps.sys.clock.now());
  const [issuer, policy] = await Promise.all([
    issuerOf(deps, order.tenantId, order.branchId, date),
    einPolicyOf(deps, order.tenantId, order.branchId, date),
  ]);
  const cust = await deps.buyers.get(scope, order.customerId);
  const buyer = mergeBuyer(cust ?? { kind: 'retail', name: order.customerName }, override);
  const built =
    order.lines.length > 0
      ? buildInvoiceContent(
          order.lines,
          policy.lineMode,
          policy.perRateDescription.replace('{order}', order.number),
        )
      : null;
  const index = tx
    ? await deps.index.getInTx(tx, scope, orderId)
    : await deps.index.get(scope, orderId);
  const openRequest = index?.issueRequestId
    ? await (tx
        ? deps.requests.getInTx(tx, scope, index.issueRequestId)
        : deps.requests.get(scope, index.issueRequestId))
    : null;
  const keys = [...new Set(order.lines.map((l) => l.taxKey))];
  const currentRates = new Map<string, number>();
  for (const k of keys) {
    const snap = await resolveConfigAt(deps.sys, {
      tenantId: order.tenantId,
      type: 'tax-rate',
      scopeKey: k,
      date,
    });
    if (snap) currentRates.set(k, Number((snap.payload as { rateBp: number }).rateBp));
  }
  const check = checkEligibility({
    providerActive: providerActive(deps, issuer),
    issuerComplete: !!issuer && issuer.snapshot.sellerName.length > 1 && !!issuer.snapshot.symbol,
    order: {
      status: order.status,
      qcPassed: order.qcPassed,
      completed: order.completed,
      cancelled: order.cancelled,
      totalVnd: order.totalVnd,
      hasLines: order.lines.length > 0,
    },
    buyer,
    lines: order.lines,
    built,
    existing: index?.validInvoiceId
      ? 'valid_invoice'
      : openRequest && isOpenRequest(openRequest.status)
        ? 'open_request'
        : 'none',
    currentRates,
    policy,
  });
  return { order, issuer, policy, buyer, built, check, index, openRequest };
}

export interface IssueCheckDto {
  orderId: string;
  orderNumber: string;
  totalVnd: number;
  eligible: boolean;
  issues: (EligibilityIssue & { message: string })[];
  warnings: EligibilityWarning[];
  buyer: {
    kind: string;
    name: string;
    taxCode: string | null;
    address: { value: string | null; masked: boolean };
    email: { value: string | null; masked: boolean };
  };
  lines: { no: number; description: string; netVnd: number; rateBp: number }[];
  taxSummary: { rateBp: number; netVnd: number; taxVnd: number }[];
  netVnd: number;
  taxVnd: number;
  provider: { activated: boolean; environment: string | null; symbol: string | null };
  existingInvoiceId: string | null;
}

export async function previewIssue(
  deps: EinDeps,
  actor: Actor,
  orderId: string,
  override?: unknown,
): Promise<IssueCheckDto> {
  const scope = resolveScope(actor, 'invoice:view');
  const o = override === undefined ? undefined : parseInput(buyerOverrideSchema, override);
  const a = await assemble(deps, scope, orderId, o, null);
  const present = (f: 'address' | 'email', v: string | undefined) => {
    const p = deps.sys.pii.present(actor, f, v);
    return { value: p.value ?? null, masked: p.masked };
  };
  return {
    orderId: a.order.id,
    orderNumber: a.order.number,
    totalVnd: a.order.totalVnd,
    eligible: a.check.ok,
    issues: a.check.issues.map((i) => ({ ...i, message: i.code })),
    warnings: a.check.warnings,
    buyer: {
      kind: a.buyer.kind,
      name: a.buyer.name,
      taxCode: a.buyer.taxCode ?? null,
      address: present('address', a.buyer.address),
      email: present('email', a.buyer.email),
    },
    lines: (a.built?.lines ?? []).map((l) => ({
      no: l.no,
      description: l.description,
      netVnd: l.netVnd,
      rateBp: l.rateBp,
    })),
    taxSummary: (a.built?.taxSummary ?? []).map((t) => ({
      rateBp: t.rateBp,
      netVnd: t.netVnd,
      taxVnd: t.taxVnd,
    })),
    netVnd: a.built?.netVnd ?? 0,
    taxVnd: a.built?.taxVnd ?? 0,
    provider: {
      activated: providerActive(deps, a.issuer),
      environment: a.issuer?.snapshot.environment ?? null,
      symbol: a.issuer?.snapshot.symbol ?? null,
    },
    existingInvoiceId: a.index?.validInvoiceId ?? null,
  };
}

/** `invoice_not_eligible` carries every blocking issue (FR-EIN-011): nothing is sent while the list is not empty. */
function notEligible(check: EligibilityResult): AppError {
  return new AppError(
    'invoice_not_eligible',
    422,
    check.issues.map((i) => ({ field: i.field ?? 'order', message: i.code })),
  );
}

export interface IssueOutcome {
  status: number;
  body: { invoiceId: string; requestId: string; duplicate: boolean };
  replayed: boolean;
}

export async function issueInvoice(
  deps: EinDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<IssueOutcome> {
  const scope = resolveScope(actor, 'invoice:create');
  const branchId = einBranch(actor, scope);
  const data = parseInput(issueSchema, input ?? {});
  const route = `POST /api/v1/ein/orders/${orderId}/invoices`;
  const res = await runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const a = await assemble(deps, scope, orderId, data.buyer, tx);
      if (a.order.branchId !== branchId) throw notFound();
      // business-level idempotency: an open or valid issue request already exists -> return it, create nothing
      if (a.openRequest && isOpenRequest(a.openRequest.status))
        return {
          status: 200,
          body: {
            invoiceId: a.openRequest.invoiceId,
            requestId: a.openRequest.id,
            duplicate: true,
            created: false,
          },
        };
      if (a.index?.validInvoiceId)
        return {
          status: 200,
          body: {
            invoiceId: a.index.validInvoiceId,
            requestId: a.index.issueRequestId,
            duplicate: true,
            created: false,
          },
        };
      if (!a.check.ok) throw notEligible(a.check);
      const issuer = a.issuer!;
      const built = a.built!;
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const now = deps.sys.clock.now();
      const q = await readQueue(deps, tx, scope, actor.tenantId, branchId, now);
      if (Object.keys(q.items).length >= deps.ein.queueMax)
        throw new AppError('invoice_queue_full', 409);
      const rounds = (a.index?.rounds ?? 0) + 1;
      const requestId = issueRequestId(orderId, rounds);
      const invoiceId = invoiceIdOf(requestId);
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'invoice-request',
        businessDate: businessDate(now),
        stage: 'create',
        documentId: requestId,
        requestKey: `${ctx.idempotencyKey}:yh`,
      });
      const req: InvoiceRequest = {
        id: requestId,
        tenantId: actor.tenantId,
        branchId,
        number: num.number!,
        purpose: 'issue',
        orderId,
        orderNumber: a.order.number,
        invoiceId,
        idempotencyKey: idempotencyKeyOf(actor.tenantId, requestId),
        status: 'pending',
        attemptCount: 0,
        maxAttempts: a.policy.maxAttempts,
        attempts: [],
        valueVnd: built.totalVnd,
        createdAt: now,
        createdBy: actor.userId,
        createdByName: actor.displayName,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      const inv: Invoice = {
        id: invoiceId,
        tenantId: actor.tenantId,
        branchId,
        orderId,
        orderNumber: a.order.number,
        plate: a.order.plate,
        customerId: a.order.customerId,
        docType: 'original',
        status: 'not_issued',
        sync: 'queued',
        requestId,
        requestNumber: req.number,
        issuer: issuer.snapshot,
        buyer: {
          kind: a.buyer.kind,
          name: a.buyer.name,
          ...(a.buyer.taxCode ? { taxCode: a.buyer.taxCode } : {}),
        },
        lineMode: a.policy.lineMode,
        lines: built.lines,
        taxSummary: built.taxSummary,
        netVnd: built.netVnd,
        taxVnd: built.taxVnd,
        totalVnd: built.totalVnd,
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
      deps.requests.create(tx, req);
      deps.invoices.create(tx, inv);
      deps.invoices.savePii(tx, {
        id: invoiceId,
        tenantId: actor.tenantId,
        branchId,
        ...(a.buyer.address ? { address: a.buyer.address } : {}),
        ...(a.buyer.email ? { email: a.buyer.email } : {}),
      });
      deps.index.save(tx, {
        id: orderId,
        tenantId: actor.tenantId,
        branchId,
        orderNumber: a.order.number,
        rounds,
        issueRequestId: requestId,
        validInvoiceId: a.index?.validInvoiceId ?? null,
        invoiceIds: [...(a.index?.invoiceIds ?? []), invoiceId],
        requestIds: [...(a.index?.requestIds ?? []), requestId],
        updatedAt: now,
        version: (a.index?.version ?? 0) + 1,
      });
      deps.queue.save(tx, queueWith(q, req, now));
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'invoice',
          entityId: invoiceId,
          action: 'invoice.request',
          after: {
            request: req.number,
            order: a.order.number,
            totalVnd: built.totalVnd,
            buyerKind: a.buyer.kind,
            lineMode: a.policy.lineMode,
            issuerVersion: issuer.snapshot.configVersionId,
          },
        }),
      );
      return {
        status: 201,
        body: { invoiceId, requestId, duplicate: false, created: true },
      };
    },
  );
  const body = res.response.body as {
    invoiceId: string;
    requestId: string;
    duplicate: boolean;
    created: boolean;
  };
  // the provider call happens AFTER the commit, only by the process that created the request
  if (body.created && !res.replayed)
    await dispatchRequest(deps, actor, scope, ctx, body.requestId, 'manual');
  return {
    status: res.response.status,
    body: { invoiceId: body.invoiceId, requestId: body.requestId, duplicate: body.duplicate },
    replayed: res.replayed,
  };
}

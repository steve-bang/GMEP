import { createHash } from 'node:crypto';
import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { filePath } from '@/platform/files/fileStore';
import { checkEligibility, mergeBuyer } from '../domain/eligibility';
import type { Invoice, InvoiceHistoryEntry, InvoiceRequest } from '../domain/invoice';
import { syncOf, transitionInvoice, transitionRequest } from '../domain/state';
import type { EinDeps } from '../ports/deps';
import { buildInvoiceContent } from '../domain/build';
import { einPolicyOf, issuerOf, providerActive } from './config';
import { dispatchRequest } from './dispatch';
import { queueWith, readQueue } from './queue';
import { buyerOverrideSchema } from './issue';
import {
  AppError,
  auditEntry,
  einBranch,
  idemOf,
  notFound,
  parseInput,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

/**
 * Working the queue (FR-EIN-010, 013): retry, fix the buyer, cancel a request, sync the status, run what is due.
 * "Thử lại" ALWAYS asks the provider first (see `dispatch.ts`); cancelling a request asks one last time and refuses when
 * the provider already holds the invoice, so no path can lose or double an invoice.
 */

export async function retryRequest(
  deps: EinDeps,
  actor: Actor,
  requestId: string,
  ctx: RequestCtx,
) {
  const scope = resolveScope(actor, 'invoice-queue:update');
  const branchId = einBranch(actor, scope);
  const r0 = await deps.requests.get(scope, requestId);
  if (!r0 || r0.branchId !== branchId) throw notFound();
  if (r0.status === 'failed_data') throw new AppError('fix_data_first', 409);
  if (r0.status === 'sending') throw new AppError('request_in_flight', 409);
  if (r0.status === 'succeeded' || r0.status === 'cancelled')
    throw new AppError('request_closed', 409);
  const res = await dispatchRequest(deps, actor, scope, ctx, requestId, 'manual');
  return { claimed: res.claimed, status: res.request.status };
}

export const fixBuyerSchema = z.object({
  version: z.number().int().min(1),
  buyer: buyerOverrideSchema,
});

/** failed_data -> pending: the buyer was corrected; the rules are checked again BEFORE it can go out. */
export async function fixBuyer(
  deps: EinDeps,
  actor: Actor,
  requestId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'invoice-queue:update');
  const branchId = einBranch(actor, scope);
  const data = parseInput(fixBuyerSchema, input);
  const res = await runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/ein/queue/${requestId}/fix-buyer`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ requestId, ...data }),
    },
    async (tx) => {
      const r = await deps.requests.getInTx(tx, scope, requestId);
      if (!r || r.branchId !== branchId) throw notFound();
      if (r.version !== data.version) throw versionConflict();
      const inv = await deps.invoices.getInTx(tx, scope, r.invoiceId);
      if (!inv || r.purpose === 'cancel') throw notFound();
      if (r.status !== 'failed_data') throw new AppError('request_not_fixable', 409);
      const pii = await deps.invoices.getPiiInTx(tx, scope, inv.id);
      const q = await readQueue(deps, tx, scope, r.companyId, r.branchId, deps.sys.clock.now());
      const now = deps.sys.clock.now();
      const date = businessDate(now);
      const policy = await einPolicyOf(deps, r.companyId, r.branchId, date);
      const buyer = mergeBuyer(
        {
          kind: inv.buyer.kind,
          name: inv.buyer.name,
          ...(inv.buyer.taxCode ? { taxCode: inv.buyer.taxCode } : {}),
          ...(pii?.address ? { address: pii.address } : {}),
          ...(pii?.email ? { email: pii.email } : {}),
        },
        data.buyer,
      );
      const check = checkEligibility({
        providerActive: true,
        issuerComplete: true,
        order: {
          status: 'ok',
          qcPassed: true,
          completed: true,
          cancelled: false,
          totalVnd: inv.totalVnd,
          hasLines: true,
        },
        buyer,
        lines: [],
        built: null,
        existing: 'none',
        currentRates: new Map(),
        policy,
      });
      const blocking = check.issues.filter((i) => i.code.startsWith('buyer_'));
      if (blocking.length)
        throw new AppError(
          'invoice_not_eligible',
          422,
          blocking.map((i) => ({ field: i.field ?? 'buyer', message: i.code })),
        );
      const t = transitionRequest('failed_data', 'fix_data');
      if (!t.ok) throw new AppError('request_transition_not_allowed', 409);
      const next: InvoiceRequest = {
        ...r,
        status: t.to,
        updatedAt: now,
        updatedBy: actor.userId,
        version: r.version + 1,
      };
      delete next.lastError;
      deps.requests.update(tx, r.id, {
        status: t.to,
        lastError: null,
        updatedAt: now,
        updatedBy: actor.userId,
        version: next.version,
      });
      const hist: InvoiceHistoryEntry = { at: now, event: 'buyer_fixed', by: actor.userId };
      deps.invoices.update(tx, inv.id, {
        buyer: {
          kind: buyer.kind,
          name: buyer.name,
          ...(buyer.taxCode ? { taxCode: buyer.taxCode } : {}),
        },
        sync: syncOf('pending'),
        syncError: null,
        history: [...inv.history, hist].slice(-40),
        updatedAt: now,
        updatedBy: actor.userId,
        version: inv.version + 1,
      });
      deps.invoices.savePii(tx, {
        id: inv.id,
        companyId: inv.companyId,
        branchId: inv.branchId,
        ...(buyer.address ? { address: buyer.address } : {}),
        ...(buyer.email ? { email: buyer.email } : {}),
      });
      deps.queue.save(tx, queueWith(q, next, now));
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'invoiceRequest',
          entityId: r.id,
          action: 'invoice.buyer_fixed',
          after: { request: r.number, buyerKind: buyer.kind },
        }),
      );
      return { status: 200, body: { requestId: r.id } };
    },
  );
  if (!res.replayed) await dispatchRequest(deps, actor, scope, ctx, requestId, 'manual');
  return res;
}

export const cancelRequestSchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().min(5).max(300),
  /** the request number typed back as a guard (G4-EIN-06) */
  confirm: z.string().trim().min(1).max(40),
});

/**
 * Cancels a request that never produced an invoice (G4-EIN-06). The provider is asked one last time: when it already holds
 * the invoice the request is NOT cancelled; the outcome is recorded instead (the invoice then exists in the list).
 */
export async function cancelRequest(
  deps: EinDeps,
  actor: Actor,
  requestId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'invoice-queue:update');
  const branchId = einBranch(actor, scope);
  const data = parseInput(cancelRequestSchema, input);
  const r0 = await deps.requests.get(scope, requestId);
  if (!r0 || r0.branchId !== branchId) throw notFound();
  if (data.confirm !== r0.number) throw new AppError('confirm_mismatch', 422);
  if (r0.status === 'sending') throw new AppError('request_in_flight', 409);
  const inv0 = await deps.invoices.get(scope, r0.invoiceId);
  if (!inv0) throw notFound();
  // last question to the provider (FR-EIN-013): outside any transaction
  if (r0.attemptCount > 0 && r0.purpose !== 'cancel') {
    const provider = deps.providers.get(inv0.issuer.providerCode, inv0.issuer.environment);
    if (!provider) throw new AppError('provider_unavailable', 503);
    try {
      const q = await provider.query({ clientRequestId: r0.idempotencyKey });
      if (q.found) {
        // the provider holds the invoice: record that instead of cancelling
        await dispatchRequest(deps, actor, scope, ctx, requestId, 'manual');
        throw new AppError('request_has_invoice', 409);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('provider_unavailable', 503);
    }
  }
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/ein/queue/${requestId}/cancel`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ requestId, ...data }),
    },
    async (tx) => {
      const r = await deps.requests.getInTx(tx, scope, requestId);
      if (!r || r.branchId !== branchId) throw notFound();
      if (r.version !== data.version) throw versionConflict();
      const inv = await deps.invoices.getInTx(tx, scope, r.invoiceId);
      if (!inv) throw notFound();
      const idx = await deps.index.getInTx(tx, scope, r.orderId);
      const q = await readQueue(deps, tx, scope, r.companyId, r.branchId, deps.sys.clock.now());
      const t = transitionRequest(r.status, 'cancel');
      if (!t.ok) throw new AppError('request_transition_not_allowed', 409);
      const now = deps.sys.clock.now();
      const next: InvoiceRequest = {
        ...r,
        status: 'cancelled',
        reason: data.reason,
        updatedAt: now,
        updatedBy: actor.userId,
        version: r.version + 1,
      };
      deps.requests.update(tx, r.id, {
        status: 'cancelled',
        reason: data.reason,
        sendingUntil: null,
        nextAttemptAt: null,
        updatedAt: now,
        updatedBy: actor.userId,
        version: next.version,
      });
      if (r.purpose === 'cancel') {
        // the original invoice stays issued; only the failed cancel attempt is withdrawn
        deps.invoices.update(tx, inv.id, {
          sync: 'synced',
          syncError: null,
          history: [
            ...inv.history,
            { at: now, event: 'cancel_request_withdrawn', by: actor.userId },
          ].slice(-40),
          updatedAt: now,
          updatedBy: actor.userId,
          version: inv.version + 1,
        });
      } else {
        const it = transitionInvoice(inv.status, 'request_cancelled');
        if (!it.ok) throw new AppError('invoice_transition_not_allowed', 409);
        deps.invoices.update(tx, inv.id, {
          status: it.to,
          sync: 'synced',
          syncError: null,
          cancelReason: data.reason,
          history: [
            ...inv.history,
            { at: now, event: 'request_cancelled', by: actor.userId, note: data.reason },
          ].slice(-40),
          updatedAt: now,
          updatedBy: actor.userId,
          version: inv.version + 1,
        });
      }
      if (idx)
        deps.index.save(tx, {
          ...idx,
          // the order goes back to "no invoice": the next issue opens round + 1
          issueRequestId: r.purpose === 'issue' ? null : idx.issueRequestId,
          updatedAt: now,
          version: idx.version + 1,
        });
      deps.queue.save(tx, queueWith(q, next, now));
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'invoiceRequest',
          entityId: r.id,
          action: 'invoice.request_cancelled',
          before: { status: r.status },
          after: { status: 'cancelled', request: r.number },
          reason: data.reason,
        }),
      );
      return { status: 200, body: { requestId: r.id, status: 'cancelled' } };
    },
  );
}

/**
 * FR-EIN-005: pulls the provider-side status. A request still waiting is asked (and recorded); an issued invoice whose files
 * were not fetched yet gets them; an issued invoice the provider reports as cancelled follows it (the provider is the
 * authority for the status of an invoice, BR-EIN-03).
 */
export async function syncInvoice(deps: EinDeps, actor: Actor, invoiceId: string, ctx: RequestCtx) {
  const scope = resolveScope(actor, 'invoice-queue:update');
  einBranch(actor, scope);
  const inv = await deps.invoices.get(scope, invoiceId);
  if (!inv) throw notFound();
  const req = await deps.requests.get(scope, inv.requestId);
  if (req && ['awaiting_provider', 'unknown', 'failed_provider', 'pending'].includes(req.status))
    await dispatchRequest(deps, actor, scope, ctx, req.id, 'manual');
  const fresh = (await deps.invoices.get(scope, invoiceId))!;
  if (fresh.status === 'issued' && fresh.providerInvoiceId) {
    const provider = deps.providers.get(fresh.issuer.providerCode, fresh.issuer.environment);
    if (provider) {
      try {
        const st = await provider.getStatus(fresh.providerInvoiceId);
        if (!fresh.artifactsReady && st.state !== 'processing')
          await storeArtifacts(deps, actor, scope, ctx, fresh);
        if (st.state === 'cancelled')
          await applyProviderCancel(deps, actor, scope, ctx, fresh, st.rawStatus);
      } catch {
        // a provider that cannot answer leaves the invoice as it is; the next sync tries again
      }
    }
  }
  return { status: (await deps.invoices.get(scope, invoiceId))!.status };
}

async function storeArtifacts(
  deps: EinDeps,
  actor: Actor,
  scope: Parameters<EinDeps['invoices']['get']>[0],
  ctx: RequestCtx,
  inv: Invoice,
): Promise<void> {
  const provider = deps.providers.get(inv.issuer.providerCode, inv.issuer.environment);
  if (!provider || !inv.providerInvoiceId) return;
  const a = await provider.fetchArtifacts(inv.providerInvoiceId);
  const xmlPath = filePath('invoices', inv.companyId, inv.branchId, `${inv.id}.xml`);
  const pdfPath = filePath('invoices', inv.companyId, inv.branchId, `${inv.id}.pdf`);
  await deps.files.put(xmlPath, {
    bytes: new TextEncoder().encode(a.xml),
    contentType: 'application/xml',
  });
  await deps.files.put(pdfPath, { bytes: a.pdf, contentType: 'application/pdf' });
  const sha = (b: string | Uint8Array) => createHash('sha256').update(b).digest('hex');
  await deps.sys.uow.run(async (tx) => {
    const cur = await deps.invoices.getInTx(tx, scope, inv.id);
    if (!cur || cur.artifactsReady) return;
    const now = deps.sys.clock.now();
    deps.invoices.saveArtifacts(tx, {
      id: inv.id,
      companyId: inv.companyId,
      branchId: inv.branchId,
      xmlPath,
      pdfPath,
      xmlSha256: sha(a.xml),
      pdfSha256: sha(a.pdf),
      xmlBytes: new TextEncoder().encode(a.xml).length,
      pdfBytes: a.pdf.length,
      storedAt: now,
    });
    deps.invoices.update(tx, inv.id, {
      artifactsReady: true,
      updatedAt: now,
      updatedBy: actor.userId,
      version: cur.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: inv.branchId,
        entityType: 'invoice',
        entityId: inv.id,
        action: 'invoice.files_stored',
        after: { xmlBytes: new TextEncoder().encode(a.xml).length, pdfBytes: a.pdf.length },
      }),
    );
  });
}

async function applyProviderCancel(
  deps: EinDeps,
  actor: Actor,
  scope: Parameters<EinDeps['invoices']['get']>[0],
  ctx: RequestCtx,
  inv: Invoice,
  rawStatus: string,
): Promise<void> {
  await deps.sys.uow.run(async (tx) => {
    const cur = await deps.invoices.getInTx(tx, scope, inv.id);
    const idx = await deps.index.getInTx(tx, scope, inv.orderId);
    if (!cur) return;
    const t = transitionInvoice(cur.status, 'provider_cancelled');
    if (!t.ok) return;
    const now = deps.sys.clock.now();
    deps.invoices.update(tx, cur.id, {
      status: t.to,
      cancelledAt: now,
      providerStatus: rawStatus,
      history: [
        ...cur.history,
        { at: now, event: 'cancelled_at_provider', by: actor.userId },
      ].slice(-40),
      updatedAt: now,
      updatedBy: actor.userId,
      version: cur.version + 1,
    });
    if (idx && idx.validInvoiceId === cur.id)
      deps.index.save(tx, {
        ...idx,
        validInvoiceId: null,
        updatedAt: now,
        version: idx.version + 1,
      });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: cur.branchId,
        entityType: 'invoice',
        entityId: cur.id,
        action: 'invoice.cancelled',
        after: { source: 'provider_sync', status: rawStatus },
      }),
    );
  });
}

/**
 * The retry job (FR-EIN-010): handles the requests of the working branch that are due. There is no scheduler yet; Cloud
 * Scheduler calls this through the API with a service account (documented in the README), a person can press it on the
 * queue screen. It only claims requests that are due and not final, so running it twice at once is safe.
 */
export async function runDueRequests(deps: EinDeps, actor: Actor, ctx: RequestCtx) {
  const scope = resolveScope(actor, 'invoice-queue:update');
  const branchId = einBranch(actor, scope);
  const q = await deps.queue.get(scope, branchId);
  const now = deps.sys.clock.now();
  const due = Object.values(q?.items ?? {})
    .filter(
      (i) =>
        i.status === 'pending' ||
        (['unknown', 'awaiting_provider', 'failed_provider'].includes(i.status) &&
          (!i.nextAttemptAt || i.nextAttemptAt <= now) &&
          i.attemptCount < i.maxAttempts),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, deps.ein.jobBatch);
  let handled = 0;
  for (const i of due) {
    const r = await dispatchRequest(deps, actor, scope, ctx, i.requestId, 'auto');
    if (r.claimed) handled++;
  }
  return { due: due.length, handled };
}

export { buildInvoiceContent, issuerOf, providerActive };

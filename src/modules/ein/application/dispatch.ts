import { createHash } from 'node:crypto';
import { businessDate } from '@/platform/format/date';
import type { Actor } from '@/platform/rbac/rbac';
import type { Scope } from '@/platform/scope/scope';
import { filePath } from '@/platform/files/fileStore';
import { notifyUsers, usersWithRole } from '@/modules/sys';
import type {
  ErrorKind,
  Invoice,
  InvoiceHistoryEntry,
  InvoicePii,
  InvoiceRequest,
  RequestAttempt,
} from '../domain/invoice';
import {
  errorKindOf,
  mustQueryFirst,
  nextAttemptDelayMinutes,
  syncOf,
  transitionInvoice,
  transitionRequest,
  type RequestEvent,
} from '../domain/state';
import type { EinDeps } from '../ports/deps';
import {
  ProviderError,
  type EInvoiceProvider,
  type ProviderDraft,
  type ProviderResult,
} from '../ports/provider';
import { einPolicyOf } from './config';
import { queueWith, readQueue } from './queue';
import { AppError, auditEntry, notFound, type RequestCtx } from './support';

/**
 * Sending to the provider and recording what came back (FR-EIN-004, 005, 010, 013). The call to the provider is NEVER
 * inside a database transaction (plan §2.5). Three steps: (1) CLAIM the request in a transaction (one winner, a lease),
 * (2) talk to the provider, (3) RECORD the outcome in a transaction. Before any attempt after the first, or after a timeout,
 * the provider is ASKED by the stable key and the request is sent again only if the provider holds nothing for it, so a
 * timeout followed by a retry can never create a second invoice.
 */

export interface DispatchResult {
  claimed: boolean;
  request: InvoiceRequest;
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new ProviderError('timeout', 'provider_timeout', 'provider did not answer in time')),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });

const sha256 = (b: string | Uint8Array): string => createHash('sha256').update(b).digest('hex');

export function draftOf(
  inv: Invoice,
  pii: InvoicePii | null,
  req: InvoiceRequest,
  original: Invoice | null,
): ProviderDraft {
  return {
    clientRequestId: req.idempotencyKey,
    docType: inv.docType,
    issuer: {
      sellerName: inv.issuer.sellerName,
      sellerTaxCode: inv.issuer.sellerTaxCode,
      ...(inv.issuer.sellerAddress ? { sellerAddress: inv.issuer.sellerAddress } : {}),
      symbol: inv.issuer.symbol,
      invoiceType: inv.issuer.invoiceType,
      templateCode: inv.issuer.templateCode,
    },
    buyer: {
      kind: inv.buyer.kind,
      name: inv.buyer.name,
      ...(inv.buyer.taxCode ? { taxCode: inv.buyer.taxCode } : {}),
      ...(pii?.address ? { address: pii.address } : {}),
      ...(pii?.email ? { email: pii.email } : {}),
    },
    lines: inv.lines.map((l) => ({
      no: l.no,
      description: l.description,
      ...(l.quantityText ? { quantityText: l.quantityText } : {}),
      netVnd: l.netVnd,
      rateBp: l.rateBp,
    })),
    taxSummary: inv.taxSummary.map((t) => ({
      rateBp: t.rateBp,
      netVnd: t.netVnd,
      taxVnd: t.taxVnd,
    })),
    netVnd: inv.netVnd,
    taxVnd: inv.taxVnd,
    totalVnd: inv.totalVnd,
    orderNumber: inv.orderNumber,
    ...(original?.providerInvoiceId
      ? {
          reference: {
            providerInvoiceId: original.providerInvoiceId,
            number: original.number ?? '',
            symbol: original.issuer.symbol,
            reason: req.reason ?? '',
          },
        }
      : {}),
  };
}

function classify(e: unknown): { kind: ErrorKind; code: string; message: string } {
  if (e instanceof ProviderError) return { kind: e.kind, code: e.code, message: e.message };
  // anything unexpected from an adapter is "unavailable": retryable, never lost
  return {
    kind: 'unavailable',
    code: 'provider_unexpected',
    message: e instanceof Error ? e.message.slice(0, 200) : 'unexpected provider failure',
  };
}

const EVENT_OF_KIND: Record<ErrorKind, RequestEvent> = {
  timeout: 'provider_timeout',
  unavailable: 'provider_unavailable',
  rejected: 'provider_rejected',
  data: 'provider_data_error',
};

/** (1) claim. Returns `claimed:false` when the request is not due, is final, or another process holds it. */
export async function claimRequest(
  deps: EinDeps,
  actor: Actor,
  scope: Scope,
  ctx: RequestCtx,
  requestId: string,
  mode: 'manual' | 'auto',
): Promise<(DispatchResult & { phase: 'query' | 'send'; invoice: Invoice }) | DispatchResult> {
  return deps.sys.uow.run(async (tx) => {
    const r = await deps.requests.getInTx(tx, scope, requestId);
    if (!r) throw notFound();
    const inv = await deps.invoices.getInTx(tx, scope, r.invoiceId);
    if (!inv) throw notFound();
    const q = await readQueue(deps, tx, scope, r.companyId, r.branchId, deps.sys.clock.now());
    const now = deps.sys.clock.now();
    let status = r.status;
    const leaseExpired = status === 'sending' && !!r.sendingUntil && r.sendingUntil <= now;
    if (leaseExpired) status = 'unknown';
    const due = !r.nextAttemptAt || r.nextAttemptAt <= now;
    const claimable =
      mode === 'manual'
        ? ['pending', 'unknown', 'awaiting_provider', 'failed_provider'].includes(status)
        : status === 'pending' ||
          (['unknown', 'awaiting_provider', 'failed_provider'].includes(status) &&
            due &&
            r.attemptCount < r.maxAttempts);
    if (!claimable) return { claimed: false, request: r };
    const t = transitionRequest(status, 'claim');
    if (!t.ok) return { claimed: false, request: r };
    const phase = mustQueryFirst({ status, attemptCount: r.attemptCount }) ? 'query' : 'send';
    const n = r.attemptCount + 1;
    const patch: InvoiceRequest = {
      ...r,
      status: 'sending',
      attemptCount: n,
      sendingUntil: new Date(now.getTime() + deps.ein.leaseMs),
      updatedAt: now,
      updatedBy: actor.userId,
      version: r.version + 1,
    };
    delete patch.nextAttemptAt;
    deps.requests.update(tx, r.id, {
      status: 'sending',
      attemptCount: n,
      sendingUntil: patch.sendingUntil,
      nextAttemptAt: null,
      updatedAt: now,
      updatedBy: actor.userId,
      version: patch.version,
    });
    deps.invoices.update(tx, inv.id, {
      sync: syncOf('sending'),
      updatedAt: now,
      updatedBy: actor.userId,
      version: inv.version + 1,
    });
    deps.queue.save(tx, queueWith(q, patch, now));
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: r.branchId,
        entityType: 'invoiceRequest',
        entityId: r.id,
        action: 'invoice.attempt',
        before: { status },
        after: { status: 'sending', attempt: n, phase },
      }),
    );
    return { claimed: true, request: patch, phase, invoice: inv };
  });
}

/** (2)+(3): run an already claimed attempt to the end. Never throws for provider trouble: that is an outcome. */
export async function runClaimed(
  deps: EinDeps,
  actor: Actor,
  scope: Scope,
  ctx: RequestCtx,
  claimed: { request: InvoiceRequest; phase: 'query' | 'send'; invoice: Invoice },
): Promise<InvoiceRequest> {
  const { request: req, invoice: inv } = claimed;
  const date = businessDate(deps.sys.clock.now());
  const policy = await einPolicyOf(deps, req.companyId, req.branchId, date);
  const provider = deps.providers.get(inv.issuer.providerCode, inv.issuer.environment);
  const attempt: RequestAttempt = {
    n: req.attemptCount,
    at: deps.sys.clock.now(),
    phase: claimed.phase,
    outcome: 'ok',
  };
  let result: ProviderResult | null = null;
  let failure: { kind: ErrorKind; code: string; message: string } | null = null;
  let artifacts: { xmlPath: string; pdfPath: string; xml: string; pdf: Uint8Array } | null = null;
  try {
    if (!provider)
      throw new ProviderError('unavailable', 'provider_missing', 'provider adapter not available');
    const pii = await deps.invoices.getPii(scope, inv.id);
    const original = req.targetInvoiceId
      ? await deps.invoices.get(scope, req.targetInvoiceId)
      : null;
    if (claimed.phase === 'query') {
      const q = await withTimeout(
        provider.query({ clientRequestId: req.idempotencyKey }),
        policy.providerTimeoutMs,
      );
      if (q.found) result = q.result;
      else attempt.outcome = 'not_found';
    }
    if (!result) {
      result = await withTimeout(
        sendOne(provider, req, draftOf(inv, pii, req, original), original),
        policy.providerTimeoutMs,
      );
      attempt.phase = 'send';
    }
    if (result.state === 'processing') attempt.outcome = 'processing';
    else attempt.outcome = 'ok';
    const wantsInvoice = req.purpose !== 'cancel';
    if (result.state === 'issued' && wantsInvoice) {
      try {
        const a = await withTimeout(
          provider.fetchArtifacts(result.providerInvoiceId),
          policy.providerTimeoutMs,
        );
        artifacts = {
          xmlPath: filePath('invoices', req.companyId, req.branchId, `${inv.id}.xml`),
          pdfPath: filePath('invoices', req.companyId, req.branchId, `${inv.id}.pdf`),
          xml: a.xml,
          pdf: a.pdf,
        };
        // files are written BEFORE the transaction that points at them; an orphan file is harmless, a dangling pointer is not
        await deps.files.put(artifacts.xmlPath, {
          bytes: new TextEncoder().encode(a.xml),
          contentType: 'application/xml',
        });
        await deps.files.put(artifacts.pdfPath, { bytes: a.pdf, contentType: 'application/pdf' });
      } catch {
        artifacts = null; // the invoice exists; the files are fetched again by the sync (artifactsReady stays false)
      }
    }
  } catch (e) {
    failure = classify(e);
    attempt.outcome = failure.kind;
    attempt.code = failure.code;
    attempt.message = failure.message;
  }
  return recordOutcome(deps, actor, scope, ctx, req, attempt, result, failure, artifacts, policy);
}

function sendOne(
  provider: EInvoiceProvider,
  req: InvoiceRequest,
  draft: ProviderDraft,
  original: Invoice | null,
): Promise<ProviderResult> {
  if (req.purpose === 'cancel') {
    if (!original?.providerInvoiceId)
      return Promise.reject(
        new ProviderError('data', 'invoice_not_at_provider', 'nothing to cancel'),
      );
    return provider.cancel({
      clientRequestId: req.idempotencyKey,
      providerInvoiceId: original.providerInvoiceId,
      reason: req.reason ?? '',
    });
  }
  return provider.issue(draft);
}

async function recordOutcome(
  deps: EinDeps,
  actor: Actor,
  scope: Scope,
  ctx: RequestCtx,
  claimedReq: InvoiceRequest,
  attempt: RequestAttempt,
  result: ProviderResult | null,
  failure: { kind: ErrorKind; code: string; message: string } | null,
  artifacts: { xmlPath: string; pdfPath: string; xml: string; pdf: Uint8Array } | null,
  policy: Awaited<ReturnType<typeof einPolicyOf>>,
): Promise<InvoiceRequest> {
  // people to tell when a request goes to the queue (plain read, before the transaction)
  const toNotify = failure
    ? await usersWithRole(deps.sys, claimedReq.companyId, ['KT'], claimedReq.branchId)
    : [];
  return deps.sys.uow.run(async (tx) => {
    const r = await deps.requests.getInTx(tx, scope, claimedReq.id);
    if (!r) throw notFound();
    const inv = await deps.invoices.getInTx(tx, scope, r.invoiceId);
    if (!inv) throw notFound();
    const target = r.targetInvoiceId
      ? await deps.invoices.getInTx(tx, scope, r.targetInvoiceId)
      : null;
    const idx = await deps.index.getInTx(tx, scope, r.orderId);
    const q = await readQueue(deps, tx, scope, r.companyId, r.branchId, deps.sys.clock.now());
    // a stale outcome (the lease ran out and another attempt took over) must not overwrite the newer one
    if (r.status !== 'sending' || r.attemptCount !== claimedReq.attemptCount) return r;
    const now = deps.sys.clock.now();
    const attempts = [...r.attempts, attempt].slice(-deps.ein.attemptsKept);
    const hist = (event: string, note?: string): InvoiceHistoryEntry => ({
      at: now,
      event,
      by: actor.userId,
      ...(note ? { note } : {}),
    });
    const base = { updatedAt: now, updatedBy: actor.userId };

    // ---- success -------------------------------------------------------------------------------------------
    const succeeded =
      result &&
      ((r.purpose === 'cancel' && result.state === 'cancelled') ||
        (r.purpose !== 'cancel' && result.state === 'issued'));
    if (result && succeeded) {
      const next: InvoiceRequest = {
        ...r,
        ...base,
        status: 'succeeded',
        attempts,
        version: r.version + 1,
      };
      delete next.sendingUntil;
      delete next.nextAttemptAt;
      delete next.lastError;
      deps.requests.update(tx, r.id, {
        status: 'succeeded',
        attempts,
        sendingUntil: null,
        nextAttemptAt: null,
        lastError: null,
        ...base,
        version: next.version,
      });
      let validInvoiceId = idx?.validInvoiceId ?? null;
      if (r.purpose === 'cancel') {
        const t = transitionInvoice(target?.status ?? 'issued', 'provider_cancelled');
        if (target && t.ok) {
          deps.invoices.update(tx, target.id, {
            status: t.to,
            cancelledAt: now,
            cancelReason: r.reason ?? '',
            sync: 'synced',
            providerStatus: result.rawStatus,
            history: [...target.history, hist('cancelled', r.reason)].slice(-40),
            ...base,
            version: target.version + 1,
          });
        }
        if (validInvoiceId === r.targetInvoiceId) validInvoiceId = null;
        // the cancel request has no invoice document of its own: its `invoiceId` is the target
      } else {
        const t = transitionInvoice(inv.status, 'provider_issued');
        if (!t.ok) throw new AppError('invoice_transition_not_allowed', 409);
        deps.invoices.update(tx, inv.id, {
          status: t.to,
          sync: 'synced',
          syncError: null,
          providerInvoiceId: result.providerInvoiceId,
          ...(result.number ? { number: result.number } : {}),
          ...(result.taxAuthorityCode ? { taxAuthorityCode: result.taxAuthorityCode } : {}),
          issuedAt: result.issuedAt ?? now,
          providerStatus: result.rawStatus,
          artifactsReady: !!artifacts,
          history: [...inv.history, hist('issued', result.number)].slice(-40),
          ...base,
          version: inv.version + 1,
        });
        if (artifacts) {
          deps.invoices.saveArtifacts(tx, {
            id: inv.id,
            companyId: inv.companyId,
            branchId: inv.branchId,
            xmlPath: artifacts.xmlPath,
            pdfPath: artifacts.pdfPath,
            xmlSha256: sha256(artifacts.xml),
            pdfSha256: sha256(artifacts.pdf),
            xmlBytes: new TextEncoder().encode(artifacts.xml).length,
            pdfBytes: artifacts.pdf.length,
            storedAt: now,
          });
        }
        if (inv.docType === 'original' || inv.docType === 'replacement') validInvoiceId = inv.id;
        if (target) {
          if (inv.docType === 'adjustment')
            deps.invoices.update(tx, target.id, {
              adjustedBy: [...target.adjustedBy, inv.id],
              history: [...target.history, hist('adjusted_by', result.number)].slice(-40),
              ...base,
              version: target.version + 1,
            });
          if (inv.docType === 'replacement')
            deps.invoices.update(tx, target.id, {
              replacedBy: inv.id,
              history: [...target.history, hist('replaced_by', result.number)].slice(-40),
              ...base,
              version: target.version + 1,
            });
        }
      }
      if (idx)
        deps.index.save(tx, {
          ...idx,
          validInvoiceId,
          updatedAt: now,
          version: idx.version + 1,
        });
      deps.queue.save(tx, queueWith(q, next, now));
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: r.branchId,
          entityType: 'invoice',
          entityId: r.purpose === 'cancel' ? (r.targetInvoiceId ?? inv.id) : inv.id,
          action: `invoice.${r.purpose === 'issue' ? 'issued' : r.purpose === 'cancel' ? 'cancelled' : r.purpose === 'adjust' ? 'adjusted' : 'replaced'}`,
          before: { status: r.status },
          after: {
            request: r.number,
            number: result.number ?? null,
            symbol: result.symbol ?? inv.issuer.symbol,
            totalVnd: inv.totalVnd,
          },
        }),
      );
      return next;
    }

    // ---- still processing at the provider ----------------------------------------------------------------
    if (result && result.state === 'processing') {
      const delay = nextAttemptDelayMinutes(r.attemptCount, policy.retryBackoffMinutes);
      const next: InvoiceRequest = {
        ...r,
        ...base,
        status: 'awaiting_provider',
        attempts,
        nextAttemptAt: new Date(now.getTime() + delay * 60_000),
        version: r.version + 1,
      };
      delete next.sendingUntil;
      deps.requests.update(tx, r.id, {
        status: 'awaiting_provider',
        attempts,
        sendingUntil: null,
        nextAttemptAt: next.nextAttemptAt,
        ...base,
        version: next.version,
      });
      deps.invoices.update(tx, inv.id, {
        sync: syncOf('awaiting_provider'),
        providerInvoiceId: result.providerInvoiceId,
        providerStatus: result.rawStatus,
        history: [...inv.history, hist('processing')].slice(-40),
        ...base,
        version: inv.version + 1,
      });
      deps.queue.save(tx, queueWith(q, next, now));
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: r.branchId,
          entityType: 'invoiceRequest',
          entityId: r.id,
          action: 'invoice.processing',
          after: { attempt: r.attemptCount },
        }),
      );
      return next;
    }

    // ---- error (or a state the purpose cannot use) -------------------------------------------------------
    const f = failure ?? {
      kind: 'rejected' as ErrorKind,
      code: 'unexpected_state',
      message: result?.rawStatus ?? 'unexpected',
    };
    const event = EVENT_OF_KIND[f.kind];
    const t = transitionRequest('sending', event);
    if (!t.ok) throw new AppError('request_transition_not_allowed', 409);
    const retryable = f.kind === 'timeout' || f.kind === 'unavailable';
    const delay = nextAttemptDelayMinutes(r.attemptCount, policy.retryBackoffMinutes);
    const next: InvoiceRequest = {
      ...r,
      ...base,
      status: t.to,
      attempts,
      lastError: { kind: f.kind, code: f.code, message: f.message.slice(0, 200) },
      version: r.version + 1,
    };
    delete next.sendingUntil;
    delete next.nextAttemptAt;
    if (retryable && r.attemptCount < r.maxAttempts)
      next.nextAttemptAt = new Date(now.getTime() + delay * 60_000);
    deps.requests.update(tx, r.id, {
      status: next.status,
      attempts,
      sendingUntil: null,
      nextAttemptAt: next.nextAttemptAt ?? null,
      lastError: next.lastError,
      ...base,
      version: next.version,
    });
    deps.invoices.update(tx, inv.id, {
      sync: syncOf(next.status),
      syncError: next.lastError,
      history: [...inv.history, hist(errorKindOf(event) ?? 'error', f.code)].slice(-40),
      ...base,
      version: inv.version + 1,
    });
    deps.queue.save(tx, queueWith(q, next, now));
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: r.branchId,
        entityType: 'invoiceRequest',
        entityId: r.id,
        action: 'invoice.error',
        after: { kind: f.kind, code: f.code, attempt: r.attemptCount, status: next.status },
      }),
    );
    // FR-EIN-010: the accountant is told every time a request lands in the queue (no personal data in the notice)
    notifyUsers(deps.sys, tx, {
      companyId: r.companyId,
      userIds: toNotify,
      kind: 'ein.issue',
      titleKey: 'notifications.einvoiceQueued',
      params: { count: '1', number: r.number },
      link: '/ein/queue',
      branchId: r.branchId,
    });
    return next;
  });
}

/**
 * Claims and runs one request. `manual` is a person pressing "Thử lại / Truy vấn"; `auto` is the job (only requests that
 * are due). Returns the request as it stands afterwards.
 */
export async function dispatchRequest(
  deps: EinDeps,
  actor: Actor,
  scope: Scope,
  ctx: RequestCtx,
  requestId: string,
  mode: 'manual' | 'auto',
): Promise<DispatchResult> {
  const c = await claimRequest(deps, actor, scope, ctx, requestId, mode);
  if (!c.claimed || !('phase' in c)) return c;
  const request = await runClaimed(deps, actor, scope, ctx, c);
  return { claimed: true, request };
}

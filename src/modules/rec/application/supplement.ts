import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import {
  hasPermission,
  resolveScope,
  requireWorkingBranch,
  type Actor,
} from '@/platform/rbac/rbac';
import { branchesScope, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { prepareHoldForApproval } from '@/modules/inv';
import { allocateDocumentNumber, notifyUsers, usersWithRole } from '@/modules/sys';
import {
  versionId,
  type Quote,
  type QuoteLink,
  type QuoteStatus,
  type QuoteVersion,
} from '../domain/entities';
import {
  itemId,
  itemSeedsOf,
  seqKeyOf,
  type RepairItem,
  type SupplementRef,
  type WorkProposal,
} from '../domain/order';
import { isOrderOpen, transitionOrder } from '../domain/orderState';
import { transitionQuote } from '../domain/quoteState';
import { computeTotals } from '../domain/pricing';
import type { RecDeps } from '../ports/deps';
import type { RepairOrder } from '../domain/order';
import { pushHistory, systemActor } from './orderHelpers';
import {
  AppError,
  assertWritable,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

/**
 * Work outside the approved quote (FR-REC-014, RULE-005/006): a technician PROPOSES, the advisor makes a
 * SUPPLEMENTARY quote (its own quote object, number from the BG series), the customer approves it through the
 * same approval core as any quote, and only then do its items join the existing order with their own stock
 * hold. Nothing here lets work or parts reach the order without an approval (R37 rule 5: no new order).
 */

// ---- technician's proposal ----------------------------------------------------------------------------

export const proposalSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().trim().min(3).max(120),
  note: z.string().trim().max(500).optional(),
});

/** "Báo hư hỏng phát sinh" (G2-TEC-04). Photos are not stored yet (file upload API is not built). */
export async function createProposal(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'work-proposal:create');
  const data = parseInput(proposalSchema, input);
  const o0 = await deps.orders.get(scope, orderId);
  if (!o0) throw notFound();
  // a technician only proposes on an order where they have an assigned item
  if (!hasPermission(actor, 'repair-item:manage')) {
    const mine = (await deps.items.listByOrder(scope, orderId, deps.rec.maxItemsPerOrder)).some(
      (i) => i.technicianId === actor.userId,
    );
    if (!mine) throw notFound();
  }
  const advisor = o0.advisorId;
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${orderId}/proposals`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scope, orderId);
      if (!o) throw notFound();
      if (o.version !== data.version) throw versionConflict();
      if (!isOrderOpen(o.status)) throw new AppError('order_state_invalid', 409);
      if (o.proposals.length >= deps.rec.maxProposalsPerOrder)
        throw new AppError('order_too_large', 422);
      await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      const now = deps.sys.clock.now();
      const p: WorkProposal = {
        id: `wp_${deps.sys.newId()}`,
        title: data.title,
        ...(data.note ? { note: data.note } : {}),
        proposedBy: actor.userId,
        proposedAt: now,
        status: 'open',
      };
      deps.orders.update(tx, o.id, {
        proposals: [...o.proposals, p],
        updatedAt: now,
        updatedBy: actor.userId,
        version: o.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairOrder',
          entityId: o.id,
          action: 'repairOrder.proposal',
          after: { proposalId: p.id, title: p.title },
        }),
      );
      if (advisor !== actor.userId)
        notifyUsers(deps.sys, tx, {
          companyId: o.companyId,
          userIds: [advisor],
          kind: 'rec.order',
          titleKey: 'notifications.proposalNew',
          params: { number: o.number },
          link: `/rec/orders/${o.id}`,
          branchId: o.branchId,
        });
      return { status: 201, body: { id: p.id, version: o.version + 1 } };
    },
  );
}

export const dismissProposalSchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().min(3).max(300),
});

export async function dismissProposal(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
  proposalId: string,
  input: unknown,
  ctx: RequestCtx,
) {
  const scope = resolveScope(actor, 'work-proposal:update');
  const data = parseInput(dismissProposalSchema, input);
  return deps.sys.uow.run(async (tx) => {
    const o = await deps.orders.getInTx(tx, scope, orderId);
    if (!o) throw notFound();
    if (o.version !== data.version) throw versionConflict();
    const p = o.proposals.find((x) => x.id === proposalId);
    if (!p) throw notFound();
    if (p.status !== 'open') throw new AppError('proposal_closed', 409);
    await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
    const now = deps.sys.clock.now();
    deps.orders.update(tx, o.id, {
      proposals: o.proposals.map((x) =>
        x.id === proposalId ? { ...x, status: 'dismissed', dismissedReason: data.reason } : x,
      ),
      updatedAt: now,
      updatedBy: actor.userId,
      version: o.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: o.branchId,
        entityType: 'repairOrder',
        entityId: o.id,
        action: 'repairOrder.proposal_dismiss',
        after: { proposalId },
        reason: data.reason,
      }),
    );
    return { id: o.id, version: o.version + 1 };
  });
}

// ---- the supplementary quote -----------------------------------------------------------------------------

export const supplementSchema = z.object({
  version: z.number().int().min(1),
  proposalId: z.string().trim().max(80).optional(),
});

/**
 * The advisor opens a supplementary quote on an open order. It is a normal quote (draft, versions, send,
 * counter or link approval) whose approval extends THIS order instead of opening a new one.
 */
export async function createSupplementaryQuote(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'quote:create');
  const data = parseInput(supplementSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${orderId}/supplement`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scope, orderId);
      if (!o || o.branchId !== requireWorkingBranch(actor)) throw notFound();
      if (o.version !== data.version) throw versionConflict();
      if (!isOrderOpen(o.status)) throw new AppError('order_state_invalid', 409);
      const branch = await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      const now = deps.sys.clock.now();
      const id = `qt_${deps.sys.newId()}`;
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'quote',
        businessDate: businessDate(now),
        stage: 'create',
        documentId: id,
        requestKey: ctx.idempotencyKey,
      });
      const q: Quote = {
        id,
        companyId: o.companyId,
        branchId: o.branchId,
        number: num.number!,
        intakeId: o.intakeId,
        vehicleId: o.vehicleId,
        customerId: o.customerId,
        plate: o.plate,
        plateNorm: o.plateNorm,
        vehicleLabel: o.vehicleLabel,
        customerName: o.customerName,
        advisorId: actor.userId,
        supplementOfOrderId: o.id,
        currentN: 1,
        status: 'draft',
        totalVnd: 0,
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      const v: QuoteVersion = {
        id: versionId(id, 1),
        quoteId: id,
        companyId: o.companyId,
        branchId: o.branchId,
        n: 1,
        status: 'draft',
        items: [],
        totals: computeTotals([]),
        taxes: [],
        pricedOn: businessDate(now),
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.quotes.create(tx, q);
      deps.versions.create(tx, v);
      let proposals = o.proposals;
      if (data.proposalId) {
        const p = proposals.find((x) => x.id === data.proposalId);
        if (!p || p.status !== 'open') throw new AppError('proposal_closed', 409);
        proposals = proposals.map((x) =>
          x.id === data.proposalId ? { ...x, status: 'quoted' as const, quoteId: id } : x,
        );
      }
      deps.orders.update(tx, o.id, {
        proposals,
        supplementQuoteIds: [...(o.supplementQuoteIds ?? []), id],
        updatedAt: now,
        updatedBy: actor.userId,
        version: o.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'quote',
          entityId: id,
          action: 'quote.create_supplement',
          after: { number: q.number, orderId: o.id, proposalId: data.proposalId ?? null },
        }),
      );
      return { status: 201, body: { id, number: q.number, orderId: o.id } };
    },
  );
}

// ---- the approved supplement joins the order ------------------------------------------------------------

/**
 * Called after a supplementary quote is approved (R37 rule 5): its approved items become items of the EXISTING
 * order, with their own stock hold; the order total grows by the approved total. Idempotent by quote id. An
 * order that was waiting for QC or delivery goes back to work (`reopen`). If the order is no longer open the
 * approval stands, nothing is appended and the manager is told (the supplement then needs a decision).
 */
export async function appendSupplement(
  deps: RecDeps,
  quote: Pick<Quote, 'id' | 'companyId' | 'branchId'>,
  actor: Actor | null,
  ctx: RequestCtx,
) {
  const scope = branchesScope(quote.companyId, [quote.branchId]);
  const by = actor ?? systemActor(quote.companyId, quote.branchId);
  const q = await deps.quotes.get(scope, quote.id);
  if (!q?.supplementOfOrderId) throw notFound();
  const versions = await deps.versions.listByQuote(scope, q.id, q.currentN);
  const v = versions.find((x) => x.approval);
  if (!v?.approval) throw new AppError('quote_not_approved', 409);
  const approval = v.approval;
  const orderId = q.supplementOfOrderId;
  const seeds = itemSeedsOf(
    approval.lines,
    (no) => v.items.find((i) => i.no === no)?.necessity ?? 'optional',
  );
  const partLines = approval.lines.filter((l) => l.kind === 'part' && l.partId && l.qty);
  const managers = await usersWithRole(deps.sys, q.companyId, ['QL'], q.branchId);
  const recipients = [...new Set([q.advisorId, ...managers])].filter((id) => id !== by.userId);

  return deps.sys.uow.run(async (tx) => {
    const o = await deps.orders.getInTx(tx, scope, orderId);
    if (!o) throw notFound();
    if (o.supplements.some((s) => s.quoteId === q.id))
      return { orderId, number: o.number, created: false, unmetLines: o.unmetLines };
    if (!isOrderOpen(o.status)) throw new AppError('order_state_invalid', 409);
    if (o.itemCount + seeds.length > deps.rec.maxItemsPerOrder)
      throw new AppError('order_too_large', 422);
    if (partLines.length && !o.warehouseId) throw new AppError('warehouse_missing', 409);
    const hold = partLines.length
      ? await prepareHoldForApproval(
          deps.inv,
          tx,
          by,
          scope,
          {
            orderId,
            warehouseId: o.warehouseId!,
            lines: partLines.map((l) => ({ lineKey: l.lineKey, partId: l.partId!, qty: l.qty! })),
          },
          ctx,
        )
      : null;
    const now = deps.sys.clock.now();
    const holds = hold ? hold.commit() : [];
    const unmet = new Set(holds.filter((h) => h.unmetQty > 0).map((h) => h.lineKey));
    const items: RepairItem[] = seeds.map((s, i) => {
      const no = o.itemCount + i + 1;
      const waiting = s.lines.some((l) => unmet.has(l.lineKey));
      return {
        id: itemId(orderId, no),
        companyId: q.companyId,
        branchId: q.branchId,
        orderId,
        no,
        seqKey: seqKeyOf(no),
        origin: 'supplement',
        sourceQuoteId: q.id,
        sourceItemNo: s.sourceItemNo,
        name: s.name,
        necessity: s.necessity,
        lines: s.lines,
        subtotalVnd: s.subtotalVnd,
        status: waiting ? 'paused' : 'not_started',
        active: true,
        ...(waiting ? { pauseReason: 'waiting_parts' } : {}),
        waitingParts: waiting,
        technicianId: null,
        technicianName: null,
        assignments: [],
        events: [],
        workedMs: 0,
        approvedMinutes: s.approvedMinutes,
        orderNumber: o.number,
        plate: o.plate,
        vehicleLabel: o.vehicleLabel,
        createdAt: now,
        createdBy: by.userId,
        updatedAt: now,
        updatedBy: by.userId,
        version: 1,
      };
    });
    for (const it of items) deps.items.create(tx, it);
    const ref: SupplementRef = {
      quoteId: q.id,
      number: q.number,
      versionN: v.n,
      approvedAt: approval.decidedAt,
      hash: approval.hash,
      totalVnd: approval.approvedTotalVnd,
      itemNos: items.map((i) => i.no),
    };
    const reopen = transitionOrder(o.status, 'reopen');
    // R47: extra approved work after a check was passed (or while it was awaited): the old result no longer counts
    const qcRuns = reopen.ok
      ? o.qcRuns.map((r, i) =>
          i === o.qcRuns.length - 1 && !r.invalidatedAt
            ? { ...r, invalidatedAt: now, invalidatedReason: `supplement:${q.number}` }
            : r,
        )
      : o.qcRuns;
    deps.orders.update(tx, o.id, {
      qcRuns,
      itemCount: o.itemCount + items.length,
      totalVnd: o.totalVnd + approval.approvedTotalVnd,
      supplements: [...o.supplements, ref],
      unmetLines: o.unmetLines + unmet.size,
      // finished work with new approved work goes back to the workshop
      ...(reopen.ok
        ? {
            status: reopen.state,
            open: true,
            history: pushHistory(o.history, {
              from: o.status,
              to: reopen.state,
              event: 'reopen',
              at: now,
              by: by.userId,
              reason: q.number,
            }),
          }
        : {}),
      updatedAt: now,
      updatedBy: by.userId,
      version: o.version + 1,
    });
    deps.quotes.update(tx, q.id, { orderId, updatedAt: now, updatedBy: by.userId });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, by, ctx, {
        branchId: q.branchId,
        entityType: 'repairOrder',
        entityId: orderId,
        action: 'repairOrder.supplement',
        after: {
          quoteId: q.id,
          quoteNumber: q.number,
          evidence: approval.hash,
          items: items.length,
          totalVnd: approval.approvedTotalVnd,
        },
      }),
    );
    if (recipients.length)
      notifyUsers(deps.sys, tx, {
        companyId: q.companyId,
        userIds: recipients,
        kind: 'rec.order',
        titleKey: 'notifications.supplementApproved',
        params: { number: o.number, quote: q.number },
        link: `/rec/orders/${orderId}`,
        branchId: q.branchId,
      });
    return { orderId, number: o.number, created: true, unmetLines: unmet.size };
  });
}

// ---- R47: supplements and a closed order ----------------------------------------------------------------

/**
 * R47: a supplementary quote cannot be approved (or sent) once its order is completed or cancelled. Called INSIDE the
 * approval transaction, so the race "the customer taps approve" against "the order completes" has one winner: the loser
 * gets 409 `order_closed` and no approval evidence is written (RULE-007: no approval for work without a source document).
 */
export async function assertSupplementOrderOpen(
  deps: RecDeps,
  tx: Tx,
  scope: Scope,
  q: Pick<Quote, 'supplementOfOrderId'>,
): Promise<void> {
  if (!q.supplementOfOrderId) return;
  const o = await deps.orders.getInTx(tx, scope, q.supplementOfOrderId);
  if (!o || !isOrderOpen(o.status)) throw new AppError('order_closed', 409);
}

/**
 * R47: when the order closes (handover or cancellation) every supplementary quote still draft or sent is closed with the
 * reason "order closed", its customer link stops working (read-only like R38) and the change is audited. Runs inside the
 * closing transaction in two phases because a Firestore transaction finishes its reads before its first write: `prepare`
 * READS (call it with the other reads), `commit` only STAGES the writes.
 */
export async function prepareCloseSupplements(
  deps: RecDeps,
  tx: Tx,
  scope: Scope,
  o: Pick<RepairOrder, 'branchId' | 'supplementQuoteIds' | 'number'>,
): Promise<{ commit(actor: Actor, ctx: RequestCtx, now: Date): number }> {
  const open: { q: Quote; v: QuoteVersion; link: QuoteLink | null; next: QuoteStatus }[] = [];
  for (const qid of o.supplementQuoteIds ?? []) {
    const q = await deps.quotes.getInTx(tx, scope, qid);
    if (!q) continue;
    const v = await deps.versions.getInTx(tx, scope, versionId(qid, q.currentN));
    if (!v) continue;
    const t = transitionQuote(v.status, 'close');
    if (!t.ok) continue;
    const link = v.linkHash ? await deps.links.findInTx(tx, v.linkHash) : null;
    open.push({ q, v, link, next: t.state });
  }
  return {
    commit(actor, ctx, now) {
      for (const { q, v, link, next } of open) {
        deps.versions.update(tx, v.id, {
          status: next,
          closedAt: now,
          closedReason: 'order_closed',
          updatedAt: now,
          updatedBy: actor.userId,
          version: v.version + 1,
        });
        deps.quotes.update(tx, q.id, {
          status: next,
          updatedAt: now,
          updatedBy: actor.userId,
          version: q.version + 1,
        });
        if (link && !link.revokedAt)
          deps.links.update(tx, link.id, { revokedAt: now, revokedReason: 'order_closed' });
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId: o.branchId,
            entityType: 'quote',
            entityId: q.id,
            action: 'quote.close',
            before: { n: v.n, status: v.status },
            after: { n: v.n, status: next, order: o.number },
            reason: 'order_closed',
          }),
        );
      }
      return open.length;
    },
  };
}

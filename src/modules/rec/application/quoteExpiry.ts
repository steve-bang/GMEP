import { businessDate, isoToVi } from '@/platform/format/date';
import { decodeCursor, MAX_LIMIT } from '@/platform/pagination/pagination';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { notifyUsers } from '@/modules/sys';
import { versionId, type Quote } from '../domain/entities';
import { quoteDuePhase, transitionQuote } from '../domain/quoteState';
import type { RecDeps } from '../ports/deps';
import { auditEntry, type RequestCtx } from './support';

/** What one run did in one branch. `failed` counts quotes whose own transaction threw (others are unaffected). */
export interface QuoteExpiryResult {
  scanned: number;
  expired: number;
  reminded: number;
  failed: number;
}

/** Safety bound on one run: pages of MAX_LIMIT sent quotes per branch; the rest is picked up by the next run. */
const MAX_PAGES = 20;

/**
 * Background job for R10 / R17 (FR-REC-011): per branch, move quotes awaiting the customer whose `validUntil` has
 * passed to "Hết hạn" (event `expire`, stored on the version and the quote) and remind the advisor in-app
 * `quoteReminderLeadDays` before expiry. Needs `quote:manage` (SYSTEM_CRON only); the Scope is the actor's, narrowed to the
 * branch. Selection reads the existing `quotes.list` shape (status `sent`, branch scope, createdAt) so it needs no new
 * index. Idempotent and overlap-safe: each quote is re-read inside its own transaction (Firestore retries a conflicting
 * run), the phase is recomputed on the fresh data, and the reminder marker `remindedFor` is stored in the same transaction.
 * Quotes hold no stock reservation (ba-answers: inventory), so nothing is released here.
 */
export async function runQuoteExpiry(
  deps: RecDeps,
  actor: Actor,
  ctx: RequestCtx,
): Promise<QuoteExpiryResult> {
  const scope = resolveScope(actor, 'quote:manage');
  const out: QuoteExpiryResult = { scanned: 0, expired: 0, reminded: 0, failed: 0 };
  const today = businessDate(deps.sys.clock.now());
  const lead = deps.rec.quoteReminderLeadDays;

  const due: { id: string }[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await deps.quotes.list(scope, {
      limit: MAX_LIMIT,
      status: 'sent',
      ...(cursor ? { cursor: decodeCursor(cursor)! } : {}),
    });
    for (const q of res.items) {
      out.scanned++;
      if (quoteDuePhase(q, today, lead)) due.push({ id: q.id });
    }
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }

  for (const { id } of due) {
    try {
      const phase = await applyOne(deps, actor, scope, id, ctx, lead);
      if (phase === 'expire') out.expired++;
      if (phase === 'remind') out.reminded++;
    } catch {
      out.failed++;
    }
  }
  return out;
}

async function applyOne(
  deps: RecDeps,
  actor: Actor,
  scope: ReturnType<typeof resolveScope>,
  id: string,
  ctx: RequestCtx,
  lead: number,
): Promise<'expire' | 'remind' | null> {
  return deps.sys.uow.run(async (tx) => {
    // reads first (Firestore transaction rule), then the writes
    const q: Quote | null = await deps.quotes.getInTx(tx, scope, id);
    if (!q) return null;
    const cur = await deps.versions.getInTx(tx, scope, versionId(id, q.currentN));
    if (!cur) return null;
    const now = deps.sys.clock.now();
    const today = businessDate(now);
    // the version is the truth for status and validity; the quote copy only helps the list
    const phase = quoteDuePhase(
      { status: cur.status, validUntil: cur.validUntil, remindedFor: q.remindedFor },
      today,
      lead,
    );
    if (!phase) return null; // decided, revised or already handled by an overlapping run
    if (phase === 'expire') {
      const t = transitionQuote(cur.status, 'expire');
      if (!t.ok) return null;
      deps.versions.update(tx, cur.id, {
        status: t.state,
        closedAt: now,
        closedReason: 'validity_ended',
        updatedAt: now,
        updatedBy: actor.userId,
        version: cur.version + 1,
      });
      deps.quotes.update(tx, id, {
        status: t.state,
        updatedAt: now,
        updatedBy: actor.userId,
        version: q.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: q.branchId,
          entityType: 'quote',
          entityId: id,
          action: 'quote.expire',
          before: { n: cur.n, status: cur.status, validUntil: cur.validUntil ?? null },
          after: { n: cur.n, status: t.state },
          reason: 'validity_ended',
        }),
      );
      return 'expire';
    }
    deps.quotes.update(tx, id, {
      remindedFor: cur.validUntil,
      updatedAt: now,
      updatedBy: actor.userId,
      version: q.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: q.branchId,
        entityType: 'quote',
        entityId: id,
        action: 'quote.remind_expiry',
        after: { n: cur.n, validUntil: cur.validUntil ?? null },
      }),
    );
    notifyUsers(deps.sys, tx, {
      companyId: q.companyId,
      userIds: [q.advisorId],
      kind: 'rec.quote_expiring',
      titleKey: 'notifications.quoteExpiringSoon',
      params: { number: q.number, n: String(cur.n), validUntil: isoToVi(cur.validUntil) },
      link: `/rec/quotes/${q.id}`,
      branchId: q.branchId,
    });
    return 'remind';
  });
}

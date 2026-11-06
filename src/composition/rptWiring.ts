import { mapPool } from '@/platform/async/mapPool';
import { decodeCursor } from '@/platform/pagination/pagination';
import { branchesScope, scopeAllows, type Scope } from '@/platform/scope/scope';
import { businessDate } from '@/platform/format/date';
import type { AccDeps } from '@/modules/acc';
import type { EinDeps } from '@/modules/ein';
import { isOpenRequest } from '@/modules/ein';
import type { InvDeps } from '@/modules/inv';
import type { RecDeps, RepairOrder } from '@/modules/rec';
import {
  DEFAULT_RPT_CONFIG,
  type BalanceFact,
  type Capped,
  type OrderFact,
  type WorkItemFact,
  type RptDeps,
  type RptSources,
} from '@/modules/rpt';
import type { SysDeps } from '@/modules/sys';
import { DocRollupRepository } from '@/infrastructure/repos/rptRepos';
import type { DocStore } from '@/platform/store/docStore';

const DAY_MS = 86_400_000;

/** One branch of the actor's scope, or null when the scope does not cover it (the source then answers "nothing"). */
function oneBranch(scope: Scope, branchId: string): Scope | null {
  return scopeAllows(scope, scope.tenantId, branchId)
    ? branchesScope(scope.tenantId, [branchId])
    : null;
}

const orderFact = (o: RepairOrder): OrderFact => ({
  id: o.id,
  number: o.number,
  plate: o.plate,
  customerName: o.customerName,
  status: o.status,
  createdAt: o.createdAt,
  ...(o.completedAt ? { completedAt: o.completedAt } : {}),
  ...(o.cancelledAt ? { cancelledAt: o.cancelledAt } : {}),
  ...(o.handover?.at ? { handedOverAt: o.handover.at } : {}),
  totalVnd: o.totalVnd,
  serviceType: o.serviceType ?? null,
  ...(o.promisedDate ? { promisedDate: o.promisedDate } : {}),
});

const empty = <T>(): Capped<T> => ({ items: [], truncated: false });

/**
 * RPT reads REC, ACC, EIN and INV only through their PUBLIC repositories and always inside one branch Scope (the same
 * pattern as EIN reading REC, plan §2.2). It writes nothing to them. Every list is bounded and says when it was cut.
 */
export function buildRptSources(
  getRec: () => RecDeps,
  getAcc: () => AccDeps,
  getEin: () => EinDeps,
  getInv: () => InvDeps,
): RptSources {
  return {
    async orders(scope, branchId, range, limit) {
      const s = oneBranch(scope, branchId);
      if (!s) return empty();
      const rec = getRec();
      const items: OrderFact[] = [];
      // newest created first, starting just before `until` (id '0' sorts below any real id)
      let cursor: { v: string; id: string } | undefined = { v: range.until.toISOString(), id: '0' };
      let truncated = false;
      for (;;) {
        const page = await rec.orders.list(s, { limit: 100, ...(cursor ? { cursor } : {}) });
        let reachedSince = false;
        for (const o of page.items) {
          if (o.createdAt.getTime() < range.since.getTime()) {
            reachedSince = true;
            break;
          }
          if (items.length >= limit) {
            truncated = true;
            break;
          }
          items.push(orderFact(o));
        }
        if (truncated || reachedSince || !page.nextCursor) break;
        cursor = decodeCursor(page.nextCursor);
      }
      return { items, truncated };
    },
    async openOrders(scope, branchId, limit) {
      const s = oneBranch(scope, branchId);
      if (!s) return empty();
      const rows = (await getRec().orders.listOpen(s, limit + 1)).filter(
        (o) => o.branchId === branchId,
      );
      return { items: rows.slice(0, limit).map(orderFact), truncated: rows.length > limit };
    },
    async orderLines(scope, ids) {
      const out = new Map<string, { laborVnd: number; partsVnd: number }>();
      for (const id of ids) {
        const items = await getRec().items.listByOrder(scope, id, getRec().rec.maxItemsPerOrder);
        let laborVnd = 0;
        let partsVnd = 0;
        for (const it of items)
          for (const l of it.lines) {
            if (l.kind === 'labor') laborVnd += l.amountVnd;
            else partsVnd += l.amountVnd;
          }
        out.set(id, { laborVnd, partsVnd });
      }
      return out;
    },
    async orderMoney(scope, ids) {
      const out = new Map<string, { receivedVnd: number; openDebtVnd: number }>();
      if (ids.length === 0) return out;
      const accounts = await getAcc().accounts.getMany(scope, ids);
      for (const a of accounts)
        out.set(a.orderId, {
          receivedVnd: a.receivedVnd + a.depositAppliedVnd,
          openDebtVnd: a.debt && a.debt.status === 'open' ? a.debt.amountVnd : 0,
        });
      return out;
    },
    async invoiceStates(scope, ids) {
      const out = new Map<string, { valid: boolean; requestOpen: boolean }>();
      if (ids.length === 0) return out;
      const ein = getEin();
      const idx = await ein.index.getMany(scope, ids);
      const reqIds = idx.flatMap((x) =>
        !x.validInvoiceId && x.issueRequestId ? [x.issueRequestId] : [],
      );
      const reqs = new Map(
        (reqIds.length ? await ein.requests.getMany(scope, reqIds) : []).map((r) => [r.id, r]),
      );
      for (const x of idx) {
        const r = x.issueRequestId ? reqs.get(x.issueRequestId) : undefined;
        out.set(x.id, { valid: !!x.validInvoiceId, requestOpen: !!r && isOpenRequest(r.status) });
      }
      return out;
    },
    async payments(scope, branchId, window, limit) {
      const rows = await getAcc().payments.listByBranch(scope, branchId, window, limit + 1);
      return {
        items: rows.slice(0, limit).map((p) => ({
          id: p.id,
          number: p.number,
          kind: p.kind,
          direction: p.direction,
          ...(p.reversesKind ? { reversesKind: p.reversesKind } : {}),
          orderId: p.orderId,
          businessDate: p.businessDate,
          lines: p.lines.map((l) => ({ method: l.method, amountVnd: l.amountVnd })),
          totalVnd: p.totalVnd,
        })),
        truncated: rows.length > limit,
      };
    },
    async openDebts(scope, branchId, limit) {
      const rows = await getAcc().debts.listByStatus(scope, branchId, 'open', limit + 1);
      return {
        items: rows.slice(0, limit).map((d) => ({
          id: d.id,
          orderId: d.orderId,
          orderNumber: d.orderNumber,
          customerName: d.customerName,
          amountVnd: d.amountVnd,
          dueDate: d.dueDate,
        })),
        truncated: rows.length > limit,
      };
    },
    async shifts(scope, branchId, date, limit) {
      const from = new Date(`${date}T00:00:00+07:00`);
      const rows = await getAcc().cash.listShifts(
        scope,
        branchId,
        { from: new Date(from.getTime() - DAY_MS), to: new Date(from.getTime() + 3 * DAY_MS) },
        limit + 1,
      );
      return {
        items: rows
          .filter((s) => s.businessDate === date)
          .slice(0, limit)
          .map((s) => ({
            id: s.id,
            status: s.status,
            varianceVnd: s.varianceVnd ?? null,
            varianceStatus: s.varianceStatus,
          })),
        truncated: rows.length > limit,
      };
    },
    async dayClosedAt(scope, branchId, date) {
      const d = await getAcc().cash.getDayClose(scope, branchId, date);
      return d ? d.closedAt : null;
    },
    async invoicesIssued(scope, branchId, window, limit) {
      // the list is by creation time; an invoice created the evening before may be issued today: read a day each side
      const rows = await getEin().invoices.listByBranch(scope, branchId, {
        limit: limit + 1,
        from: new Date(window.from.getTime() - DAY_MS),
        to: new Date(window.to.getTime() + DAY_MS),
      });
      const inDay = rows.items.filter(
        (i) =>
          i.issuedAt &&
          i.issuedAt.getTime() >= window.from.getTime() &&
          i.issuedAt.getTime() < window.to.getTime(),
      );
      return {
        items: inDay.slice(0, limit).map((i) => ({
          id: i.id,
          ...(i.number ? { number: i.number } : {}),
          orderId: i.orderId,
          orderNumber: i.orderNumber,
          valid: i.status === 'issued',
          totalVnd: i.totalVnd,
          issuedDate: businessDate(i.issuedAt!),
        })),
        truncated: !!rows.nextCursor,
      };
    },
    async stockBalances(scope, branchId, limit) {
      const s = oneBranch(scope, branchId);
      if (!s) return empty();
      const inv = getInv();
      const items: BalanceFact[] = [];
      let cursor: { v: string; id: string } | undefined;
      let truncated = false;
      for (;;) {
        const page = await inv.balances.list(s, { limit: 100, ...(cursor ? { cursor } : {}) });
        for (const b of page.items) {
          if (items.length >= limit) {
            truncated = true;
            break;
          }
          if (b.branchId !== branchId) continue;
          items.push({
            warehouseId: b.warehouseId,
            partId: b.partId,
            partCode: b.partCode,
            partName: b.partName,
            onHand: b.onHand,
            reserved: b.reserved,
            inTransit: b.inTransit,
            valueVnd: b.valueVnd,
            minQty: b.minQty,
            maxQty: b.maxQty,
          });
        }
        if (truncated || !page.nextCursor) break;
        cursor = decodeCursor(page.nextCursor);
      }
      return { items, truncated };
    },
    async workItems(scope, branchId, window, opts) {
      const s = oneBranch(scope, branchId);
      if (!s) return empty();
      const rec = getRec();
      const since = window.from.getTime() - opts.lookbackDays * DAY_MS;
      const done: RepairOrder[] = [];
      let cursor: { v: string; id: string } | undefined = { v: window.to.toISOString(), id: '0' };
      let truncated = false;
      for (;;) {
        const page = await rec.orders.list(s, { limit: 100, ...(cursor ? { cursor } : {}) });
        let reachedSince = false;
        for (const o of page.items) {
          if (o.createdAt.getTime() < since) {
            reachedSince = true;
            break;
          }
          const c = o.completedAt?.getTime();
          if (c === undefined || c < window.from.getTime() || c >= window.to.getTime()) continue;
          if (opts.serviceType && o.serviceType !== opts.serviceType) continue;
          if (done.length >= opts.maxOrders) {
            truncated = true;
            break;
          }
          done.push(o);
        }
        if (truncated || reachedSince || !page.nextCursor) break;
        cursor = decodeCursor(page.nextCursor);
      }
      // one by-key read per finished order, a few at a time (up to maxOrders of them); order of the result is kept
      const perOrder = await mapPool(done, 10, async (o) => {
        const list = await rec.items.listByOrder(s, o.id, rec.rec.maxItemsPerOrder);
        return list.map((it): WorkItemFact => ({
          orderId: o.id,
          orderNumber: o.number,
          serviceType: o.serviceType ?? null,
          technicianId: it.technicianId,
          technicianName: it.technicianName,
          status: it.status,
          workedMs: it.workedMs,
          approvedMinutes: it.approvedMinutes,
        }));
      });
      const items = perOrder.flat();
      return { items, truncated };
    },
    async stockIssues(scope, branchId, date, limit) {
      const s = oneBranch(scope, branchId);
      if (!s) return empty();
      const inv = getInv();
      const dayStart = new Date(`${date}T00:00:00+07:00`).getTime();
      const items: { id: string; label: string; sourceType: string; sourceId: string | null }[] =
        [];
      let cursor: { v: string; id: string } | undefined;
      let scanned = 0;
      let truncated = false;
      for (;;) {
        const page = await inv.documents.list(s, {
          type: 'GIN',
          status: 'posted',
          limit: 100,
          ...(cursor ? { cursor } : {}),
        });
        let past = false;
        for (const d of page.items) {
          if (d.createdAt.getTime() < dayStart - 2 * DAY_MS) {
            past = true;
            break;
          }
          if (++scanned > limit) {
            truncated = true;
            break;
          }
          if (d.branchId === branchId && d.businessDate === date)
            items.push({
              id: d.id,
              label: d.number ?? d.draftRef,
              sourceType: d.source.type,
              sourceId: d.source.id,
            });
        }
        if (truncated || past || !page.nextCursor) break;
        cursor = decodeCursor(page.nextCursor);
      }
      return { items, truncated };
    },
  };
}

export function buildRpt(
  sys: SysDeps,
  store: DocStore,
  getRec: () => RecDeps,
  getAcc: () => AccDeps,
  getEin: () => EinDeps,
  getInv: () => InvDeps,
): RptDeps {
  return {
    sys,
    rollups: new DocRollupRepository(store),
    sources: buildRptSources(getRec, getAcc, getEin, getInv),
    rpt: { ...DEFAULT_RPT_CONFIG },
  };
}

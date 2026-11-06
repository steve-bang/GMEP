import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { DocStore } from '@/platform/store/docStore';
import {
  DEFAULT_HRM_CONFIG,
  prepareCancel,
  prepareQcFail,
  prepareQcPass,
  type HrmDeps,
  type LaborCall,
  type LaborItemFacts,
  type LaborOrderSource,
  type LaborOrderView,
} from '@/modules/hrm';
import type { LaborGate, LaborQcCall, RecDeps, RepairItem, RepairOrder } from '@/modules/rec';
import type { SysDeps } from '@/modules/sys';
import { DocEmployeeRepository, DocLaborSheetRepository } from '@/infrastructure/repos/hrmRepos';

/**
 * HRM and REC know each other only through ports (plan §2.2: no cycle between modules). This is the one place that
 * connects them: REC calls `LaborGate` around QC and cancel; HRM reads the order and its items through `LaborOrderSource`.
 * The mapping below is where "the approved labor minutes of an item" is read off the approved quote lines.
 */
function itemFacts(i: RepairItem): LaborItemFacts {
  const labor = i.lines.filter((l) => l.kind === 'labor');
  return {
    itemId: i.id,
    no: i.no,
    name: i.name,
    status: i.status,
    technicianId: i.technicianId,
    assignments: i.assignments.map((a) => ({ technicianId: a.technicianId, at: a.at })),
    events: i.events.map((e) => ({
      type: e.type,
      at: e.at,
      ...(e.undone ? { undone: true } : {}),
    })),
    standardMinutes: labor.reduce((s, l) => s + (l.minutes ?? 0), 0),
    laborAmountVnd: labor.reduce((s, l) => s + l.amountVnd, 0),
    hoursVersionIds: [
      ...new Set(labor.flatMap((l) => (l.hoursVersionId ? [l.hoursVersionId] : []))),
    ],
  };
}

const viewOf = (o: RepairOrder, items: readonly RepairItem[]): LaborOrderView => ({
  id: o.id,
  tenantId: o.tenantId,
  branchId: o.branchId,
  number: o.number,
  serviceType: o.serviceType ?? '',
  status: o.status,
  items: items.map(itemFacts),
});

export function recLaborOrderSource(getRec: () => RecDeps): LaborOrderSource {
  return {
    async get(scope: Scope, id: string) {
      const rec = getRec();
      const o = await rec.orders.get(scope, id);
      if (!o) return null;
      return viewOf(o, await rec.items.listByOrder(scope, id, rec.rec.maxItemsPerOrder));
    },
    async getInTx(tx: Tx, scope: Scope, id: string) {
      const rec = getRec();
      const o = await rec.orders.getInTx(tx, scope, id);
      if (!o) return null;
      return viewOf(o, await rec.items.listByOrderInTx(tx, scope, id, rec.rec.maxItemsPerOrder));
    },
  };
}

export function buildHrm(sys: SysDeps, store: DocStore, getRec: () => RecDeps): HrmDeps {
  return {
    sys,
    employees: new DocEmployeeRepository(store),
    sheets: new DocLaborSheetRepository(store),
    orders: recLaborOrderSource(getRec),
    hrm: { ...DEFAULT_HRM_CONFIG },
  };
}

const callOf = (c: LaborQcCall): LaborCall => ({
  tx: c.tx,
  scope: c.scope,
  actor: c.actor,
  ctx: c.ctx,
  order: {
    id: c.order.id,
    tenantId: c.order.tenantId,
    branchId: c.order.branchId,
    number: c.order.number,
    serviceType: c.order.serviceType ?? '',
  },
  items: c.items.map(itemFacts),
  at: c.at,
  businessDate: c.businessDate,
});

/** REC's view of HRM: labor recorded inside REC's own transactions (FR-HRM-007, 008). */
export function hrmLaborGate(getHrm: () => HrmDeps): LaborGate {
  return {
    prepareQcPass: (c) => prepareQcPass(getHrm(), { ...callOf(c), qcRun: c.qcRun }),
    prepareQcFail: (c) =>
      prepareQcFail(getHrm(), {
        ...callOf(c),
        qcRun: c.qcRun,
        returnedItemIds: c.returnedItemIds,
      }),
    prepareCancel: (c) => prepareCancel(getHrm(), { ...callOf(c), reason: c.reason }),
  };
}

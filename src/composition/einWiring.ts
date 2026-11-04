import { decodeCursor } from '@/platform/pagination/pagination';
import type { Scope } from '@/platform/scope/scope';
import type { CrmDeps } from '@/modules/crm';
import {
  DEFAULT_EIN_CONFIG,
  hasValidInvoice,
  type BuyerSource,
  type EinDeps,
  type InvoiceableOrder,
  type InvoiceOrderSource,
  type SourceLine,
} from '@/modules/ein';
import type { RecDeps, RepairItem, RepairOrder } from '@/modules/rec';
import type { SysDeps } from '@/modules/sys';
import type { FileStore } from '@/platform/files/fileStore';
import {
  DocInvoiceQueueRepository,
  DocInvoiceRepository,
  DocInvoiceRequestRepository,
  DocOrderInvoiceIndexRepository,
} from '@/infrastructure/repos/einRepos';
import type { DocStore } from '@/platform/store/docStore';
import type { FakeProvider } from '@/infrastructure/einvoice/fakeProvider';
import { StaticProviderRegistry } from '@/infrastructure/einvoice/fakeProvider';

/**
 * EIN reads the repair order (REC) and the customer (CRM) only through ports; this is the one place that connects them
 * (the same pattern as ACC, plan §2.2). The invoice lines are the APPROVED lines of the order's repair items, with the
 * tax key, version and rate stored on each line at quote time (R2): nothing is priced or taxed again.
 */
const formatQty = (qty: number, scale: number): string => {
  const v = qty / scale;
  return Number.isInteger(v) ? String(v) : v.toFixed(Math.log10(scale)).replace(/\.?0+$/, '');
};

function sourceLines(items: readonly RepairItem[]): SourceLine[] {
  return items.flatMap((item) =>
    item.lines.map((l): SourceLine => {
      const base = {
        sourceKey: item.origin === 'base' ? 'base' : item.sourceQuoteId,
        lineKey: l.lineKey,
        kind: l.kind,
        code: l.code,
        name: l.name,
        amountVnd: l.amountVnd,
        taxKey: l.taxKey,
        taxVersionId: l.taxVersionId,
        taxRateBp: l.taxRateBp,
      };
      const qty =
        l.kind === 'part' && l.qty !== undefined
          ? formatQty(l.qty, l.qtyScale ?? 1)
          : l.kind === 'labor' && l.minutes !== undefined
            ? `${formatQty(l.minutes, 60)} h`
            : undefined;
      return qty ? { ...base, quantityText: qty } : base;
    }),
  );
}

const head = (o: RepairOrder) => ({
  id: o.id,
  companyId: o.companyId,
  branchId: o.branchId,
  number: o.number,
  status: o.status,
  qcPassed: o.status === 'ready_for_delivery' || o.status === 'completed',
  completed: o.status === 'completed',
  cancelled: o.status === 'cancelled',
  completedAt: o.completedAt ?? null,
  totalVnd: o.totalVnd,
  customerId: o.customerId,
  customerName: o.customerName,
  plate: o.plate,
});

export function recInvoiceOrders(getRec: () => RecDeps, itemsMax = 120): InvoiceOrderSource {
  return {
    async get(scope: Scope, orderId: string): Promise<InvoiceableOrder | null> {
      const rec = getRec();
      const o = await rec.orders.get(scope, orderId);
      if (!o) return null;
      const items = await rec.items.listByOrder(scope, orderId, itemsMax);
      return { ...head(o), lines: sourceLines(items) };
    },
    async listCompleted(scope: Scope, limit: number) {
      const rec = getRec();
      const out: ReturnType<typeof head>[] = [];
      let cursor: ReturnType<typeof decodeCursor>;
      while (out.length < limit) {
        const page = await rec.orders.list(scope, {
          status: 'completed',
          limit: Math.min(100, limit - out.length),
          ...(cursor ? { cursor } : {}),
        });
        out.push(...page.items.map(head));
        if (!page.nextCursor) break;
        cursor = decodeCursor(page.nextCursor);
      }
      return out;
    },
  };
}

export function crmBuyers(getCrm: () => CrmDeps): BuyerSource {
  return {
    async get(scope, customerId) {
      const crm = getCrm();
      const c = await crm.customers.get(scope, customerId);
      if (!c) return null;
      const pii = await crm.customers.getPii(scope.companyId, customerId);
      return {
        kind: c.type === 'business' ? 'business' : 'retail',
        name: c.name,
        ...(c.taxCode ? { taxCode: c.taxCode } : {}),
        ...(pii?.address ? { address: pii.address } : {}),
        ...(pii?.email ? { email: pii.email } : {}),
      };
    },
  };
}

export function buildEin(
  sys: SysDeps,
  store: DocStore,
  getRec: () => RecDeps,
  getCrm: () => CrmDeps,
  files: FileStore,
  fake: FakeProvider,
): EinDeps {
  return {
    sys,
    invoices: new DocInvoiceRepository(store),
    requests: new DocInvoiceRequestRepository(store),
    index: new DocOrderInvoiceIndexRepository(store),
    queue: new DocInvoiceQueueRepository(store),
    orders: recInvoiceOrders(getRec),
    buyers: crmBuyers(getCrm),
    // no real provider is chosen yet: `fake` is the only adapter and it is test-environment only
    providers: new StaticProviderRegistry({ fake }),
    files,
    ein: { ...DEFAULT_EIN_CONFIG },
  };
}

/**
 * R75: the one bridge from REC / INV / ACC to EIN's "does the order have an effective invoice?". Each of those modules
 * declares its own `OrderInvoiceGate` port (structurally identical); none of them imports EIN. A failure to read EIN
 * propagates, and the callers turn it into a block (fail closed), never into a silent pass.
 */
export function einInvoiceGate(getEin: () => EinDeps): {
  hasValidInvoice(scope: Scope, orderId: string): Promise<boolean>;
} {
  return { hasValidInvoice: (scope, orderId) => hasValidInvoice(getEin(), scope, orderId) };
}

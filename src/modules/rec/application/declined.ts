import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { getVehicle, normalizePlate } from '@/modules/crm';
import { versionId, type QuoteStatus } from '../domain/entities';
import type { RecDeps } from '../ports/deps';

/**
 * FR-REC-024 (slice 2.8b; BR-REC-11): items the customer refused or left undone, so the advisor can offer them again
 * when the vehicle comes back. Read from the quotes of the vehicle INSIDE the actor's scope (existing `quotes.byPlate`
 * shape, no new index): a partly approved quote contributes its declined items, a refused quote all of its items.
 * Refused REQUIRED items keep the safety flag. Another branch's refusals are not shown (not in the P3 white list).
 */
export interface DeclinedItemDto {
  quoteId: string;
  quoteNumber: string;
  branchId: string;
  /** yyyy-MM-dd of the customer's decision */
  decidedOn: string;
  itemNo: number;
  name: string;
  necessity: 'required' | 'optional';
  safety: boolean;
  reasonCode: string | null;
  reasonNote: string | null;
  subtotalVnd: number;
}

const DECLINING: readonly QuoteStatus[] = ['approved_partial', 'rejected'];

export async function listDeclinedItems(
  deps: RecDeps,
  actor: Actor,
  vehicleId: string,
): Promise<{ vehicleId: string; items: DeclinedItemDto[]; truncated: boolean }> {
  const scope = resolveScope(actor, 'quote:view');
  const vehicle = await getVehicle(deps.crm, actor, vehicleId);
  const plateNorm = normalizePlate(vehicle.plate);
  const max = deps.rec.pickerMax;
  const items: DeclinedItemDto[] = [];
  let truncated = false;
  for (const status of DECLINING) {
    const page = await deps.quotes.list(scope, { limit: max, status, platePrefix: plateNorm });
    if (page.nextCursor) truncated = true;
    const quotes = page.items.filter((q) => q.vehicleId === vehicleId && !q.supplementOfOrderId);
    const versions = await Promise.all(
      quotes.map((q) => deps.versions.get(scope, versionId(q.id, q.currentN))),
    );
    quotes.forEach((q, n) => {
      const v = versions[n];
      if (!v) return;
      const base = { quoteId: q.id, quoteNumber: q.number, branchId: q.branchId };
      if (status === 'approved_partial' && v.approval) {
        const on = v.approval.decidedAt.toISOString().slice(0, 10);
        for (const d of v.approval.declined)
          items.push({
            ...base,
            decidedOn: on,
            itemNo: d.itemNo,
            name: d.name,
            necessity: d.necessity,
            safety: d.safety,
            reasonCode: d.reasonCode ?? null,
            reasonNote: d.reasonNote ?? null,
            subtotalVnd: d.subtotalVnd,
          });
      } else if (status === 'rejected') {
        const on = (v.rejectedAt ?? q.updatedAt).toISOString().slice(0, 10);
        v.items.forEach((it) =>
          items.push({
            ...base,
            decidedOn: on,
            itemNo: it.no,
            name: it.name,
            necessity: it.necessity,
            safety: it.necessity === 'required',
            reasonCode: null,
            reasonNote: v.rejectReason ?? null,
            subtotalVnd: it.subtotalVnd,
          }),
        );
      }
    });
  }
  items.sort((a, b) => b.decidedOn.localeCompare(a.decidedOn) || a.itemNo - b.itemNo);
  return { vehicleId, items, truncated };
}

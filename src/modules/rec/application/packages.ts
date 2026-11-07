import { businessDate } from '@/platform/format/date';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { resolveCatalogAt } from '@/modules/sys';
import type { RecDeps } from '../ports/deps';
import type { ItemInput } from './quoteBuild';

/**
 * FR-REC-020 (slice 2.8b): maintenance packages ("gói bảo dưỡng"), the effective-dated `service-package` catalogue.
 * Choosing a package gives the quote ALL its items and lines in the `items` shape of the quote edit, so the advisor
 * adds them with the existing quote edit (same pricing, standard hours, discount limit and tax as any line). The fixed
 * package price is not applied: how it is represented is open [Cần xác nhận: BA/Kế toán khách].
 */
export interface ServicePackageDto {
  code: string;
  name: string;
  serviceType: string | null;
  items: ItemInput[];
}

export async function listServicePackages(
  deps: RecDeps,
  actor: Actor,
): Promise<ServicePackageDto[]> {
  resolveScope(actor, 'quote:view');
  const rows = await resolveCatalogAt(deps.sys, {
    tenantId: actor.tenantId,
    type: 'service-package',
    date: businessDate(deps.sys.clock.now()),
  });
  return rows
    .filter((r) => r.payload.status !== 'inactive')
    .map((r) => {
      const p = r.payload as {
        name: string;
        serviceType?: string;
        items: (Omit<ItemInput, 'customerRequested'> & { customerRequested?: boolean })[];
      };
      return {
        code: r.code,
        name: p.name,
        serviceType: p.serviceType ?? null,
        items: p.items.map((i) => ({ ...i, customerRequested: false })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

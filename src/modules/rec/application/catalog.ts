import { businessDate } from '@/platform/format/date';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { getAvailability, listParts } from '@/modules/inv';
import { listServices, resolveConfigAt } from '@/modules/sys';
import type { RecDeps } from '../ports/deps';
import { parseInput, z } from './support';

/**
 * Pickers for the quote editor (FR-REC-005, FR-REC-006). A service shows its standard hours and the
 * branch hourly rate in force today; a part shows its list price and the AVAILABLE quantity only
 * (never on-hand, reserved or cost: BA-04 Câu 6).
 */
const pickerSchema = z.object({ q: z.string().trim().max(60).default('') });

export interface ServicePick {
  id: string;
  code: string;
  name: string;
  standardMinutes: number | null;
  hourlyRateVnd: number | null;
}
export interface PartPick {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantityScale: number;
  listPriceVnd: number | null;
  available: number | null;
}

export async function pickServices(
  deps: RecDeps,
  actor: Actor,
  raw: unknown,
): Promise<ServicePick[]> {
  resolveScope(actor, 'quote:view');
  const { q } = parseInput(pickerSchema, raw);
  const date = businessDate(deps.sys.clock.now());
  const page = await listServices(deps.sys, actor, { q, limit: deps.rec.pickerMax });
  const rate = await resolveConfigAt(deps.sys, {
    companyId: actor.companyId,
    type: 'labor-rate',
    scopeKey: 'company',
    date,
    ...(actor.workingBranchId ? { branchId: actor.workingBranchId } : {}),
  });
  const hourly = (rate?.payload as { hourlyRateVnd?: number } | undefined)?.hourlyRateVnd ?? null;
  return Promise.all(
    page.items
      .filter((s) => s.status === 'active')
      .map(async (s) => {
        const h = await resolveConfigAt(deps.sys, {
          companyId: actor.companyId,
          type: 'standard-hours',
          scopeKey: `service:${s.code}`,
          date,
        });
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          standardMinutes:
            (h?.payload as { standardMinutes?: number } | undefined)?.standardMinutes ?? null,
          hourlyRateVnd: hourly,
        };
      }),
  );
}

export async function pickParts(deps: RecDeps, actor: Actor, raw: unknown): Promise<PartPick[]> {
  resolveScope(actor, 'quote:view');
  const { q } = parseInput(pickerSchema, raw);
  const date = businessDate(deps.sys.clock.now());
  const page = await listParts(deps.inv, actor, { q, limit: deps.rec.pickerMax, status: 'active' });
  const avail = new Map<string, number>();
  if (page.items.length && hasPermission(actor, 'stock-availability:view')) {
    try {
      for (const a of await getAvailability(deps.inv, actor, {
        partIds: page.items.map((p) => p.id),
      }))
        avail.set(a.partId, a.available);
    } catch {
      /* no working branch chosen: no availability number */
    }
  }
  return Promise.all(
    page.items.map(async (p) => {
      const price = await resolveConfigAt(deps.sys, {
        companyId: actor.companyId,
        type: 'price-item',
        scopeKey: `${deps.rec.priceListCode}:${p.code}`,
        date,
      });
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        quantityScale: p.quantityScale,
        listPriceVnd:
          (price?.payload as { listPriceVnd?: number } | undefined)?.listPriceVnd ?? null,
        available: avail.get(p.id) ?? null,
      };
    }),
  );
}

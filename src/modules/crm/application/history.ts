import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { notFound } from '@/platform/errors/errors';
import type { VehicleHistoryEntry } from '../domain/entities';
import type { CrmDeps } from '../ports/deps';
import { parseInput, z } from './support';

export interface HistoryDto {
  id: string;
  branchName: string;
  orderCode: string;
  date: string;
  km: number | null;
  items: string[];
  parts: { name: string; qty: number }[];
  /** null when the client decided prices are not shown across branches (BA P3) */
  totalVnd: number | null;
}

export function toHistoryDto(e: VehicleHistoryEntry, showPrice: boolean): HistoryDto {
  return {
    id: e.id,
    branchName: e.branchName,
    orderCode: e.orderCode,
    date: e.date,
    km: e.km ?? null,
    items: e.items,
    parts: e.parts,
    totalVnd: showPrice && e.totalVnd !== undefined ? e.totalVnd : null,
  };
}

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
});

/**
 * FR-CRM-004: repair history of a vehicle across ALL branches (a cross-branch projection read
 * model, BA §10 P3). Needs `vehicle-history:view` and either a relation between the vehicle and the
 * actor's scope, or the cross-branch rights `customer-lookup:view` + `vehicle-history-cross:view` (C20: CH, CV, QL, QĐ;
 * intake of a vehicle first seen at another branch). The projection contains only white-listed fields.
 */
export async function listVehicleHistory(
  deps: CrmDeps,
  actor: Actor,
  vehicleId: string,
  raw: unknown,
): Promise<Page<HistoryDto>> {
  const scope = resolveScope(actor, 'vehicle-history:view');
  const q = parseInput(schema, raw);
  const related = await deps.vehicles.get(scope, vehicleId);
  if (!related) {
    // C20: reading the history of a vehicle OUTSIDE the scope is its own right (CH, CV, QL, QĐ);
    // QV and KT only see the history of vehicles inside their scope
    const viaLookup =
      hasPermission(actor, 'customer-lookup:view') &&
      hasPermission(actor, 'vehicle-history-cross:view');
    const v = viaLookup ? await deps.vehicles.getCompanyWide(actor.companyId, vehicleId) : null;
    if (!v) throw notFound();
  }
  const page = await deps.history.listByVehicle(actor.companyId, vehicleId, {
    limit: q.limit,
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return {
    items: page.items.map((e) => toHistoryDto(e, deps.crm.historyShowPrice)),
    nextCursor: page.nextCursor,
  };
}

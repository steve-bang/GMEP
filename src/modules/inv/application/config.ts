import { businessDate } from '@/platform/format/date';
import { resolveConfigAt } from '@/modules/sys';
import { costMethodOf, DEFAULT_COST_METHOD, type CostMethod } from '../domain/cost';
import type { InvDeps } from '../ports/deps';

/**
 * Cost method in force on a business date (FR-INV-009: one method per period, effective-dated
 * config). No version yet -> the default weighted average, pending the accountant [Cần xác nhận].
 */
export async function resolveCostMethod(
  deps: InvDeps,
  companyId: string,
  date: string,
): Promise<{ method: CostMethod; versionId: string | null }> {
  const snap = await resolveConfigAt(deps.sys, {
    companyId,
    type: 'cost-method',
    scopeKey: 'company',
    date,
  });
  const code = (snap?.payload as { method?: string } | undefined)?.method ?? DEFAULT_COST_METHOD;
  return { method: costMethodOf(code), versionId: snap?.versionId ?? null };
}

export interface GrnThresholds {
  priceVarianceBp: number;
  qtyVarianceBp: number;
}

/** FR-INV-005 thresholds: branch override of the effective `inventory-policy`, else documented defaults. */
export async function resolveGrnThresholds(
  deps: InvDeps,
  companyId: string,
  branchId: string,
  date: string,
): Promise<GrnThresholds> {
  const snap = await resolveConfigAt(deps.sys, {
    companyId,
    type: 'inventory-policy',
    scopeKey: 'company',
    date,
    branchId,
  });
  const p = snap?.payload as { grnPriceVarianceBp?: number; grnQtyVarianceBp?: number } | undefined;
  return {
    priceVarianceBp: p?.grnPriceVarianceBp ?? deps.inv.defaultGrnPriceVarianceBp,
    qtyVarianceBp: p?.grnQtyVarianceBp ?? deps.inv.defaultGrnQtyVarianceBp,
  };
}

export const today = (deps: InvDeps): string => businessDate(deps.sys.clock.now());

import { resolveConfigAt } from '@/modules/sys';
import type { EligibilityPolicy } from '../domain/eligibility';
import { DEFAULT_ELIGIBILITY_POLICY } from '../domain/eligibility';
import type { IssuerSnapshot } from '../domain/invoice';
import type { EinDeps } from '../ports/deps';

/**
 * Effective-dated configuration of the invoice layer (NFR-MNT-01): issuing unit per branch and the build / retry policy.
 * Missing configuration is NOT silently replaced by guesses: no issuer = "provider not activated" (G4-EIN-07 default).
 */
export interface EinPolicy extends EligibilityPolicy {
  lineMode: 'per-rate' | 'per-line';
  perRateDescription: string;
  maxAttempts: number;
  retryBackoffMinutes: number[];
  providerTimeoutMs: number;
}

export const DEFAULT_EIN_POLICY: EinPolicy = {
  ...DEFAULT_ELIGIBILITY_POLICY,
  lineMode: 'per-rate',
  perRateDescription: 'Dịch vụ sửa chữa, bảo dưỡng và phụ tùng theo lệnh {order}',
  maxAttempts: 5,
  retryBackoffMinutes: [5, 15, 60, 240, 720],
  providerTimeoutMs: 30_000,
};

export async function einPolicyOf(
  deps: EinDeps,
  companyId: string,
  branchId: string,
  date: string,
): Promise<EinPolicy> {
  const snap = await resolveConfigAt(deps.sys, {
    companyId,
    type: 'einvoice-policy',
    scopeKey: 'company',
    date,
    branchId,
  });
  return snap
    ? { ...DEFAULT_EIN_POLICY, ...(snap.payload as Partial<EinPolicy>) }
    : DEFAULT_EIN_POLICY;
}

export interface IssuerConfig {
  enabled: boolean;
  snapshot: IssuerSnapshot;
}

/** null = no issuing unit configured for the branch: the provider is "not activated". */
export async function issuerOf(
  deps: EinDeps,
  companyId: string,
  branchId: string,
  date: string,
): Promise<IssuerConfig | null> {
  const snap = await resolveConfigAt(deps.sys, {
    companyId,
    type: 'einvoice-issuer',
    scopeKey: 'company',
    date,
    branchId,
  });
  if (!snap) return null;
  const p = snap.payload as Record<string, unknown>;
  return {
    enabled: p.enabled === true,
    snapshot: {
      configVersionId: snap.versionId,
      providerCode: String(p.providerCode),
      environment: p.environment === 'live' ? 'live' : 'test',
      sellerName: String(p.sellerName),
      sellerTaxCode: String(p.sellerTaxCode),
      ...(p.sellerAddress ? { sellerAddress: String(p.sellerAddress) } : {}),
      symbol: String(p.symbol),
      invoiceType: p.invoiceType === 'sales' ? 'sales' : 'vat',
      templateCode: String(p.templateCode ?? '1'),
    },
  };
}

/** Is the issuer usable: enabled and its provider code is one this build can talk to. */
export function providerActive(deps: EinDeps, i: IssuerConfig | null): boolean {
  return !!i && i.enabled && !!deps.providers.get(i.snapshot.providerCode, i.snapshot.environment);
}

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
  tenantId: string,
  branchId: string,
  date: string,
): Promise<EinPolicy> {
  const snap = await resolveConfigAt(deps.sys, {
    tenantId,
    type: 'einvoice-policy',
    scopeKey: 'tenant',
    date,
    branchId,
  });
  const payload = (snap?.payload ?? {}) as Partial<EinPolicy>;
  // R72: an explicit configured value always wins; the DEFAULT depends on the issuer: `block` for a live (non-fake)
  // issuer so a changed tax rate is never issued silently, `warn` for the test environment.
  let taxChangePolicy = payload.taxChangePolicy;
  if (!taxChangePolicy) {
    const issuer = await issuerOf(deps, tenantId, branchId, date);
    taxChangePolicy = defaultTaxChangePolicy(issuer?.snapshot);
  }
  return { ...DEFAULT_EIN_POLICY, ...payload, taxChangePolicy };
}

/** R72 / FR-EIN-002: pure default of `taxChangePolicy` by issuer environment. Configuration overrides it. */
export function defaultTaxChangePolicy(
  issuer: Pick<IssuerSnapshot, 'environment' | 'providerCode'> | null | undefined,
): 'warn' | 'block' {
  return issuer && (issuer.environment === 'live' || issuer.providerCode !== 'fake')
    ? 'block'
    : 'warn';
}

export interface IssuerConfig {
  enabled: boolean;
  snapshot: IssuerSnapshot;
}

/** null = no issuing unit configured for the branch: the provider is "not activated". */
export async function issuerOf(
  deps: EinDeps,
  tenantId: string,
  branchId: string,
  date: string,
): Promise<IssuerConfig | null> {
  const snap = await resolveConfigAt(deps.sys, {
    tenantId,
    type: 'einvoice-issuer',
    scopeKey: 'tenant',
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

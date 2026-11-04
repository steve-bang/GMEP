import { AppError, validationFailed } from '@/platform/errors/errors';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { businessDate } from '@/platform/format/date';
import { resolveCatalogAt } from '@/modules/sys';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import {
  CONSENT_BASES,
  CONSENT_CHANNELS,
  CONTACT_CHANNELS,
  CONSENT_PURPOSES,
  filterMarketingAudience,
  looksLikePersonalContact,
  marketingChannelsOf,
  type AudienceDecision,
  type Consent,
} from '../domain/consent';
import type { CrmDeps } from '../ports/deps';
import {
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  versionConflict,
  writableWorkingBranch,
  z,
  type RequestCtx,
} from './support';

export interface ConsentDto {
  id: string;
  customerId: string;
  purpose: string;
  channel: string;
  basis: string;
  status: string;
  grantedAt: string;
  evidence: string | null;
  evidenceKind: string | null;
  evidenceRef: string | null;
  policyVersion: string | null;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  version: number;
}

export const toConsentDto = (c: Consent): ConsentDto => ({
  id: c.id,
  customerId: c.customerId,
  purpose: c.purpose,
  channel: c.channel,
  basis: c.basis,
  status: c.status,
  grantedAt: c.grantedAt.toISOString(),
  evidence: c.evidence ?? null,
  evidenceKind: c.evidenceKind ?? null,
  evidenceRef: c.evidenceRef ?? null,
  policyVersion: c.policyVersion ?? null,
  withdrawnAt: c.withdrawnAt?.toISOString() ?? null,
  withdrawnReason: c.withdrawnReason ?? null,
  version: c.version,
});

/** FR-CRM-010: the full consent history of a customer the actor can see (withdrawn records stay listed). */
export async function listConsents(
  deps: CrmDeps,
  actor: Actor,
  customerId: string,
): Promise<ConsentDto[]> {
  const scope = resolveScope(actor, 'consent:view');
  if (!(await deps.customers.get(scope, customerId))) throw notFound();
  return (await deps.consents.listByCustomer(actor.companyId, customerId)).map(toConsentDto);
}

export const recordConsentSchema = z.object({
  purpose: z.enum(CONSENT_PURPOSES),
  channel: z.enum(CONSENT_CHANNELS),
  basis: z.enum(CONSENT_BASES),
  /** C23: picked from the company `evidence-kind` catalogue, not typed */
  evidenceKind: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,29}$/)
    .optional(),
  evidenceRef: z.string().trim().max(40).optional(),
  evidence: z.string().trim().max(200).optional(),
});

export interface EvidenceKindOption {
  code: string;
  name: string;
  referenceLabel: string | null;
  referenceRequired: boolean;
  noteRequired: boolean;
}

/** C23: the kinds of evidence the counter can pick today (active entries of the catalogue). */
export async function listEvidenceKinds(
  deps: CrmDeps,
  actor: Actor,
): Promise<EvidenceKindOption[]> {
  resolveScope(actor, 'consent:view');
  const rows = await resolveCatalogAt(deps.sys, {
    companyId: actor.companyId,
    type: 'evidence-kind',
    date: businessDate(deps.sys.clock.now()),
  });
  return rows
    .filter((r) => r.payload.status !== 'inactive')
    .map((r) => ({
      code: r.code,
      name: String(r.payload.name ?? r.code),
      referenceLabel:
        typeof r.payload.referenceLabel === 'string' ? r.payload.referenceLabel : null,
      referenceRequired: r.payload.referenceRequired === true,
      noteRequired: r.payload.noteRequired === true,
    }));
}

/** C23: the kind comes from the catalogue; once the catalogue has active entries one must be picked. */
async function checkEvidence(
  deps: CrmDeps,
  actor: Actor,
  data: z.infer<typeof recordConsentSchema>,
): Promise<void> {
  const kinds = await listEvidenceKinds(deps, actor);
  if (kinds.length === 0 && !data.evidenceKind) return;
  const kind = kinds.find((k) => k.code === data.evidenceKind);
  if (!data.evidenceKind)
    throw validationFailed([{ field: 'evidenceKind', message: 'Chọn loại bằng chứng.' }]);
  if (!kind)
    throw validationFailed([
      { field: 'evidenceKind', message: 'Loại bằng chứng này không còn dùng. Chọn loại khác.' },
    ]);
  if (kind.referenceRequired && !data.evidenceRef)
    throw validationFailed([
      { field: 'evidenceRef', message: `Nhập ${kind.referenceLabel ?? 'mã tham chiếu'}.` },
    ]);
  if (kind.noteRequired && !data.evidence)
    throw validationFailed([{ field: 'evidence', message: 'Ghi chú cách thu nhận.' }]);
}

/** Re-derives the advertising channels from all records of the customer (inside the customer's tx read). */
async function marketingOf(deps: CrmDeps, companyId: string, customerId: string, extra?: Consent) {
  const all = await deps.consents.listByCustomer(companyId, customerId);
  const merged = extra ? [...all.filter((c) => c.id !== extra.id), extra] : all;
  return marketingChannelsOf(merged);
}

/**
 * FR-CRM-010/013: records a basis for processing. Advertising is only valid with basis `consent`;
 * a granted record for the same purpose and channel is never duplicated (the call is a no-op replay).
 */
export async function recordConsent(
  deps: CrmDeps,
  actor: Actor,
  customerId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'consent:create');
  const cscope = resolveScope(actor, 'customer:view');
  const data = parseInput(recordConsentSchema, input);
  if (data.purpose === 'marketing' && data.basis !== 'consent')
    throw validationFailed([
      { field: 'basis', message: 'Quảng cáo chỉ được gửi khi khách đồng ý (căn cứ: đồng ý).' },
    ]);
  // C10: legitimate interest is not usable until the lawyer confirms it (config), for any purpose
  if (!deps.crm.consentBasesEnabled.includes(data.basis))
    throw validationFailed([
      { field: 'basis', message: 'Căn cứ này chưa được dùng. Chọn căn cứ khác.' },
    ]);
  // C4: evidence stays after anonymisation, so no phone or email in it
  const noContact =
    'Không ghi số điện thoại, email hoặc tên khách vào bằng chứng; chỉ ghi số phiếu hoặc cách thu nhận.';
  if (data.evidence && looksLikePersonalContact(data.evidence))
    throw validationFailed([{ field: 'evidence', message: noContact }]);
  if (data.evidenceRef && looksLikePersonalContact(data.evidenceRef))
    throw validationFailed([{ field: 'evidenceRef', message: noContact }]);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/crm/customers/${customerId}/consents`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const customer = await deps.customers.getInTx(tx, cscope, customerId);
      if (!customer) throw notFound();
      if (customer.status === 'anonymized') throw new AppError('customer_anonymized', 409);
      await checkEvidence(deps, actor, data);
      const branch = await writableWorkingBranch(deps, tx, actor, scope);
      const existing = await deps.consents.listByCustomer(actor.companyId, customerId);
      if (
        existing.some(
          (c) =>
            c.status === 'granted' &&
            c.purpose === data.purpose &&
            c.channel === data.channel &&
            c.basis === data.basis,
        )
      )
        throw new AppError('consent_exists', 409);
      const now = deps.sys.clock.now();
      const c: Consent = {
        id: `con_${deps.sys.newId()}`,
        companyId: actor.companyId,
        branchId: branch.id,
        customerId,
        purpose: data.purpose,
        channel: data.channel,
        basis: data.basis,
        status: 'granted',
        grantedAt: now,
        ...(data.evidenceKind ? { evidenceKind: data.evidenceKind } : {}),
        ...(data.evidenceRef ? { evidenceRef: data.evidenceRef } : {}),
        ...(data.evidence ? { evidence: data.evidence } : {}),
        policyVersion: deps.crm.consentPolicyVersion,
        createdBy: actor.userId,
        version: 1,
      };
      deps.consents.create(tx, c);
      deps.customers.update(tx, customerId, {
        marketing: await marketingOf(deps, actor.companyId, customerId, c),
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: branch.id,
          entityType: 'consent',
          entityId: c.id,
          action: 'consent.grant',
          after: {
            customerId,
            purpose: c.purpose,
            channel: c.channel,
            basis: c.basis,
            evidenceKind: c.evidenceKind ?? null,
            policyVersion: c.policyVersion,
          },
        }),
      );
      return { status: 201, body: toConsentDto(c) };
    },
  );
}

export const withdrawConsentSchema = z.object({
  reason: z.string().trim().max(200).optional(),
  version: z.number().int().min(1),
});

/** FR-CRM-010: withdrawal stops advertising at once (denormalised channels are recomputed in the same transaction). */
export async function withdrawConsent(
  deps: CrmDeps,
  actor: Actor,
  consentId: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<ConsentDto> {
  const scope = resolveScope(actor, 'consent:update');
  const cscope = resolveScope(actor, 'customer:view');
  const data = parseInput(withdrawConsentSchema, input);
  if (data.reason && looksLikePersonalContact(data.reason))
    throw validationFailed([
      { field: 'reason', message: 'Không ghi số điện thoại hoặc email vào lý do rút.' },
    ]);
  return deps.sys.uow.run(async (tx) => {
    const c = await deps.consents.getInTx(tx, actor.companyId, consentId);
    if (!c) throw notFound();
    const customer = await deps.customers.getInTx(tx, cscope, c.customerId); // out of scope looks missing
    if (!customer) throw notFound();
    const branch = await writableWorkingBranch(deps, tx, actor, scope, 'edit_master');
    if (c.version !== data.version) throw versionConflict();
    if (c.status === 'withdrawn') throw new AppError('consent_withdrawn', 409);
    const now = deps.sys.clock.now();
    const next: Consent = {
      ...c,
      status: 'withdrawn',
      withdrawnAt: now,
      withdrawnBy: actor.userId,
      ...(data.reason ? { withdrawnReason: data.reason } : {}),
      version: c.version + 1,
    };
    deps.consents.update(tx, consentId, {
      status: 'withdrawn',
      withdrawnAt: now,
      withdrawnBy: actor.userId,
      ...(data.reason ? { withdrawnReason: data.reason } : {}),
      version: next.version,
    });
    deps.customers.update(tx, c.customerId, {
      marketing: await marketingOf(deps, actor.companyId, c.customerId, next),
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: branch.id,
        entityType: 'consent',
        entityId: consentId,
        action: 'consent.withdraw',
        before: { status: 'granted' },
        after: { status: 'withdrawn', purpose: c.purpose, channel: c.channel },
        ...(data.reason ? { reason: data.reason } : {}),
      }),
    );
    return toConsentDto(next);
  });
}

export interface AudienceResult extends AudienceDecision {
  eligibleCount: number;
  excludedCount: number;
}

/**
 * FR-CRM-013: the campaign helper. Given the intended recipients it keeps only customers with an
 * active advertising consent for the channel and reports how many were dropped. Customers outside
 * the actor's scope count as excluded (never revealed). Other modules call this before sending.
 */
export const audienceSchema = z.object({
  channel: z.enum(CONTACT_CHANNELS),
  customerIds: z.array(z.string().trim().min(1).max(128)).min(1).max(1000),
});

export async function selectMarketingAudience(
  deps: CrmDeps,
  actor: Actor,
  raw: unknown,
): Promise<AudienceResult> {
  const scope = resolveScope(actor, 'consent:view');
  const { channel, customerIds } = parseInput(audienceSchema, raw);
  const found = await deps.customers.getMany(scope, [...new Set(customerIds)]);
  const decision = filterMarketingAudience(
    customerIds,
    new Map(found.map((c) => [c.id, { status: c.status, marketing: c.marketing }] as const)),
    channel,
  );
  return {
    ...decision,
    eligibleCount: decision.eligible.length,
    excludedCount: decision.excluded.length,
  };
}

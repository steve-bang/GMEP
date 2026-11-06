import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows } from '@/platform/scope/scope';
import { getVehicle } from '@/modules/crm';
import { resolveConfigAt } from '@/modules/sys';
import {
  STRICT_WARRANTY_POLICY,
  warrantyStatus,
  type WarrantyLink,
  type WarrantyPolicy,
  type WarrantyStatus,
  type WarrantyTerm,
} from '../domain/warranty';
import type { RecDeps } from '../ports/deps';
import { stageIntake, toIntakeDto } from './intakes';
import {
  AppError,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  requireWorkingBranch,
  z,
  type RequestCtx,
} from './support';

/**
 * Warranty (slice 2.8b; FR-REC-018, 036, FR-CRM-016; RULE-012). Reading: the coverage of a vehicle visible in the
 * actor's scope, from the warranty records of EVERY branch of the tenant (projection P4): records of another branch show
 * the white-listed fields only, without the origin order id or the technician. Opening warranty work: a warranty intake
 * linked to the origin order and items, through the normal intake flow. Cross-branch opening and the recorded cost bearer
 * follow the effective-dated `warranty-policy` (Q77 open; strict default: own orders only, performing branch records).
 */

/** Term in force on `date` for a service type: `svc:<type>`, then `default`; none = no warranty assumed. */
export async function warrantyTermAt(
  deps: RecDeps,
  tenantId: string,
  serviceType: string | null,
  date: string,
): Promise<(WarrantyTerm & { versionId: string }) | null> {
  for (const scopeKey of [...(serviceType ? [`svc:${serviceType}`] : []), 'default']) {
    const snap = await resolveConfigAt(deps.sys, {
      tenantId,
      type: 'warranty-term',
      scopeKey,
      date,
    });
    if (snap) {
      const p = snap.payload as Partial<WarrantyTerm>;
      return {
        days: p.days ?? 0,
        km: p.km ?? 0,
        ...(p.conditions ? { conditions: p.conditions } : {}),
        versionId: snap.versionId,
      };
    }
  }
  return null;
}

export async function warrantyPolicyAt(
  deps: RecDeps,
  tenantId: string,
  branchId: string,
  date: string,
): Promise<WarrantyPolicy & { versionId: string | null }> {
  const snap = await resolveConfigAt(deps.sys, {
    tenantId,
    type: 'warranty-policy',
    scopeKey: 'tenant',
    date,
    branchId,
  });
  if (!snap) return { ...STRICT_WARRANTY_POLICY, versionId: null };
  return {
    ...STRICT_WARRANTY_POLICY,
    ...(snap.payload as Partial<WarrantyPolicy>),
    versionId: snap.versionId,
  };
}

export interface WarrantyItemDto {
  key: string;
  /** only for readers of the origin branch */
  itemId: string | null;
  name: string;
  technicianId: string | null;
  expiresOn: string | null;
  expiresAtKm: number | null;
  status: WarrantyStatus;
  conditions: string | null;
}
export interface WarrantyRecordDto {
  id: string;
  branchId: string;
  branchName: string;
  /** the reader's scope holds the origin branch: only then the origin order can be opened */
  own: boolean;
  orderId: string | null;
  orderCode: string;
  serviceType: string | null;
  startDate: string;
  startKm: number | null;
  items: WarrantyItemDto[];
}

/** FR-REC-018, 036, FR-CRM-016: warranty coverage of a vehicle, every branch of the tenant (P4 white list). */
export async function listVehicleWarranties(
  deps: RecDeps,
  actor: Actor,
  vehicleId: string,
): Promise<{ vehicleId: string; currentKm: number | null; items: WarrantyRecordDto[] }> {
  const scope = resolveScope(actor, 'warranty:view');
  // the vehicle must be visible in the scope (a car first seen elsewhere becomes related when it is taken in, C24)
  const vehicle = await getVehicle(deps.crm, actor, vehicleId);
  const today = businessDate(deps.sys.clock.now());
  const currentKm = vehicle.lastKm ?? null;
  const records = await deps.warranties.listByVehicle(
    actor.tenantId,
    vehicleId,
    deps.rec.warrantyListMax,
  );
  return {
    vehicleId,
    currentKm,
    items: records.map((r) => {
      const own = scopeAllows(scope, actor.tenantId, r.branchId);
      return {
        id: r.id,
        branchId: r.branchId,
        branchName: r.branchName,
        own,
        orderId: own ? r.orderId : null,
        orderCode: r.orderCode,
        serviceType: r.serviceType,
        startDate: r.startDate,
        startKm: r.startKm,
        items: r.items.map((i) => ({
          key: i.key,
          itemId: own ? i.itemId : null,
          name: i.name,
          technicianId: own ? i.technicianId : null,
          expiresOn: i.expiresOn,
          expiresAtKm: i.expiresAtKm,
          status: warrantyStatus(i, today, currentKm),
          conditions: i.conditions ?? null,
        })),
      };
    }),
  };
}

export const openWarrantySchema = z.object({
  recordId: z.string().trim().min(1).max(120),
  /** the item keys of the record ("1", "2", ...) */
  itemKeys: z.array(z.string().trim().min(1).max(4)).min(1).max(60),
  note: z.string().trim().max(500).optional(),
});

/**
 * FR-REC-018, 036: open warranty work as an intake linked to the origin order and items ("lệnh bảo hành gắn lệnh gốc").
 * Only items still under warranty; out-of-term work needs an approval that is not built yet [Cần xác nhận: BA, Q77], so
 * it is refused with `warranty_expired`. Another branch's order needs `warranty-policy.crossBranchOpen`. The recorded
 * cost bearer comes from the policy; no cost is moved between branches.
 */
export async function openWarranty(
  deps: RecDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string; sessionId?: string },
) {
  resolveScope(actor, 'warranty:create');
  const scope = resolveScope(actor, 'intake:create');
  const data = parseInput(openWarrantySchema, input);
  const branchId = requireWorkingBranch(actor);
  const record = await deps.warranties.getCompanyWide(actor.tenantId, data.recordId);
  if (!record) throw notFound();
  const vehicle = await getVehicle(deps.crm, actor, record.vehicleId);
  if (!vehicle.owner) throw new AppError('owner_not_visible', 409);
  const today = businessDate(deps.sys.clock.now());
  const crossBranch = record.branchId !== branchId;
  const policy = await warrantyPolicyAt(deps, actor.tenantId, branchId, today);
  if (crossBranch && !policy.crossBranchOpen)
    throw new AppError('warranty_cross_branch_not_allowed', 409);
  const chosen = [...new Set(data.itemKeys)].map((k) => record.items.find((i) => i.key === k));
  if (chosen.some((i) => !i)) throw notFound();
  if (chosen.some((i) => warrantyStatus(i!, today, vehicle.lastKm ?? null) !== 'valid'))
    throw new AppError('warranty_expired', 409);
  const link: WarrantyLink = {
    recordId: record.id,
    originOrderId: record.orderId,
    originOrderCode: record.orderCode,
    originBranchId: record.branchId,
    itemIds: chosen.map((i) => i!.itemId),
    costBearer: policy.costBearer,
    crossBranch,
    policyVersionId: policy.versionId,
  };
  const names = chosen.map((i) => i!.name).join(', ');
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/rec/warranties/open',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const intake = await stageIntake(deps, tx, actor, scope, vehicle, ctx, {
        ...(record.serviceType ? { serviceType: record.serviceType } : {}),
        customerRequest: `Bảo hành ${record.orderCode}: ${names}${data.note ? `. ${data.note}` : ''}`,
        warranty: link,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'intake',
          entityId: intake.id,
          action: 'intake.warranty_open',
          after: {
            originOrderCode: record.orderCode,
            originBranchId: record.branchId,
            itemKeys: data.itemKeys,
            costBearer: link.costBearer,
            crossBranch,
            policyVersion: policy.versionId,
          },
        }),
      );
      return { status: 201, body: toIntakeDto(intake) };
    },
  );
}

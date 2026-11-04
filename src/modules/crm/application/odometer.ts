import { businessDate } from '@/platform/format/date';
import { validationFailed } from '@/platform/errors/errors';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { Tx } from '@/platform/tx/unitOfWork';
import { notifyUsers, usersWithRole } from '@/modules/sys';
import { checkOdometer, type OdometerReason } from '../domain/odometer';
import type { Vehicle } from '../domain/entities';
import type { CrmDeps } from '../ports/deps';
import { auditEntry, notFound, type RequestCtx } from './support';

/**
 * C18: the branch manager (QL) is told when a reading drops by more than the shared threshold. The
 * notice names the plate (a vehicle, not a person) and the two readings, nothing else. Recipients are
 * read before the caller's first write; a missing manager is not an error.
 */
export async function abnormalDropRecipients(
  deps: CrmDeps,
  actor: Actor,
  branchId: string,
): Promise<string[]> {
  return usersWithRole(deps.sys, actor.companyId, ['QL'], branchId);
}

export function stageAbnormalDropNotice(
  deps: CrmDeps,
  tx: Tx,
  actor: Actor,
  recipients: readonly string[],
  v: Pick<Vehicle, 'id' | 'plate'>,
  from: number,
  to: number,
  branchId: string,
): void {
  if (recipients.length === 0) return;
  notifyUsers(deps.sys, tx, {
    companyId: actor.companyId,
    userIds: recipients,
    kind: 'crm.odometer_abnormal',
    titleKey: 'notifications.odometerAbnormal',
    params: { plate: v.plate, from: String(from), to: String(to) },
    link: `/crm/vehicles/${v.id}`,
    branchId,
  });
}

export interface OdometerResult {
  lastKm: number;
  below: boolean;
  abnormal: boolean;
}

/**
 * R9 port for REC: records an odometer reading as the vehicle's last known km INSIDE the caller's
 * transaction (the intake that completes it). Same rule as editing the vehicle: a lower reading needs
 * a reason, a drop over `abnormalKmDrop` is flagged and the manager notified, a replaced odometer is
 * remembered. The caller must do its own reads first (reads before writes); this reads the vehicle,
 * then writes. A reading equal to the stored one changes nothing.
 */
export async function recordOdometer(
  deps: CrmDeps,
  tx: Tx,
  actor: Actor,
  input: {
    vehicleId: string;
    km: number;
    reason?: OdometerReason | undefined;
    note?: string | undefined;
    /** what produced the reading: audit only */
    source: 'intake' | 'handover';
    sourceId: string;
  },
  ctx: RequestCtx,
): Promise<OdometerResult> {
  const scope = resolveScope(actor, 'vehicle:update');
  const v = await deps.vehicles.getInTx(tx, scope, input.vehicleId);
  if (!v) throw notFound();
  const last = v.lastKm ?? null;
  const r = checkOdometer({
    km: input.km,
    lastKm: last,
    reason: input.reason,
    note: input.note,
    abnormalDrop: deps.crm.abnormalKmDrop,
  });
  if (!r.ok)
    throw validationFailed([
      {
        field: r.field,
        message:
          r.code === 'reason_required'
            ? `Số km nhỏ hơn số km lần sửa trước (${last}). Nhập lý do để tiếp tục.`
            : 'Ghi chú lý do ít nhất 5 ký tự.',
      },
    ]);
  if (last === input.km) return { lastKm: input.km, below: false, abnormal: false };
  const recipients = r.abnormal
    ? await abnormalDropRecipients(deps, actor, actor.workingBranchId ?? v.branchId)
    : [];
  const now = deps.sys.clock.now();
  const today = businessDate(now);
  deps.vehicles.update(tx, v.id, {
    lastKm: input.km,
    lastKmAt: today,
    ...(r.below && input.reason === 'odometer_replaced' ? { odometerReplacedAt: today } : {}),
    updatedAt: now,
    updatedBy: actor.userId,
    version: v.version + 1,
  });
  deps.sys.audit.record(
    tx,
    auditEntry(deps.sys, actor, ctx, {
      branchId: actor.workingBranchId ?? v.branchId,
      entityType: 'vehicle',
      entityId: v.id,
      action: 'vehicle.odometer',
      before: { lastKm: last },
      after: {
        lastKm: input.km,
        source: input.source,
        sourceId: input.sourceId,
        abnormal: r.abnormal,
      },
      ...(r.below
        ? {
            reason: `${last} -> ${input.km}: ${input.reason}${input.note ? ` (${input.note})` : ''}`,
          }
        : {}),
    }),
  );
  if (r.abnormal)
    stageAbnormalDropNotice(
      deps,
      tx,
      actor,
      recipients,
      v,
      last!,
      input.km,
      actor.workingBranchId ?? v.branchId,
    );
  return { lastKm: input.km, below: r.below, abnormal: r.abnormal };
}

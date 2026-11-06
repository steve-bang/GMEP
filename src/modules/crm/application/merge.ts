import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { checkMerge, mergedBranchIds } from '../domain/merge';
import type { Ownership } from '../domain/ownership';
import type { CrmDeps } from '../ports/deps';
import { toCustomerDto } from './customers';
import {
  AppError,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  versionConflict,
  writableWorkingBranch,
  z,
  type RequestCtx,
} from './support';

/**
 * FR-CRM-003 (slice 2.8b): duplicate suggestions and merge. Suggestions: other ACTIVE records in the scope with the same
 * full phone number (plates are unique per tenant, so a plate cannot be on two records). Merge keeps every record and
 * every document (see domain/merge.ts); the vehicles currently owned by the source move to the target by ownership
 * records, branch relations are united, both records are audited in the same transaction. Consents stay on the source
 * as evidence and are NOT copied (a consent is given by a record's contact on a date) [Cần xác nhận: Luật sư khách].
 */
export async function listDuplicateCandidates(deps: CrmDeps, actor: Actor, customerId: string) {
  const scope = resolveScope(actor, 'customer:view');
  const c = await deps.customers.get(scope, customerId);
  if (!c) throw notFound();
  const pii = await deps.customers.getPii(actor.tenantId, c.id);
  if (!pii?.phoneNorm) return { items: [] };
  const ids = (
    await deps.customers.customerIdsByPhone(actor.tenantId, pii.phoneNorm, 'exact', 20)
  ).filter((id) => id !== c.id);
  const found = (await deps.customers.getMany(scope, ids)).filter((x) => x.status === 'active');
  const piis = await Promise.all(found.map((x) => deps.customers.getPii(actor.tenantId, x.id)));
  return {
    items: found.map((x, i) => ({
      ...toCustomerDto(deps, actor, x, piis[i] ?? null),
      match: 'phone',
    })),
  };
}

export const mergeSchema = z.object({
  /** the record that disappears into the target (kept, marked merged) */
  sourceId: z.string().trim().min(1).max(80),
  version: z.number().int().min(1),
  sourceVersion: z.number().int().min(1),
  reason: z.string().trim().min(5).max(300),
});

export async function mergeCustomers(
  deps: CrmDeps,
  actor: Actor,
  targetId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'customer-merge:create');
  const data = parseInput(mergeSchema, input);
  // ownerships are read before the transaction (no in-transaction query); each vehicle is re-read inside it
  const owned = (await deps.ownerships.listByCustomer(actor.tenantId, data.sourceId, 200)).filter(
    (o) => o.to === null,
  );
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/crm/customers/${targetId}/merge`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ targetId, ...data }),
    },
    async (tx) => {
      // Firestore: every read before the first write
      const target = await deps.customers.getInTx(tx, scope, targetId);
      const source = await deps.customers.getInTx(tx, scope, data.sourceId);
      if (!target || !source) throw notFound();
      if (target.version !== data.version || source.version !== data.sourceVersion)
        throw versionConflict();
      const refusal = checkMerge(target, source);
      if (refusal) throw new AppError(refusal, 409);
      const branch = await writableWorkingBranch(deps, tx, actor, scope, 'edit_master');
      const vehicles = (
        await Promise.all(
          owned.map((o) => deps.vehicles.getCompanyWideInTx(tx, actor.tenantId, o.vehicleId)),
        )
      ).flatMap((v, i) => (v && v.currentOwnerId === source.id ? [{ v, own: owned[i]! }] : []));
      const now = deps.sys.clock.now();
      const today = businessDate(now);
      const branchIds = mergedBranchIds(target.branchIds, source.branchIds);
      const note = `Gộp khách ${source.code} vào ${target.code}`;
      for (const { v, own } of vehicles) {
        deps.ownerships.close(tx, own.id, today);
        const next: Ownership = {
          id: `own_${deps.sys.newId()}`,
          tenantId: actor.tenantId,
          vehicleId: v.id,
          customerId: target.id,
          from: today,
          to: null,
          branchId: branch.id,
          note,
          createdAt: now,
          createdBy: actor.userId,
        };
        deps.ownerships.create(tx, next);
        deps.vehicles.update(tx, v.id, {
          currentOwnerId: target.id,
          updatedAt: now,
          updatedBy: actor.userId,
          version: v.version + 1,
        });
      }
      for (const b of branchIds)
        if (!target.branchIds.includes(b))
          deps.customers.link(tx, target, b, now, { source: 'merge', by: actor.userId });
      deps.customers.update(tx, target.id, {
        branchIds,
        vehicleCount: target.vehicleCount + vehicles.length,
        mergedFrom: [...(target.mergedFrom ?? []), source.id],
        updatedAt: now,
        updatedBy: actor.userId,
        version: target.version + 1,
      });
      deps.customers.update(tx, source.id, {
        status: 'merged',
        mergedInto: target.id,
        mergedAt: now,
        vehicleCount: 0,
        updatedAt: now,
        updatedBy: actor.userId,
        version: source.version + 1,
      });
      const moved = vehicles.map((x) => x.v.id);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: target.branchId,
          entityType: 'customer',
          entityId: target.id,
          action: 'customer.merge',
          after: { sourceId: source.id, sourceCode: source.code, movedVehicles: moved, branchIds },
          reason: data.reason,
        }),
      );
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: source.branchId,
          entityType: 'customer',
          entityId: source.id,
          action: 'customer.merged_into',
          before: { status: source.status },
          after: { status: 'merged', mergedInto: target.id, movedVehicles: moved },
          reason: data.reason,
        }),
      );
      return {
        status: 200,
        body: {
          targetId: target.id,
          sourceId: source.id,
          movedVehicles: moved,
          branchIds,
        },
      };
    },
  );
}

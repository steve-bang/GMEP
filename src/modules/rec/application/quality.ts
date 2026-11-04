import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, requireWorkingBranch, type Actor } from '@/platform/rbac/rbac';
import { recordOdometer } from '@/modules/crm';
import { notifyUsers, resolveConfigAt } from '@/modules/sys';
import type { Handover, QcCheckResult, QcRun, TimeEvent } from '../domain/order';
import { transitionOrder } from '../domain/orderState';
import type { RecDeps } from '../ports/deps';
import { orderPatch } from './orderHelpers';
import {
  AppError,
  assertWritable,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  validationFailed,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

/**
 * Quality check (FR-REC-016) and vehicle handover (FR-REC-017). The check list is effective-dated
 * configuration per service type (`qc-checklist`, falling back to `default`). A failed check sends items back to
 * their technician and records the fault against them; the order cannot be handed over without a passed check.
 * Handing over completes the order, updates the vehicle's odometer and writes the cross-branch history row.
 */

export interface QcChecklistDto {
  versionId: string | null;
  /** nothing configured: the check list is empty and the screen says so */
  checks: { code: string; name: string }[];
}

async function checklistOf(
  deps: RecDeps,
  companyId: string,
  serviceType: string | undefined,
  date: string,
) {
  for (const key of [...(serviceType ? [serviceType] : []), 'default']) {
    const c = await resolveConfigAt(deps.sys, {
      companyId,
      type: 'qc-checklist',
      scopeKey: key,
      date,
    });
    if (c)
      return {
        versionId: c.versionId,
        checks: (c.payload as { checks: { code: string; name: string }[] }).checks,
      };
  }
  return { versionId: null, checks: [] as { code: string; name: string }[] };
}

export async function getQcChecklist(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
): Promise<QcChecklistDto> {
  const scope = resolveScope(actor, 'qc-record:view');
  const o = await deps.orders.get(scope, orderId);
  if (!o) throw notFound();
  return checklistOf(deps, o.companyId, o.serviceType, businessDate(deps.sys.clock.now()));
}

export const qcSchema = z.object({
  version: z.number().int().min(1),
  checks: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(40),
        ok: z.boolean(),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .max(50),
  /** items sent back to their technician (mandatory when something fails) */
  returnItemIds: z.array(z.string().trim().min(1).max(120)).max(60).default([]),
  note: z.string().trim().max(500).optional(),
});

export async function runQc(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'qc-record:create');
  const data = parseInput(qcSchema, input);
  const o0 = await deps.orders.get(scope, orderId);
  if (!o0) throw notFound();
  const list = await checklistOf(
    deps,
    o0.companyId,
    o0.serviceType,
    businessDate(deps.sys.clock.now()),
  );
  const byCode = new Map(data.checks.map((c) => [c.code, c]));
  const errors: { field: string; message: string }[] = [];
  const results: QcCheckResult[] = list.checks.map((c) => {
    const r = byCode.get(c.code);
    if (!r) errors.push({ field: `checks.${c.code}`, message: 'Chưa đánh giá mục này.' });
    if (r && !r.ok && !r.note)
      errors.push({ field: `checks.${c.code}`, message: 'Ghi lỗi khi mục không đạt.' });
    return { code: c.code, name: c.name, ok: r?.ok ?? false, ...(r?.note ? { note: r.note } : {}) };
  });
  const failed = results.some((r) => !r.ok);
  if (failed && data.returnItemIds.length === 0)
    errors.push({ field: 'returnItemIds', message: 'Chọn hạng mục trả lại thợ để sửa.' });
  if (!failed && data.returnItemIds.length > 0)
    errors.push({ field: 'returnItemIds', message: 'Không trả hạng mục khi kiểm tra đạt.' });
  if (errors.length) throw validationFailed(errors);
  const advisor = o0.advisorId;
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${orderId}/qc`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scope, orderId);
      if (!o || o.branchId !== requireWorkingBranch(actor)) throw notFound();
      if (o.version !== data.version) throw versionConflict();
      await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      const t = transitionOrder(o.status, failed ? 'qc_fail' : 'qc_pass');
      if (!t.ok) throw new AppError(t.reason, 409);
      const items = await Promise.all(
        data.returnItemIds.map((id) => deps.items.getInTx(tx, scope, id)),
      );
      const now = deps.sys.clock.now();
      for (const it of items) {
        if (!it || it.orderId !== o.id || it.status !== 'done')
          throw new AppError('item_state_invalid', 409);
      }
      const run: QcRun = {
        n: o.qcRuns.length + 1,
        at: now,
        by: actor.userId,
        result: failed ? 'fail' : 'pass',
        checks: results,
        returnedItemIds: data.returnItemIds,
        ...(data.note ? { note: data.note } : {}),
        ...(list.versionId ? { checklistVersionId: list.versionId } : {}),
      };
      const techs = new Set<string>();
      for (const it of items) {
        if (!it) continue;
        const e: TimeEvent = {
          n: it.events.length + 1,
          type: 'return',
          from: 'done',
          to: 'returned',
          at: now,
          by: actor.userId,
          reason: results
            .filter((r) => !r.ok)
            .map((r) => r.name)
            .join('; ')
            .slice(0, 300),
        };
        deps.items.update(tx, it.id, {
          status: 'returned',
          active: true,
          events: [...it.events, e],
          updatedAt: now,
          updatedBy: actor.userId,
          version: it.version + 1,
        });
        if (it.technicianId) techs.add(it.technicianId);
      }
      deps.orders.update(tx, o.id, {
        ...orderPatch(o, failed ? 'qc_fail' : 'qc_pass', t.state, actor.userId, now),
        qcRuns: [...o.qcRuns, run],
        doneCount: o.doneCount - items.length,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairOrder',
          entityId: o.id,
          action: failed ? 'repairOrder.qc_fail' : 'repairOrder.qc_pass',
          before: { status: o.status },
          after: {
            status: t.state,
            run: run.n,
            returned: data.returnItemIds,
            technicians: [...techs],
          },
        }),
      );
      const to = failed ? [...techs, advisor] : [advisor];
      const recipients = [...new Set(to)].filter((u) => u !== actor.userId);
      if (recipients.length)
        notifyUsers(deps.sys, tx, {
          companyId: o.companyId,
          userIds: recipients,
          kind: 'rec.order',
          titleKey: failed ? 'notifications.qcFailed' : 'notifications.qcPassed',
          params: { number: o.number },
          link: `/rec/orders/${o.id}`,
          branchId: o.branchId,
        });
      return { status: 200, body: { id: o.id, status: t.state, result: run.result, run: run.n } };
    },
  );
}

// ---- handover (FR-REC-017) ----------------------------------------------------------------------------------

export const handoverSchema = z.object({
  version: z.number().int().min(1),
  receiverName: z.string().trim().max(120).default(''),
  confirmation: z.enum(['screen', 'paper']),
  paperRef: z.string().trim().max(60).optional(),
  /** odometer when the vehicle leaves (optional); a lower reading than the last needs a reason (CRM rule) */
  km: z.number().int().min(0).max(5_000_000).optional(),
  kmReason: z.enum(['typo', 'odometer_replaced', 'other']).optional(),
  kmNote: z.string().trim().max(200).optional(),
  belongingsReturned: z.boolean(),
  oldPartsReturned: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

interface OrderPolicy {
  handoverRequiresPayment: boolean;
  handoverRequiresReceiver: boolean;
}

async function orderPolicyOf(
  deps: RecDeps,
  companyId: string,
  branchId: string,
  date: string,
): Promise<OrderPolicy> {
  const c = (
    await resolveConfigAt(deps.sys, {
      companyId,
      type: 'order-policy',
      scopeKey: 'company',
      date,
      branchId,
    })
  )?.payload as Partial<OrderPolicy> | undefined;
  return {
    handoverRequiresPayment: c?.handoverRequiresPayment ?? false,
    handoverRequiresReceiver: c?.handoverRequiresReceiver ?? deps.rec.requireHandoverReceiverName,
  };
}

export async function handoverVehicle(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'vehicle-handover:create');
  const data = parseInput(handoverSchema, input);
  const o0 = await deps.orders.get(scope, orderId);
  if (!o0) throw notFound();
  const policy = await orderPolicyOf(
    deps,
    o0.companyId,
    o0.branchId,
    businessDate(deps.sys.clock.now()),
  );
  if (policy.handoverRequiresReceiver && data.receiverName.length < 2)
    throw validationFailed([{ field: 'receiverName', message: 'Nhập họ tên người nhận xe.' }]);
  if (data.confirmation === 'paper' && !data.paperRef && policy.handoverRequiresReceiver)
    throw validationFailed([{ field: 'paperRef', message: 'Ghi mã biên bản giấy đã ký.' }]);
  // FR-REC-016 / slice 1.7: the payment object arrives with ACC; until then a policy that requires it cannot be met
  if (policy.handoverRequiresPayment) throw new AppError('payment_check_unavailable', 409);
  const items0 = await deps.items.listByOrder(scope, orderId, deps.rec.maxItemsPerOrder);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${orderId}/handover`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scope, orderId);
      if (!o || o.branchId !== requireWorkingBranch(actor)) throw notFound();
      if (o.version !== data.version) throw versionConflict();
      const t = transitionOrder(o.status, 'deliver');
      if (!t.ok)
        throw new AppError(t.reason === 'order_state_invalid' ? 'qc_required' : t.reason, 409);
      const branch = await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      // CRM reads the vehicle then writes: it goes before this transaction's own writes
      if (data.km !== undefined)
        await recordOdometer(
          deps.crm,
          tx,
          actor,
          {
            vehicleId: o.vehicleId,
            km: data.km,
            reason: data.kmReason,
            note: data.kmNote,
            source: 'handover',
            sourceId: o.id,
          },
          ctx,
        );
      const now = deps.sys.clock.now();
      const h: Handover = {
        at: now,
        by: actor.userId,
        receiverName: data.receiverName,
        ...(data.km !== undefined ? { km: data.km } : {}),
        confirmation: data.confirmation,
        ...(data.paperRef ? { paperRef: data.paperRef } : {}),
        ...(data.note ? { note: data.note } : {}),
        belongingsReturned: data.belongingsReturned,
        oldPartsReturned: data.oldPartsReturned,
        printCount: 0,
      };
      deps.orders.update(tx, o.id, {
        ...orderPatch(o, 'deliver', t.state, actor.userId, now),
        handover: h,
        completedAt: now,
      });
      // the cross-branch history row (white-listed fields only, C6: prices before tax and order discount)
      const done = items0.filter((i) => i.status === 'done');
      deps.crm.history.upsert(tx, {
        id: `repair-order:${o.id}`,
        companyId: o.companyId,
        vehicleId: o.vehicleId,
        branchId: o.branchId,
        branchName: branch.name,
        orderCode: o.number,
        date: businessDate(now),
        ...(data.km !== undefined ? { km: data.km } : o.km !== undefined ? { km: o.km } : {}),
        items: done.map((i) => i.name),
        parts: done.flatMap((i) =>
          i.lines
            .filter((l) => l.kind === 'part')
            .map((l) => ({ name: l.name, qty: (l.qty ?? 0) / (l.qtyScale ?? 1) })),
        ),
        totalVnd: done.reduce((s, i) => s + i.subtotalVnd, 0),
        projectedAt: now,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairOrder',
          entityId: o.id,
          action: 'repairOrder.deliver',
          before: { status: o.status },
          after: {
            status: t.state,
            confirmation: h.confirmation,
            km: h.km ?? null,
            belongingsReturned: h.belongingsReturned,
            oldPartsReturned: h.oldPartsReturned,
          },
        }),
      );
      if (o.advisorId !== actor.userId)
        notifyUsers(deps.sys, tx, {
          companyId: o.companyId,
          userIds: [o.advisorId],
          kind: 'rec.order',
          titleKey: 'notifications.orderDelivered',
          params: { number: o.number },
          link: `/rec/orders/${o.id}`,
          branchId: o.branchId,
        });
      return { status: 200, body: { id: o.id, status: t.state, version: o.version + 1 } };
    },
  );
}

// ---- the printed record ---------------------------------------------------------------------------------------

export interface HandoverPrintDto {
  orderNumber: string;
  branchName: string;
  plate: string;
  vehicleLabel: string;
  /** name only; no phone or address on the paper */
  customerName: string;
  items: { no: number; name: string; parts: { name: string; qty: number }[] }[];
  totalVnd: number;
  handover: {
    at: string;
    receiverName: string;
    km: number | null;
    confirmation: 'screen' | 'paper';
    paperRef: string | null;
    belongingsReturned: boolean;
    oldPartsReturned: boolean;
    note: string | null;
    printCount: number;
  };
  reprint: boolean;
}

/** Reads the data of the handover record. No side effect (a GET never writes); printing is logged by `logHandoverPrint`. */
export async function getHandoverPrint(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
): Promise<HandoverPrintDto> {
  const scope = resolveScope(actor, 'vehicle-handover:view');
  const o = await deps.orders.get(scope, orderId);
  if (!o?.handover) throw notFound();
  const items = (await deps.items.listByOrder(scope, orderId, deps.rec.maxItemsPerOrder)).filter(
    (i) => i.status === 'done',
  );
  const branch = await deps.sys.branches.get(scope, o.branchId);
  const h = o.handover;
  return {
    orderNumber: o.number,
    branchName: branch?.name ?? '',
    plate: o.plate,
    vehicleLabel: o.vehicleLabel,
    customerName: o.customerName,
    items: items.map((i) => ({
      no: i.no,
      name: i.name,
      parts: i.lines
        .filter((l) => l.kind === 'part')
        .map((l) => ({ name: l.name, qty: (l.qty ?? 0) / (l.qtyScale ?? 1) })),
    })),
    totalVnd: o.totalVnd,
    handover: {
      at: h.at.toISOString(),
      receiverName: h.receiverName,
      km: h.km ?? null,
      confirmation: h.confirmation,
      paperRef: h.paperRef ?? null,
      belongingsReturned: h.belongingsReturned,
      oldPartsReturned: h.oldPartsReturned,
      note: h.note ?? null,
      printCount: h.printCount,
    },
    reprint: h.printCount > 0,
  };
}

export const printLogSchema = z.object({
  format: z.enum(['a5', 'thermal']),
  /** a reprint needs a reason (plan §2.11) */
  reason: z.string().trim().max(200).optional(),
});

/** Every print is logged; a reprint of the record needs a reason and is shown as "BẢN IN LẠI". */
export async function logHandoverPrint(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'vehicle-handover:view');
  const data = parseInput(printLogSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${orderId}/handover/print`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scope, orderId);
      if (!o?.handover) throw notFound();
      if (o.handover.printCount > 0 && !data.reason)
        throw validationFailed([{ field: 'reason', message: 'Ghi lý do in lại biên bản.' }]);
      const now = deps.sys.clock.now();
      deps.orders.update(tx, o.id, {
        handover: { ...o.handover, printCount: o.handover.printCount + 1, lastPrintedAt: now },
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairOrder',
          entityId: o.id,
          action: 'repairOrder.handover_print',
          after: { format: data.format, count: o.handover.printCount + 1 },
          ...(data.reason ? { reason: data.reason } : {}),
        }),
      );
      return { status: 200, body: { printCount: o.handover.printCount + 1 } };
    },
  );
}

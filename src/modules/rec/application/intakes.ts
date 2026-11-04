import { toPhotoDtos, type PhotoDto } from './photos';
import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { hasPermission, resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { normalizePlate, getVehicle, recordOdometer, relateToWorkingBranch } from '@/modules/crm';
import { allocateDocumentNumber, resolveCatalogAt } from '@/modules/sys';
import {
  BELONGINGS,
  FUEL_LEVELS,
  type Intake,
  type IntakeStatus,
  type KmReason,
} from '../domain/entities';
import { checkKm } from '../domain/intake';
import { allowedIntakeActions, transitionIntake } from '../domain/quoteState';
import type { RecDeps } from '../ports/deps';
import {
  assertWritable,
  auditEntry,
  idemOf,
  isoDate,
  notFound,
  parseInput,
  requireWorkingBranch,
  validationFailed,
  versionConflict,
  AppError,
  z,
  type RequestCtx,
} from './support';

/**
 * Intake (hồ sơ tiếp nhận, G2-REC-01; FR-REC-001, 002, 003; BR-REC-01). A draft is saved after every
 * wizard step; completing it checks the required facts (FR-REC-002: odometer and the customer's own
 * words). Customer and vehicle come from CRM through its public index only; a customer who is only
 * known at another branch becomes related to the working branch here (C2 `relateToWorkingBranch`).
 */
export interface IntakeDto {
  id: string;
  number: string;
  status: IntakeStatus;
  vehicleId: string;
  customerId: string;
  plate: string;
  vehicleLabel: string;
  customerName: string;
  lastKmAtOpen: number | null;
  step: number;
  km: number | null;
  kmReason: KmReason | null;
  kmNote: string | null;
  kmAbnormal: boolean;
  fuel: string | null;
  customerRequest: string | null;
  condition: string | null;
  belongings: string[];
  belongingsOther: string | null;
  photos: PhotoDto[];
  serviceType: string | null;
  advisorId: string;
  promisedDate: string | null;
  promisedTime: string | null;
  customerParts: { name: string; qty: number; condition: string }[];
  internalNote: string | null;
  quoteId: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  /** the server decides which actions are open (state machine table) */
  allowed: string[];
}

export function toIntakeDto(i: Intake, includeHiddenPhotos = false): IntakeDto {
  return {
    id: i.id,
    number: i.number,
    status: i.status,
    vehicleId: i.vehicleId,
    customerId: i.customerId,
    plate: i.plate,
    vehicleLabel: i.vehicleLabel,
    customerName: i.customerName,
    lastKmAtOpen: i.lastKmAtOpen,
    step: i.step,
    km: i.km ?? null,
    kmReason: i.kmReason ?? null,
    kmNote: i.kmNote ?? null,
    kmAbnormal: i.kmAbnormal ?? false,
    fuel: i.fuel ?? null,
    customerRequest: i.customerRequest ?? null,
    condition: i.condition ?? null,
    belongings: i.belongings,
    photos: toPhotoDtos(i.photos, includeHiddenPhotos),
    belongingsOther: i.belongingsOther ?? null,
    serviceType: i.serviceType ?? null,
    advisorId: i.advisorId,
    promisedDate: i.promisedDate ?? null,
    promisedTime: i.promisedTime ?? null,
    customerParts: i.customerParts,
    internalNote: i.internalNote ?? null,
    quoteId: i.quoteId ?? null,
    cancelReason: i.cancelReason ?? null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    version: i.version,
    allowed: allowedIntakeActions(i.status, { hasQuote: !!i.quoteId }),
  };
}

// ---- service types (R7) ---------------------------------------------------------------------------

export interface ServiceTypeOption {
  code: string;
  name: string;
  active: boolean;
}

/** R7: the company catalogue of service types (FR-REC-032, BR-REC-13) for the wizard and filters. */
export async function listServiceTypes(deps: RecDeps, actor: Actor): Promise<ServiceTypeOption[]> {
  resolveScope(actor, 'intake:view');
  const rows = await resolveCatalogAt(deps.sys, {
    companyId: actor.companyId,
    type: 'service-type',
    date: businessDate(deps.sys.clock.now()),
  });
  return rows
    .map((r) => ({
      code: r.code,
      name: String(r.payload.name ?? r.code),
      active: r.payload.status !== 'inactive',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/** A type may be CHOSEN only while it is active; a stored inactive one stays readable (like groups, I21). */
async function assertServiceTypeActive(deps: RecDeps, actor: Actor, code: string): Promise<void> {
  const t = (await listServiceTypes(deps, actor)).find((x) => x.code === code);
  if (!t)
    throw validationFailed([
      { field: 'serviceType', message: 'Loại dịch vụ không có trong danh mục.' },
    ]);
  if (!t.active)
    throw validationFailed([
      { field: 'serviceType', message: 'Loại dịch vụ đã ngừng dùng. Chọn loại khác.' },
    ]);
}

// ---- list / get ---------------------------------------------------------------------------

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  status: z.enum(['draft', 'completed', 'cancelled']).optional(),
  q: z.string().trim().max(40).optional(),
});

export async function listIntakes(
  deps: RecDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<IntakeDto>> {
  const scope = resolveWorkingScope(actor, 'intake:view');
  const q = parseInput(listSchema, raw);
  const text = q.q ?? '';
  const byNumber = /^tx/i.test(text);
  const page = await deps.intakes.list(scope, {
    limit: q.limit,
    ...(q.status ? { status: q.status } : {}),
    ...(text && byNumber ? { numberPrefix: text.toUpperCase() } : {}),
    ...(text && !byNumber ? { platePrefix: normalizePlate(text) } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return { items: page.items.map((i) => toIntakeDto(i)), nextCursor: page.nextCursor };
}

export async function getIntake(deps: RecDeps, actor: Actor, id: string): Promise<IntakeDto> {
  const scope = resolveScope(actor, 'intake:view');
  const i = await deps.intakes.get(scope, id);
  if (!i) throw notFound();
  return toIntakeDto(i, hasPermission(actor, 'rec-photo:update'));
}

// ---- create (step 1) -------------------------------------------------------------------------

export const createIntakeSchema = z.object({ vehicleId: z.string().trim().min(1).max(80) });

export async function createIntake(
  deps: RecDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string; sessionId?: string },
) {
  const scope = resolveScope(actor, 'intake:create');
  const data = parseInput(createIntakeSchema, input);
  requireWorkingBranch(actor);
  // FR-REC-001: the vehicle (and its owner) come from CRM; not visible in scope = not found
  const vehicle = await getVehicle(deps.crm, actor, data.vehicleId);
  if (!vehicle.owner) throw new AppError('owner_not_visible', 409);
  // BA §10.1.4: opening a visit relates the customer (and vehicles) to the working branch
  await relateToWorkingBranch(
    deps.crm,
    actor,
    vehicle.owner.id,
    {},
    {
      // C24 (BA §17): a vehicle that arrived and got an intake file relates its customer by `intake`
      source: 'intake',
      idempotencyKey: `rel-${ctx.idempotencyKey}`,
      requestId: ctx.requestId,
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    },
  );
  const owner = vehicle.owner;
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/rec/intakes',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const branch = await assertWritable(
        deps,
        tx,
        actor,
        scope,
        requireWorkingBranch(actor),
        'new_order',
      );
      const now = deps.sys.clock.now();
      const id = `tx_${deps.sys.newId()}`;
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'intake',
        businessDate: businessDate(now),
        stage: 'create',
        documentId: id,
        requestKey: ctx.idempotencyKey,
      });
      const i: Intake = {
        id,
        companyId: actor.companyId,
        branchId: branch.id,
        number: num.number!,
        status: 'draft',
        vehicleId: vehicle.id,
        customerId: owner.id,
        plate: vehicle.plate,
        plateNorm: normalizePlate(vehicle.plate),
        vehicleLabel: `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
        customerName: owner.name,
        lastKmAtOpen: vehicle.lastKm,
        step: 1,
        belongings: [],
        advisorId: actor.userId,
        customerParts: [],
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.intakes.create(tx, i);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: branch.id,
          entityType: 'intake',
          entityId: id,
          action: 'intake.create',
          after: { number: i.number, vehicleId: i.vehicleId },
        }),
      );
      return { status: 201, body: toIntakeDto(i) };
    },
  );
}

// ---- save a step (draft) ------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max);
export const patchIntakeSchema = z.object({
  version: z.number().int().min(1),
  step: z.number().int().min(1).max(5).optional(),
  km: z.number().int().min(0).max(9_999_999).optional(),
  kmReason: z.enum(['typo', 'odometer_replaced', 'other']).nullable().optional(),
  kmNote: text(200).nullable().optional(),
  fuel: z.enum(FUEL_LEVELS).nullable().optional(),
  customerRequest: text(1000).optional(),
  condition: text(1000).optional(),
  belongings: z.array(z.enum(BELONGINGS)).max(BELONGINGS.length).optional(),
  belongingsOther: text(200).optional(),
  /** R7: the CODE of an active entry of the company `service-type` catalogue (checked on save) */
  serviceType: z
    .string()
    .regex(/^[a-z][a-z0-9_-]{0,29}$/)
    .nullable()
    .optional(),
  promisedDate: isoDate.nullable().optional(),
  promisedTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  customerParts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        qty: z.number().int().min(1).max(999),
        condition: text(120),
      }),
    )
    .max(10)
    .optional(),
  internalNote: text(500).optional(),
});
export type PatchIntakeInput = z.infer<typeof patchIntakeSchema>;

/** Fields of the patch applied to the stored intake; an empty string or null clears an optional field. */
function applyPatch(i: Intake, d: PatchIntakeInput): Intake {
  const next: Intake = { ...i };
  const setOrClear = <K extends keyof Intake>(k: K, v: Intake[K] | null | '' | undefined) => {
    if (v === undefined) return;
    if (v === null || v === '') delete next[k];
    else next[k] = v as Intake[K];
  };
  setOrClear('fuel', d.fuel);
  setOrClear('customerRequest', d.customerRequest);
  setOrClear('condition', d.condition);
  setOrClear('belongingsOther', d.belongingsOther);
  setOrClear('serviceType', d.serviceType);
  setOrClear('promisedDate', d.promisedDate);
  setOrClear('promisedTime', d.promisedTime);
  setOrClear('internalNote', d.internalNote);
  if (d.belongings) next.belongings = [...new Set(d.belongings)];
  if (d.customerParts) next.customerParts = d.customerParts;
  if (d.km !== undefined) next.km = d.km;
  if (d.step !== undefined) next.step = Math.max(i.step, d.step);
  return next;
}

/** FR-REC-003 + CRM C5: one rule, applied wherever an odometer value is stored. */
async function applyKmRule(
  deps: RecDeps,
  actor: Actor,
  i: Intake,
  d: Pick<PatchIntakeInput, 'kmReason' | 'kmNote'>,
): Promise<Intake> {
  if (i.km === undefined) return i;
  // read the vehicle fresh: another visit may have moved the last known reading since the draft opened
  const v = await getVehicle(deps.crm, actor, i.vehicleId);
  const reason = d.kmReason === undefined ? i.kmReason : (d.kmReason ?? undefined);
  const note = d.kmNote === undefined ? i.kmNote : (d.kmNote ?? undefined);
  const r = checkKm({
    km: i.km,
    lastKm: v.lastKm,
    reason,
    note,
    abnormalDrop: deps.crm.crm.abnormalKmDrop,
  });
  if (!r.ok)
    throw validationFailed([
      {
        field: r.field,
        message:
          r.code === 'reason_required'
            ? `Số km nhỏ hơn số km lần sửa trước (${v.lastKm}). Nhập lý do để tiếp tục.`
            : 'Ghi chú lý do ít nhất 5 ký tự.',
      },
    ]);
  const next: Intake = { ...i, lastKmAtOpen: v.lastKm };
  delete next.kmReason;
  delete next.kmNote;
  delete next.kmAbnormal;
  if (r.below) {
    next.kmReason = reason!;
    if (note) next.kmNote = note;
    if (r.abnormal) next.kmAbnormal = true;
  }
  return next;
}

const FIELDS = [
  'km',
  'kmReason',
  'kmNote',
  'kmAbnormal',
  'fuel',
  'customerRequest',
  'condition',
  'belongings',
  'belongingsOther',
  'serviceType',
  'promisedDate',
  'promisedTime',
  'customerParts',
  'internalNote',
  'lastKmAtOpen',
  'step',
] as const;
const patchOf = (next: Intake): Record<string, unknown> =>
  Object.fromEntries(FIELDS.map((f) => [f, next[f] ?? null]));

export async function updateIntake(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<IntakeDto> {
  const scope = resolveScope(actor, 'intake:update');
  const data = parseInput(patchIntakeSchema, input);
  if (data.serviceType) await assertServiceTypeActive(deps, actor, data.serviceType);
  return deps.sys.uow.run(async (tx) => {
    const i = await deps.intakes.getInTx(tx, scope, id);
    if (!i) throw notFound();
    if (i.version !== data.version) throw versionConflict();
    if (i.status !== 'draft') throw new AppError('state_invalid', 409);
    await assertWritable(deps, tx, actor, scope, i.branchId, 'edit_open_order');
    const next = await applyKmRule(deps, actor, applyPatch(i, data), data);
    const now = deps.sys.clock.now();
    deps.intakes.update(tx, id, {
      ...patchOf(next),
      updatedAt: now,
      updatedBy: actor.userId,
      version: i.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: i.branchId,
        entityType: 'intake',
        entityId: id,
        action: 'intake.update',
        // values of the customer's words stay out of the log; the km change and its reason are the audit fact
        before: { km: i.km ?? null, step: i.step },
        after: { km: next.km ?? null, step: next.step },
        ...(next.kmReason
          ? {
              reason: `km ${i.lastKmAtOpen} -> ${next.km}: ${next.kmReason}${next.kmNote ? ` (${next.kmNote})` : ''}`,
            }
          : {}),
      }),
    );
    return toIntakeDto({
      ...next,
      updatedAt: now,
      updatedBy: actor.userId,
      version: i.version + 1,
    });
  });
}

// ---- complete / cancel ----------------------------------------------------------------------------

export const intakeActionSchema = z.object({ version: z.number().int().min(1) });

export async function completeIntake(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'intake:update');
  const data = parseInput(intakeActionSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/intakes/${id}/complete`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const i = await deps.intakes.getInTx(tx, scope, id);
      if (!i) throw notFound();
      if (i.version !== data.version) throw versionConflict();
      const t = transitionIntake(i.status, 'complete');
      if (!t.ok) throw new AppError(t.reason, 409);
      await assertWritable(deps, tx, actor, scope, i.branchId, 'edit_open_order');
      // FR-REC-002: cannot be saved without the odometer and the customer's own words
      const missing = [
        ...(i.km === undefined
          ? [{ field: 'km', message: 'Nhập số km trên đồng hồ để tiếp tục.' }]
          : []),
        ...(!i.customerRequest
          ? [{ field: 'customerRequest', message: 'Ghi yêu cầu của khách để tiếp tục.' }]
          : []),
        ...(!i.serviceType ? [{ field: 'serviceType', message: 'Chọn loại dịch vụ.' }] : []),
        ...(!i.promisedDate ? [{ field: 'promisedDate', message: 'Chọn ngày hẹn giao.' }] : []),
      ];
      if (missing.length) throw validationFailed(missing);
      await assertServiceTypeActive(deps, actor, i.serviceType!);
      const now = deps.sys.clock.now();
      if (i.promisedDate! < businessDate(now))
        throw validationFailed([
          { field: 'promisedDate', message: 'Ngày hẹn giao không được trước hôm nay.' },
        ]);
      const checked = await applyKmRule(deps, actor, i, {});
      // R9: the reading becomes the vehicle's last known km in THIS transaction (CRM owns the rule and the
      // manager notice for an abnormal drop), so km-based reminders are right before any quote is approved
      await recordOdometer(
        deps.crm,
        tx,
        actor,
        {
          vehicleId: i.vehicleId,
          km: checked.km!,
          reason: checked.kmReason,
          note: checked.kmNote,
          source: 'intake',
          sourceId: i.id,
        },
        ctx,
      );
      deps.intakes.update(tx, id, {
        ...patchOf(checked),
        status: t.state,
        completedAt: now,
        updatedAt: now,
        updatedBy: actor.userId,
        version: i.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: i.branchId,
          entityType: 'intake',
          entityId: id,
          action: 'intake.complete',
          before: { status: i.status },
          after: { status: t.state },
        }),
      );
      return {
        status: 200,
        body: toIntakeDto({
          ...checked,
          status: t.state,
          updatedAt: now,
          updatedBy: actor.userId,
          version: i.version + 1,
        }),
      };
    },
  );
}

export const cancelIntakeSchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().min(5).max(300),
});

export async function cancelIntake(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'intake:update');
  const data = parseInput(cancelIntakeSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/intakes/${id}/cancel`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const i = await deps.intakes.getInTx(tx, scope, id);
      if (!i) throw notFound();
      if (i.version !== data.version) throw versionConflict();
      const t = transitionIntake(i.status, 'cancel', { hasQuote: !!i.quoteId });
      if (!t.ok) throw new AppError(t.reason, 409);
      await assertWritable(deps, tx, actor, scope, i.branchId, 'edit_open_order');
      const now = deps.sys.clock.now();
      deps.intakes.update(tx, id, {
        status: t.state,
        cancelReason: data.reason,
        updatedAt: now,
        updatedBy: actor.userId,
        version: i.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: i.branchId,
          entityType: 'intake',
          entityId: id,
          action: 'intake.cancel',
          before: { status: i.status },
          after: { status: t.state },
          reason: data.reason,
        }),
      );
      return {
        status: 200,
        body: toIntakeDto({
          ...i,
          status: t.state,
          cancelReason: data.reason,
          updatedAt: now,
          updatedBy: actor.userId,
          version: i.version + 1,
        }),
      };
    },
  );
}

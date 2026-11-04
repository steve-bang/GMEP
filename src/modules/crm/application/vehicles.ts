import { AppError, validationFailed } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { businessDate } from '@/platform/format/date';
import type { Vehicle } from '../domain/entities';
import { currentOwnership, planOwnerChange, type Ownership } from '../domain/ownership';
import { isPlausiblePlate, isValidVin, normalizePlate, normalizeVin } from '../domain/normalize';
import { AlreadyExistsError } from '@/platform/store/docStore';
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

export interface VehicleDto {
  id: string;
  plate: string;
  previousPlates: { plate: string; until: string }[];
  vin: string | null;
  engineNo: string | null;
  make: string;
  model: string;
  year: number;
  isCommercial: boolean;
  lastKm: number | null;
  lastKmAt: string | null;
  branchId: string;
  /** the current owner, only when that customer is visible in the actor's scope */
  owner: { id: string; code: string; name: string } | null;
  createdAt: string;
  version: number;
}

export function toVehicleDto(
  v: Vehicle,
  owner: { id: string; code: string; name: string } | null,
): VehicleDto {
  return {
    id: v.id,
    plate: v.plate,
    previousPlates: v.previousPlates,
    vin: v.vin ?? null,
    engineNo: v.engineNo ?? null,
    make: v.make,
    model: v.model,
    year: v.year,
    isCommercial: v.isCommercial,
    lastKm: v.lastKm ?? null,
    lastKmAt: v.lastKmAt ?? null,
    branchId: v.branchId,
    owner,
    createdAt: v.createdAt.toISOString(),
    version: v.version,
  };
}

async function withOwners(
  deps: CrmDeps,
  scope: Parameters<CrmDeps['customers']['getMany']>[0],
  vehicles: Vehicle[],
): Promise<VehicleDto[]> {
  const ids = [...new Set(vehicles.flatMap((v) => (v.currentOwnerId ? [v.currentOwnerId] : [])))];
  const owners = new Map((await deps.customers.getMany(scope, ids)).map((c) => [c.id, c] as const));
  return vehicles.map((v) => {
    const o = v.currentOwnerId ? owners.get(v.currentOwnerId) : undefined;
    return toVehicleDto(v, o ? { id: o.id, code: o.code, name: o.name } : null);
  });
}

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  q: z.string().trim().max(30).optional(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

/** FR-CRM-002: plate-prefix search (diacritics and separators ignored) inside the working scope. */
export async function listVehicles(
  deps: CrmDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<VehicleDto>> {
  const scope = resolveWorkingScope(actor, 'vehicle:view');
  const q = parseInput(listSchema, raw);
  const platePrefix = q.q ? normalizePlate(q.q) : '';
  const page = await deps.vehicles.list(scope, {
    direction: q.direction,
    limit: q.limit,
    ...(platePrefix ? { platePrefix } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return { items: await withOwners(deps, scope, page.items), nextCursor: page.nextCursor };
}

export async function getVehicle(deps: CrmDeps, actor: Actor, id: string): Promise<VehicleDto> {
  const scope = resolveScope(actor, 'vehicle:view');
  const v = await deps.vehicles.get(scope, id);
  if (!v) throw notFound();
  return (await withOwners(deps, scope, [v]))[0]!;
}

export async function listCustomerVehicles(
  deps: CrmDeps,
  actor: Actor,
  customerId: string,
): Promise<VehicleDto[]> {
  const scope = resolveScope(actor, 'vehicle:view');
  const cscope = resolveScope(actor, 'customer:view');
  if (!(await deps.customers.get(cscope, customerId))) throw notFound();
  const vs = await deps.vehicles.byCustomer(scope, customerId, 100);
  return withOwners(deps, scope, vs);
}

// ---- ownership history ---------------------------------------------------------------

export interface OwnershipDto {
  id: string;
  customerId: string;
  /** name only when the owner is visible in the actor's scope */
  customer: { code: string; name: string } | null;
  from: string;
  to: string | null;
  current: boolean;
  note: string | null;
}

/** FR-CRM-014: full effective-dated history of a vehicle, newest first. */
export async function listVehicleOwnerships(
  deps: CrmDeps,
  actor: Actor,
  vehicleId: string,
): Promise<OwnershipDto[]> {
  const scope = resolveScope(actor, 'vehicle:view');
  const v = await deps.vehicles.get(scope, vehicleId);
  if (!v) throw notFound();
  const rows = await deps.ownerships.listByVehicle(actor.companyId, vehicleId);
  const visible = new Map(
    (
      await deps.customers.getMany(resolveScope(actor, 'customer:view'), [
        ...new Set(rows.map((r) => r.customerId)),
      ])
    ).map((c) => [c.id, c] as const),
  );
  return rows.map((o) => ({
    id: o.id,
    customerId: o.customerId,
    customer: visible.has(o.customerId)
      ? { code: visible.get(o.customerId)!.code, name: visible.get(o.customerId)!.name }
      : null,
    from: o.from,
    to: o.to,
    current: o.to === null,
    note: o.note ?? null,
  }));
}

// ---- create ----------------------------------------------------------------------------

const thisYear = (deps: CrmDeps) => Number(businessDate(deps.sys.clock.now()).slice(0, 4));
const vehicleFields = {
  vin: z.string().trim().max(20).optional(),
  engineNo: z.string().trim().max(40).optional(),
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1950).max(2100),
  isCommercial: z.boolean().default(false),
  lastKm: z.number().int().min(0).max(9_999_999).optional(),
};
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const createVehicleSchema = z.object({
  customerId: z.string().trim().min(1).max(128),
  plate: z.string().trim().min(3).max(20),
  ...vehicleFields,
  /** start of the first ownership; defaults to today */
  ownedFrom: z.string().regex(dateRe).optional(),
});

const vinExists = () =>
  new AppError('vin_exists', 409, [{ field: 'vin', message: 'Số khung đã gắn với một xe khác.' }]);

/**
 * Registry slots (plate, VIN) are created, never set: a taken slot fails the transaction. The store
 * does not say which slot, so the plate is re-checked to tell the two conflicts apart.
 */
async function mapRegistryConflict(
  deps: CrmDeps,
  companyId: string,
  plateNorm: string | undefined,
  e: unknown,
): Promise<unknown> {
  if (!(e instanceof AlreadyExistsError)) return e;
  if (plateNorm === undefined) return vinExists();
  return (await deps.vehicles.vehicleIdByPlate(companyId, plateNorm))
    ? new AppError('plate_exists', 409)
    : vinExists();
}

function checkVehicleFields(
  deps: CrmDeps,
  d: { plate?: string; vin?: string; year?: number },
): { plateNorm?: string; vin?: string } {
  const errors: { field: string; message: string }[] = [];
  let plateNorm: string | undefined;
  if (d.plate !== undefined) {
    plateNorm = normalizePlate(d.plate);
    if (!isPlausiblePlate(plateNorm))
      errors.push({ field: 'plate', message: 'Biển số chưa đúng (5-12 ký tự gồm chữ và số).' });
  }
  let vin: string | undefined;
  if (d.vin) {
    vin = normalizeVin(d.vin);
    if (!isValidVin(vin))
      errors.push({ field: 'vin', message: 'Số khung gồm 17 ký tự chữ và số, không có I, O, Q.' });
  }
  if (d.year !== undefined && d.year > thisYear(deps) + 1)
    errors.push({ field: 'year', message: 'Năm sản xuất chưa hợp lệ.' });
  if (errors.length) throw validationFailed(errors);
  return { ...(plateNorm ? { plateNorm } : {}), ...(vin ? { vin } : {}) };
}

/** FR-CRM-002 + FR-CRM-014: vehicle with its first ownership; the plate is unique in the whole company. */
export async function createVehicle(
  deps: CrmDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'vehicle:create');
  const cscope = resolveScope(actor, 'customer:view');
  const data = parseInput(createVehicleSchema, input);
  const checked = checkVehicleFields(deps, data);
  try {
    return await runIdempotent(
      idemOf(deps),
      {
        userId: actor.userId,
        route: 'POST /api/v1/crm/vehicles',
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf(data),
      },
      async (tx) => {
        const customer = await deps.customers.getInTx(tx, cscope, data.customerId);
        if (!customer) throw notFound();
        if (customer.status === 'anonymized') throw new AppError('customer_anonymized', 409);
        const branch = await writableWorkingBranch(deps, tx, actor, scope);
        // friendly early answer; the registry slot created below is the race-proof guard
        if (await deps.vehicles.vehicleIdByPlate(actor.companyId, checked.plateNorm!))
          throw new AppError('plate_exists', 409);
        // C11: a VIN identifies one vehicle company-wide; the answer never names a branch
        if (checked.vin && (await deps.vehicles.vehicleIdByVin(actor.companyId, checked.vin)))
          throw vinExists();
        const now = deps.sys.clock.now();
        const today = businessDate(now);
        const id = `veh_${deps.sys.newId()}`;
        const v: Vehicle = {
          id,
          companyId: actor.companyId,
          branchId: branch.id,
          plate: data.plate.trim().toUpperCase(),
          plateNorm: checked.plateNorm!,
          previousPlates: [],
          ...(checked.vin ? { vin: checked.vin } : {}),
          ...(data.engineNo ? { engineNo: data.engineNo } : {}),
          make: data.make,
          model: data.model,
          year: data.year,
          isCommercial: data.isCommercial,
          ...(data.lastKm !== undefined ? { lastKm: data.lastKm, lastKmAt: today } : {}),
          currentOwnerId: customer.id,
          branchIds: [branch.id],
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        const own: Ownership = {
          id: `own_${deps.sys.newId()}`,
          companyId: actor.companyId,
          vehicleId: id,
          customerId: customer.id,
          from: data.ownedFrom ?? today,
          to: null,
          branchId: branch.id,
          createdAt: now,
          createdBy: actor.userId,
        };
        if (own.from > today)
          throw validationFailed([
            { field: 'ownedFrom', message: 'Ngày bắt đầu sở hữu không được ở tương lai.' },
          ]);
        deps.vehicles.create(tx, v);
        deps.vehicles.link(tx, v, branch.id, now);
        deps.ownerships.create(tx, own);
        deps.customers.update(tx, customer.id, { vehicleCount: customer.vehicleCount + 1 });
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId: branch.id,
            entityType: 'vehicle',
            entityId: id,
            action: 'vehicle.create',
            after: {
              plate: v.plate,
              make: v.make,
              model: v.model,
              year: v.year,
              isCommercial: v.isCommercial,
              ownerId: customer.id,
            },
          }),
        );
        return {
          status: 201,
          body: toVehicleDto(v, { id: customer.id, code: customer.code, name: customer.name }),
        };
      },
    );
  } catch (e) {
    throw await mapRegistryConflict(deps, actor.companyId, checked.plateNorm, e);
  }
}

// ---- update ----------------------------------------------------------------------------

export const updateVehicleSchema = z.object({
  vin: z.string().trim().max(20).nullable().optional(),
  engineNo: z.string().trim().max(40).nullable().optional(),
  make: vehicleFields.make.optional(),
  model: vehicleFields.model.optional(),
  year: vehicleFields.year.optional(),
  isCommercial: z.boolean().optional(),
  lastKm: vehicleFields.lastKm,
  /** C5: required when the odometer value goes down */
  lastKmReason: z.enum(['typo', 'odometer_replaced', 'other']).optional(),
  lastKmNote: z.string().trim().max(200).optional(),
  version: z.number().int().min(1),
});

export async function updateVehicle(
  deps: CrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<VehicleDto> {
  const scope = resolveScope(actor, 'vehicle:update');
  const data = parseInput(updateVehicleSchema, input);
  const checked = checkVehicleFields(deps, {
    ...(data.vin ? { vin: data.vin } : {}),
    ...(data.year !== undefined ? { year: data.year } : {}),
  });
  try {
    return await updateVehicleTx(deps, actor, scope, id, data, checked, ctx);
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw vinExists(); // lost a race for the VIN slot (C11)
    throw e;
  }
}

async function updateVehicleTx(
  deps: CrmDeps,
  actor: Actor,
  scope: ReturnType<typeof resolveScope>,
  id: string,
  data: z.infer<typeof updateVehicleSchema>,
  checked: { plateNorm?: string; vin?: string },
  ctx: RequestCtx,
): Promise<VehicleDto> {
  return deps.sys.uow.run(async (tx) => {
    const v = await deps.vehicles.getInTx(tx, scope, id);
    if (!v) throw notFound();
    if (v.version !== data.version) throw versionConflict();
    await writableWorkingBranch(deps, tx, actor, scope, 'edit_master');
    // C5 [Đề xuất BA - chờ xác nhận: Khách]: a lower reading is allowed with a mandatory reason,
    // audited; it is a warning, not a hard block (FR-CRM-002, FR-REC-003)
    const lowering = data.lastKm !== undefined && v.lastKm !== undefined && data.lastKm < v.lastKm;
    if (lowering) {
      if (!data.lastKmReason)
        throw validationFailed([
          {
            field: 'lastKmReason',
            message: `Số km nhỏ hơn số km đã ghi (${v.lastKm}). Chọn lý do: nhập nhầm, thay đồng hồ hoặc khác.`,
          },
        ]);
      if (data.lastKmReason === 'other' && (data.lastKmNote ?? '').length < 5)
        throw validationFailed([
          { field: 'lastKmNote', message: 'Ghi chú lý do ít nhất 5 ký tự.' },
        ]);
    }
    // VIN uniqueness (C11): the slot moves with the value
    const newVin = data.vin === undefined ? (v.vin ?? null) : (checked.vin ?? null);
    if (newVin !== (v.vin ?? null)) {
      if (newVin && (await deps.vehicles.vehicleIdByVin(actor.companyId, newVin)))
        throw vinExists();
      deps.vehicles.setVin(tx, v, v.vin ?? null, newVin);
    }
    const now = deps.sys.clock.now();
    const next = {
      make: data.make ?? v.make,
      model: data.model ?? v.model,
      year: data.year ?? v.year,
      isCommercial: data.isCommercial ?? v.isCommercial,
      vin: data.vin === undefined ? (v.vin ?? null) : (checked.vin ?? null),
      engineNo: data.engineNo === undefined ? (v.engineNo ?? null) : data.engineNo || null,
      lastKm: data.lastKm ?? v.lastKm ?? null,
      lastKmAt: data.lastKm !== undefined ? businessDate(now) : (v.lastKmAt ?? null),
      odometerReplacedAt:
        lowering && data.lastKmReason === 'odometer_replaced'
          ? businessDate(now)
          : (v.odometerReplacedAt ?? null),
    };
    deps.vehicles.update(tx, id, {
      ...next,
      updatedAt: now,
      updatedBy: actor.userId,
      version: v.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: v.branchId,
        entityType: 'vehicle',
        entityId: id,
        action: 'vehicle.update',
        before: {
          make: v.make,
          model: v.model,
          year: v.year,
          isCommercial: v.isCommercial,
          vin: v.vin ?? null,
          engineNo: v.engineNo ?? null,
          lastKm: v.lastKm ?? null,
        },
        after: { ...next, lastKmAt: undefined },
        ...(lowering
          ? {
              reason: `lastKm ${v.lastKm} -> ${data.lastKm}: ${data.lastKmReason}${data.lastKmNote ? ` (${data.lastKmNote})` : ''}`,
            }
          : {}),
      }),
    );
    const merged: Vehicle = {
      ...v,
      make: next.make,
      model: next.model,
      year: next.year,
      isCommercial: next.isCommercial,
      ...(next.vin ? { vin: next.vin } : {}),
      ...(next.engineNo ? { engineNo: next.engineNo } : {}),
      ...(next.lastKm !== null ? { lastKm: next.lastKm } : {}),
      ...(next.lastKmAt ? { lastKmAt: next.lastKmAt } : {}),
      ...(next.odometerReplacedAt ? { odometerReplacedAt: next.odometerReplacedAt } : {}),
      version: v.version + 1,
    };
    return (await withOwners(deps, resolveScope(actor, 'customer:view'), [merged]))[0]!;
  });
}

// ---- plate change (G2-CRM-07) --------------------------------------------------------------

export const changePlateSchema = z.object({
  plate: z.string().trim().min(3).max(20),
  reason: z.string().trim().min(5).max(200),
  version: z.number().int().min(1),
});

/** The old plate is kept in `previousPlates` (history keeps matching the vehicle); the new one must be free. */
export async function changePlate(
  deps: CrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<VehicleDto> {
  const scope = resolveScope(actor, 'vehicle:update');
  const data = parseInput(changePlateSchema, input);
  const { plateNorm } = checkVehicleFields(deps, { plate: data.plate });
  try {
    return await deps.sys.uow.run(async (tx) => {
      const v = await deps.vehicles.getInTx(tx, scope, id);
      if (!v) throw notFound();
      if (v.version !== data.version) throw versionConflict();
      await writableWorkingBranch(deps, tx, actor, scope, 'edit_master');
      if (plateNorm === v.plateNorm)
        throw validationFailed([
          { field: 'plate', message: 'Biển số mới trùng biển số hiện tại.' },
        ]);
      if (await deps.vehicles.vehicleIdByPlate(actor.companyId, plateNorm!))
        throw new AppError('plate_exists', 409);
      const now = deps.sys.clock.now();
      const plate = data.plate.trim().toUpperCase();
      deps.vehicles.changePlate(tx, v, plateNorm!);
      deps.vehicles.update(tx, id, {
        plate,
        plateNorm,
        previousPlates: [...v.previousPlates, { plate: v.plate, until: businessDate(now) }],
        updatedAt: now,
        updatedBy: actor.userId,
        version: v.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: v.branchId,
          entityType: 'vehicle',
          entityId: id,
          action: 'vehicle.plate_change',
          before: { plate: v.plate },
          after: { plate },
          reason: data.reason,
        }),
      );
      const merged: Vehicle = {
        ...v,
        plate,
        plateNorm: plateNorm!,
        previousPlates: [...v.previousPlates, { plate: v.plate, until: businessDate(now) }],
        version: v.version + 1,
      };
      return (await withOwners(deps, resolveScope(actor, 'customer:view'), [merged]))[0]!;
    });
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('plate_exists', 409);
    throw e;
  }
}

// ---- owner change (FR-CRM-014) -------------------------------------------------------------

export const changeOwnerSchema = z.object({
  newCustomerId: z.string().trim().min(1).max(128),
  effectiveDate: z.string().regex(dateRe),
  note: z.string().trim().max(200).optional(),
  version: z.number().int().min(1),
});

/**
 * Closes the open ownership the day before `effectiveDate` and opens a new one. Nothing is edited or
 * deleted, so the vehicle's repair history keeps pointing at the right owner on any date (UAT-18).
 */
export async function changeOwner(
  deps: CrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'vehicle:update');
  const cscope = resolveScope(actor, 'customer:view');
  const data = parseInput(changeOwnerSchema, input);
  if (!z.iso.date().safeParse(data.effectiveDate).success)
    throw validationFailed([{ field: 'effectiveDate', message: 'Ngày không hợp lệ.' }]);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/crm/vehicles/${id}/owner`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const v = await deps.vehicles.getInTx(tx, scope, id);
      if (!v) throw notFound();
      if (v.version !== data.version) throw versionConflict();
      const next = await deps.customers.getInTx(tx, cscope, data.newCustomerId);
      if (!next) throw notFound();
      if (next.status === 'anonymized') throw new AppError('customer_anonymized', 409);
      const branch = await writableWorkingBranch(deps, tx, actor, scope, 'edit_master');
      const now = deps.sys.clock.now();
      const today = businessDate(now);
      if (data.effectiveDate > today)
        throw validationFailed([
          { field: 'effectiveDate', message: 'Ngày chuyển chủ không được ở tương lai.' },
        ]);
      const history = await deps.ownerships.listByVehicleInTx(tx, actor.companyId, id);
      const prev = currentOwnership(history);
      const prevCustomer = prev
        ? await deps.customers.getCompanyWideInTx(tx, actor.companyId, prev.customerId)
        : null;
      const planned = planOwnerChange(history, data);
      if (!planned.ok) throw new AppError(`owner_${planned.error}`, 422);
      const { plan } = planned;
      deps.ownerships.close(tx, plan.closeId, plan.closeTo);
      const own: Ownership = {
        id: `own_${deps.sys.newId()}`,
        companyId: actor.companyId,
        vehicleId: id,
        customerId: next.id,
        from: plan.openFrom,
        to: null,
        branchId: branch.id,
        ...(data.note ? { note: data.note } : {}),
        createdAt: now,
        createdBy: actor.userId,
      };
      deps.ownerships.create(tx, own);
      deps.vehicles.update(tx, id, {
        currentOwnerId: next.id,
        updatedAt: now,
        updatedBy: actor.userId,
        version: v.version + 1,
      });
      deps.customers.update(tx, next.id, { vehicleCount: next.vehicleCount + 1 });
      if (prevCustomer)
        deps.customers.update(tx, prevCustomer.id, {
          vehicleCount: Math.max(0, prevCustomer.vehicleCount - 1),
        });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: v.branchId,
          entityType: 'vehicle',
          entityId: id,
          action: 'vehicle.owner_change',
          before: { ownerId: prev?.customerId ?? null, ownedFrom: prev?.from },
          after: { ownerId: next.id, effectiveDate: plan.openFrom },
          ...(data.note ? { reason: data.note } : {}),
        }),
      );
      const dto = toVehicleDto(
        { ...v, currentOwnerId: next.id, version: v.version + 1 },
        { id: next.id, code: next.code, name: next.name },
      );
      return { status: 200, body: dto };
    },
  );
}

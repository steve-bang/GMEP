import { AppError, validationFailed } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { AlreadyExistsError } from '@/platform/store/docStore';
import { normalizeSearch } from '@/platform/text/normalize';
import { resolveConfigAt } from '@/modules/sys';
import type { Part, PartStatus } from '../domain/entities';
import {
  compatKey,
  isValidBarcode,
  normalizeBarcode,
  normalizePartCode,
  partCodeKey,
  PART_CODE_PATTERN,
  QUANTITY_SCALES,
} from '../domain/normalize';
import type { InvDeps } from '../ports/deps';
import { allBranchesScope } from '@/platform/scope/scope';
import { resolveCatalog, type CatalogKind } from './catalog';
import { today } from './config';
import {
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

export interface PartDto {
  id: string;
  code: string;
  name: string;
  brand: string;
  unit: string;
  group: string;
  /** I4: stored quantity / quantityScale = displayed quantity */
  quantityScale: number;
  barcode: string | null;
  compat: string[];
  status: PartStatus;
  createdAt: string;
  version: number;
}

export function toPartDto(p: Part): PartDto {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    brand: p.brand,
    unit: p.unit,
    group: p.group,
    quantityScale: p.quantityScale,
    barcode: p.barcode ?? null,
    compat: p.compat,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    version: p.version,
  };
}

/** Search mode from the shape of the text (FR-INV-001: by code, name, barcode or vehicle line). */
export function partSearchMode(q: string): 'barcode' | 'code' | 'name' {
  const compact = q.replace(/\s+/g, '');
  if (/^\d{8,14}$/.test(compact)) return 'barcode';
  if (/\d/.test(q) && !/\s/.test(q.trim())) return 'code';
  if (/^[A-Za-z0-9._-]+$/.test(compact) && /\d/.test(compact) && /-/.test(compact)) return 'code';
  return 'name';
}

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  q: z.string().trim().max(60).optional(),
  by: z.enum(['auto', 'code', 'name', 'barcode', 'model']).default('auto'),
  group: z.string().trim().max(30).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const BOUND = 50;

/** FR-INV-001: catalogue list and search. Company-level data; needs `part:view`. */
export async function listParts(deps: InvDeps, actor: Actor, raw: unknown): Promise<Page<PartDto>> {
  const scope = resolveScope(actor, 'part:view');
  const q = parseInput(listSchema, raw);
  const text = q.q ?? '';
  const mode = !text ? 'name' : q.by === 'auto' ? partSearchMode(text) : q.by;
  const filter = {
    ...(q.group ? { group: q.group } : {}),
    ...(q.status ? { status: q.status } : {}),
  };
  const bounded = (items: Part[]): Page<PartDto> => ({
    items: items
      .filter((p) => (!q.group || p.group === q.group) && (!q.status || p.status === q.status))
      .map(toPartDto),
    nextCursor: null,
  });
  if (mode === 'barcode') {
    const id = await deps.parts.idByBarcode(scope, normalizeBarcode(text));
    const p = id ? await deps.parts.get(scope, id) : null;
    if (p) return bounded([p]);
    if (q.by === 'barcode') return bounded([]);
  }
  if (mode === 'model') {
    const key = compatKey('', text);
    return bounded(await deps.parts.listByCompat(scope, key, BOUND));
  }
  const run = async (byCode: boolean) =>
    mapPage(
      await deps.parts.list(scope, {
        sort: byCode ? 'code' : 'name',
        limit: q.limit,
        ...(text ? { prefix: byCode ? normalizePartCode(text) : normalizeSearch(text) } : {}),
        ...filter,
        ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
      }),
    );
  const byCode = mode === 'code' || mode === 'barcode';
  const first = await run(byCode);
  // automatic mode guesses from the shape of the text; when the guess finds nothing, try the other column
  if (q.by === 'auto' && text && !q.cursor && first.items.length === 0) return run(!byCode);
  return first;
}

const mapPage = (p: Page<Part>): Page<PartDto> => ({
  items: p.items.map(toPartDto),
  nextCursor: p.nextCursor,
});

export async function getPart(deps: InvDeps, actor: Actor, id: string): Promise<PartDto> {
  const scope = resolveScope(actor, 'part:view');
  const p = await deps.parts.get(scope, id);
  if (!p) throw notFound();
  return toPartDto(p);
}

// ---- create ---------------------------------------------------------------------------

const compatItem = z.object({
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
});
const partFields = {
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(60).default(''),
  unit: z.string().trim().min(1).max(30),
  group: z.string().trim().min(1).max(30),
  quantityScale: z.coerce
    .number()
    .int()
    .refine((n) => (QUANTITY_SCALES as readonly number[]).includes(n), 'scale')
    .default(1),
  barcode: z.string().trim().max(40).optional(),
  compat: z.array(compatItem).max(30).default([]),
};

export const createPartSchema = z.object({
  code: z.string().trim().min(2).max(40),
  ...partFields,
});

function compatOf(items: { make: string; model: string }[]): { display: string[]; keys: string[] } {
  const display = [...new Set(items.map((c) => `${c.make} ${c.model}`))];
  const keys = [
    ...new Set(items.flatMap((c) => [compatKey(c.make, c.model), compatKey('', c.model)])),
  ];
  return { display, keys };
}

function checkBarcode(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const b = normalizeBarcode(raw);
  if (!isValidBarcode(b))
    throw validationFailed([
      { field: 'barcode', message: 'Mã vạch gồm 4-32 ký tự chữ và số, không có khoảng trắng.' },
    ]);
  return b;
}

/** FR-INV-002: the code is unique across the whole chain; a duplicate is refused and the existing part is named. */
export async function createPart(
  deps: InvDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'part:create');
  const data = parseInput(createPartSchema, input);
  const code = normalizePartCode(data.code);
  if (!PART_CODE_PATTERN.test(code))
    throw validationFailed([
      {
        field: 'code',
        message:
          'Mã gồm 2-40 ký tự: chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới hoặc dấu gạch chéo, không có khoảng trắng.',
      },
    ]);
  const barcode = checkBarcode(data.barcode);
  const compat = compatOf(data.compat);
  await assertInCatalog(deps, actor.tenantId, 'unit', data.unit, undefined);
  await assertInCatalog(deps, actor.tenantId, 'group', data.group, undefined);
  try {
    return await runIdempotent(
      idemOf(deps),
      {
        userId: actor.userId,
        route: 'POST /api/v1/inv/parts',
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf(data),
      },
      async (tx) => {
        const existing = await deps.parts.idByCodeKey(scope, partCodeKey(code));
        if (existing) throw await codeExists(deps, scope, existing);
        if (barcode && (await deps.parts.idByBarcode(scope, barcode)))
          throw new AppError('part_barcode_exists', 409);
        const now = deps.sys.clock.now();
        const id = `part_${deps.sys.newId()}`;
        const p: Part = {
          id,
          tenantId: actor.tenantId,
          code,
          codeKey: partCodeKey(code),
          name: data.name,
          nameNorm: normalizeSearch(data.name),
          brand: data.brand,
          unit: data.unit,
          group: data.group,
          quantityScale: data.quantityScale,
          ...(barcode ? { barcode } : {}),
          compat: compat.display,
          compatKeys: compat.keys,
          status: 'active',
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        deps.parts.create(tx, p);
        deps.parts.relinkCompat(tx, p, [], compat.keys);
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId: null,
            entityType: 'part',
            entityId: id,
            action: 'part.create',
            after: { code, name: p.name, unit: p.unit, group: p.group },
          }),
        );
        return { status: 201, body: toPartDto(p) };
      },
    );
  } catch (e) {
    if (e instanceof AlreadyExistsError) {
      const id = await deps.parts.idByCodeKey(scope, partCodeKey(code));
      if (id) throw await codeExists(deps, scope, id);
      throw new AppError('part_barcode_exists', 409);
    }
    throw e;
  }
}

/**
 * I14: a new or changed unit/group must be an ACTIVE entry of the company catalogue. Keeping the value
 * a part already has is allowed even when the entry was deactivated since.
 */
async function assertInCatalog(
  deps: InvDeps,
  tenantId: string,
  kind: CatalogKind,
  value: string,
  current: string | undefined,
): Promise<void> {
  if (value === current) return;
  const entry = (await resolveCatalog(deps, tenantId, kind, today(deps))).find(
    (e) => e.code === value,
  );
  if (!entry || !entry.active)
    throw validationFailed([
      {
        field: kind,
        message:
          kind === 'unit'
            ? 'Đơn vị tính chưa có trong danh mục.'
            : 'Nhóm hàng chưa có trong danh mục.',
      },
    ]);
}

async function codeExists(
  deps: InvDeps,
  scope: Parameters<InvDeps['parts']['get']>[0],
  existingId: string,
): Promise<AppError> {
  const p = await deps.parts.get(scope, existingId);
  return new AppError('part_code_exists', 409, [
    { field: 'code', message: p ? `Mã đã có: ${p.code} - ${p.name}` : 'Mã đã có.' },
  ]);
}

// ---- update / status ----------------------------------------------------------------------

export const updatePartSchema = z.object({
  name: partFields.name.optional(),
  brand: z.string().trim().max(60).optional(),
  unit: partFields.unit.optional(),
  group: partFields.group.optional(),
  quantityScale: partFields.quantityScale.optional(),
  barcode: z.string().trim().max(40).nullable().optional(),
  compat: partFields.compat.optional(),
  version: z.number().int().min(1),
});

/** The code never changes (price versions and documents refer to it); everything else may. */
export async function updatePart(
  deps: InvDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<PartDto> {
  const scope = resolveScope(actor, 'part:update');
  const data = parseInput(updatePartSchema, input);
  const barcode = data.barcode ? checkBarcode(data.barcode) : undefined;
  try {
    return await deps.sys.uow.run(async (tx) => {
      const p = await deps.parts.getInTx(tx, scope, id);
      if (!p) throw notFound();
      if (p.version !== data.version) throw versionConflict();
      if (barcode && barcode !== p.barcode && (await deps.parts.idByBarcode(scope, barcode)))
        throw new AppError('part_barcode_exists', 409);
      if (data.unit) await assertInCatalog(deps, actor.tenantId, 'unit', data.unit, p.unit);
      if (data.group) await assertInCatalog(deps, actor.tenantId, 'group', data.group, p.group);
      // I4: the scale is fixed once the part has any stock record (every integer in the ledger depends on it)
      if (data.quantityScale !== undefined && data.quantityScale !== p.quantityScale) {
        const any = await deps.balances.listByPart(allBranchesScope(actor.tenantId), id, 1);
        if (any.length > 0) throw new AppError('scale_locked', 409);
      }
      const now = deps.sys.clock.now();
      const compat = data.compat
        ? compatOf(data.compat)
        : { display: p.compat, keys: p.compatKeys };
      const nextBarcode = data.barcode === null ? undefined : (barcode ?? p.barcode);
      const patch = {
        name: data.name ?? p.name,
        nameNorm: normalizeSearch(data.name ?? p.name),
        brand: data.brand ?? p.brand,
        unit: data.unit ?? p.unit,
        group: data.group ?? p.group,
        quantityScale: data.quantityScale ?? p.quantityScale,
        barcode: nextBarcode ?? null,
        compat: compat.display,
        compatKeys: compat.keys,
        updatedAt: now,
        updatedBy: actor.userId,
        version: p.version + 1,
      };
      deps.parts.update(tx, id, patch);
      if (nextBarcode !== p.barcode) deps.parts.rebarcode(tx, p, p.barcode, nextBarcode);
      if (data.compat) deps.parts.relinkCompat(tx, p, p.compatKeys, compat.keys);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: null,
          entityType: 'part',
          entityId: id,
          action: 'part.update',
          before: { name: p.name, brand: p.brand, unit: p.unit, group: p.group },
          after: { name: patch.name, brand: patch.brand, unit: patch.unit, group: patch.group },
        }),
      );
      return toPartDto({
        ...p,
        name: patch.name,
        brand: patch.brand,
        unit: patch.unit,
        group: patch.group,
        quantityScale: patch.quantityScale,
        compat: patch.compat,
        ...(nextBarcode ? { barcode: nextBarcode } : {}),
        version: patch.version,
      });
    });
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('part_barcode_exists', 409);
    throw e;
  }
}

export const partStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
  version: z.number().int().min(1),
});

/** An inactive part keeps its history but cannot enter new documents or reservations. No deletion (RULE-009, RULE-010). */
export async function setPartStatus(
  deps: InvDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<PartDto> {
  const scope = resolveScope(actor, 'part:archive');
  const data = parseInput(partStatusSchema, input);
  return deps.sys.uow.run(async (tx) => {
    const p = await deps.parts.getInTx(tx, scope, id);
    if (!p) throw notFound();
    if (p.version !== data.version) throw versionConflict();
    if (p.status === data.status) throw new AppError('state_invalid', 409);
    deps.parts.update(tx, id, {
      status: data.status,
      updatedAt: deps.sys.clock.now(),
      updatedBy: actor.userId,
      version: p.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: null,
        entityType: 'part',
        entityId: id,
        action: data.status === 'inactive' ? 'part.deactivate' : 'part.reactivate',
        before: { status: p.status },
        after: { status: data.status },
      }),
    );
    return toPartDto({ ...p, status: data.status, version: p.version + 1 });
  });
}

// ---- standard prices (FR-INV-025 link) ------------------------------------------------------

export interface PartPriceDto {
  priceListId: string;
  priceListCode: string;
  priceListName: string;
  /** list price effective today; null when the list has no price for the part */
  listPriceVnd: number | null;
  effectiveFrom: string | null;
  /** the list's standard cost, only for roles with stock-cost:view */
  costVnd: number | null;
}

/**
 * Standard list prices of a part: one row per price list header (SYS, slice 1.2), value from the
 * effective-dated `price-item` config (scope key `<price list code>:<part code>`). Cost, list price
 * and actual price stay separate; the list never decides the actual price of a document.
 */
export async function getPartPrices(
  deps: InvDeps,
  actor: Actor,
  partId: string,
): Promise<PartPriceDto[]> {
  const scope = resolveScope(actor, 'part:view');
  const part = await deps.parts.get(scope, partId);
  if (!part) throw notFound();
  const lists = await deps.sys.priceLists.list(actor.tenantId, {
    sort: 'code',
    direction: 'asc',
    limit: 20,
  });
  const showCost = hasPermission(actor, 'stock-cost:view');
  const date = today(deps);
  return Promise.all(
    lists.items.map(async (pl) => {
      const snap = await resolveConfigAt(deps.sys, {
        tenantId: actor.tenantId,
        type: 'price-item',
        scopeKey: `${pl.code}:${part.code}`,
        date,
      });
      const pay = snap?.payload as { listPriceVnd?: number; costVnd?: number } | undefined;
      return {
        priceListId: pl.id,
        priceListCode: pl.code,
        priceListName: pl.name,
        listPriceVnd: pay?.listPriceVnd ?? null,
        effectiveFrom: snap?.effectiveFrom ?? null,
        costVnd: showCost ? (pay?.costVnd ?? null) : null,
      };
    }),
  );
}

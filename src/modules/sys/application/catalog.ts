import { z } from 'zod';
import { AppError, forbidden, notFound } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import {
  fingerprintOf,
  runIdempotent,
  type StoredResponse,
} from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor, type Permission } from '@/platform/rbac/rbac';
import { normalizeSearch } from '@/platform/text/normalize';
import type { PriceListHeader, ServiceItem } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { AlreadyExistsError } from '../ports/ports';
import { auditEntry, parseInput, type RequestCtx } from './support';

/**
 * Service catalog and price-list headers (G4-SYS-07, FR-INV-025, ba-answers §2.3). Both are
 * company-level shared catalogues (BA §10): creating them needs a company-wide scope; branch
 * differences are effective-dated config overrides (labor-rate, discount-limit), not copies.
 * Prices themselves (cost, list) live in `price-item` config versions: separate, effective-dated, approved.
 */
const idem = (deps: SysDeps) => ({
  uow: deps.uow,
  store: deps.idempotency,
  now: () => deps.clock.now(),
  ttlMs: deps.config.idempotencyTtlMs,
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  q: z.string().trim().max(100).optional(),
  group: z.string().trim().max(60).optional(),
  sort: z.enum(['code', 'name']).default('code'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});
const codeRe = /^[A-Z0-9][A-Z0-9._-]{1,29}$/;

function companyWide(actor: Actor, permission: Permission): void {
  if (resolveScope(actor, permission).kind !== 'all') throw forbidden();
}

// ---- services -------------------------------------------------------------------

export interface ServiceDto {
  id: string;
  code: string;
  name: string;
  group: string;
  status: string;
  version: number;
}
const toServiceDto = (s: ServiceItem): ServiceDto => ({
  id: s.id,
  code: s.code,
  name: s.name,
  group: s.group,
  status: s.status,
  version: s.version,
});

export async function listServices(
  deps: SysDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<ServiceDto>> {
  resolveScope(actor, 'service-catalog:view');
  const q = parseInput(listSchema, raw);
  const namePrefix = q.q ? normalizeSearch(q.q) : undefined;
  const page = await deps.services.list(actor.companyId, {
    sort: namePrefix ? 'name' : q.sort,
    direction: q.direction,
    limit: q.limit,
    ...(namePrefix ? { namePrefix } : {}),
    ...(q.group ? { group: q.group } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return { items: page.items.map(toServiceDto), nextCursor: page.nextCursor };
}

export async function getService(deps: SysDeps, actor: Actor, id: string): Promise<ServiceDto> {
  resolveScope(actor, 'service-catalog:view');
  const s = await deps.services.get(actor.companyId, id);
  if (!s) throw notFound();
  return toServiceDto(s);
}

export const createServiceSchema = z.object({
  code: z.string().trim().toUpperCase().regex(codeRe),
  name: z.string().trim().min(2).max(120),
  group: z.string().trim().min(1).max(60),
});

export async function createService(
  deps: SysDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  companyWide(actor, 'service-catalog:create');
  const data = parseInput(createServiceSchema, input);
  try {
    return await runIdempotent(
      idem(deps),
      {
        userId: actor.userId,
        route: 'POST /api/v1/sys/services',
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf(data),
      },
      async (tx) => {
        const now = deps.clock.now();
        const s: ServiceItem = {
          id: `svc_${actor.companyId}_${data.code}`,
          companyId: actor.companyId,
          code: data.code,
          name: data.name,
          nameNorm: normalizeSearch(data.name),
          group: data.group,
          status: 'active',
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        deps.services.create(tx, s);
        deps.audit.record(
          tx,
          auditEntry(deps, actor, ctx, {
            branchId: null,
            entityType: 'service',
            entityId: s.id,
            action: 'service.create',
            after: toServiceDto(s) as unknown as Record<string, unknown>,
          }),
        );
        return { status: 201, body: toServiceDto(s) };
      },
    );
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('code_exists', 409);
    throw e;
  }
}

export const updateServiceSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  group: z.string().trim().min(1).max(60).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  version: z.number().int().min(1),
});

export async function updateService(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<ServiceDto> {
  companyWide(actor, 'service-catalog:update');
  const data = parseInput(updateServiceSchema, input);
  return deps.uow.run(async (tx) => {
    const s = await deps.services.getInTx(tx, actor.companyId, id);
    if (!s) throw notFound();
    if (s.version !== data.version) throw new AppError('version_conflict', 409);
    const next = {
      name: data.name ?? s.name,
      group: data.group ?? s.group,
      status: data.status ?? s.status,
    };
    deps.services.update(tx, id, {
      ...next,
      nameNorm: normalizeSearch(next.name),
      updatedAt: deps.clock.now(),
      updatedBy: actor.userId,
      version: s.version + 1,
    });
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: null,
        entityType: 'service',
        entityId: id,
        action: 'service.update',
        before: { name: s.name, group: s.group, status: s.status },
        after: next,
      }),
    );
    return toServiceDto({ ...s, ...next, version: s.version + 1 });
  });
}

// ---- price list headers ------------------------------------------------------------

export interface PriceListDto {
  id: string;
  code: string;
  name: string;
  status: string;
  version: number;
}
const toPriceListDto = (p: PriceListHeader): PriceListDto => ({
  id: p.id,
  code: p.code,
  name: p.name,
  status: p.status,
  version: p.version,
});

export async function listPriceLists(
  deps: SysDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<PriceListDto>> {
  resolveScope(actor, 'price-list:view');
  const q = parseInput(listSchema, raw);
  const namePrefix = q.q ? normalizeSearch(q.q) : undefined;
  const page = await deps.priceLists.list(actor.companyId, {
    sort: namePrefix ? 'name' : q.sort,
    direction: q.direction,
    limit: q.limit,
    ...(namePrefix ? { namePrefix } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return { items: page.items.map(toPriceListDto), nextCursor: page.nextCursor };
}

export const createPriceListSchema = z.object({
  code: z.string().trim().toUpperCase().regex(codeRe),
  name: z.string().trim().min(2).max(120),
});

export async function createPriceList(
  deps: SysDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  companyWide(actor, 'price-list:create');
  const data = parseInput(createPriceListSchema, input);
  try {
    return await runIdempotent(
      idem(deps),
      {
        userId: actor.userId,
        route: 'POST /api/v1/sys/price-lists',
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf(data),
      },
      async (tx) => {
        const now = deps.clock.now();
        const p: PriceListHeader = {
          id: `pl_${actor.companyId}_${data.code}`,
          companyId: actor.companyId,
          code: data.code,
          name: data.name,
          nameNorm: normalizeSearch(data.name),
          status: 'active',
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        deps.priceLists.create(tx, p);
        deps.audit.record(
          tx,
          auditEntry(deps, actor, ctx, {
            branchId: null,
            entityType: 'priceList',
            entityId: p.id,
            action: 'priceList.create',
            after: toPriceListDto(p) as unknown as Record<string, unknown>,
          }),
        );
        return { status: 201, body: toPriceListDto(p) };
      },
    );
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('code_exists', 409);
    throw e;
  }
}

export const updatePriceListSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  version: z.number().int().min(1),
});

export async function updatePriceList(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<PriceListDto> {
  companyWide(actor, 'price-list:update');
  const data = parseInput(updatePriceListSchema, input);
  return deps.uow.run(async (tx) => {
    const p = await deps.priceLists.getInTx(tx, actor.companyId, id);
    if (!p) throw notFound();
    if (p.version !== data.version) throw new AppError('version_conflict', 409);
    const next = { name: data.name ?? p.name, status: data.status ?? p.status };
    deps.priceLists.update(tx, id, {
      ...next,
      nameNorm: normalizeSearch(next.name),
      updatedAt: deps.clock.now(),
      updatedBy: actor.userId,
      version: p.version + 1,
    });
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: null,
        entityType: 'priceList',
        entityId: id,
        action: 'priceList.update',
        before: { name: p.name, status: p.status },
        after: next,
      }),
    );
    return toPriceListDto({ ...p, ...next, version: p.version + 1 });
  });
}

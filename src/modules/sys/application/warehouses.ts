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
import { resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { narrowScope, scopeAllows } from '@/platform/scope/scope';
import { normalizeSearch } from '@/platform/text/normalize';
import { assertBranchWritable } from '../domain/branchState';
import { WAREHOUSE_CODE_PATTERN, warehouseId, type Warehouse } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { AlreadyExistsError, type WarehouseListQuery } from '../ports/ports';
import { auditEntry, parseInput, roleCodesOf, type RequestCtx } from './support';

export const warehouseListInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  sort: z.enum(['code', 'name']).default('code'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().max(100).optional(),
  branchId: z.string().trim().max(64).optional(),
});
export type WarehouseListInput = z.input<typeof warehouseListInputSchema>;

/** FR-SYS-005, FR-SYS-002, NFR-ISO-01: the list is always evaluated inside the working scope of `warehouse:view`. */
export async function listWarehouses(
  deps: SysDeps,
  actor: Actor,
  rawInput: WarehouseListInput,
): Promise<Page<Warehouse>> {
  const baseScope = resolveWorkingScope(actor, 'warehouse:view');
  const input = warehouseListInputSchema.parse(rawInput);
  const scope = narrowScope(baseScope, input.branchId);
  if (!scope) return { items: [], nextCursor: null }; // requested a branch outside the scope: nothing visible

  const namePrefix = input.q ? normalizeSearch(input.q) : undefined;
  const query: WarehouseListQuery = {
    // prefix search is on nameNorm, so name ordering is forced when searching
    sort: namePrefix ? 'name' : input.sort,
    direction: input.direction,
    limit: input.limit,
    ...(namePrefix ? { namePrefix } : {}),
    ...(input.cursor ? { cursor: decodeCursor(input.cursor)! } : {}),
  };
  return deps.warehouses.list(scope, query);
}

/** Out-of-scope behaves exactly like missing (NFR-ISO-01 / UAT-06). */
export async function getWarehouse(deps: SysDeps, actor: Actor, id: string): Promise<Warehouse> {
  const scope = resolveScope(actor, 'warehouse:view');
  const found = await deps.warehouses.get(scope, id);
  if (!found) throw notFound();
  return found;
}

export const createWarehouseSchema = z.object({
  branchId: z.string().trim().min(1).max(64),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(WAREHOUSE_CODE_PATTERN, 'Mã kho gồm 2-20 ký tự A-Z, 0-9, gạch ngang.'),
  name: z.string().trim().min(2).max(120),
  note: z.string().trim().max(300).optional(),
});
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

export interface WarehouseDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  status: string;
  note: string | null;
  createdAt: string;
  version: number;
}

export function toWarehouseDto(w: Warehouse): WarehouseDto {
  return {
    id: w.id,
    branchId: w.branchId,
    code: w.code,
    name: w.name,
    status: w.status,
    note: w.note ?? null,
    createdAt: w.createdAt.toISOString(),
    version: w.version,
  };
}

const idem = (deps: SysDeps) => ({
  uow: deps.uow,
  store: deps.idempotency,
  now: () => deps.clock.now(),
  ttlMs: deps.config.idempotencyTtlMs,
});

/**
 * FR-SYS-005 create, FR-SYS-011 (branch state table), FR-SYS-003 (audit in the same transaction),
 * idempotent via Idempotency-Key (plan §2.8). Business uniqueness (branch + code) is the
 * deterministic document id, independent of the HTTP key's TTL (H2).
 */
export async function createWarehouse(
  deps: SysDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  const data = parseInput(createWarehouseSchema, input);
  const scope = resolveScope(actor, 'warehouse:create');
  if (!scopeAllows(scope, actor.companyId, data.branchId)) throw forbidden();

  try {
    return await runIdempotent(
      idem(deps),
      {
        userId: actor.userId,
        route: 'POST /api/v1/sys/warehouses',
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf(data),
      },
      async (tx) => {
        const branch = await deps.branches.getInTx(tx, scope, data.branchId);
        if (!branch) throw notFound();
        assertBranchWritable(
          branch.status,
          'new_master',
          roleCodesOf(actor),
          deps.config.branchStateRules,
        );

        const now = deps.clock.now();
        const warehouse: Warehouse = {
          id: warehouseId(data.branchId, data.code),
          companyId: actor.companyId,
          branchId: data.branchId,
          code: data.code,
          name: data.name,
          nameNorm: normalizeSearch(data.name),
          status: 'active',
          ...(data.note ? { note: data.note } : {}),
          isDefault: false,
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        deps.warehouses.create(tx, scope, warehouse);
        const dto = toWarehouseDto(warehouse);
        deps.audit.record(
          tx,
          auditEntry(deps, actor, ctx, {
            branchId: warehouse.branchId,
            entityType: 'warehouse',
            entityId: warehouse.id,
            action: 'warehouse.create',
            after: dto as unknown as Record<string, unknown>,
          }),
        );
        return { status: 201, body: dto };
      },
    );
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('warehouse_code_exists', 409);
    throw e;
  }
}

export const updateWarehouseSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  note: z.string().trim().max(300).nullable().optional(),
  /** optimistic locking (plan §2.3 If-Match) */
  version: z.number().int().min(1),
});

/**
 * Name and note only (BA §3: the code is immutable once stock movements exist; until INV exists no
 * code edit is offered at all). Optimistic locking via `version` (409 `version_conflict`).
 */
export async function updateWarehouse(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<WarehouseDto> {
  const data = parseInput(updateWarehouseSchema, input);
  const scope = resolveScope(actor, 'warehouse:update');
  return deps.uow.run(async (tx) => {
    const w = await deps.warehouses.getInTx(tx, scope, id);
    if (!w) throw notFound();
    if (w.version !== data.version) throw new AppError('version_conflict', 409);
    const branch = await deps.branches.getInTx(tx, scope, w.branchId);
    if (!branch) throw notFound();
    assertBranchWritable(
      branch.status,
      'edit_master',
      roleCodesOf(actor),
      deps.config.branchStateRules,
    );
    const now = deps.clock.now();
    const name = data.name ?? w.name;
    const note = data.note === undefined ? w.note : (data.note ?? undefined);
    deps.warehouses.update(tx, scope, id, {
      name,
      nameNorm: normalizeSearch(name),
      note: note ?? '',
      updatedAt: now,
      updatedBy: actor.userId,
      version: w.version + 1,
    });
    const next: Warehouse = {
      ...w,
      name,
      nameNorm: normalizeSearch(name),
      ...(note ? { note } : {}),
      version: w.version + 1,
    };
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: w.branchId,
        entityType: 'warehouse',
        entityId: id,
        action: 'warehouse.update',
        before: { name: w.name, note: w.note ?? null },
        after: { name, note: note ?? null },
      }),
    );
    return toWarehouseDto(next);
  });
}

export const warehouseStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
  version: z.number().int().min(1),
});

/**
 * Warehouse lifecycle (BA §3, FR-SYS-005): deactivate only when every stock number is 0 and no open
 * document refers to it; reactivation is the reverse. Both need `warehouse:archive`.
 * The blocker check goes through WarehouseActivityPort (stub until INV exists).
 */
export async function setWarehouseStatus(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  const data = parseInput(warehouseStatusSchema, input);
  const scope = resolveScope(actor, 'warehouse:archive');
  return runIdempotent(
    idem(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/sys/warehouses/${id}:status`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const w = await deps.warehouses.getInTx(tx, scope, id);
      if (!w) throw notFound();
      if (w.version !== data.version) throw new AppError('version_conflict', 409);
      if (w.status === data.status) throw new AppError('state_invalid', 409);
      const branch = await deps.branches.getInTx(tx, scope, w.branchId);
      if (!branch) throw notFound();
      assertBranchWritable(
        branch.status,
        'edit_master',
        roleCodesOf(actor),
        deps.config.branchStateRules,
      );
      if (data.status === 'inactive') {
        const blockers = await deps.warehouseActivity.blockers(w);
        if (blockers.length)
          throw new AppError(
            'warehouse_not_empty',
            409,
            blockers.map((b) => ({ field: 'status', message: b })),
          );
      }
      const now = deps.clock.now();
      deps.warehouses.update(tx, scope, id, {
        status: data.status,
        updatedAt: now,
        updatedBy: actor.userId,
        version: w.version + 1,
      });
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: w.branchId,
          entityType: 'warehouse',
          entityId: id,
          action: data.status === 'inactive' ? 'warehouse.deactivate' : 'warehouse.reactivate',
          before: { status: w.status },
          after: { status: data.status },
        }),
      );
      return {
        status: 200,
        body: toWarehouseDto({ ...w, status: data.status, version: w.version + 1 }),
      };
    },
  );
}

const CSV_PAGE = 100;

function csvCell(v: string): string {
  // neutralise spreadsheet formula injection, then quote (NFR-SEC-02)
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}
export { csvCell };

/** NFR-EXP-01 / FR-SYS-013 `export` action: only inside that scope; limited rows (BA §9); the export itself is audited. */
export async function exportWarehousesCsv(
  deps: SysDeps,
  actor: Actor,
  requestId: string,
): Promise<string> {
  const scope = resolveWorkingScope(actor, 'warehouse:export');
  const max = deps.config.exportMaxRows;
  const rows: Warehouse[] = [];
  let cursor: string | undefined;
  do {
    const page = await deps.warehouses.list(scope, {
      sort: 'code',
      direction: 'asc',
      limit: CSV_PAGE,
      ...(cursor ? { cursor: decodeCursor(cursor)! } : {}),
    });
    rows.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (rows.length > max) throw new AppError('export_too_large', 422);
  } while (cursor);

  await deps.uow.run(async (tx) => {
    deps.audit.record(
      tx,
      auditEntry(
        deps,
        actor,
        { requestId },
        {
          branchId: null,
          entityType: 'warehouse',
          entityId: '*',
          action: 'warehouse.export',
          after: { rows: rows.length, scope: scope.kind },
        },
      ),
    );
  });
  const header = ['id', 'branchId', 'code', 'name', 'status'].join(',');
  const lines = rows.map((w) =>
    [w.id, w.branchId, w.code, w.name, w.status].map(csvCell).join(','),
  );
  return `﻿${[header, ...lines].join('\r\n')}\r\n`;
}

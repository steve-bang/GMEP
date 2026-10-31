import { z } from 'zod';
import { AppError, forbidden, notFound, validationFailed } from '@/platform/errors/errors';
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
import { requirePermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { narrowScope, scopeAllows } from '@/platform/scope/scope';
import { normalizeSearch } from '@/platform/text/normalize';
import { WAREHOUSE_CODE_PATTERN, warehouseId, type Warehouse } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { AlreadyExistsError, type WarehouseListQuery } from '../ports/ports';

export const warehouseListInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  sort: z.enum(['code', 'name']).default('code'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().max(100).optional(),
  branchId: z.string().trim().max(64).optional(),
});
export type WarehouseListInput = z.input<typeof warehouseListInputSchema>;

/** FR-SYS-005, FR-SYS-002, NFR-ISO-01: the list is always evaluated inside resolveScope(actor, 'warehouse:view'). */
export async function listWarehouses(
  deps: SysDeps,
  actor: Actor,
  rawInput: WarehouseListInput,
): Promise<Page<Warehouse>> {
  const baseScope = resolveScope(actor, 'warehouse:view');
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
    ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
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
});
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

export interface WarehouseDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  status: string;
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
    createdAt: w.createdAt.toISOString(),
    version: w.version,
  };
}

/**
 * FR-SYS-005 create, FR-SYS-011 (locked branch -> no new records), FR-SYS-003 (audit in the
 * same transaction), idempotent via Idempotency-Key (plan §2.8).
 */
export async function createWarehouse(
  deps: SysDeps,
  actor: Actor,
  input: unknown,
  ctx: { idempotencyKey: string; requestId: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  const parsed = createWarehouseSchema.safeParse(input);
  if (!parsed.success) {
    throw validationFailed(
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  const data = parsed.data;
  const scope = resolveScope(actor, 'warehouse:create');
  if (!scopeAllows(scope, actor.companyId, data.branchId)) throw forbidden();

  try {
    return await runIdempotent(
      {
        uow: deps.uow,
        store: deps.idempotency,
        now: () => deps.clock.now(),
        ttlMs: deps.config.idempotencyTtlMs,
      },
      {
        userId: actor.userId,
        route: 'POST /api/v1/sys/warehouses',
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf(data),
      },
      async (tx) => {
        const branch = await deps.branches.getInTx(tx, scope, data.branchId);
        if (!branch) throw notFound();
        if (branch.status === 'locked') throw new AppError('branch_locked', 409); // FR-SYS-011

        const now = deps.clock.now();
        const warehouse: Warehouse = {
          id: warehouseId(data.branchId, data.code),
          companyId: actor.companyId,
          branchId: data.branchId,
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
        deps.warehouses.create(tx, scope, warehouse);
        const dto = toWarehouseDto(warehouse);
        deps.audit.record(tx, {
          id: deps.newId(),
          at: now,
          companyId: actor.companyId,
          branchId: warehouse.branchId,
          actorId: actor.userId,
          actorRoles: actor.assignments.map((a) => a.roleCode),
          entityType: 'warehouse',
          entityId: warehouse.id,
          action: 'warehouse.create',
          before: null,
          after: dto as unknown as Record<string, unknown>,
          requestId: ctx.requestId,
        });
        return { status: 201, body: dto };
      },
    );
  } catch (e) {
    // The deterministic document id (branch + code) makes a duplicate fail atomically at commit,
    // in every adapter. (The idempotency-key document is read in the same transaction, so a
    // concurrent same-key request is retried and replayed instead of reaching this branch.)
    if (e instanceof AlreadyExistsError) throw new AppError('warehouse_code_exists', 409);
    throw e;
  }
}

const CSV_PAGE = 100;
const CSV_MAX_ROWS = 5000;

function csvCell(v: string): string {
  // neutralise spreadsheet formula injection, then quote
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** NFR-EXP-01 / FR-SYS-013 `export` action: only with warehouse:export, only inside that scope; the export itself is audited. */
export async function exportWarehousesCsv(
  deps: SysDeps,
  actor: Actor,
  requestId: string,
): Promise<string> {
  requirePermission(actor, 'warehouse:export');
  const scope = resolveScope(actor, 'warehouse:export');
  const rows: Warehouse[] = [];
  let cursor: string | undefined;
  do {
    const page = await deps.warehouses.list(scope, {
      sort: 'code',
      direction: 'asc',
      limit: CSV_PAGE,
      ...(cursor ? { cursor: decodeCursor(cursor) } : {}),
    });
    rows.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && rows.length < CSV_MAX_ROWS);

  const now = deps.clock.now();
  await deps.uow.run(async (tx) => {
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      companyId: actor.companyId,
      branchId: null,
      actorId: actor.userId,
      actorRoles: actor.assignments.map((a) => a.roleCode),
      entityType: 'warehouse',
      entityId: '*',
      action: 'warehouse.export',
      before: null,
      after: { rows: rows.length, scope: scope.kind },
      requestId,
    });
  });
  const header = ['id', 'branchId', 'code', 'name', 'status'].join(',');
  const lines = rows.map((w) =>
    [w.id, w.branchId, w.code, w.name, w.status].map(csvCell).join(','),
  );
  return `﻿${[header, ...lines].join('\r\n')}\r\n`;
}

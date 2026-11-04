import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError, forbidden, notFound } from '@/platform/errors/errors';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { parseTabular, TabularError } from '@/platform/files/tabular';
import {
  hasPermission,
  requireWorkingBranch,
  resolveScope,
  type Actor,
  type Permission,
} from '@/platform/rbac/rbac';
import { scopeAllows } from '@/platform/scope/scope';
import {
  ACTIVE_STATUSES,
  autoMap,
  canTransition,
  chunk,
  extractRows,
  IMPORT_KINDS,
  missingRequired,
  sanitizeMapping,
  templateCsv,
  type ColumnMapping,
  type ImportColumn,
  type ImportKind,
  type ImportStatus,
  type RowIssue,
} from '../domain/dataImport';
import {
  IMPORT_CHUNK_ROWS,
  type ImportBatch,
  type ImportKindHandler,
  ImportStepError,
  type ImportUnit,
} from '../ports/ports';
import type { SysDeps } from '../ports/deps';
import { auditEntry, parseInput, type RequestCtx } from './support';

/** Cap of issues kept on a batch and returned to the screen; the count of all of them is kept (FR-SYS-007). */
const MAX_ISSUES = 500;
const SCREEN_ISSUES = 200;

export interface ImportDto {
  id: string;
  kind: ImportKind;
  kindLabel: string;
  fileName: string;
  status: ImportStatus;
  branchId: string;
  warehouseId: string | null;
  rowCount: number;
  unitCount: number;
  committedUnits: number;
  issueCount: number;
  issues: RowIssue[];
  warnings: RowIssue[];
  headers: string[];
  mapping: ColumnMapping;
  columns: ImportColumn[];
  created: Record<string, number>;
  failure: string | null;
  undoReason: string | null;
  createdAt: string;
  createdBy: string;
  version: number;
}

function handlerOf(deps: SysDeps, kind: string): ImportKindHandler {
  const h = deps.importHandlers.get(kind);
  if (!h) throw notFound();
  return h;
}

function toDto(deps: SysDeps, b: ImportBatch): ImportDto {
  const h = deps.importHandlers.get(b.kind);
  const created: Record<string, number> = {};
  for (const r of b.refs) created[r.type] = (created[r.type] ?? 0) + 1;
  return {
    id: b.id,
    kind: b.kind,
    kindLabel: h?.label ?? b.kind,
    fileName: b.fileName,
    status: b.status,
    branchId: b.branchId,
    warehouseId: b.warehouseId,
    rowCount: b.rowCount,
    unitCount: b.unitCount,
    committedUnits: b.committedUnits,
    issueCount: b.issueCount,
    issues: b.issues.slice(0, SCREEN_ISSUES),
    warnings: b.warnings.slice(0, SCREEN_ISSUES),
    headers: b.headers,
    mapping: b.mapping,
    columns: h ? [...h.columns] : [],
    created,
    failure: b.failure,
    undoReason: b.undoReason,
    createdAt: b.createdAt.toISOString(),
    createdBy: b.createdBy,
    version: b.version,
  };
}

/** Kinds the actor may import: data-import:create plus what the owning module needs (customers, parts, stock). */
function importableKinds(deps: SysDeps, actor: Actor): ImportKindHandler[] {
  if (!hasPermission(actor, 'data-import:create')) return [];
  return [...deps.importHandlers.values()].filter((h) =>
    h.requires.every((p) => hasPermission(actor, p as Permission)),
  );
}

export function listImportKinds(deps: SysDeps, actor: Actor) {
  resolveScope(actor, 'data-import:view');
  return importableKinds(deps, actor).map((h) => ({
    kind: h.kind,
    label: h.label,
    needsWarehouse: h.needsWarehouse,
    columns: [...h.columns],
  }));
}

/** CSV template of a kind (header in Vietnamese + one example row). */
export function importTemplate(deps: SysDeps, actor: Actor, kind: string): string {
  resolveScope(actor, 'data-import:view');
  return templateCsv(handlerOf(deps, kind).columns);
}

export async function listImports(deps: SysDeps, actor: Actor): Promise<ImportDto[]> {
  const scope = resolveScope(actor, 'data-import:view');
  const branchId = requireWorkingBranch(actor);
  const rows = await deps.imports.listByBranch(scope, branchId, 50);
  return rows.map((b) => toDto(deps, b));
}

export async function getImport(deps: SysDeps, actor: Actor, id: string): Promise<ImportDto> {
  const scope = resolveScope(actor, 'data-import:view');
  const b = await deps.imports.get(scope, id);
  if (!b) throw notFound();
  return toDto(deps, b);
}

const previewSchema = z.object({
  kind: z.enum(IMPORT_KINDS),
  warehouseId: z.string().trim().min(1).max(128).optional(),
  mapping: z.unknown().optional(),
});

/**
 * FR-SYS-007 dry run: parses the file, maps the columns, validates EVERY row and stores the report. Nothing of the
 * business data is written. A file with any error is kept only as a report (`rejected`); a clean file becomes
 * `validated` and its normalised rows are staged for the commit. The same bytes cannot be staged twice for a branch.
 */
export async function previewImport(
  deps: SysDeps,
  actor: Actor,
  input: {
    kind: unknown;
    warehouseId?: unknown;
    mapping?: unknown;
    fileName: string;
    bytes: Buffer;
  },
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ body: ImportDto; replayed: boolean }> {
  const scope = resolveScope(actor, 'data-import:create');
  const data = parseInput(previewSchema, input);
  const branchId = requireWorkingBranch(actor);
  if (!scopeAllows(scope, actor.companyId, branchId)) throw forbidden();
  const handler = handlerOf(deps, data.kind);
  if (!importableKinds(deps, actor).includes(handler)) throw forbidden();
  if (handler.needsWarehouse && !data.warehouseId)
    throw new AppError('validation_failed', 422, [
      { field: 'warehouseId', message: 'Chọn kho nhận tồn đầu kỳ.' },
    ]);
  const warehouseId = handler.needsWarehouse ? (data.warehouseId ?? null) : null;

  let grid;
  try {
    grid = await parseTabular(input.bytes, {
      maxBytes: deps.config.importMaxBytes,
      maxRows: deps.config.importMaxRows,
    });
  } catch (e) {
    if (e instanceof TabularError) throw new AppError('import_file_invalid', 422);
    throw e;
  }
  const fileHash = createHash('sha256').update(input.bytes).digest('hex');
  // the same bytes already written (or being written) for this branch: refuse before any work, whatever the rows say
  const slotId = `${branchId}_${data.kind}_${fileHash}`;
  const holder = await deps.uow.run(async (tx) => {
    const holderId = await deps.imports.getFileSlotInTx(tx, slotId);
    return holderId ? deps.imports.getInTx(tx, scope, holderId) : null;
  });
  if (holder && ['committing', 'committed', 'failed'].includes(holder.status))
    throw new AppError('import_duplicate_file', 409);
  const headers = grid[0]!;
  const mapping =
    data.mapping === undefined
      ? autoMap(headers, handler.columns)
      : sanitizeMapping(data.mapping, handler.columns, headers.length);

  // validation reads existing data but writes nothing
  const issues: RowIssue[] = missingRequired(mapping, handler.columns).map((c) => ({
    row: 0,
    field: c.field,
    message: `Thiếu cột bắt buộc "${c.label}". Chọn cột tương ứng trong tệp.`,
  }));
  let units: ImportUnit[] = [];
  let warnings: RowIssue[] = [];
  let rowCount = 0;
  if (issues.length === 0) {
    const rows = extractRows(grid, mapping, handler.columns);
    rowCount = rows.length;
    if (rows.length === 0)
      issues.push({ row: 0, message: 'Tệp không có dòng dữ liệu dưới dòng tiêu đề.' });
    else {
      const r = await handler.validate(actor, rows, { warehouseId });
      issues.push(...r.issues);
      warnings = r.warnings;
      units = r.units;
    }
  }
  const rejected = issues.length > 0;
  issues.sort((a, b) => a.row - b.row);

  const r = await runIdempotent(
    {
      uow: deps.uow,
      store: deps.idempotency,
      now: () => deps.clock.now(),
      ttlMs: deps.config.idempotencyTtlMs,
    },
    {
      userId: actor.userId,
      route: 'POST /api/v1/sys/imports',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ kind: data.kind, fileHash, warehouseId, mapping }),
    },
    async (tx) => {
      if (!rejected) {
        const holderId = await deps.imports.getFileSlotInTx(tx, slotId);
        const holder = holderId ? await deps.imports.getInTx(tx, scope, holderId) : null;
        if (holder && ACTIVE_STATUSES.includes(holder.status)) {
          // a dry run that was only previewed is replaced by the new run (e.g. another mapping)
          if (holder.status !== 'validated') throw new AppError('import_duplicate_file', 409);
          deps.imports.update(tx, holder.id, {
            status: 'discarded',
            updatedAt: deps.clock.now(),
            updatedBy: actor.userId,
            version: holder.version + 1,
          });
          deps.imports.deleteUnits(tx, holder.id, Math.ceil(holder.unitCount / IMPORT_CHUNK_ROWS));
          deps.audit.record(
            tx,
            auditEntry(deps, actor, ctx, {
              branchId,
              entityType: 'dataImport',
              entityId: holder.id,
              action: 'dataImport.discard',
              before: { status: 'validated' },
              after: { status: 'discarded' },
            }),
          );
        }
      }
      const now = deps.clock.now();
      const id = `imp_${deps.newId()}`;
      const batch: ImportBatch = {
        id,
        companyId: actor.companyId,
        branchId,
        kind: data.kind,
        fileName: input.fileName.slice(0, 120),
        fileHash,
        warehouseId,
        headers,
        mapping,
        status: rejected ? 'rejected' : 'validated',
        rowCount,
        unitCount: units.length,
        committedUnits: 0,
        issues: issues.slice(0, MAX_ISSUES),
        issueCount: issues.length,
        warnings: warnings.slice(0, MAX_ISSUES),
        refs: [],
        failure: null,
        undoReason: null,
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.imports.create(tx, batch);
      if (!rejected) {
        deps.imports.setFileSlot(tx, slotId, id);
        deps.imports.putUnits(tx, id, actor.companyId, units);
      }
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId,
          entityType: 'dataImport',
          entityId: id,
          action: rejected ? 'dataImport.reject' : 'dataImport.validate',
          after: {
            kind: data.kind,
            status: batch.status,
            rows: rowCount,
            units: units.length,
            errors: issues.length,
          },
        }),
      );
      return { status: 201, body: toDto(deps, batch) };
    },
  );
  return { body: r.response.body as ImportDto, replayed: r.replayed };
}

const mergeRefs = (a: ImportBatch['refs'], b: ImportBatch['refs']) => {
  const seen = new Set(a.map((r) => `${r.type}:${r.id}`));
  return [...a, ...b.filter((r) => !seen.has(`${r.type}:${r.id}`))];
};

function failureText(e: unknown): string {
  const inner = e instanceof ImportStepError ? e.original : e;
  if (inner instanceof AppError) return inner.code;
  return 'internal_error';
}

/**
 * Writes a validated batch in bounded steps through the owning module's own use cases (as the actor). Each step
 * records its progress and what it created. The batch is claimed first, so a double click or two tabs cannot run it
 * twice; a step failing leaves `failed` and the data written so far, which can be resumed (steps are idempotent by
 * key) or undone as a whole.
 */
export async function commitImport(
  deps: SysDeps,
  actor: Actor,
  id: string,
  ctx: RequestCtx,
): Promise<ImportDto> {
  const scope = resolveScope(actor, 'data-import:create');
  const claimed = await deps.uow.run(async (tx) => {
    const b = await deps.imports.getInTx(tx, scope, id);
    if (!b) throw notFound();
    if (b.status === 'committed') return { batch: b, run: false };
    if (!canTransition(b.status, 'committing')) throw new AppError('import_state_invalid', 409);
    const h = handlerOf(deps, b.kind);
    if (!importableKinds(deps, actor).includes(h)) throw forbidden();
    deps.imports.update(tx, id, {
      status: 'committing',
      failure: null,
      updatedAt: deps.clock.now(),
      updatedBy: actor.userId,
      version: b.version + 1,
    });
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: b.branchId,
        entityType: 'dataImport',
        entityId: id,
        action: b.status === 'failed' ? 'dataImport.resume' : 'dataImport.commit.start',
        before: { status: b.status },
        after: { status: 'committing' },
      }),
    );
    return { batch: { ...b, status: 'committing' as const, version: b.version + 1 }, run: true };
  });
  if (!claimed.run) return toDto(deps, claimed.batch);

  let batch = claimed.batch;
  const handler = handlerOf(deps, batch.kind);
  const hctx = { batchId: id, requestId: ctx.requestId, warehouseId: batch.warehouseId };
  try {
    const units = await deps.imports.getUnits(id, Math.ceil(batch.unitCount / IMPORT_CHUNK_ROWS));
    if (units.length !== batch.unitCount) throw new AppError('import_state_invalid', 409);
    const pending = units.slice(batch.committedUnits);
    for (const step of chunk(pending, handler.chunkSize)) {
      const refs = await handler.commit(actor, step, hctx);
      const base = batch;
      batch = await deps.uow.run(async (tx) => {
        const cur = await deps.imports.getInTx(tx, scope, id);
        if (!cur || cur.version !== base.version) throw new AppError('import_state_invalid', 409);
        const next = {
          committedUnits: cur.committedUnits + step.length,
          refs: mergeRefs(cur.refs, refs),
          updatedAt: deps.clock.now(),
          updatedBy: actor.userId,
          version: cur.version + 1,
        };
        deps.imports.update(tx, id, next);
        return { ...cur, ...next };
      });
    }
  } catch (e) {
    const failed = batch;
    const partial = e instanceof ImportStepError ? e.partial : [];
    await deps.uow.run(async (tx) => {
      const cur = await deps.imports.getInTx(tx, scope, id);
      if (!cur) return;
      deps.imports.update(tx, id, {
        refs: mergeRefs(cur.refs, partial),
        status: 'failed',
        failure: failureText(e),
        updatedAt: deps.clock.now(),
        updatedBy: actor.userId,
        version: cur.version + 1,
      });
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: failed.branchId,
          entityType: 'dataImport',
          entityId: id,
          action: 'dataImport.commit.failed',
          before: { status: 'committing' },
          after: { status: 'failed', failure: failureText(e), written: failed.committedUnits },
        }),
      );
    });
    return toDto(deps, {
      ...batch,
      status: 'failed',
      failure: failureText(e),
    });
  }
  const done = batch;
  const finished = await deps.uow.run(async (tx) => {
    const cur = await deps.imports.getInTx(tx, scope, id);
    if (!cur) throw notFound();
    const patch = {
      status: 'committed' as const,
      updatedAt: deps.clock.now(),
      updatedBy: actor.userId,
      version: cur.version + 1,
    };
    deps.imports.update(tx, id, patch);
    // the rows are in the real records now; the staged copy (personal data) is not kept
    deps.imports.deleteUnits(tx, id, Math.ceil(done.unitCount / IMPORT_CHUNK_ROWS));
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: cur.branchId,
        entityType: 'dataImport',
        entityId: id,
        action: 'dataImport.commit',
        before: { status: 'committing' },
        after: { status: 'committed', units: cur.unitCount, created: cur.refs.length },
      }),
    );
    return { ...cur, ...patch };
  });
  return toDto(deps, finished);
}

const undoSchema = z.object({ reason: z.string().trim().min(5).max(300) });

/**
 * Takes back exactly what the batch created. CRM and INV decide how (RULE-010: stock by reversal documents, never
 * deletion); when any item has been used or changed since the import nothing is touched and the answer says so.
 */
export async function undoImport(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<ImportDto> {
  const scope = resolveScope(actor, 'data-import:archive');
  const data = parseInput(undoSchema, input);
  const b = await deps.imports.get(scope, id);
  if (!b) throw notFound();
  if (b.status === 'undone') return toDto(deps, b);
  if (!canTransition(b.status, 'undone')) throw new AppError('import_state_invalid', 409);
  const handler = handlerOf(deps, b.kind);
  await handler.undo(actor, b.refs, {
    batchId: id,
    requestId: ctx.requestId,
    warehouseId: b.warehouseId,
    reason: data.reason,
  });
  const out = await deps.uow.run(async (tx) => {
    const cur = await deps.imports.getInTx(tx, scope, id);
    if (!cur) throw notFound();
    if (cur.status === 'undone') return cur;
    if (!canTransition(cur.status, 'undone')) throw new AppError('import_state_invalid', 409);
    const patch = {
      status: 'undone' as const,
      undoReason: data.reason,
      updatedAt: deps.clock.now(),
      updatedBy: actor.userId,
      version: cur.version + 1,
    };
    deps.imports.update(tx, id, patch);
    deps.imports.deleteUnits(tx, id, Math.ceil(cur.unitCount / IMPORT_CHUNK_ROWS));
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: cur.branchId,
        entityType: 'dataImport',
        entityId: id,
        action: 'dataImport.undo',
        before: { status: cur.status },
        after: { status: 'undone', removed: cur.refs.length },
        reason: data.reason,
      }),
    );
    return { ...cur, ...patch };
  });
  return toDto(deps, out);
}

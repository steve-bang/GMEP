import { z } from 'zod';
import { AppError } from '@/platform/errors/errors';
import { decodeCursor, type Page } from '@/platform/pagination/pagination';
import { resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import type { AuditEntry, AuditFilter } from '@/platform/audit/audit';
import { csvCell } from './warehouses';
import type { SysDeps } from '../ports/deps';
import { auditEntry, parseInput, roleCodesOf } from './support';

/**
 * Audit log viewer and export (FR-SYS-003, G4-SYS-19, ba-answers-for-dev §8.2/§9): read-only,
 * scope-limited (NFR-ISO-01), page size 25 or 100, export capped and logged with a reason.
 */
export const AUDIT_PAGE_SIZES = [25, 100] as const;

/** Roles that see every entity type; others (KT) see only the money-related types below. */
const FULL_AUDIT_ROLES = ['CH', 'AD', 'QL'];
/** Entity types a restricted viewer (KT) may read: tax, price, numbering, templates (+ money later). [Đề xuất BA] */
export const AUDIT_RESTRICTED_TYPES: readonly string[] = [
  'config.tax-rate',
  'config.price-item',
  'config.numbering-series',
  'config.doc-template',
  'priceList',
];

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
export const auditQuerySchema = z.object({
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(128).optional(),
  actorId: z.string().trim().max(128).optional(),
  action: z.string().trim().max(60).optional(),
  from: z.string().regex(dateRe).optional(),
  to: z.string().regex(dateRe).optional(),
  limit: z.coerce
    .number()
    .int()
    .refine((n) => (AUDIT_PAGE_SIZES as readonly number[]).includes(n), 'limit 25|100')
    .default(25),
  cursor: z.string().max(512).optional(),
});

/** business date -> instant at 00:00 Asia/Ho_Chi_Minh (UTC+7, no DST) */
const startOfBusinessDay = (d: string) => new Date(`${d}T00:00:00+07:00`);

/** Full viewers see every entity type; restricted ones (KT) must pick one of AUDIT_RESTRICTED_TYPES. */
export const isFullAuditViewer = (actor: Actor): boolean =>
  roleCodesOf(actor).some((r) => FULL_AUDIT_ROLES.includes(r));

function filterOf(actor: Actor, q: z.infer<typeof auditQuerySchema>): AuditFilter {
  const full = isFullAuditViewer(actor);
  if (!full && (!q.entityType || !AUDIT_RESTRICTED_TYPES.includes(q.entityType)))
    throw new AppError('audit_type_required', 422);
  const toDay = q.to ? new Date(startOfBusinessDay(q.to).getTime() + 86_400_000) : undefined;
  return {
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(q.from ? { from: startOfBusinessDay(q.from) } : {}),
    ...(toDay ? { to: toDay } : {}),
  };
}

export interface AuditRowDto {
  id: string;
  at: string;
  branchId: string | null;
  actorId: string;
  actorName: string | null;
  actorRoles: string[];
  entityType: string;
  entityId: string;
  action: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  requestId: string;
}

export async function listAudit(
  deps: SysDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<AuditRowDto>> {
  const scope = resolveWorkingScope(actor, 'audit-log:view');
  const q = parseInput(auditQuerySchema, raw);
  const page = await deps.audit.list(scope, filterOf(actor, q), {
    limit: q.limit,
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  const names = new Map<string, string>();
  for (const id of new Set(page.items.map((e) => e.actorId))) {
    const u = await deps.users.getById(id);
    if (u) names.set(id, u.displayName);
  }
  return {
    items: page.items.map((e: AuditEntry) => ({
      id: e.id,
      at: e.at.toISOString(),
      branchId: e.branchId,
      actorId: e.actorId,
      actorName: names.get(e.actorId) ?? null,
      actorRoles: e.actorRoles,
      entityType: e.entityType,
      entityId: e.entityId,
      action: e.action,
      reason: e.reason ?? null,
      before: e.before,
      after: e.after,
      requestId: e.requestId,
    })),
    nextCursor: page.nextCursor,
  };
}

export const auditExportSchema = auditQuerySchema.omit({ limit: true, cursor: true }).extend({
  reason: z.string().trim().min(5).max(300),
});

/**
 * Export (`audit-log:export`: CH, AD): reason required, at most `exportMaxRows` rows (else 422 and
 * a hint to narrow the filter), the export itself is written to the audit log with filter, row
 * count and reason. Values (before/after) are not exported, only the event columns.
 */
export async function exportAuditCsv(
  deps: SysDeps,
  actor: Actor,
  raw: unknown,
  requestId: string,
): Promise<string> {
  const scope = resolveWorkingScope(actor, 'audit-log:export');
  const data = parseInput(auditExportSchema, raw);
  const { reason, ...rest } = data;
  const filter = filterOf(actor, { ...rest, limit: 25 });
  const max = deps.config.exportMaxRows;
  const rows: AuditEntry[] = [];
  let cursor: { v: string; id: string } | undefined;
  for (;;) {
    const page = await deps.audit.list(scope, filter, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    rows.push(...page.items);
    if (rows.length > max) throw new AppError('export_too_large', 422);
    if (!page.nextCursor) break;
    cursor = decodeCursor(page.nextCursor)!;
  }
  await deps.uow.run(async (tx) => {
    deps.audit.record(
      tx,
      auditEntry(
        deps,
        actor,
        { requestId },
        {
          branchId: null,
          entityType: 'audit',
          entityId: '*',
          action: 'audit.export',
          after: {
            rows: rows.length,
            scope: scope.kind,
            filter: { ...rest },
            columns: [
              'at',
              'branchId',
              'actorId',
              'entityType',
              'entityId',
              'action',
              'reason',
              'requestId',
            ],
          },
          reason,
        },
      ),
    );
  });
  const header = [
    'at',
    'branchId',
    'actorId',
    'entityType',
    'entityId',
    'action',
    'reason',
    'requestId',
  ].join(',');
  const lines = rows.map((e) =>
    [
      e.at.toISOString(),
      e.branchId ?? '',
      e.actorId,
      e.entityType,
      e.entityId,
      e.action,
      e.reason ?? '',
      e.requestId,
    ]
      .map(csvCell)
      .join(','),
  );
  return `﻿${[header, ...lines].join('\r\n')}\r\n`;
}

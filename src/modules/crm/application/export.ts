import { AppError, validationFailed } from '@/platform/errors/errors';
import { hasPermission, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { csvCell, reauthenticate } from '@/modules/sys';
import type { Customer } from '../domain/entities';
import type { CrmDeps } from '../ports/deps';
import { listCustomers } from './customers';
import { accessEntry, auditEntry, parseInput, z } from './support';

export const exportSchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(['individual', 'business']).optional(),
  /** full (unmasked) personal columns: needs customer-pii:export, a reason and the password again (BA §9) */
  includePii: z.boolean().optional(),
  reason: z.string().trim().max(300).optional(),
  reauthPassword: z.string().max(256).optional(),
});

/**
 * FR-CRM-017, NFR-EXP-01, ba-answers-for-dev §9: exports the customer list inside the actor's scope.
 * - needs the dedicated `customer:export` permission (no permission, no file);
 * - personal columns follow PiiPolicy for the actor's roles (masked or absent) unless the actor also
 *   holds `customer-pii:export` AND gives a reason AND re-enters the password;
 * - at most `exportMaxRows` rows (fewer with full personal columns), otherwise 422 `export_too_large`;
 * - the export is written to the audit log (filter flags, row count, columns, reason) and to the
 *   access log when personal columns are included. Values never enter either log.
 */
export async function exportCustomersCsv(
  deps: CrmDeps,
  actor: Actor,
  raw: unknown,
  ctx: { requestId: string; sessionId?: string },
): Promise<string> {
  const scope = resolveWorkingScope(actor, 'customer:export');
  const data = parseInput(exportSchema, raw);
  await deps.sys.limiter.hit('export', actor.userId);
  const full = data.includePii === true;
  if (full) {
    // C7/C14: only CH and KT hold `customer-pii:export`; QL and QV export masked columns at most,
    // even though they may see full values on screen
    if (!hasPermission(actor, 'customer-pii:export')) throw new AppError('forbidden', 403);
    if ((data.reason ?? '').length < 5)
      throw validationFailed([
        { field: 'reason', message: 'Cần ghi lý do xuất (ít nhất 5 ký tự).' },
      ]);
    await reauthenticate(deps.sys, actor, data.reauthPassword);
  }
  const max = full ? deps.crm.exportMaxRowsWithPii : deps.crm.exportMaxRows;

  const rows: Customer[] = [];
  let cursor: string | undefined;
  do {
    const page = await listCustomers(deps, actor, {
      limit: 100,
      ...(data.q ? { q: data.q } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(cursor ? { cursor } : {}),
    });
    rows.push(...page.items);
    // C12/C14: a phone or plate search cut at its bound would silently export a partial list
    if (page.capped) throw new AppError('export_too_large', 422);
    if (rows.length > max) throw new AppError('export_too_large', 422);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  const branches = new Map(
    (await deps.sys.branches.list(scope)).map((b) => [b.id, b.code] as const),
  );
  // a column exists only if the role may see that field at all (hidden -> no column)
  const piiFields = (['phone', 'email', 'address'] as const).filter(
    (f) => full || deps.sys.pii.level(actor, f) !== 'hidden',
  );
  const columns = [
    'code',
    'type',
    'name',
    'taxCode',
    ...piiFields,
    'vehicleCount',
    'labels',
    'branch',
    'createdAt',
  ];
  const piis = await Promise.all(rows.map((c) => deps.customers.getPii(actor.companyId, c.id)));
  const lines = rows.map((c, i) => {
    const pii = piis[i];
    const personal = piiFields.map((f) =>
      full ? (pii?.[f] ?? '') : (deps.sys.pii.present(actor, f, pii?.[f]).value ?? ''),
    );
    return [
      c.code,
      c.type,
      c.name,
      c.taxCode ?? '',
      ...personal,
      String(c.vehicleCount),
      c.labels.join('|'),
      branches.get(c.branchId) ?? '',
      c.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(',');
  });

  await deps.sys.uow.run(async (tx) => {
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId:
          scope.kind === 'branches' && scope.branchIds.length === 1 ? scope.branchIds[0]! : null,
        entityType: 'customerExport',
        entityId: '*',
        action: 'customer.export',
        after: {
          rows: rows.length,
          scope: scope.kind,
          columns,
          includePii: full,
          filter: { hasQuery: !!data.q, type: data.type ?? null },
        },
        ...(data.reason ? { reason: data.reason } : {}),
      }),
    );
  });
  if (piiFields.length)
    await deps.sys.piiLog.record(
      accessEntry(deps, actor, ctx.sessionId, ctx.requestId, {
        entityType: 'customer',
        entityId: '*',
        purpose: 'export',
        fields: [...piiFields],
        rowCount: rows.length,
        columns,
        ...(data.reason ? { reasonCode: 'other', reasonText: '[có ghi chú]' } : {}),
      }),
    );
  return `﻿${[columns.join(','), ...lines].join('\r\n')}\r\n`;
}

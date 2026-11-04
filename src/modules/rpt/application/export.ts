import { messages } from '@/platform/i18n/messages';
import { hasPermission, type Actor } from '@/platform/rbac/rbac';
import { ALERT_KINDS } from '../domain/rollup';
import type { RptDeps } from '../ports/deps';
import { ALERT_PERMISSION } from './read';
import {
  AppError,
  auditEntry,
  dateSchema,
  parseInput,
  z,
  branchesOf,
  csvCell,
  type RequestCtx,
} from './support';

const exportSchema = z
  .object({
    date: dateSchema,
    branchId: z.string().trim().max(64).optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

const L = (messages as unknown as { rpt: { csv: Record<string, string> } }).rpt.csv;

/**
 * FR-RPT-003 / NFR-EXP-01: CSV of the daily report of ONE branch, inside the actor's scope, only the sections the actor
 * may see (an alert row appears only with the permission of its kind), spreadsheet formula text neutralised. The export
 * itself is written to the audit log in the same transaction (the file is built first, the audit entry commits it).
 * PDF and Excel are not built (FR-RPT-009 is Could).
 */
export async function exportDailyCsv(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
  ctx: RequestCtx,
): Promise<{ csv: string; filename: string }> {
  const input = parseInput(exportSchema, raw);
  const { scope, branches } = await branchesOf(deps, actor, 'report-daily:export', input.branchId);
  const branch = branches.length === 1 ? branches[0] : undefined;
  if (!branch) throw new AppError('scope_required', 409);
  const r = await deps.rollups.get(scope, branch.id, input.date);
  if (!r) throw new AppError('rollup_missing', 404);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(actor, p);

  const rows: [string, string, string][] = [];
  const add = (code: string, value: number | string) =>
    rows.push([code, L[code] ?? code, String(value)]);
  add('status', r.official ? L.official! : L.provisional!);
  if (can('repair-order:view')) {
    add('orders.opened', r.orders.opened);
    add('orders.closed', r.orders.closed);
    add('orders.handedOver', r.orders.handedOver);
    add('orders.cancelled', r.orders.cancelled);
    add('orders.openAtEnd', r.orders.openAtEnd);
  }
  add('revenue.laborVnd', r.revenue.laborVnd);
  add('revenue.partsVnd', r.revenue.partsVnd);
  add('revenue.exTaxVnd', r.revenue.exTaxVnd);
  add('revenue.orderTotalVnd', r.revenue.orderTotalVnd);
  if (can('payment:view')) {
    for (const [m, v] of Object.entries(r.money.byMethod)) add(`money.method.${m}`, v);
    add('money.inflowVnd', r.money.inflowVnd);
    add('money.receivedForClosedVnd', r.money.receivedForClosedVnd);
    add('money.debtForClosedVnd', r.money.debtForClosedVnd);
    add('money.gapVnd', r.money.gapVnd);
  }
  if (can('debt:view')) {
    add('receivables.openDebtVnd', r.receivables.openDebtVnd);
    add('receivables.overdueDebtVnd', r.receivables.overdueDebtVnd);
  }
  if (can('invoice:view')) {
    add('invoices.issuedCount', r.invoices.issuedCount);
    add('invoices.closedWithoutInvoiceCount', r.invoices.closedWithoutInvoiceCount);
  }
  if (can('stock:view')) add('stock.issuesWithoutSource', r.stock.issuesWithoutSource);
  for (const k of ALERT_KINDS)
    if (can(ALERT_PERMISSION[k])) add(`alerts.${k}`, r.alertCounts[k] ?? 0);
  if (rows.length > deps.rpt.exportMaxRows) throw new AppError('export_too_large', 422);

  await deps.sys.uow.run(async (tx) => {
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: branch.id,
        entityType: 'rollup',
        entityId: r.id,
        action: 'rollup.export',
        after: { date: r.date, rows: rows.length, official: r.official, format: 'csv' },
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    );
  });
  const head = [L.colCode!, L.colLabel!, L.colValue!].map(csvCell).join(',');
  // integers are written as numbers (a leading minus is not a formula); everything else is neutralised
  const num = (v: string) => (/^-?\d+$/.test(v) ? v : csvCell(v));
  const body = rows.map((x) => [csvCell(x[0]), csvCell(x[1]), num(x[2])].join(','));
  const meta = [
    [L.branch!, `${branch.code} ${branch.name}`],
    [L.date!, r.date],
  ].map((x) => x.map(csvCell).join(','));
  return {
    csv: `﻿${[...meta, head, ...body].join('\r\n')}\r\n`,
    filename: `bao-cao-ngay-${branch.code}-${r.date}.csv`,
  };
}

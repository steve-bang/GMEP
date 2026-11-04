import { messages } from '@/platform/i18n/messages';
import { businessDate } from '@/platform/format/date';
import { buildXlsx } from '@/platform/files/xlsxWriter';
import { hasPermission, type Actor } from '@/platform/rbac/rbac';
import { ALERT_KINDS, type UnlinkedRollup } from '../domain/rollup';
import type { RptDeps } from '../ports/deps';
import { ALERT_PERMISSION } from './read';
import { getMonthly, getReconcile, getTechnicians, getWarehouse } from './reports';
import {
  AppError,
  auditEntry,
  dateSchema,
  parseInput,
  z,
  branchesOf,
  csvCell,
  forbidden,
  validationFailed,
  type RequestCtx,
} from './support';

const exportSchema = z
  .object({
    date: dateSchema,
    branchId: z.string().trim().max(64).optional(),
    reason: z.string().trim().max(200).optional(),
    /** FR-RPT-009: csv (default) or .xlsx; same permission, scope, redaction and audit */
    format: z.enum(['csv', 'xlsx']).default('csv'),
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
  const r = await exportDaily(deps, actor, { ...(raw as object), format: 'csv' }, ctx);
  return { csv: r.csv!, filename: r.filename };
}

/** Daily report as CSV or .xlsx (`format`): the same rows, permission, scope, redaction, audit and "minimum" label. */
export async function exportDaily(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
  ctx: RequestCtx,
): Promise<{ format: 'csv' | 'xlsx'; csv?: string; xlsx?: Buffer; filename: string }> {
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
  // R102: a cut source is never silent in the file either; a total built on it is a minimum (copied by mistake as complete otherwise)
  if (r.truncated.length > 0) add('truncated', r.truncated.join(' '));
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
        after: { date: r.date, rows: rows.length, official: r.official, format: input.format },
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    );
  });
  if (input.format === 'xlsx') {
    // inline strings, formula markers neutralised by the writer; integers are real numbers
    const sheet: (string | number)[][] = [
      [L.branch!, `${branch.code} ${branch.name}`],
      [L.date!, r.date],
      [L.colCode!, L.colLabel!, L.colValue!],
      ...rows.map((x) => [x[0], x[1], /^-?\d+$/.test(x[2]) ? Number(x[2]) : x[2]]),
    ];
    return {
      format: 'xlsx',
      xlsx: buildXlsx(L.sheet ?? 'bao-cao-ngay', sheet, 2),
      filename: `bao-cao-ngay-${branch.code}-${r.date}.xlsx`,
    };
  }
  const head = [L.colCode!, L.colLabel!, L.colValue!].map(csvCell).join(',');
  // integers are written as numbers (a leading minus is not a formula); everything else is neutralised
  const num = (v: string) => (/^-?\d+$/.test(v) ? v : csvCell(v));
  const body = rows.map((x) => [csvCell(x[0]), csvCell(x[1]), num(x[2])].join(','));
  const meta = [
    [L.branch!, `${branch.code} ${branch.name}`],
    [L.date!, r.date],
  ].map((x) => x.map(csvCell).join(','));
  return {
    format: 'csv',
    csv: `﻿${[...meta, head, ...body].join('\r\n')}\r\n`,
    filename: `bao-cao-ngay-${branch.code}-${r.date}.csv`,
  };
}

// ---- CSV of the phase 1 reports (monthly, reconciliation, warehouse, technicians) --------------------------------------

const X = (messages as unknown as { rpt: { xcsv: Record<string, string> } }).rpt.xcsv;
const REPORT_KINDS = ['monthly', 'reconcile', 'warehouse', 'technicians'] as const;

const reportExportSchema = z
  .object({
    kind: z.enum(REPORT_KINDS),
    month: z.string().optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    branchId: z.string().trim().max(64).optional(),
    warehouseId: z.string().trim().max(128).optional(),
    serviceType: z.string().trim().max(64).optional(),
    reason: z.string().trim().max(200).optional(),
    /** FR-RPT-009: csv (default) or a real .xlsx workbook; same permission, scope, redaction and audit */
    format: z.enum(['csv', 'xlsx']).default('csv'),
  })
  .strict();

type Cell = string | number | null;

/** FR-RPT-014: "không gắn lệnh" figures as flat code -> value pairs. */
function unlinkedFlat(u: UnlinkedRollup): Record<string, number> {
  return {
    'unlinked.inflowVnd': u.inflowVnd,
    'unlinked.expenseVnd': u.expenseVnd,
    'unlinked.invoicesIssuedCount': u.invoicesIssuedCount,
    'unlinked.invoicesIssuedVnd': u.invoicesIssuedVnd,
    'unlinked.stockIssueDocuments': u.stockIssueDocuments,
  };
}
const unlinkedRows = (
  u: UnlinkedRollup | null,
  row: (code: string, v: Cell) => Cell[],
): Cell[][] => (u ? Object.entries(unlinkedFlat(u)).map(([k, v]) => row(k, v)) : []);
const lbl = (k: string): string => X[k] ?? k;
// integers are written as numbers (a leading minus is not a formula); everything else is neutralised
const cell = (v: Cell): string =>
  v === null ? '' : typeof v === 'number' ? String(Math.trunc(v)) : csvCell(v);

/**
 * FR-RPT-002/004/005/006 + NFR-EXP-01: CSV of one phase 1 report of ONE branch. Needs `report-daily:export` on top of the
 * data permission of the report (the same getters run, so scope and redaction are identical to the screen). The export
 * is audited in its own transaction; formula text in cells is neutralised (csvCell). Excel/PDF are not built.
 */
export async function exportReportCsv(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
  ctx: RequestCtx,
): Promise<{ csv: string; filename: string }> {
  const r = await exportReport(deps, actor, { ...(raw as object), format: 'csv' }, ctx);
  return { csv: r.csv!, filename: r.filename };
}

/** Same as the CSV export; `format: 'xlsx'` returns a workbook (bytes) instead of text. */
export async function exportReport(
  deps: RptDeps,
  actor: Actor,
  raw: unknown,
  ctx: RequestCtx,
): Promise<{ format: 'csv' | 'xlsx'; csv?: string; xlsx?: Buffer; filename: string }> {
  const input = parseInput(reportExportSchema, raw);
  if (!hasPermission(actor, 'report-daily:export')) throw forbidden();
  const q = {
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.from ? { from: input.from } : {}),
    ...(input.to ? { to: input.to } : {}),
  };
  let branch: { id: string; name: string; code: string };
  let period: string;
  let head: string[];
  let body: Cell[][];
  const meta: Cell[][] = [];
  switch (input.kind) {
    case 'monthly': {
      if (!input.month) throw validationFailed([{ field: 'month', message: 'required' }]);
      const d = await getMonthly(deps, actor, {
        month: input.month,
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.serviceType ? { serviceType: input.serviceType } : {}),
      });
      if (d.serviceType) meta.push([lbl('serviceType'), d.serviceType]);
      if (d.breakdownUnavailableDates.length > 0)
        meta.push([lbl('breakdownMissing'), d.breakdownUnavailableDates.length]);
      branch = { id: d.branchId, name: d.branchName, code: d.branchId };
      period = input.month;
      const r = d.report;
      head = [lbl('colCode'), lbl('colLabel'), lbl('colValue')];
      const row = (code: string, v: Cell): Cell[] => [code, lbl(code), v];
      body = [
        row('month.present', r.present),
        row('month.official', r.official),
        row('month.missing', r.missingDates.length),
        row('orders.opened', r.orders.opened),
        row('orders.closed', r.orders.closed),
        row('orders.handedOver', r.orders.handedOver),
        row('orders.cancelled', r.orders.cancelled),
        row('revenue.laborVnd', r.revenue.laborVnd),
        row('revenue.partsVnd', r.revenue.partsVnd),
        row('revenue.exTaxVnd', r.revenue.exTaxVnd),
        row('revenue.orderTotalVnd', r.revenue.orderTotalVnd),
        row('revenue.avgPerOrderVnd', r.revenue.avgPerOrderVnd),
        ...(d.visible.money
          ? [
              ...Object.entries(r.money.byMethod).map(([m, v]) => row(`money.method.${m}`, v)),
              row('money.inflowVnd', r.money.inflowVnd),
              row('money.gapVnd', r.money.gapVnd),
            ]
          : []),
        ...(d.visible.receivables
          ? [
              row('receivables.openDebtVnd', r.endOfPeriod.openDebtVnd),
              row('receivables.overdueDebtVnd', r.endOfPeriod.overdueDebtVnd),
            ]
          : []),
        ...(d.visible.invoices
          ? [
              row('invoices.issuedCount', r.invoices.issuedCount),
              row('invoices.closedWithoutInvoiceCount', r.endOfPeriod.closedWithoutInvoiceCount),
            ]
          : []),
        ...(d.visible.stock ? [row('stock.issuesWithoutSource', r.stock.issuesWithoutSource)] : []),
        ...unlinkedRows(d.unlinked, row),
      ];
      break;
    }
    case 'reconcile': {
      const d = await getReconcile(deps, actor, {
        ...q,
        ...(input.serviceType ? { serviceType: input.serviceType } : {}),
      });
      if (d.serviceType) meta.push([lbl('serviceType'), d.serviceType]);
      if (d.breakdownUnavailableDates.length > 0)
        meta.push([lbl('breakdownMissing'), d.breakdownUnavailableDates.length]);
      // FR-RPT-014: the documents with no order stay in their own lines (label + value), not spread over types
      if (d.unlinked)
        for (const [k, v] of Object.entries(unlinkedFlat(d.unlinked))) meta.push([lbl(k), v]);
      branch = { id: d.branchId, name: d.branchName, code: d.branchId };
      period = `${d.report.from}_${d.report.to}`;
      head = [
        lbl('date'),
        lbl('closed'),
        lbl('orderTotalVnd'),
        lbl('receivedVnd'),
        lbl('debtVnd'),
        lbl('gapVnd'),
        lbl('issuedCount'),
        lbl('notInvoicedCount'),
        lbl('shiftsWithVariance'),
        lbl('varianceVnd'),
        lbl('issueDocuments'),
        lbl('withoutSource'),
        lbl('failed'),
      ];
      const v = d.visible;
      body = d.report.rows.map((r) => [
        r.date,
        r.closed,
        r.orderTotalVnd,
        v.payments ? r.receivedVnd : null,
        v.payments ? r.debtVnd : null,
        v.payments ? r.gapVnd : null,
        v.invoices ? r.issuedCount : null,
        v.invoices ? r.notInvoicedCount : null,
        v.cash ? r.shiftsWithVariance : null,
        v.cash ? r.varianceVnd : null,
        v.stock ? r.issueDocuments : null,
        v.stock ? r.withoutSource : null,
        r.failed.join(' '),
      ]);
      break;
    }
    case 'warehouse': {
      const d = await getWarehouse(deps, actor, {
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
      });
      branch = { id: d.branchId, name: d.branchName, code: d.branchId };
      period = businessDate(deps.sys.clock.now());
      head = [
        lbl('warehouse'),
        lbl('partCode'),
        lbl('partName'),
        lbl('onHand'),
        lbl('reserved'),
        lbl('inTransit'),
        lbl('available'),
        lbl('minQty'),
        lbl('suggestQty'),
        ...(d.showValue ? [lbl('valueVnd')] : []),
      ];
      body = d.report.below.map((b) => [
        d.warehouses[b.warehouseId] ?? b.warehouseId,
        b.partCode,
        b.partName,
        b.onHand,
        b.reserved,
        b.inTransit,
        b.available,
        b.minQty,
        b.suggestQty,
        ...(d.showValue ? [b.valueVnd] : []),
      ]);
      meta.push([lbl('totalValueVnd'), d.showValue ? d.report.totalValueVnd : null]);
      if (d.truncated) meta.push([lbl('minimumNote'), lbl('minimumText')]);
      break;
    }
    case 'technicians': {
      const d = await getTechnicians(deps, actor, {
        ...q,
        ...(input.serviceType ? { serviceType: input.serviceType } : {}),
      });
      branch = { id: d.branchId, name: d.branchName, code: d.branchId };
      period = `${d.from}_${d.to}`;
      head = [
        lbl('technician'),
        lbl('jobs'),
        lbl('orders'),
        lbl('workedMinutes'),
        lbl('standardMinutes'),
        lbl('efficiencyBp'),
      ];
      body = d.report.rows.map((r) => [
        r.technicianName ?? lbl('unassigned'),
        r.jobs,
        r.orders,
        r.workedMinutes,
        r.standardMinutes,
        r.efficiencyBp,
      ]);
      if (d.serviceType) meta.push([lbl('serviceType'), d.serviceType]);
      if (d.truncated) meta.push([lbl('minimumNote'), lbl('minimumText')]);
      break;
    }
  }
  if (body.length > deps.rpt.exportMaxRows) throw new AppError('export_too_large', 422);
  // the branch code is on the branch record; the list read above names it
  const code =
    (await branchesOf(deps, actor, 'report-daily:export', branch.id)).branches[0]?.code ??
    branch.id;
  await deps.sys.uow.run(async (tx) => {
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: branch.id,
        entityType: 'rollup',
        entityId: `report:${input.kind}:${period}`,
        action: 'rollup.export',
        after: { report: input.kind, period, rows: body.length, format: input.format },
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    );
  });
  const top: Cell[][] = [
    [lbl('branch'), `${code} ${branch.name}`],
    [lbl('period'), period],
    ...meta,
  ];
  if (input.format === 'xlsx') {
    // the same cells as the CSV; text is inert in the workbook (inline strings, formula markers neutralised)
    const sheet: Cell[][] = [...top, head, ...body];
    return {
      format: 'xlsx',
      xlsx: buildXlsx(lbl(`sheet_${input.kind}`), sheet, top.length),
      filename: `bao-cao-${input.kind}-${code}-${period}.xlsx`,
    };
  }
  const lines = [[lbl('branch'), `${code} ${branch.name}`], [lbl('period'), period], ...meta].map(
    (x) => x.map((c) => cell(c as Cell)).join(','),
  );
  const csv = [...lines, head.map(csvCell).join(','), ...body.map((r) => r.map(cell).join(','))];
  return {
    format: 'csv',
    csv: `﻿${csv.join('\r\n')}\r\n`,
    filename: `bao-cao-${input.kind}-${code}-${period}.csv`,
  };
}

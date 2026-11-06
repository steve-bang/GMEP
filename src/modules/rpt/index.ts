/**
 * RPT module public surface (the only file other modules, composition and infrastructure import).
 * Slice 1.9 "Báo cáo một chi nhánh": daily rollup projection per branch and business day (read model, read by key),
 * role based dashboard, daily report with drill-down, exception alerts, idempotent rollup job, CSV export
 * (FR-RPT-001, 003, 004, 011, 012, 013, 014) plus monthly, four-way reconciliation, warehouse and technician reports
 * with CSV export (FR-RPT-002, 004..006). Not built: advanced charts, scheduler, PDF/Excel (see README).
 */
export const MODULE_CODE = 'RPT' as const;

export * from './domain/rollup';
export * from './domain/reports';
export * from './domain/range';
export * from './ports/ports';
export { DEFAULT_RPT_CONFIG } from './ports/deps';
export type { RptDeps, RptConfig } from './ports/deps';

export { runDueRollups, rebuildRollup } from './application/job';
export type { BranchOutcome, DayOutcome } from './application/job';
export {
  getDashboard,
  getDaily,
  getDrill,
  listAlerts,
  lensOf,
  METRIC_PERMISSION,
  ALERT_PERMISSION,
} from './application/read';
export type {
  DashboardDto,
  DailyDto,
  DrillDto,
  AlertsDto,
  AlertRow,
  BranchRow,
  RollupDto,
  Lens,
  Visible,
} from './application/read';
export { resolveRange } from './application/range';
export type { DashboardRange } from './application/range';
export { getMonthly, getReconcile, getWarehouse, getTechnicians } from './application/reports';
export type { MonthlyDto, ReconcileDto, WarehouseDto, TechniciansDto } from './application/reports';
export { exportDaily, exportDailyCsv, exportReport, exportReportCsv } from './application/export';
export { rptPolicyOf } from './application/support';

import type { SysDeps } from '@/modules/sys';
import type { RollupRepository, RptSources } from './ports';

/** Technical limits (not business rules); thresholds that mean something to the business are the `report-policy` config. */
export interface RptConfig {
  /** orders read by one scan (newest first); more sets `truncated` instead of silently cutting */
  ordersScanMax: number;
  /** how many days before the earliest rebuilt day the order scan reaches back */
  orderLookbackDays: number;
  scanMax: number;
  /** references kept per metric for the drill-down and alerts kept per day (document size stays small) */
  refsMax: number;
  alertsMax: number;
  /** run-due refreshes today and this many days before it */
  refreshDays: number;
  /** run-due also creates a missing day in this many days before today */
  catchUpDays: number;
  /** a manual rebuild reaches back this many days */
  rebuildMaxDays: number;
  /** branches handled by one run-due call */
  maxBranchesPerRun: number;
  /** rows a CSV export may hold */
  exportMaxRows: number;
  /** longest date range of a reconciliation (days) */
  reconcileMaxDays: number;
  /** stock balances read by the warehouse report; more sets `truncated` */
  balancesScanMax: number;
  /** below-reorder rows listed by the warehouse report */
  belowReorderMax: number;
  /** orders read by the technician report and how far before the period they may have been created */
  technicianOrdersMax: number;
  technicianLookbackDays: number;
}

export const DEFAULT_RPT_CONFIG: RptConfig = {
  ordersScanMax: 1500,
  orderLookbackDays: 7,
  scanMax: 500,
  refsMax: 60,
  alertsMax: 100,
  refreshDays: 1,
  catchUpDays: 7,
  rebuildMaxDays: 93,
  maxBranchesPerRun: 25,
  exportMaxRows: 2000,
  reconcileMaxDays: 93,
  balancesScanMax: 3000,
  belowReorderMax: 200,
  technicianOrdersMax: 300,
  technicianLookbackDays: 30,
};

export interface RptDeps {
  sys: SysDeps;
  rollups: RollupRepository;
  sources: RptSources;
  rpt: RptConfig;
}

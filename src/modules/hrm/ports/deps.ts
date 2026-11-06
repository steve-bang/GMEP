import type { SysDeps } from '@/modules/sys';
import type { EmployeeRepository, LaborOrderSource, LaborSheetRepository } from './ports';

/** HRM limits that keep one request inside a bounded page or transaction (technical, not business rules). */
export interface HrmConfig {
  /** staff rows read for a list */
  employeesMax: number;
  /** order sheets read for a period listing */
  sheetsMax: number;
  /** lines of one order sheet (one document stays far below the 1 MiB limit) */
  linesPerSheetMax: number;
}

export const DEFAULT_HRM_CONFIG: HrmConfig = {
  employeesMax: 500,
  sheetsMax: 300,
  linesPerSheetMax: 400,
};

export interface HrmDeps {
  sys: SysDeps;
  employees: EmployeeRepository;
  sheets: LaborSheetRepository;
  orders: LaborOrderSource;
  hrm: HrmConfig;
}

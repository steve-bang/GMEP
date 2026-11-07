import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { Employee, EmployeePii } from '../domain/employee';
import type { AssignmentFact, LaborSheet, TimeEventFact } from '../domain/labor';

/** Every read takes a Scope (NFR-ISO-01). */
export interface EmployeeRepository {
  get(scope: Scope, id: string): Promise<Employee | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Employee | null>;
  /** the profile linked to a login account of the tenant (read by key) */
  getByUser(tenantId: string, userId: string): Promise<Employee | null>;
  getByUserInTx(tx: Tx, tenantId: string, userId: string): Promise<Employee | null>;
  /**
   * The tenant's staff inside the scope, by name. A tenant has a few hundred people, so the list is read ordered by
   * the tenant id alone (no composite index) and cut to the scope here; `truncated` tells the screen when the cap hit.
   */
  list(scope: Scope, limit: number): Promise<{ items: Employee[]; truncated: boolean }>;
  getPii(scope: Scope, id: string): Promise<EmployeePii | null>;
  getPiiInTx(tx: Tx, scope: Scope, id: string): Promise<EmployeePii | null>;
  /** stages the record, its personal data and the unique code slot (a duplicate code fails at commit) */
  create(tx: Tx, e: Employee, pii: EmployeePii): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
  savePii(tx: Tx, pii: EmployeePii): void;
  /** `create` semantics: a second claim of the same account fails at commit (one profile per login account) */
  linkUser(tx: Tx, tenantId: string, userId: string, employeeId: string, branchId: string): void;
  unlinkUser(tx: Tx, tenantId: string, userId: string): void;
}

export interface LaborSheetRepository {
  get(scope: Scope, orderId: string): Promise<LaborSheet | null>;
  getInTx(tx: Tx, scope: Scope, orderId: string): Promise<LaborSheet | null>;
  /** sheets of one branch whose last line is at or after `from`, newest first (the by-branch period read) */
  listByBranch(scope: Scope, branchId: string, from: Date, limit: number): Promise<LaborSheet[]>;
  /** upsert of the whole sheet; the caller only ever appends lines (RULE-010) */
  save(tx: Tx, sheet: LaborSheet): void;
}

/** What labor needs to know about an item of a repair order (REC owns it; the composition root maps it). */
export interface LaborItemFacts {
  itemId: string;
  no: number;
  name: string;
  /** REC item status code (`done` = finished by the technician) */
  status: string;
  technicianId: string | null;
  assignments: AssignmentFact[];
  events: TimeEventFact[];
  /** approved labor minutes of the item (the standard hours of the quote) */
  standardMinutes: number;
  /** approved labor amount of the item before tax */
  laborAmountVnd: number;
  /** standard-hours config versions of its labor lines */
  hoursVersionIds: string[];
}

export interface LaborOrderView {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  serviceType: string;
  status: string;
  items: LaborItemFacts[];
}

export interface LaborOrderSource {
  get(scope: Scope, orderId: string): Promise<LaborOrderView | null>;
  getInTx(tx: Tx, scope: Scope, orderId: string): Promise<LaborOrderView | null>;
}

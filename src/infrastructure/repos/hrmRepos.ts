import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  employeeCodeSlotId,
  type Employee,
  type EmployeePii,
  type EmployeeRepository,
  type LaborSheet,
  type LaborSheetRepository,
} from '@/modules/hrm';
import { COL, Q } from './queries';

const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};
const inScope = (scope: Scope, x: { tenantId: string; branchId: string }) =>
  scopeAllows(scope, x.tenantId, x.branchId);
const asEntity = <T>({ id, data }: StoredDoc): T => ({ id, ...data }) as T;
const linkId = (tenantId: string, userId: string) => `${tenantId}__${userId}`;

export class DocEmployeeRepository implements EmployeeRepository {
  constructor(private readonly store: DocStore) {}

  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.employees, id);
    const x = d ? asEntity<Employee>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.employees, id);
    const x = d ? asEntity<Employee>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getByUser(tenantId: string, userId: string) {
    const link = await this.store.get(COL.employeeUserLinks, linkId(tenantId, userId));
    if (!link || link.data.tenantId !== tenantId) return null;
    const d = await this.store.get(COL.employees, link.data.employeeId as string);
    const x = d ? asEntity<Employee>(d) : null;
    return x && x.tenantId === tenantId ? x : null;
  }
  async getByUserInTx(tx: Tx, tenantId: string, userId: string) {
    const link = await this.store.getInTx(tx, COL.employeeUserLinks, linkId(tenantId, userId));
    if (!link || link.data.tenantId !== tenantId) return null;
    const d = await this.store.getInTx(tx, COL.employees, link.data.employeeId as string);
    const x = d ? asEntity<Employee>(d) : null;
    return x && x.tenantId === tenantId ? x : null;
  }
  async list(scope: Scope, limit: number) {
    const rows = await this.store.query(Q.employees.pick([], false), {
      eq: { tenantId: scope.tenantId },
      limit: limit + 1,
    });
    const items = rows
      .map((r) => asEntity<Employee>(r))
      .filter((x) => inScope(scope, x))
      .sort((a, b) => a.nameNorm.localeCompare(b.nameNorm) || (a.id < b.id ? -1 : 1));
    return { items: items.slice(0, limit), truncated: rows.length > limit };
  }
  async getPii(scope: Scope, id: string) {
    const d = await this.store.get(COL.employeePii, id);
    const x = d ? asEntity<EmployeePii>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getPiiInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.employeePii, id);
    const x = d ? asEntity<EmployeePii>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  create(tx: Tx, e: Employee, pii: EmployeePii) {
    this.store.create(tx, COL.employees, e.id, without(e, 'id'));
    this.store.create(tx, COL.employeePii, pii.id, without(pii, 'id'));
    // create(), not set(): a second employee with the same code fails at commit (RULE-018 unique in the tenant)
    this.store.create(tx, COL.employeeCodes, employeeCodeSlotId(e.tenantId, e.code), {
      tenantId: e.tenantId,
      branchId: e.branchId,
      employeeId: e.id,
    });
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.employees, id, patch);
  }
  savePii(tx: Tx, pii: EmployeePii) {
    this.store.set(tx, COL.employeePii, pii.id, without(pii, 'id'));
  }
  linkUser(tx: Tx, tenantId: string, userId: string, employeeId: string, branchId: string) {
    this.store.create(tx, COL.employeeUserLinks, linkId(tenantId, userId), {
      tenantId,
      branchId,
      employeeId,
    });
  }
  unlinkUser(tx: Tx, tenantId: string, userId: string) {
    this.store.delete(tx, COL.employeeUserLinks, linkId(tenantId, userId));
  }
}

/** One document per order holds its labor lines: lines are appended, never updated or deleted (RULE-010). */
export class DocLaborSheetRepository implements LaborSheetRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, orderId: string) {
    const d = await this.store.get(COL.laborSheets, orderId);
    const x = d ? asEntity<LaborSheet>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, orderId: string) {
    const d = await this.store.getInTx(tx, COL.laborSheets, orderId);
    const x = d ? asEntity<LaborSheet>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async listByBranch(scope: Scope, branchId: string, from: Date, limit: number) {
    if (!scopeAllows(scope, scope.tenantId, branchId)) return [];
    const rows = await this.store.query(Q.laborSheetsByBranch.pick([], false), {
      eq: { tenantId: scope.tenantId, branchId },
      range: { gte: from },
      limit,
    });
    return rows.map((r) => asEntity<LaborSheet>(r));
  }
  save(tx: Tx, sheet: LaborSheet) {
    this.store.set(tx, COL.laborSheets, sheet.id, without(sheet, 'id'));
  }
}

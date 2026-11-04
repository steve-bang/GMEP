import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { ApprovalRepository, ApprovalRequest, ApprovalStatus } from '@/modules/sys';
import { COL, Q } from './queries';

const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};
const put = <K extends string, V>(k: K, v: V | null | undefined) =>
  v === null || v === undefined ? {} : ({ [k]: v } as Record<K, V>);

const fromDoc = ({ id, data: x }: StoredDoc): ApprovalRequest => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  number: x.number,
  kind: x.kind,
  level: x.level,
  subjectType: x.subjectType,
  subjectId: x.subjectId,
  subjectLabel: x.subjectLabel,
  valueVnd: x.valueVnd,
  reason: x.reason,
  payload: x.payload ?? {},
  status: x.status,
  requestedBy: x.requestedBy,
  requestedByName: x.requestedByName,
  requestedByRole: x.requestedByRole,
  requestedAt: x.requestedAt,
  dueAt: x.dueAt,
  ...put('decidedBy', x.decidedBy),
  ...put('decidedByName', x.decidedByName),
  ...put('decidedAt', x.decidedAt),
  ...put('decisionNote', x.decisionNote),
  ...put('consumedAt', x.consumedAt),
  ...put('consumedBy', x.consumedBy),
  ...put('resultId', x.resultId),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

/** FR-SYS-004. A request belongs to one branch; every read checks the Scope against it (NFR-ISO-01). */
export class DocApprovalRepository implements ApprovalRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.approvals, id);
    const x = d ? fromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.approvals, id);
    const x = d ? fromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async listByBranchStatus(scope: Scope, branchId: string, status: ApprovalStatus, limit: number) {
    if (!scopeAllows(scope, scope.companyId, branchId)) return [];
    const rows = await this.store.query(Q.approvalsByBranchStatus.pick([], false), {
      eq: { companyId: scope.companyId, branchId, status },
      limit,
    });
    return rows.map(fromDoc);
  }
  async listByRequester(scope: Scope, requesterId: string, limit: number) {
    const rows = await this.store.query(Q.approvalsByRequester.pick([], false), {
      eq: { companyId: scope.companyId, requestedBy: requesterId },
      limit,
    });
    return rows.map(fromDoc).filter((x) => scopeAllows(scope, x.companyId, x.branchId));
  }
  async getSlotInTx(tx: Tx, slotId: string) {
    const d = await this.store.getInTx(tx, COL.approvalSlots, slotId);
    return d ? { requestId: d.data.requestId as string, open: d.data.open === true } : null;
  }
  setSlot(tx: Tx, slotId: string, v: { requestId: string; open: boolean; companyId: string }) {
    this.store.set(tx, COL.approvalSlots, slotId, v);
  }
  create(tx: Tx, r: ApprovalRequest) {
    this.store.create(tx, COL.approvals, r.id, without(r, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.approvals, id, patch);
  }
}

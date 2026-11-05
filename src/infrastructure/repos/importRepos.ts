import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  IMPORT_CHUNK_ROWS,
  chunk,
  type ImportBatch,
  type ImportBatchRepository,
  type ImportUnit,
} from '@/modules/sys';
import { COL, Q } from './queries';

const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};

const fromDoc = ({ id, data: x }: StoredDoc): ImportBatch => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  kind: x.kind,
  fileName: x.fileName,
  fileHash: x.fileHash,
  fileSize: x.fileSize ?? 0,
  warehouseId: x.warehouseId ?? null,
  headers: x.headers ?? [],
  mapping: x.mapping ?? {},
  status: x.status,
  rowCount: x.rowCount,
  unitCount: x.unitCount,
  committedUnits: x.committedUnits ?? 0,
  issues: x.issues ?? [],
  issueCount: x.issueCount ?? 0,
  warnings: x.warnings ?? [],
  refs: x.refs ?? [],
  failure: x.failure ?? null,
  undoReason: x.undoReason ?? null,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

const chunkId = (batchId: string, n: number) => `${batchId}_${n}`;

/** FR-SYS-007. A batch belongs to one branch; every read checks the Scope against it (NFR-ISO-01). */
export class DocImportBatchRepository implements ImportBatchRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.importBatches, id);
    const b = d ? fromDoc(d) : null;
    return b && scopeAllows(scope, b.companyId, b.branchId) ? b : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.importBatches, id);
    const b = d ? fromDoc(d) : null;
    return b && scopeAllows(scope, b.companyId, b.branchId) ? b : null;
  }
  async listByBranch(scope: Scope, branchId: string, limit: number) {
    if (!scopeAllows(scope, scope.companyId, branchId)) return [];
    const rows = await this.store.query(Q.importBatchesByBranch.pick([], false), {
      eq: { companyId: scope.companyId, branchId },
      limit,
    });
    return rows.map(fromDoc);
  }
  async listByBranchStatus(
    scope: Scope,
    branchId: string,
    status: ImportBatch['status'],
    limit: number,
  ) {
    if (!scopeAllows(scope, scope.companyId, branchId)) return [];
    const rows = await this.store.query(Q.importBatchesByBranchStatus.pick([], false), {
      eq: { companyId: scope.companyId, branchId, status },
      limit,
    });
    return rows.map(fromDoc);
  }
  create(tx: Tx, b: ImportBatch) {
    this.store.create(tx, COL.importBatches, b.id, without(b, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.importBatches, id, patch);
  }
  async getFileSlotInTx(tx: Tx, scope: Scope, slotId: string) {
    const d = await this.store.getInTx(tx, COL.importFileSlots, slotId);
    // a slot carries its owner; one without (or of another company/branch) is not visible to this scope
    if (!d || !scopeAllows(scope, d.data.companyId as string, (d.data.branchId as string) ?? null))
      return null;
    return d.data.batchId as string;
  }
  setFileSlot(
    tx: Tx,
    slotId: string,
    owner: { batchId: string; companyId: string; branchId: string },
  ) {
    this.store.set(tx, COL.importFileSlots, slotId, owner);
  }
  putUnits(
    tx: Tx,
    batchId: string,
    owner: { companyId: string; branchId: string },
    units: readonly ImportUnit[],
  ) {
    chunk(units, IMPORT_CHUNK_ROWS).forEach((c, n) =>
      this.store.set(tx, COL.importUnits, chunkId(batchId, n), { ...owner, units: c }),
    );
  }
  async getUnits(scope: Scope, batchId: string, chunkCount: number) {
    const ids = Array.from({ length: chunkCount }, (_, n) => chunkId(batchId, n));
    const docs = (await this.store.getMany(COL.importUnits, ids)).filter((d) =>
      scopeAllows(scope, d.data.companyId as string, (d.data.branchId as string) ?? null),
    );
    const byId = new Map(docs.map((d) => [d.id, d.data.units as ImportUnit[]]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }
  deleteUnits(tx: Tx, batchId: string, chunkCount: number) {
    for (let n = 0; n < chunkCount; n++)
      this.store.delete(tx, COL.importUnits, chunkId(batchId, n));
  }
}

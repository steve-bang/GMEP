import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import { rollupId, type DailyRollup, type RollupRepository } from '@/modules/rpt';
import { COL } from './queries';

const asEntity = ({ id, data }: StoredDoc): DailyRollup => ({ id, ...data }) as DailyRollup;
const inScope = (scope: Scope, x: { tenantId: string; branchId: string }) =>
  scopeAllows(scope, x.tenantId, x.branchId);

/**
 * Rollups are addressed by id only: a branch outside the scope is "not found" before the document is even read, and a
 * document of another company or branch is dropped after the read (defence in depth, NFR-ISO-01).
 */
export class DocRollupRepository implements RollupRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, branchId: string, date: string) {
    if (!scopeAllows(scope, scope.tenantId, branchId)) return null;
    const d = await this.store.get(COL.rollups, rollupId(branchId, date));
    const x = d ? asEntity(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, branchId: string, date: string) {
    if (!scopeAllows(scope, scope.tenantId, branchId)) return null;
    const d = await this.store.getInTx(tx, COL.rollups, rollupId(branchId, date));
    const x = d ? asEntity(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getMany(scope: Scope, keys: readonly { branchId: string; date: string }[]) {
    const ids = keys
      .filter((k) => scopeAllows(scope, scope.tenantId, k.branchId))
      .map((k) => rollupId(k.branchId, k.date));
    if (ids.length === 0) return [];
    const docs = await this.store.getMany(COL.rollups, ids);
    return docs.map(asEntity).filter((x) => inScope(scope, x));
  }
  save(tx: Tx, r: DailyRollup) {
    const { id, ...data } = r;
    this.store.set(tx, COL.rollups, id, data as unknown as DocData);
  }
}

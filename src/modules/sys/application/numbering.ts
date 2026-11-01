import { AppError } from '@/platform/errors/errors';
import {
  DEFAULT_NUMBERING,
  draftReference,
  type AssignedNumber,
  type NumberingSeries,
} from '@/platform/numbering/numbering';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { Branch } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { resolveConfigAt } from './config';

/**
 * Series for a document type on a business date: an approved effective-dated `numbering-series`
 * config version wins over the BA default table (so the accountant's answers K1-K8 are data).
 */
export async function resolveNumberingSeries(
  deps: SysDeps,
  companyId: string,
  docType: string,
  businessDate: string,
): Promise<NumberingSeries> {
  const snap = await resolveConfigAt(deps, {
    companyId,
    type: 'numbering-series',
    scopeKey: docType,
    date: businessDate,
  });
  if (snap) return snap.payload as unknown as NumberingSeries;
  const def = DEFAULT_NUMBERING[docType];
  if (!def) throw new AppError('numbering_unknown_type', 422);
  return def;
}

export type NumberStage = 'create' | 'post';

/**
 * Document numbering entry point for other modules (BA-13). Call INSIDE the document's
 * transaction after its reads. Group A types get their number at `create`; group B types get a
 * temporary reference at `create` (no counter used, drafts leave no gap) and the real number at
 * `post`. The same `requestKey` returns the same number. Period = businessDate.
 */
export async function allocateDocumentNumber(
  deps: SysDeps,
  tx: Tx,
  p: {
    branch: Branch;
    docType: string;
    businessDate: string;
    stage: NumberStage;
    documentId: string;
    requestKey?: string;
  },
): Promise<{ number: string | null; draftRef: string | null; assigned: AssignedNumber | null }> {
  const series = await resolveNumberingSeries(deps, p.branch.companyId, p.docType, p.businessDate);
  const numberNow = series.group === 'A' ? p.stage === 'create' : p.stage === 'post';
  if (!numberNow) {
    return {
      number: null,
      draftRef: series.group === 'B' ? draftReference(p.documentId) : null,
      assigned: null,
    };
  }
  const assigned = await deps.numbering.assign(
    tx,
    {
      companyId: p.branch.companyId,
      branchId: p.branch.id,
      branchCode: p.branch.code,
      docType: p.docType,
      businessDate: p.businessDate,
      series,
    },
    { at: deps.clock.now(), ...(p.requestKey ? { requestKey: p.requestKey } : {}) },
  );
  return { number: assigned.number, draftRef: null, assigned };
}

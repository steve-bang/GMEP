import { createHash } from 'node:crypto';
import { AppError } from '../errors/errors';
import type { DocStore } from '../store/docStore';
import type { Tx } from '../tx/unitOfWork';

/**
 * Document numbering (BA-13, ba-answers-for-dev §6; FR-REC-030). Every value in
 * DEFAULT_NUMBERING is an [Đề xuất BA - chờ xác nhận: Kế toán khách] default and CONFIGURATION:
 * a series can be overridden by an effective-dated `numbering-series` config version (see
 * resolveNumberingConfig in the SYS module), so no number rule is hard-coded in a use case.
 *
 * Mechanics (§6.2): the counter is read and bumped inside the SAME transaction as the document
 * write, so a failed transaction burns no number and an issued number is never reused. The
 * period comes from the document's businessDate (Asia/Ho_Chi_Minh), not from the system clock.
 */
export type NumberingGroup = 'A' | 'B';

export interface NumberingSeries {
  prefix: string;
  /** A: number at creation (gaps tolerated). B: number at posting; drafts carry a temporary reference. */
  group: NumberingGroup;
  /** B defaults to strict (no gaps) until the accountant says otherwise (K1). */
  gapPolicy: 'strict' | 'relaxed';
  /** counter key scope: per branch (default) or per legal entity (K2, not wired yet) */
  scope: 'branch' | 'legalEntity';
  /** counter reset period (K3) */
  period: 'month' | 'year' | 'none';
  seqWidth: number;
  /** reversal documents use the original series (K4) */
  reversalSameSeries: boolean;
}

const A = (prefix: string): NumberingSeries => ({
  prefix,
  group: 'A',
  gapPolicy: 'relaxed',
  scope: 'branch',
  period: 'month',
  seqWidth: 5,
  reversalSameSeries: true,
});
const B = (prefix: string): NumberingSeries => ({ ...A(prefix), group: 'B', gapPolicy: 'strict' });

/** Table of ba-answers-for-dev §6.3. Keys are stable document type codes. */
export const DEFAULT_NUMBERING: Readonly<Record<string, NumberingSeries>> = {
  'repair-order': A('RO'),
  quote: A('BG'),
  intake: A('TX'),
  appointment: A('LH'),
  'data-subject-request': A('CD'),
  'handover-record': A('BB'),
  'purchase-request': A('YM'),
  'purchase-order': A('DM'),
  'transfer-request': A('YK'),
  'parts-request': A('CP'),
  stocktake: A('KK'),
  'expense-request': A('DX'),
  'approval-request': A('YC'),
  'invoice-request': A('YH'),
  'receipt-voucher': B('PT'),
  'payment-voucher': B('PC'),
  'cash-transfer': B('CQ'),
  'goods-receipt': B('PN'),
  'goods-issue': B('PX'),
  'internal-issue': B('XN'),
  'stock-transfer': B('CK'),
  'stock-adjustment': B('DC'),
  'stock-return-in': B('HK'),
  'supplier-return': B('TR'),
  'retail-receipt': B('BL'),
};

export interface NumberingContext {
  companyId: string;
  branchId: string;
  /** MÃCN, 2-4 chars */
  branchCode: string;
  docType: string;
  /** yyyy-MM-dd in Asia/Ho_Chi_Minh */
  businessDate: string;
  series: NumberingSeries;
}

const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function periodKey(series: NumberingSeries, businessDate: string): string {
  const m = BUSINESS_DATE.exec(businessDate);
  if (!m)
    throw new AppError('validation_failed', 422, [
      { field: 'businessDate', message: 'yyyy-MM-dd' },
    ]);
  const yy = m[1]!.slice(2);
  if (series.period === 'month') return `${yy}${m[2]}`;
  if (series.period === 'year') return yy;
  return 'ALL';
}

/** `LOẠI-MÃCN-YYMM-STT`; STT has `seqWidth` digits and grows beyond it instead of truncating. */
export function formatNumber(ctx: NumberingContext, seq: number): string {
  const period = periodKey(ctx.series, ctx.businessDate);
  const parts = [ctx.series.prefix, ctx.branchCode, ...(period === 'ALL' ? [] : [period])];
  return `${parts.join('-')}-${String(seq).padStart(ctx.series.seqWidth, '0')}`;
}

export function counterId(ctx: NumberingContext): string {
  const scope = ctx.series.scope === 'branch' ? ctx.branchId : 'LE';
  return `${ctx.companyId}__${scope}__${ctx.docType}__${periodKey(ctx.series, ctx.businessDate)}`;
}

const COUNTERS = 'counters';
const ASSIGNMENTS = 'numberAssignments';

export interface AssignedNumber {
  number: string;
  seq: number;
  /** true when the same request key had already received this number */
  replayed: boolean;
}

export class NumberingService {
  constructor(private readonly store: DocStore) {}

  /**
   * Allocates the next number. MUST be called inside the document's transaction, AFTER the
   * caller's own reads (Firestore requires reads before writes). With `requestKey` the same key
   * returns the same number (idempotent retries) even if the caller's own idempotency record is lost.
   */
  async assign(
    tx: Tx,
    ctx: NumberingContext,
    meta: { at: Date; requestKey?: string },
  ): Promise<AssignedNumber> {
    const assignmentId = meta.requestKey
      ? createHash('sha256')
          .update(`${ctx.companyId}\n${ctx.docType}\n${meta.requestKey}`)
          .digest('hex')
      : null;
    const cid = counterId(ctx);
    const [prev, counter] = await Promise.all([
      assignmentId ? this.store.getInTx(tx, ASSIGNMENTS, assignmentId) : Promise.resolve(null),
      this.store.getInTx(tx, COUNTERS, cid),
    ]);
    if (prev)
      return { number: prev.data.number as string, seq: prev.data.seq as number, replayed: true };

    const seq = ((counter?.data.last as number | undefined) ?? 0) + 1;
    this.store.set(tx, COUNTERS, cid, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      docType: ctx.docType,
      period: periodKey(ctx.series, ctx.businessDate),
      last: seq,
      updatedAt: meta.at,
    });
    const number = formatNumber(ctx, seq);
    if (assignmentId)
      this.store.create(tx, ASSIGNMENTS, assignmentId, {
        companyId: ctx.companyId,
        docType: ctx.docType,
        number,
        seq,
        at: meta.at,
      });
    return { number, seq, replayed: false };
  }
}

/**
 * Group B documents show a temporary reference until posted ("Nháp"); it never consumes a
 * counter value so cancelled drafts leave no gap (BA §6.2).
 */
export function draftReference(id: string): string {
  return `NHAP-${id
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase()}`;
}

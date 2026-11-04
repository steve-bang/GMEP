import type { CrmDeps } from '@/modules/crm';
import type { InvDeps } from '@/modules/inv';
import type { SysDeps } from '@/modules/sys';
import type { IntakeRepository, QuoteRepository, QuoteVersionRepository } from './ports';

/** REC configuration: documented defaults, none hard-coded in a use case. */
export interface RecConfig {
  /** BA: a normal quote is valid 7 days once sent (ba-answers-03 Câu 3) */
  quoteValidityDays: number;
  /** price list used for part prices until the branch-config "bảng giá áp dụng" exists [Đề xuất dev - chờ xác nhận: BA] */
  priceListCode: string;
  /**
   * R2: tax-rate key used for a kind of line when no `tax-mapping` version is in force. The real mapping
   * (labor vs parts, per goods group) is effective-dated config [Cần xác nhận: Kế toán khách].
   */
  defaultTaxRateKey: string;
  /** limits that keep one quote inside a bounded transaction */
  maxItems: number;
  maxLinesPerItem: number;
  maxVersions: number;
  /** rows a picker returns */
  pickerMax: number;
}

export const DEFAULT_REC_CONFIG: RecConfig = {
  quoteValidityDays: 7,
  priceListCode: 'STD',
  defaultTaxRateKey: 'vat',
  maxItems: 30,
  maxLinesPerItem: 30,
  maxVersions: 50,
  pickerMax: 20,
};

export interface RecDeps {
  sys: SysDeps;
  crm: CrmDeps;
  inv: InvDeps;
  intakes: IntakeRepository;
  quotes: QuoteRepository;
  versions: QuoteVersionRepository;
  rec: RecConfig;
}
// FR-REC-003 / R9: the odometer threshold is CRM's single `abnormalKmDrop` (deps.crm.crm), not a REC copy.

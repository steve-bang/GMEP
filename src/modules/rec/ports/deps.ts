import type { CrmDeps } from '@/modules/crm';
import type { InvDeps } from '@/modules/inv';
import type { SysDeps } from '@/modules/sys';
import type { IntakeRepository, QuoteRepository, QuoteVersionRepository } from './ports';

/** REC configuration: documented defaults, none hard-coded in a use case. */
export interface RecConfig {
  /** BA: a normal quote is valid 7 days once sent (ba-answers-03 Câu 3) */
  quoteValidityDays: number;
  /** FR-REC-003: a drop larger than this flags the intake "Số km bất thường" [Đề xuất BA - chờ xác nhận: Khách] */
  abnormalKmDrop: number;
  /** price list used for part prices until the branch-config "bảng giá áp dụng" exists [Đề xuất dev - chờ xác nhận: BA] */
  priceListCode: string;
  /** tax-rate config key applied to every quote line until per-group rates (FR-ACC-009) are decided [Cần xác nhận: Kế toán khách] */
  taxRateKey: string;
  /** limits that keep one quote inside a bounded transaction */
  maxItems: number;
  maxLinesPerItem: number;
  maxVersions: number;
  /** rows a picker returns */
  pickerMax: number;
}

export const DEFAULT_REC_CONFIG: RecConfig = {
  quoteValidityDays: 7,
  abnormalKmDrop: 1000,
  priceListCode: 'STD',
  taxRateKey: 'vat',
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

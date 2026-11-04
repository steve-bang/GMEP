import type { CrmDeps } from '@/modules/crm';
import type { InvDeps } from '@/modules/inv';
import type { SysDeps } from '@/modules/sys';
import type {
  IntakeRepository,
  PartRequestRepository,
  PaymentGate,
  QuoteLinkRepository,
  QuoteRepository,
  QuoteVersionRepository,
  RepairItemRepository,
  RepairOrderRepository,
} from './ports';

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
  /**
   * Approval policy used when no `quote-approval` config version is in force (Câu 2: a customer may
   * refuse a required item by default; OTP stays off until an SMS channel is active).
   */
  approval: {
    allowDeclineRequired: boolean;
    verbalApproval: boolean;
    otpMode: 'off';
  };
  /** QUO-05: a verbal approval needs a note of at least this many characters */
  verbalNoteMinLength: number;
  /** random bytes in a customer link token (>= 16 = 128 bit, QUO-04) */
  linkTokenBytes: number;
  /** limits that keep one quote inside a bounded transaction */
  maxItems: number;
  maxLinesPerItem: number;
  maxVersions: number;
  /** rows a picker returns */
  pickerMax: number;
  /** slice 1.6 limits that keep one order inside a bounded transaction */
  maxItemsPerOrder: number;
  maxPartRequestsPerOrder: number;
  maxProposalsPerOrder: number;
  maxEventsPerItem: number;
  /** FR-REC-013: "hoàn tác" window after a start/pause/finish [Đề xuất dev - chờ xác nhận: Khách] */
  undoWindowMs: number;
  /** dispatch board rows */
  boardMax: number;
  /** a handover may only happen after the QC passed (FR-REC-016); payment is checked in slice 1.7 */
  requireHandoverReceiverName: boolean;
}

export const DEFAULT_REC_CONFIG: RecConfig = {
  quoteValidityDays: 7,
  priceListCode: 'STD',
  defaultTaxRateKey: 'vat',
  approval: { allowDeclineRequired: true, verbalApproval: true, otpMode: 'off' },
  verbalNoteMinLength: 10,
  linkTokenBytes: 32,
  maxItems: 30,
  maxLinesPerItem: 30,
  maxVersions: 50,
  pickerMax: 20,
  maxItemsPerOrder: 60,
  maxPartRequestsPerOrder: 200,
  maxProposalsPerOrder: 50,
  maxEventsPerItem: 200,
  undoWindowMs: 120_000,
  boardMax: 300,
  requireHandoverReceiverName: true,
};

export interface RecDeps {
  sys: SysDeps;
  crm: CrmDeps;
  inv: InvDeps;
  intakes: IntakeRepository;
  quotes: QuoteRepository;
  versions: QuoteVersionRepository;
  links: QuoteLinkRepository;
  orders: RepairOrderRepository;
  items: RepairItemRepository;
  partRequests: PartRequestRepository;
  /** ACC's balance of an order (R44); the composition root wires it, tests may replace it */
  payments: PaymentGate;
  rec: RecConfig;
}
// FR-REC-003 / R9: the odometer threshold is CRM's single `abnormalKmDrop` (deps.crm.crm), not a REC copy.

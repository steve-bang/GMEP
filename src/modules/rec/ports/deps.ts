import type { FileStore } from '@/platform/files/fileStore';
import type { CrmDeps } from '@/modules/crm';
import type { InvDeps } from '@/modules/inv';
import type { SysDeps } from '@/modules/sys';
import type { OtpMode, OtpSettings } from '../domain/otp';
import type {
  IntakeRepository,
  OrderInvoiceGate,
  PartRequestRepository,
  PaymentGate,
  QuoteDeliveryRepository,
  QuoteLinkRepository,
  QuoteOtpRepository,
  QuoteRepository,
  QuoteVersionRepository,
  RepairItemRepository,
  RepairOrderRepository,
} from './ports';

/** REC configuration: documented defaults, none hard-coded in a use case. */
export interface RecConfig {
  /** BA: a normal quote is valid 7 days once sent (ba-answers-03 Câu 3) */
  quoteValidityDays: number;
  /** R10/R17: days before `validUntil` on which the advisor gets the in-app reminder (0 = on the last day) [Đề xuất dev - chờ xác nhận: BA] */
  quoteReminderLeadDays: number;
  /** price list used for part prices until the branch-config "bảng giá áp dụng" exists [Đề xuất dev - chờ xác nhận: BA] */
  priceListCode: string;
  /**
   * R2: tax-rate key used for a kind of line when no `tax-mapping` version is in force. The real mapping
   * (labor vs parts, per goods group) is effective-dated config [Cần xác nhận: Kế toán khách].
   */
  defaultTaxRateKey: string;
  /**
   * Approval policy used when no `quote-approval` config version is in force (Câu 2: a customer may
   * refuse a required item by default; OTP stays off until the owner turns it on).
   */
  approval: {
    allowDeclineRequired: boolean;
    verbalApproval: boolean;
    otpMode: OtpMode;
  };
  /**
   * A4 / QUO-04/05: one-time code defaults when the `quote-approval` config does not set them
   * [Đề xuất dev - chờ xác nhận: Chủ dự án]: 5 minutes, 5 wrong tries, 60 s between codes, 5 codes per link per 15 minutes.
   */
  otp: OtpSettings & { sendLimit: number; sendWindowMs: number; addressLimit: number };
  /** A4: quote-link delivery retries: attempts, backoff base and cap, how many pending items one run handles */
  delivery: {
    maxAttempts: number;
    backoffBaseMs: number;
    backoffMaxMs: number;
    runBatch: number;
    /** lease taken on a delivery while one run works on it, so an overlapping run skips it */
    leaseMs: number;
    /** pending items kept in a branch queue document */
    queueMax: number;
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
  /** photos on an intake or an order (uploads go through the API; ADR 0001 §7.3) [Đề xuất dev - chờ xác nhận: Khách] */
  photoMaxBytes: number;
  maxPhotosPerRecord: number;
  /** dispatch board rows */
  boardMax: number;
  /** a handover may only happen after the QC passed (FR-REC-016); payment is checked in slice 1.7 */
  requireHandoverReceiverName: boolean;
}

export const DEFAULT_REC_CONFIG: RecConfig = {
  quoteValidityDays: 7,
  quoteReminderLeadDays: 1,
  priceListCode: 'STD',
  defaultTaxRateKey: 'vat',
  approval: { allowDeclineRequired: true, verbalApproval: true, otpMode: 'off' },
  otp: {
    ttlMs: 5 * 60_000,
    maxAttempts: 5,
    resendCooldownMs: 60_000,
    sendLimit: 5,
    sendWindowMs: 15 * 60_000,
    addressLimit: 20,
  },
  delivery: {
    maxAttempts: 5,
    backoffBaseMs: 2 * 60_000,
    backoffMaxMs: 60 * 60_000,
    runBatch: 20,
    leaseMs: 3 * 60_000,
    queueMax: 200,
  },
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
  photoMaxBytes: 5 * 1024 * 1024,
  maxPhotosPerRecord: 30,
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
  otps: QuoteOtpRepository;
  deliveries: QuoteDeliveryRepository;
  orders: RepairOrderRepository;
  items: RepairItemRepository;
  partRequests: PartRequestRepository;
  /** ACC's balance of an order (R44); the composition root wires it, tests may replace it */
  payments: PaymentGate;
  /** R75: EIN's answer for an order, wired by the composition root */
  invoices: OrderInvoiceGate;
  rec: RecConfig;
  /** binary storage for photos; paths are server-chosen and Scope-prefixed */
  files: FileStore;
}
// FR-REC-003 / R9: the odometer threshold is CRM's single `abnormalKmDrop` (deps.crm.crm), not a REC copy.

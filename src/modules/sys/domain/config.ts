import { z } from 'zod';
import type { ConfigStatus } from '@/platform/effective/effective';

/**
 * Effective-dated configuration types (FR-SYS-004, NFR-MNT-01). Everything that changes by law or
 * policy is one of these: a version has `effectiveFrom`, goes pending -> approved|rejected, and
 * documents keep a snapshot of the version they used. NO tax rate, cutoff date, discount limit
 * or price is written in code; BA-03 (the 1/1/2027 VAT rule) is just data in a `tax-rate` version.
 */
export interface ConfigVersion {
  /** deterministic: `${type}__${scopeKey}__${effectiveFrom}` (unique slot per effective date) */
  id: string;
  companyId: string;
  type: string;
  scopeKey: string;
  effectiveFrom: string;
  status: ConfigStatus;
  payload: Record<string, unknown>;
  proposedBy: string;
  proposedAt: Date;
  reason: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  version: number;
}

export const configVersionId = (type: string, scopeKey: string, effectiveFrom: string): string =>
  `${type}__${scopeKey.replace(/[:/]/g, '~')}__${effectiveFrom}`;

const bp = z.number().int().min(0).max(10_000); // basis points: 8% = 800 (no floats)
const vnd = z.number().int().min(0).max(1_000_000_000_000);
const code = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export interface ConfigTypeDef {
  type: string;
  /** RBAC resource: propose = `<resource>:update`, decide = `<resource>:approve|reject` */
  resource: string;
  /** which scope keys are valid */
  scopeKey: z.ZodType<string>;
  /** branch-specific keys ('branch:<id>') override the company key */
  branchOverride: boolean;
  payload: z.ZodType<Record<string, unknown>>;
  /**
   * A company-wide key normally needs a company-wide scope to propose. Catalogues that a branch role
   * maintains (I14: the storekeeper proposes, the owner approves) set this: the approval is the gate.
   */
  proposeFromBranch?: boolean;
}

const companyOrBranchKey = z.union([
  z.literal('company'),
  z.string().regex(/^branch:[A-Za-z0-9_-]{1,64}$/),
]);
const keyed = (prefix: RegExp) => z.string().regex(prefix);

export const CONFIG_TYPES: Record<string, ConfigTypeDef> = {
  // FR-ACC-009: rates are basis points of an exact integer; the sample rows in tests are NOT signed off.
  'tax-rate': {
    type: 'tax-rate',
    resource: 'tax-rate',
    scopeKey: keyed(code),
    branchOverride: false,
    payload: z.object({ name: z.string().trim().min(1).max(80), rateBp: bp }).strict(),
  },
  // R2 (BA §17): which tax-rate key each kind of quote line uses. The accountant has not said whether
  // labor and parts share a rate, so the mapping is data; without a version every kind uses `vat`.
  // `partGroups` overrides the key for parts of a catalogue group (FR-ACC-009 tax by goods group).
  'tax-mapping': {
    type: 'tax-mapping',
    resource: 'tax-rate',
    scopeKey: z.literal('company'),
    branchOverride: false,
    payload: z
      .object({
        labor: z.string().regex(code),
        part: z.string().regex(code),
        partGroups: z
          .record(z.string().regex(/^[a-z][a-z0-9-]{0,29}$/), z.string().regex(code))
          .optional(),
      })
      .strict(),
  },
  // R7 (BA §17): service types are a company catalogue (BR-REC-13, FR-REC-032), not four labels in code.
  // Documents store the CODE. The workflow behind a type (body and paint needs its own) is a later slice.
  'service-type': {
    type: 'service-type',
    resource: 'service-catalog',
    scopeKey: keyed(/^[a-z][a-z0-9_-]{0,29}$/),
    branchOverride: false,
    proposeFromBranch: true,
    payload: z
      .object({ name: z.string().trim().min(1).max(60), status: z.enum(['active', 'inactive']) })
      .strict(),
  },
  // C23 (BA §17): kinds of consent evidence the counter can pick from; the lawyer and the client decide the list.
  'evidence-kind': {
    type: 'evidence-kind',
    resource: 'consent-evidence',
    scopeKey: keyed(/^[a-z][a-z0-9-]{0,29}$/),
    branchOverride: false,
    proposeFromBranch: true,
    payload: z
      .object({
        name: z.string().trim().min(1).max(80),
        status: z.enum(['active', 'inactive']),
        /** the kind carries a reference number (paper slip no., message id) */
        referenceLabel: z.string().trim().min(1).max(40).optional(),
        /** the reference is mandatory for this kind */
        referenceRequired: z.boolean().optional(),
        /** a note is mandatory (the catch-all "khác") */
        noteRequired: z.boolean().optional(),
      })
      .strict(),
  },
  // ba-answers-03 Câu 2 / FR-REC-009: reasons a customer gives for not approving an item (catalogue).
  'decline-reason': {
    type: 'decline-reason',
    resource: 'service-catalog',
    scopeKey: keyed(/^[a-z][a-z0-9_-]{0,29}$/),
    branchOverride: false,
    proposeFromBranch: true,
    payload: z
      .object({
        name: z.string().trim().min(1).max(80),
        status: z.enum(['active', 'inactive']),
        /** the catch-all "khác": the free-text note is mandatory */
        noteRequired: z.boolean().optional(),
      })
      .strict(),
  },
  // ba-answers-03 Câu 2, QUO-04/05: quote approval policy, company default or per branch. Booleans are set through the API.
  'quote-approval': {
    type: 'quote-approval',
    resource: 'branch-config',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z
      .object({
        /** "Cho phép khách bỏ hạng mục bắt buộc" (default yes) */
        allowDeclineRequired: z.boolean(),
        /** FR-REC-026: verbal approval by staff is allowed (it becomes an exception for review) */
        verbalApproval: z.boolean(),
        /** OTP is not available until an SMS provider is active; only `off` is accepted today */
        otpMode: z.enum(['off']),
        /**
         * R29: a verbal approval above this total (tax included, integer VND) must be recorded by a manager.
         * Not set = no limit. The number is the client's to give [Cần xác nhận: Khách].
         */
        verbalApprovalMaxVnd: vnd.optional(),
      })
      .strict(),
  },
  // R34: rate limits of the customer link page, effective-dated so a change needs no release. Not set = built-in defaults.
  'public-rate-limit': {
    type: 'public-rate-limit',
    resource: 'branch-config',
    scopeKey: z.literal('company'),
    branchOverride: false,
    payload: z
      .object({
        /** page views per window, per address and per link */
        viewLimit: z.number().int().min(5).max(1000),
        viewWindowSeconds: z.number().int().min(10).max(3600),
        /** approve/reject attempts per window, per link */
        decideLimit: z.number().int().min(1).max(100),
        decideWindowMinutes: z.number().int().min(1).max(240),
      })
      .strict(),
  },
  // FR-REC-016: quality-check list of a service type (company default key `default`), effective-dated.
  'qc-checklist': {
    type: 'qc-checklist',
    resource: 'service-catalog',
    scopeKey: keyed(/^[a-z][a-z0-9_-]{0,29}$/),
    branchOverride: false,
    payload: z
      .object({
        checks: z
          .array(
            z
              .object({
                code: z.string().regex(/^[a-z][a-z0-9_-]{0,29}$/),
                name: z.string().trim().min(1).max(120),
              })
              .strict(),
          )
          .min(1)
          .max(30),
      })
      .strict(),
  },
  // FR-REC-013/017: execution policy of the workshop (undo window, handover rules), company or per branch.
  'order-policy': {
    type: 'order-policy',
    resource: 'branch-config',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z
      .object({
        /** seconds a technician may undo a start/pause/finish */
        undoWindowSeconds: z.number().int().min(0).max(3600),
        /** the vehicle may be handed over only after the order is fully paid (slice 1.7 enforces it) */
        handoverRequiresPayment: z.boolean(),
        /** the customer's name is required on the handover record */
        handoverRequiresReceiver: z.boolean(),
      })
      .strict(),
  },
  // FR-ACC-001/003/004 (slice 1.7): money-handling policy of a branch, company default with branch override.
  // Every value is a default [Đề xuất dev - chờ xác nhận: Kế toán khách / Khách]; none is a legal rule.
  'acc-policy': {
    type: 'acc-policy',
    resource: 'acc-policy',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z
      .object({
        /** payment methods the counter may record (QR / e-wallet are recorded by hand; no gateway) */
        methods: z
          .array(z.enum(['cash', 'transfer', 'card', 'qr']))
          .min(1)
          .max(4),
        /** a non-cash line must carry the bank / POS / QR transaction reference */
        nonCashReferenceRequired: z.boolean(),
        /** a final receipt is accepted only after the quality check passed (G4-ACC-01 "chặn thu"); deposits are not */
        receiptRequiresQc: z.boolean(),
        /** a cash count within +/- this many VND needs an explanation but no manager approval (FR-ACC-004) */
        varianceToleranceVnd: vnd,
        /** BA R63: longest term of an approved debt at handover, in days (default 60) */
        debtMaxDays: z.number().int().min(1).max(365).optional(),
        /** R64: days a "thiếu chứng từ" flag may stay open before the manager is told (default 3) */
        sourceFlagNoticeDays: z.number().int().min(1).max(90).optional(),
      })
      .strict(),
  },
  // FR-SYS-004 / RULE-011: approval limits per kind of request, company-wide, effective-dated (G4-APR-03).
  // The scope key is the approval kind. The numbers are the client's to give [Cần xác nhận: D-11].
  'approval-limit': {
    type: 'approval-limit',
    resource: 'approval-limit',
    scopeKey: z.enum([
      'payment_reversal',
      'expense',
      'deposit_refund',
      'customer_refund',
      'day_reopen',
      'debt_handover',
      'cash_variance',
      'invoice_adjust',
      'invoice_replace',
      'invoice_cancel',
    ]),
    branchOverride: false,
    payload: z
      .object({
        selfMaxVnd: vnd,
        level1MaxVnd: vnd,
        /** R58: running cap of the values decided by the requester alone within one cash shift (expense only) */
        shiftCapVnd: vnd.optional(),
        dueHours: z
          .number()
          .int()
          .min(1)
          .max(24 * 30),
      })
      .strict()
      .refine((p) => p.level1MaxVnd >= p.selfMaxVnd, 'level1MaxVnd must not be below selfMaxVnd'),
  },
  // expense categories of the cash voucher (G4-ACC-04), a company catalogue; the accountant owns the list
  'expense-category': {
    type: 'expense-category',
    resource: 'acc-policy',
    scopeKey: keyed(/^[a-z][a-z0-9_-]{0,29}$/),
    branchOverride: false,
    payload: z
      .object({
        name: z.string().trim().min(1).max(80),
        status: z.enum(['active', 'inactive']),
        /** the category refunds a customer deposit (needs the deposit it refunds) */
        depositRefund: z.boolean().optional(),
        /**
         * R64/R65: `required` = a voucher of this category cannot be saved without its source document (an order, a
         * deposit, a supplier receipt); `optional` (default) = it can be saved flagged "thiếu chứng từ" with a reason,
         * and then always needs a manager's approval.
         */
        sourceRequirement: z.enum(['required', 'optional']).optional(),
        /** R65: optional accounting account code for the later export (FR-ACC-010, not used yet) */
        accountCode: z.string().trim().max(20).optional(),
      })
      .strict(),
  },
  // FR-EIN-003 (slice 1.8): the issuing unit of a branch and the provider behind it, company default with branch override.
  // The provider is chosen by CODE here (data), never in code; `fake` is the only adapter built. The live environment is a
  // separate value so test and live never mix (FR-EIN-004). Legal facts (symbol, invoice type) are [Cần kế toán xác nhận].
  'einvoice-issuer': {
    type: 'einvoice-issuer',
    resource: 'einvoice-config',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z
      .object({
        enabled: z.boolean(),
        providerCode: z.string().regex(/^[a-z][a-z0-9-]{0,29}$/),
        environment: z.enum(['test', 'live']),
        sellerName: z.string().trim().min(2).max(200),
        sellerTaxCode: z.string().regex(/^\d{10}(-\d{3})?$/),
        sellerAddress: z.string().trim().max(300).optional(),
        symbol: z.string().regex(/^[A-Z0-9]{3,8}$/),
        invoiceType: z.enum(['vat', 'sales']),
        templateCode: z.string().regex(/^[A-Z0-9]{1,11}$/),
      })
      .strict(),
  },
  // FR-EIN-001/009/010/011 (slice 1.8): how an invoice is built and retried. Every value is a default
  // [Đề xuất dev - chờ xác nhận: Kế toán khách]; none is a legal rule.
  'einvoice-policy': {
    type: 'einvoice-policy',
    resource: 'einvoice-config',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z
      .object({
        /** per-rate = one line per tax rate (BA R25 default); per-line = one line per approved line */
        lineMode: z.enum(['per-rate', 'per-line']),
        perRateDescription: z.string().trim().min(2).max(120),
        /** qc = from the quality check on; handover = only after the vehicle was handed over */
        issueAfter: z.enum(['qc', 'handover']),
        businessAddressRequired: z.boolean(),
        retailNameRequired: z.boolean(),
        /** a tax-rate change between the approved quote and the invoice date: list it (warn) or stop (block) */
        taxChangePolicy: z.enum(['warn', 'block']),
        maxAttempts: z.number().int().min(1).max(20),
        retryBackoffMinutes: z.array(z.number().int().min(1).max(1440)).min(1).max(8),
        providerTimeoutMs: z.number().int().min(1000).max(120_000),
      })
      .strict(),
  },
  // FR-RPT-003/008 (slice 1.9): the thresholds of the exception alerts. Every value is a default
  // [Đề xuất dev - chờ xác nhận: Chủ garage/Quản lý]; none is a legal rule.
  'report-policy': {
    type: 'report-policy',
    resource: 'report-config',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z
      .object({
        /** an order open longer than this many days is listed as "mở quá lâu" */
        openOrderMaxDays: z.number().int().min(1).max(90),
        /** a completed order without a valid invoice for this many days or more is listed */
        uninvoicedAfterDays: z.number().int().min(0).max(30),
        /** a handed-over order with an unpaid balance and no approved debt, older than this, is listed */
        unpaidHandoverGraceDays: z.number().int().min(0).max(30),
        /** a closed shift whose cash variance is above this (absolute VND) is listed */
        cashVarianceAlertVnd: vnd,
      })
      .strict(),
  },
  // FR-REC-032 / BR-REC-13: the steps of a service type (a repair order gets the set of its type).
  // The item states and the responsible person are applied when the repair item exists (slice 1.6).
  'service-workflow': {
    type: 'service-workflow',
    resource: 'service-catalog',
    scopeKey: keyed(/^[a-z][a-z0-9_-]{0,29}$/),
    branchOverride: false,
    payload: z
      .object({
        steps: z
          .array(
            z
              .object({
                code: z.string().regex(/^[a-z][a-z0-9_-]{0,29}$/),
                name: z.string().trim().min(1).max(80),
                /** role that normally does the step (a role code); optional */
                responsibleRole: z.string().min(1).max(8).optional(),
                /** R36: expected duration of the step in days (body & paint) */
                expectedDays: z.number().int().min(0).max(365).optional(),
                /** R36: the step counts toward the technician's labor; default false (labor comes from the labor lines) */
                countsTowardLabor: z.boolean().optional(),
              })
              .strict(),
          )
          .min(1)
          .max(20),
      })
      .strict(),
  },
  'labor-rate': {
    type: 'labor-rate',
    resource: 'service-catalog',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z.object({ hourlyRateVnd: vnd }).strict(),
  },
  'standard-hours': {
    type: 'standard-hours',
    resource: 'service-catalog',
    scopeKey: keyed(/^service:[A-Za-z0-9_-]{1,80}$/),
    branchOverride: false,
    payload: z
      .object({
        standardMinutes: z
          .number()
          .int()
          .min(1)
          .max(24 * 60),
      })
      .strict(),
  },
  // FR-INV-025: maximum discount per role, in basis points of list price.
  'discount-limit': {
    type: 'discount-limit',
    resource: 'discount-limit',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z.object({ maxDiscountBpByRole: z.record(z.string().min(1).max(8), bp) }).strict(),
  },
  // cost, list price and actual price are separate: the list holds cost and list price; the
  // actual price is decided per document within the discount limit.
  'price-item': {
    type: 'price-item',
    resource: 'price-list',
    scopeKey: keyed(/^[A-Za-z0-9_-]{1,64}:[A-Za-z0-9._/-]{1,40}$/),
    branchOverride: false,
    payload: z
      .object({ name: z.string().trim().min(1).max(120), costVnd: vnd, listPriceVnd: vnd })
      .strict(),
  },
  // FR-INV-009 / FR-INV-027: the stock cost method is data, effective-dated (one choice per period).
  // Only 'weighted-average' has an implementation; the list grows when the accountant decides
  // (e.g. 'fifo') and a CostMethod strategy is registered in the INV domain [Cần xác nhận: Kế toán khách].
  'cost-method': {
    type: 'cost-method',
    resource: 'cost-method',
    scopeKey: z.literal('company'),
    branchOverride: false,
    payload: z.object({ method: z.enum(['weighted-average']) }).strict(),
  },
  // FR-INV-005: GRN variance thresholds above which the manager must approve the receipt
  // (basis points of the expected price / quantity). Values are [Đề xuất dev - chờ xác nhận: Khách].
  'inventory-policy': {
    type: 'inventory-policy',
    resource: 'inventory-policy',
    scopeKey: companyOrBranchKey,
    branchOverride: true,
    payload: z.object({ grnPriceVarianceBp: bp, grnQtyVarianceBp: bp }).strict(),
  },
  // I14 (BA §16): part groups and units of measure are company-level catalogues. One scope key per
  // entry (the code), effective-dated and approved like any other config; entries are deactivated,
  // never deleted. TK proposes, CH approves (FRD §2 "Danh mục phụ tùng") [Đề xuất BA - chờ xác nhận: Khách].
  'part-group': {
    type: 'part-group',
    resource: 'part-catalog',
    scopeKey: keyed(/^[a-z][a-z0-9-]{0,29}$/),
    branchOverride: false,
    proposeFromBranch: true,
    payload: z
      .object({ name: z.string().trim().min(1).max(60), status: z.enum(['active', 'inactive']) })
      .strict(),
  },
  'part-unit': {
    type: 'part-unit',
    resource: 'part-catalog',
    scopeKey: keyed(/^[a-z][a-z0-9-]{0,29}$/),
    branchOverride: false,
    proposeFromBranch: true,
    payload: z
      .object({ name: z.string().trim().min(1).max(40), status: z.enum(['active', 'inactive']) })
      .strict(),
  },
  // FR-SYS-006: metadata only (the template body is a later slice).
  'doc-template': {
    type: 'doc-template',
    resource: 'doc-template',
    scopeKey: keyed(/^tpl:[A-Za-z0-9_-]{1,40}$/),
    branchOverride: false,
    payload: z
      .object({
        name: z.string().trim().min(1).max(120),
        kind: z.enum([
          'quote',
          'repair-order',
          'receipt',
          'stock-doc',
          'handover',
          'notification',
          'other',
        ]),
        paper: z.enum(['A4', 'A5', 'thermal80', 'thermal58']),
        note: z.string().trim().max(300).optional(),
      })
      .strict(),
  },
  'numbering-series': {
    type: 'numbering-series',
    resource: 'numbering-series',
    scopeKey: keyed(/^[a-z][a-z0-9-]{1,40}$/),
    branchOverride: false,
    payload: z
      .object({
        prefix: z.string().regex(/^[A-Z]{1,4}$/),
        group: z.enum(['A', 'B']),
        gapPolicy: z.enum(['strict', 'relaxed']),
        scope: z.enum(['branch', 'legalEntity']),
        period: z.enum(['month', 'year', 'none']),
        seqWidth: z.number().int().min(3).max(9),
        reversalSameSeries: z.boolean(),
      })
      .strict(),
  },
};

export function configTypeOrThrow(type: string): ConfigTypeDef {
  const d = CONFIG_TYPES[type];
  if (!d) throw new Error(`unknown config type ${type}`);
  return d;
}

/** Roles that may see price cost (giá vốn); others get list price only (ba-answers-04). [Cần xác nhận: Khách] */
export const COST_VISIBLE_ROLES: readonly string[] = ['CH', 'QV', 'QL', 'KT'];

/** Roles allowed to approve their own proposal (with password re-entry + audit), BA §2.2 rule 5. */
export const SELF_APPROVE_ROLES: readonly string[] = ['CH'];

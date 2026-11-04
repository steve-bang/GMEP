import type { BuyerKind, InvoiceBuyer } from './invoice';
import type { BuiltInvoice, SourceLine } from './build';

/**
 * Pre-issue check (FR-EIN-011, FR-EIN-002): every blocking issue is listed so the user can fix them all; nothing is sent
 * while any exists. Pure; the facts (order, buyer, issuer, rates in force) are read by the use case. `code` is stable
 * and has an i18n message; `field` points at the buyer form field to fix, when there is one.
 */

export type IssueCode =
  | 'provider_not_activated'
  | 'issuer_incomplete'
  | 'order_not_eligible'
  | 'order_cancelled'
  | 'already_invoiced'
  | 'request_in_progress'
  | 'buyer_name_missing'
  | 'buyer_tax_code_missing'
  | 'buyer_tax_code_invalid'
  | 'buyer_address_missing'
  | 'buyer_email_invalid'
  | 'lines_missing'
  | 'tax_missing'
  | 'tax_rate_changed'
  | 'invoice_total_mismatch';

export interface EligibilityIssue {
  code: IssueCode;
  field?: 'name' | 'taxCode' | 'address' | 'email';
}
export interface EligibilityWarning {
  code: 'tax_rate_changed';
  taxKey: string;
  quotedRateBp: number;
  currentRateBp: number;
}

export interface EligibilityPolicy {
  /** `qc`: from the quality check on (BA R44); `handover`: only after the vehicle was handed over */
  issueAfter: 'qc' | 'handover';
  /** a business buyer must give an address (default yes) */
  businessAddressRequired: boolean;
  /** retail buyers need at least a name (default yes) */
  retailNameRequired: boolean;
  /** what a tax-rate change between quote and invoice date does: `warn` lists it, `block` refuses */
  taxChangePolicy: 'warn' | 'block';
}

export const DEFAULT_ELIGIBILITY_POLICY: EligibilityPolicy = {
  issueAfter: 'qc',
  businessAddressRequired: true,
  retailNameRequired: true,
  taxChangePolicy: 'warn',
};

/** Vietnamese tax code: 10 digits, or 10 digits - 3 digits for a dependent unit. Format only (the checksum is not verified). */
export const isValidTaxCode = (s: string): boolean => /^\d{10}(-\d{3})?$/.test(s.trim());

export const isValidEmail = (s: string): boolean =>
  /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(s);

export interface OrderFacts {
  status: string;
  qcPassed: boolean;
  completed: boolean;
  cancelled: boolean;
  totalVnd: number;
  hasLines: boolean;
}

export interface EligibilityInput {
  providerActive: boolean;
  issuerComplete: boolean;
  order: OrderFacts;
  buyer: InvoiceBuyer & { address?: string; email?: string };
  lines: readonly SourceLine[];
  built: BuiltInvoice | null;
  /** an effective invoice or an open issue request already exists */
  existing: 'none' | 'valid_invoice' | 'open_request';
  /** current rate of each tax key on the invoice date (for the warning) */
  currentRates: ReadonlyMap<string, number>;
  policy: EligibilityPolicy;
}

export interface EligibilityResult {
  ok: boolean;
  issues: EligibilityIssue[];
  warnings: EligibilityWarning[];
}

export function checkEligibility(i: EligibilityInput): EligibilityResult {
  const issues: EligibilityIssue[] = [];
  const warnings: EligibilityWarning[] = [];
  const add = (code: IssueCode, field?: EligibilityIssue['field']) =>
    issues.push({ code, ...(field ? { field } : {}) });
  if (!i.providerActive) add('provider_not_activated');
  else if (!i.issuerComplete) add('issuer_incomplete');
  if (i.order.cancelled) add('order_cancelled');
  else if (!(i.policy.issueAfter === 'handover' ? i.order.completed : i.order.qcPassed))
    add('order_not_eligible');
  if (i.existing === 'valid_invoice') add('already_invoiced');
  if (i.existing === 'open_request') add('request_in_progress');
  const b = i.buyer;
  const kind: BuyerKind = b.kind;
  if (kind === 'business' || i.policy.retailNameRequired) {
    if (!b.name || b.name.trim().length < 2) add('buyer_name_missing', 'name');
  }
  if (kind === 'business') {
    if (!b.taxCode) add('buyer_tax_code_missing', 'taxCode');
    else if (!isValidTaxCode(b.taxCode)) add('buyer_tax_code_invalid', 'taxCode');
    if (i.policy.businessAddressRequired && (!b.address || b.address.trim().length < 5))
      add('buyer_address_missing', 'address');
  } else if (b.taxCode && !isValidTaxCode(b.taxCode)) add('buyer_tax_code_invalid', 'taxCode');
  if (b.email && !isValidEmail(b.email)) add('buyer_email_invalid', 'email');
  if (i.lines.length === 0) add('lines_missing');
  for (const l of i.lines) {
    if (
      !l.taxKey ||
      !l.taxVersionId ||
      !Number.isInteger(l.taxRateBp) ||
      l.taxRateBp < 0 ||
      l.taxRateBp > 10_000
    ) {
      add('tax_missing');
      break;
    }
  }
  if (i.built && i.built.totalVnd !== i.order.totalVnd) add('invoice_total_mismatch');
  for (const l of i.lines) {
    const cur = i.currentRates.get(l.taxKey);
    if (cur !== undefined && cur !== l.taxRateBp && !warnings.some((w) => w.taxKey === l.taxKey))
      warnings.push({
        code: 'tax_rate_changed',
        taxKey: l.taxKey,
        quotedRateBp: l.taxRateBp,
        currentRateBp: cur,
      });
  }
  // a tax-rate change between the approved quote and the invoice date is the ACCOUNTANT's call (Journey §8): by default
  // it is listed, not decided; `block` makes it a stop until the accountant answers
  if (i.policy.taxChangePolicy === 'block' && warnings.length) add('tax_rate_changed');
  return { ok: issues.length === 0, issues, warnings };
}

/** Where the buyer comes from (FR-EIN-002): the customer record, overridden field by field by the form. */
export function mergeBuyer(
  base: { kind: BuyerKind; name: string; taxCode?: string; address?: string; email?: string },
  over:
    | Partial<{ kind: BuyerKind; name: string; taxCode: string; address: string; email: string }>
    | undefined,
): InvoiceBuyer & { address?: string; email?: string } {
  const m = { ...base, ...(over ?? {}) };
  const kind = m.kind;
  return {
    kind,
    name: (m.name ?? '').trim(),
    ...(kind === 'business' && m.taxCode ? { taxCode: m.taxCode.trim() } : {}),
    ...(kind === 'retail' && over?.taxCode ? { taxCode: over.taxCode.trim() } : {}),
    ...(m.address ? { address: m.address.trim() } : {}),
    ...(m.email ? { email: m.email.trim() } : {}),
  };
}

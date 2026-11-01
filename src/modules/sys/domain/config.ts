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
    scopeKey: keyed(/^[A-Za-z0-9_-]{1,64}:[A-Za-z0-9._-]{1,40}$/),
    branchOverride: false,
    payload: z
      .object({ name: z.string().trim().min(1).max(120), costVnd: vnd, listPriceVnd: vnd })
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

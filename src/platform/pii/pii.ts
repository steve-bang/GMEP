import type { Actor } from '../rbac/rbac';

/**
 * PII masking by role (NFR-SEC-03, PDPL 2025, ba-answers-for-dev §7). The table below is the
 * DEFAULT `pii-policy` configuration [Đề xuất BA - chờ xác nhận: Khách, Luật sư khách]; it is data
 * passed to PiiPolicy, so a client decision changes the table, not the code.
 *
 * Levels: full = shown; reveal = masked with a "Hiện" button (no reason); reveal_reason = masked,
 * "Hiện" needs a reason; masked = masked, no reveal; hidden = field not returned at all.
 */
export type PiiField = 'phone' | 'email' | 'address';
export type PiiLevel = 'full' | 'reveal' | 'reveal_reason' | 'masked' | 'hidden';
export type PiiPolicyTable = Record<string, Record<PiiField, PiiLevel>>;

const all = (l: PiiLevel) => ({ phone: l, email: l, address: l });
export const DEFAULT_PII_POLICY: PiiPolicyTable = {
  CV: all('full'),
  QL: all('full'),
  TN: all('full'),
  QD: all('full'),
  CH: all('reveal'),
  QV: all('reveal'),
  KT: all('reveal_reason'),
  TK: { phone: 'masked', email: 'masked', address: 'hidden' },
  TH: all('hidden'),
  AD: all('hidden'),
  MH: all('hidden'),
  NS: all('hidden'),
};

/** Strictness order for fail-safe defaults: an unknown role is hidden. */
const OPENNESS: PiiLevel[] = ['hidden', 'masked', 'reveal_reason', 'reveal', 'full'];

/** Multi-role users get the union of rights (FR-SYS-012): the most open level of their roles. */
export function levelFor(
  actor: Pick<Actor, 'assignments'>,
  field: PiiField,
  table: PiiPolicyTable,
): PiiLevel {
  let best: PiiLevel = 'hidden';
  for (const a of actor.assignments) {
    const l = table[a.roleCode]?.[field];
    if (l && OPENNESS.indexOf(l) > OPENNESS.indexOf(best)) best = l;
  }
  return best;
}

export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.length < 6) return '•••';
  return `${d.slice(0, 2)}•• ••• ${d.slice(-3)}`;
}

export function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at < 1) return '•••';
  return `${value[0]}•••${value.slice(at)}`;
}

/** Keeps only district and province (the last two comma separated parts). */
export function maskAddress(value: string): string {
  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length <= 2 ? '••••••' : `••••••, ${parts.slice(-2).join(', ')}`;
}

export function maskValue(field: PiiField, value: string): string {
  return field === 'phone'
    ? maskPhone(value)
    : field === 'email'
      ? maskEmail(value)
      : maskAddress(value);
}

export interface PresentedPii {
  /** undefined when the level is `hidden`: the key is omitted from the response */
  value: string | undefined;
  masked: boolean;
  /** 'none' | 'plain' | 'reason' for the "Hiện" button */
  reveal: 'none' | 'plain' | 'reason';
}

export class PiiPolicy {
  constructor(private readonly table: PiiPolicyTable = DEFAULT_PII_POLICY) {}

  level(actor: Pick<Actor, 'assignments'>, field: PiiField): PiiLevel {
    return levelFor(actor, field, this.table);
  }

  /** Full value never leaves the server for masked/hidden levels (FR-SYS-025 proposal). */
  present(
    actor: Pick<Actor, 'assignments'>,
    field: PiiField,
    value: string | null | undefined,
  ): PresentedPii {
    const lvl = this.level(actor, field);
    if (value == null || value === '') return { value: undefined, masked: false, reveal: 'none' };
    switch (lvl) {
      case 'full':
        return { value, masked: false, reveal: 'none' };
      case 'hidden':
        return { value: undefined, masked: true, reveal: 'none' };
      case 'masked':
        return { value: maskValue(field, value), masked: true, reveal: 'none' };
      case 'reveal':
        return { value: maskValue(field, value), masked: true, reveal: 'plain' };
      case 'reveal_reason':
        return { value: maskValue(field, value), masked: true, reveal: 'reason' };
    }
  }

  revealRequirement(
    actor: Pick<Actor, 'assignments'>,
    field: PiiField,
  ): 'none' | 'plain' | 'reason' {
    const l = this.level(actor, field);
    return l === 'reveal' ? 'plain' : l === 'reveal_reason' ? 'reason' : 'none';
  }
}

export const PII_REVEAL_REASONS = ['invoice_check', 'debt_collection', 'other'] as const;
export type PiiRevealReason = (typeof PII_REVEAL_REASONS)[number];

export interface PiiAccessEntry {
  id: string;
  at: Date;
  requestId: string;
  actorId: string;
  /** role that granted the right, for the access log (BA §7.3) */
  actorRoles: string[];
  companyId: string;
  /** branch of the record */
  branchId: string | null;
  entityType: string;
  entityId: string;
  fields: PiiField[];
  purpose: 'open_record' | 'reveal' | 'export' | 'search_by_phone' | 'denied';
  result: 'allowed' | 'denied';
  reasonCode?: string;
  reasonText?: string;
  sessionId?: string;
  /** export only */
  rowCount?: number;
  columns?: string[];
}

/** Writes to the separate `accessLogs` collection (never to business audit, never with the value itself). */
export interface PiiAccessLog {
  record(entry: PiiAccessEntry): Promise<void>;
}

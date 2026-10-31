import type { Actor } from '../rbac/rbac';

/**
 * STUB (ports only). PDPL 2025 / NFR-SEC-03: phone and address are masked by role and every
 * reveal/export is logged. The real policy is configuration (FR-SYS-004 "PiiPolicy", effective-dated)
 * and is not decided yet; see docs/dev/open-questions-for-ba.md. Nothing in the skeleton returns
 * personal data yet, so nothing calls these ports; they exist so CRM (slice 1.3) plugs into them.
 */
export type PiiField = 'phone' | 'address';

export interface PiiPolicy {
  /** Returns the value as the actor may see it (masked unless the policy allows the full value). */
  present(field: PiiField, value: string, actor: Actor): string;
  canReveal(field: PiiField, actor: Actor): boolean;
}

export interface PiiAccessEntry {
  at: Date;
  actorId: string;
  companyId: string;
  branchId: string | null;
  entityType: string;
  entityId: string;
  field: PiiField;
  purpose: 'reveal' | 'export';
  requestId: string;
}

/** Writes to the separate `accessLogs` collection (never to business audit, never with the value itself). */
export interface PiiAccessLog {
  record(entry: PiiAccessEntry): Promise<void>;
}

/** Fail-safe placeholder: nobody may reveal; phone keeps only the last 3 digits, address is fully hidden. */
export const maskEverythingPolicy: PiiPolicy = {
  canReveal: () => false,
  present(field, value) {
    if (field === 'address') return '••••••';
    const digits = value.replace(/\D/g, '');
    return digits.length > 3 ? `${'•'.repeat(digits.length - 3)}${digits.slice(-3)}` : '•••';
  },
};

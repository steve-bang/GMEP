/**
 * Personal data never enters the audit log as a value (BA conflict resolution #2, DM-8, PDPL):
 * for these fields only the field name and a "changed" marker are kept. Applied centrally by every
 * AuditLog implementation, so a use case cannot forget it.
 */
export const PII_AUDIT_FIELDS: ReadonlySet<string> = new Set([
  'phone',
  'address',
  'email',
  'idNumber',
  'password',
  'passwordHash',
  'token',
]);

export const CHANGED_MARK = '[đã đổi]';

type Rec = Record<string, unknown> | null;

export function sanitizeAuditValues(
  before: Rec,
  after: Rec,
): { before: Rec; after: Rec; piiChanged: string[] } {
  const piiChanged = new Set<string>();
  const clean = (rec: Rec, other: Rec): Rec => {
    if (!rec) return rec;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (PII_AUDIT_FIELDS.has(k)) {
        if (v !== undefined && JSON.stringify(v) !== JSON.stringify(other?.[k])) {
          out[k] = CHANGED_MARK;
          piiChanged.add(k);
        }
      } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        out[k] = clean(v as Record<string, unknown>, (other?.[k] as Rec) ?? null);
      } else out[k] = v;
    }
    return out;
  };
  return { before: clean(before, after), after: clean(after, before), piiChanged: [...piiChanged] };
}

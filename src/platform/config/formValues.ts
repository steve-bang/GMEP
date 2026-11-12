import { parsePercentToBp } from '@/platform/format/percent';
import { parseVndInput } from '@/platform/format/vnd';
import { applyPayloadShape, type PayloadShape } from './payloadShape';

/**
 * Typed form values -> API payload for the generic config form (FR-SYS-004). Pure, so the client form and the
 * unit tests run the very same code. It only converts and rejects text that is not a number / time / list; every
 * business bound (min, max, refinements) stays in the type's zod schema on the server (NFR-MNT-01).
 */
export type FieldKind =
  | 'text'
  | 'vnd'
  | 'int'
  | 'percent'
  | 'select'
  | 'bool'
  /** set of options ticked as checkboxes -> array (numbers when `numeric`) */
  | 'multi'
  /** HH:MM (24:00 allowed as end of day) -> minute of the day */
  | 'time'
  /** comma separated whole numbers -> number[] */
  | 'intList';

export interface FormFieldSpec {
  name: string;
  kind: FieldKind;
  /** an empty box is left out of the payload (the server then applies its documented default) */
  optional?: boolean;
  /** multi: option values are whole numbers (for example weekdays) */
  numeric?: boolean;
}

export type FieldErrorKind = 'percent' | 'number' | 'time' | 'list' | 'pick';
export type RawFormValues = Record<string, string | string[] | undefined>;

export function parseTimeToMinute(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && total <= 1440 ? total : null;
}

const WHOLE = /^\d{1,9}$/;

export function buildConfigPayload(
  fields: readonly FormFieldSpec[],
  raw: RawFormValues,
  shape?: PayloadShape,
): { payload: Record<string, unknown>; errors: Record<string, FieldErrorKind> } {
  const values: Record<string, unknown> = {};
  const errors: Record<string, FieldErrorKind> = {};
  for (const x of fields) {
    const r = raw[x.name];
    if (x.kind === 'multi') {
      const picked = Array.isArray(r) ? r : r ? [r] : [];
      if (picked.length === 0) {
        if (!x.optional) errors[x.name] = 'pick';
        continue;
      }
      values[x.name] = x.numeric ? picked.map(Number) : picked;
      continue;
    }
    const s = (Array.isArray(r) ? (r[0] ?? '') : (r ?? '')).trim();
    if (x.optional && s === '') continue; // never send an empty optional field
    if (x.kind === 'percent') {
      const bp = parsePercentToBp(s);
      if (bp === null) errors[x.name] = 'percent';
      values[x.name] = bp;
    } else if (x.kind === 'vnd' || x.kind === 'int') {
      const n = x.kind === 'vnd' ? parseVndInput(s) : WHOLE.test(s) ? Number(s) : null;
      if (n === null || n < 0) errors[x.name] = 'number';
      values[x.name] = n;
    } else if (x.kind === 'time') {
      const n = parseTimeToMinute(s);
      if (n === null) errors[x.name] = 'time';
      values[x.name] = n;
    } else if (x.kind === 'intList') {
      const parts = s.split(/[\s,;]+/).filter(Boolean);
      if (parts.length === 0 || !parts.every((p) => WHOLE.test(p))) errors[x.name] = 'list';
      values[x.name] = parts.map(Number);
    } else if (x.kind === 'bool') values[x.name] = s === 'true';
    else values[x.name] = s;
  }
  return { payload: applyPayloadShape(shape, values), errors };
}

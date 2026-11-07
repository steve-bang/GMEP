import { maskAddress, maskPhone, type PiiLevel } from '@/platform/pii/pii';

/**
 * Staff record (FR-HRM-001). It is NOT the login account: `userId` links the two (BR: a person working in two
 * tenants is two records). No salary, bank account or insurance data is kept (BRD §4, FR-HRM scope).
 */
export type EmployeeStatus = 'active' | 'on_leave' | 'left';
export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = ['active', 'on_leave', 'left'];

/** Position over time (G3-HRM-02 "Chi nhánh và chức danh theo thời gian"); `to` null = current. Dates are yyyy-MM-dd. */
export interface PositionStint {
  positionCode: string;
  from: string;
  to: string | null;
}

export interface Certificate {
  name: string;
  issuer?: string;
  /** yyyy-MM-dd */
  expiresOn?: string;
}

export interface Employee {
  id: string;
  tenantId: string;
  /** the branch the person works in now; a transfer is slice 2.6b (FR-HRM-002) */
  branchId: string;
  /** unique inside the tenant (RULE-018); never a login identifier */
  code: string;
  fullName: string;
  nameNorm: string;
  status: EmployeeStatus;
  positionCode: string;
  positions: PositionStint[];
  /** yyyy-MM-dd */
  joinedOn: string;
  leftOn: string | null;
  leftReason: string | null;
  /** linked login account (membership id) or null */
  userId: string | null;
  certificates: Certificate[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** Sensitive fields live in their own document so lists and labor never carry them (same split as `customerPii`). */
export interface EmployeePii {
  id: string;
  tenantId: string;
  branchId: string;
  phone: string | null;
  nationalId: string | null;
  address: string | null;
  /** yyyy-MM-dd */
  birthDate: string | null;
}

/** `employeeCodes/<tenantId>__<code>`: create-only slot that makes the code unique in the tenant. */
export const employeeCodeSlotId = (tenantId: string, code: string): string =>
  `${tenantId}__${code.toUpperCase()}`;

/** Position in force on a date (yyyy-MM-dd); the stints never overlap. */
export function positionOn(e: Pick<Employee, 'positions' | 'positionCode'>, date: string): string {
  const s = e.positions.find((p) => p.from <= date && (p.to === null || date <= p.to));
  return s?.positionCode ?? e.positionCode;
}

/** Closes the open stint the day before `from` and opens a new one (history is never edited). */
export function changePosition(
  positions: readonly PositionStint[],
  positionCode: string,
  from: string,
): PositionStint[] {
  const open = positions.find((p) => p.to === null);
  if (open && open.positionCode === positionCode) return [...positions];
  if (open && from <= open.from)
    throw new RangeError('position change must start after the open stint');
  const closed = positions.map((p) => (p.to === null ? { ...p, to: dayBefore(from) } : p));
  return [...closed, { positionCode, from, to: null }];
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ---- personal data by role (ba-answers-04 Phụ lục D) ---------------------------------------------------

export type EmployeePiiField = 'phone' | 'nationalId' | 'address' | 'birthDate';
export const EMPLOYEE_PII_FIELDS: readonly EmployeePiiField[] = [
  'phone',
  'nationalId',
  'address',
  'birthDate',
];

/**
 * The DEFAULT policy of Phụ lục D as data [Đề xuất BA - chờ xác nhận: Khách]: role -> level per field. `reveal_reason`
 * is not used here (Appendix D has "Hiện" with or without a reason in the customer table only). A role missing from the
 * table sees nothing. The record of the person's own account is handled apart (`own`).
 * "NS" (nhân sự) is a role the BA proposed but the ten-role matrix does not have; it is listed so that adding the
 * role later needs no code change (Q: how is "NS" realised?).
 */
export type EmployeePiiPolicy = Record<string, Record<EmployeePiiField, PiiLevel>>;
export const DEFAULT_EMPLOYEE_PII_POLICY: EmployeePiiPolicy = {
  NS: { phone: 'full', nationalId: 'full', address: 'full', birthDate: 'full' },
  QL: { phone: 'full', nationalId: 'reveal', address: 'full', birthDate: 'full' },
  CH: { phone: 'reveal', nationalId: 'reveal', address: 'reveal', birthDate: 'masked' },
  QV: { phone: 'reveal', nationalId: 'reveal', address: 'reveal', birthDate: 'masked' },
  KT: { phone: 'masked', nationalId: 'hidden', address: 'hidden', birthDate: 'hidden' },
};

const OPENNESS: PiiLevel[] = ['hidden', 'masked', 'reveal_reason', 'reveal', 'full'];

export function employeePiiLevel(
  roleCodes: readonly string[],
  field: EmployeePiiField,
  own: boolean,
  table: EmployeePiiPolicy = DEFAULT_EMPLOYEE_PII_POLICY,
): PiiLevel {
  if (own) return 'full';
  let best: PiiLevel = 'hidden';
  for (const r of roleCodes) {
    const l = table[r]?.[field];
    if (l && OPENNESS.indexOf(l) > OPENNESS.indexOf(best)) best = l;
  }
  return best;
}

/** `•••••••• 234`: the last three digits only (Phụ lục D). */
export const maskNationalId = (v: string): string =>
  v.length <= 3 ? '•••' : `${'•'.repeat(Math.min(8, v.length - 3))} ${v.slice(-3)}`;

/** Birth date masked down to the year. */
export const maskBirthDate = (v: string): string => `••/••/${v.slice(0, 4)}`;

export function maskEmployeeField(field: EmployeePiiField, value: string): string {
  switch (field) {
    case 'phone':
      return maskPhone(value);
    case 'address':
      return maskAddress(value);
    case 'nationalId':
      return maskNationalId(value);
    case 'birthDate':
      return maskBirthDate(value);
  }
}

export interface PresentedEmployeeField {
  /** undefined = hidden (the key is not sent at all) */
  value?: string;
  masked: boolean;
  /** the "Hiện" button */
  reveal: boolean;
}

export function presentEmployeeField(
  level: PiiLevel,
  field: EmployeePiiField,
  value: string | null,
): PresentedEmployeeField | null {
  if (value === null || value === '') return null;
  switch (level) {
    case 'full':
      return { value, masked: false, reveal: false };
    case 'hidden':
      return { masked: true, reveal: false };
    case 'masked':
      return { value: maskEmployeeField(field, value), masked: true, reveal: false };
    case 'reveal':
    case 'reveal_reason':
      return { value: maskEmployeeField(field, value), masked: true, reveal: true };
  }
}

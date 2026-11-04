import { describe, expect, it } from 'vitest';
import {
  addDays,
  anonymizedPatch,
  ANONYMIZED_NAME,
  canTransition,
  currentOwnership,
  dueAtFor,
  filterMarketingAudience,
  isOverdue,
  isPlausiblePhone,
  isPlausiblePlate,
  isValidTaxCode,
  isValidVin,
  marketingChannelsOf,
  maskIdentifier,
  normalizePhone,
  normalizePlate,
  ownerOn,
  planOwnerChange,
  searchMode,
  toHistoryDto,
  type Consent,
  type Ownership,
  type VehicleHistoryEntry,
} from '@/modules/crm';
import { defaultRoleSeeds } from '@/modules/sys';

const own = (
  o: Partial<Ownership> & Pick<Ownership, 'id' | 'customerId' | 'from' | 'to'>,
): Ownership => ({
  companyId: 'c',
  vehicleId: 'v',
  branchId: 'b',
  createdAt: new Date(0),
  createdBy: 'u',
  ...o,
});
const consent = (o: Partial<Consent>): Consent => ({
  id: 'x',
  companyId: 'c',
  branchId: 'b',
  customerId: 'k',
  purpose: 'marketing',
  channel: 'zalo',
  basis: 'consent',
  status: 'granted',
  grantedAt: new Date(0),
  createdBy: 'u',
  version: 1,
  ...o,
});

describe('FR-CRM-002 plate and identity normalisation', () => {
  it('normalises plates for uniqueness whatever the typing style', () => {
    for (const raw of ['51H-123.45', '51h 123 45', ' 51H12345 ', '51Ḥ-123.45'])
      expect(normalizePlate(raw)).toBe('51H12345');
    expect(normalizePlate('59-X1 123.45')).toBe('59X112345');
  });
  it('accepts real plate shapes and rejects junk', () => {
    expect(isPlausiblePlate('51H12345')).toBe(true);
    expect(isPlausiblePlate('59X112345')).toBe(true);
    expect(isPlausiblePlate('12345')).toBe(false); // digits only
    expect(isPlausiblePlate('ABCDE')).toBe(false); // letters only
    expect(isPlausiblePlate('51H1')).toBe(false);
  });
  it('normalises Vietnamese phone numbers', () => {
    expect(normalizePhone('+84 912 345 678')).toBe('0912345678');
    expect(normalizePhone('0912.345.678')).toBe('0912345678');
    expect(normalizePhone('84912345678')).toBe('0912345678');
    expect(isPlausiblePhone('0912345678')).toBe(true);
    expect(isPlausiblePhone('912345678')).toBe(false);
  });
  it('validates tax code (MST) and VIN', () => {
    expect(isValidTaxCode('0312345678')).toBe(true);
    expect(isValidTaxCode('0312345678-001')).toBe(true);
    expect(isValidTaxCode('03123456')).toBe(false);
    expect(isValidVin('JTDBR32E720123456')).toBe(true);
    expect(isValidVin('JTDBR32E72012345O')).toBe(false); // O is not allowed
    expect(maskIdentifier('JTDBR32E720123456')).toBe('•••••••••••••3456');
  });
  it('search mode follows the shape of the text', () => {
    expect(searchMode('0912 345')).toBe('phone');
    expect(searchMode('51H-123')).toBe('plate');
    expect(searchMode('29a678')).toBe('plate');
    expect(searchMode('Nguyễn Văn')).toBe('name');
    expect(searchMode('Công ty 3T')).toBe('name');
  });
});

describe('FR-CRM-014 / UAT-18 effective-dated ownership', () => {
  const history = [
    own({ id: 'o1', customerId: 'A', from: '2020-01-01', to: '2023-05-31' }),
    own({ id: 'o2', customerId: 'B', from: '2023-06-01', to: null }),
  ];
  it('current owner is the open record', () => {
    expect(currentOwnership(history)?.customerId).toBe('B');
  });
  it('owner on a date follows the history, so old repairs keep their owner', () => {
    expect(ownerOn(history, '2021-07-04')?.customerId).toBe('A');
    expect(ownerOn(history, '2023-05-31')?.customerId).toBe('A');
    expect(ownerOn(history, '2023-06-01')?.customerId).toBe('B');
    expect(ownerOn(history, '2019-12-31')).toBeNull();
  });
  it('a change closes the previous record the day before and never overlaps', () => {
    const r = planOwnerChange(history, { newCustomerId: 'C', effectiveDate: '2026-10-01' });
    expect(r).toEqual({
      ok: true,
      plan: { closeId: 'o2', closeTo: '2026-09-30', openFrom: '2026-10-01' },
    });
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });
  it('rejects same owner, a date not after the current start, and a vehicle without open owner', () => {
    expect(planOwnerChange(history, { newCustomerId: 'B', effectiveDate: '2026-10-01' })).toEqual({
      ok: false,
      error: 'same_owner',
    });
    expect(planOwnerChange(history, { newCustomerId: 'C', effectiveDate: '2023-06-01' })).toEqual({
      ok: false,
      error: 'before_current_start',
    });
    expect(
      planOwnerChange([history[0]!], { newCustomerId: 'C', effectiveDate: '2026-10-01' }),
    ).toEqual({
      ok: false,
      error: 'no_current_owner',
    });
  });
});

describe('FR-CRM-010 / FR-CRM-013 consent and marketing filter', () => {
  it('only an active consent-based marketing record authorises advertising per channel', () => {
    expect(marketingChannelsOf([consent({})])).toEqual(['zalo']);
    expect(marketingChannelsOf([consent({ status: 'withdrawn' })])).toEqual([]);
    expect(marketingChannelsOf([consent({ basis: 'legitimate_interest' })])).toEqual([]);
    expect(marketingChannelsOf([consent({ purpose: 'reminder' })])).toEqual([]);
    expect(marketingChannelsOf([consent({ channel: 'in_person' })])).toEqual([]);
    expect(
      marketingChannelsOf([
        consent({}),
        consent({ id: 'y', channel: 'sms' }),
        consent({ id: 'z', channel: 'zalo' }),
      ]),
    ).toEqual(['sms', 'zalo']);
  });
  it('the campaign helper drops customers without consent and reports the count', () => {
    const snap = new Map([
      ['a', { status: 'active' as const, marketing: ['zalo'] }],
      ['b', { status: 'active' as const, marketing: ['sms'] }],
      ['c', { status: 'anonymized' as const, marketing: ['zalo'] }],
    ]);
    const r = filterMarketingAudience(['a', 'b', 'c', 'd', 'a'], snap, 'zalo');
    expect(r.eligible).toEqual(['a']);
    expect(r.excluded).toEqual([
      { customerId: 'b', reason: 'no_consent' },
      { customerId: 'c', reason: 'anonymized' },
      { customerId: 'd', reason: 'not_found' },
    ]);
  });
});

describe('FR-CRM-011 data-subject request state machine', () => {
  it('only allowed transitions; closed states are final', () => {
    expect(canTransition('received', 'in_progress')).toBe(true);
    expect(canTransition('received', 'completed')).toBe(false); // must be taken into work first
    expect(canTransition('in_progress', 'completed')).toBe(true);
    expect(canTransition('completed', 'rejected')).toBe(false);
    expect(canTransition('rejected', 'in_progress')).toBe(false);
  });
  it('deadline is configuration and overdue ignores closed requests', () => {
    const at = new Date('2026-11-01T00:00:00Z');
    expect(dueAtFor(at, 72).toISOString()).toBe('2026-11-04T00:00:00.000Z');
    const later = new Date('2026-11-05T00:00:00Z');
    expect(isOverdue({ status: 'in_progress', dueAt: dueAtFor(at, 72) }, later)).toBe(true);
    expect(isOverdue({ status: 'completed', dueAt: dueAtFor(at, 72) }, later)).toBe(false);
  });
  it('anonymisation erases the name unless legal identity must stay', () => {
    const c = { name: 'Công ty A', nameNorm: 'cong ty a', taxCode: '0312345678' };
    expect(anonymizedPatch(c, false)).toMatchObject({
      name: ANONYMIZED_NAME,
      status: 'anonymized',
      taxCode: null,
    });
    expect(anonymizedPatch(c, true)).toMatchObject({ name: 'Công ty A', nameNorm: 'cong ty a' });
  });
});

describe('FR-CRM-004 history projection', () => {
  const e: VehicleHistoryEntry = {
    id: 'ro:1',
    companyId: 'c',
    vehicleId: 'v',
    branchId: 'b',
    branchName: 'Q7',
    orderCode: 'RO-1',
    date: '2026-01-01',
    items: ['Thay dầu'],
    parts: [{ name: 'Lọc dầu', qty: 1 }],
    totalVnd: 500000,
    projectedAt: new Date(0),
  };
  it('price is shown only when the client allows it [Cần xác nhận]', () => {
    expect(toHistoryDto(e, true).totalVnd).toBe(500000);
    expect(toHistoryDto(e, false).totalVnd).toBeNull();
  });
  it('the DTO exposes only white-listed fields', () => {
    expect(Object.keys(toHistoryDto(e, true)).sort()).toEqual(
      ['branchName', 'date', 'id', 'items', 'km', 'orderCode', 'parts', 'totalVnd'].sort(),
    );
  });
});

describe('default CRM permission matrix (FR-CRM-017, NFR-SEC-03, BA §2.4/§9)', () => {
  const perms = (code: string) =>
    new Set(defaultRoleSeeds().find((r) => r.code === code)!.permissions);
  it('only CH, QV, QL, KT may export customers; only CH and KT may export full personal columns', () => {
    const exporters = defaultRoleSeeds()
      .filter((r) => r.permissions.includes('customer:export'))
      .map((r) => r.code);
    expect(exporters.sort()).toEqual(['CH', 'KT', 'QL', 'QV']);
    const pii = defaultRoleSeeds()
      .filter((r) => r.permissions.includes('customer-pii:export'))
      .map((r) => r.code);
    expect(pii.sort()).toEqual(['CH', 'KT']);
  });
  it('system admin, mechanic and storekeeper have no customer data', () => {
    for (const code of ['AD', 'TH', 'TK'])
      expect(
        [...perms(code)].filter((p) => /^(customer|vehicle|consent|data-request)/.test(p)),
      ).toEqual([]);
  });
  it('only the owner approves a data-subject deletion', () => {
    const approvers = defaultRoleSeeds()
      .filter((r) => r.permissions.includes('data-request:approve'))
      .map((r) => r.code);
    expect(approvers).toEqual(['CH']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildWarrantyRecord,
  STRICT_WARRANTY_POLICY,
  warrantyExpiry,
  warrantyRecordId,
  warrantyStatus,
} from '@/modules/rec';

/** FR-REC-018 / FR-CRM-016: warranty term arithmetic. Terms are SAMPLE values (minh họa), the client's are open (Q77). */
describe('FR-REC-018 warranty expiry and status', () => {
  it('days and km from the handover day and odometer; 0 = no limit of that kind', () => {
    expect(warrantyExpiry('2026-11-06', 20_000, { days: 90, km: 5000 })).toEqual({
      expiresOn: '2027-02-04',
      expiresAtKm: 25_000,
    });
    expect(warrantyExpiry('2026-11-06', 20_000, { days: 0, km: 5000 })).toEqual({
      expiresOn: null,
      expiresAtKm: 25_000,
    });
    expect(warrantyExpiry('2026-11-06', null, { days: 30, km: 1000 })).toEqual({
      expiresOn: '2026-12-06',
      expiresAtKm: null,
    });
    expect(warrantyExpiry('2026-11-06', 1, null)).toEqual({ expiresOn: null, expiresAtKm: null });
  });

  it('valid through the last day, expired after it or past the km; no term = none (nothing assumed)', () => {
    const item = { expiresOn: '2027-02-04', expiresAtKm: 25_000, termVersionId: 'v1' };
    expect(warrantyStatus(item, '2027-02-04', 24_999)).toBe('valid');
    expect(warrantyStatus(item, '2027-02-05', 21_000)).toBe('expired');
    expect(warrantyStatus(item, '2027-01-01', 25_001)).toBe('expired');
    expect(warrantyStatus(item, '2027-01-01', null)).toBe('valid');
    expect(
      warrantyStatus({ expiresOn: null, expiresAtKm: null, termVersionId: null }, '2030-01-01', 0),
    ).toBe('none');
  });

  it('FR-REC-036 / P4: the record id is deterministic and does not reveal the order id; Q77 strict default', () => {
    const id = warrantyRecordId('tnt_a', 'ro_123');
    expect(id).toBe(warrantyRecordId('tnt_a', 'ro_123'));
    expect(id).not.toContain('ro_123');
    expect(warrantyRecordId('tnt_b', 'ro_123')).not.toBe(id);
    expect(STRICT_WARRANTY_POLICY).toEqual({
      crossBranchOpen: false,
      costBearer: 'performing_branch',
    });
    const r = buildWarrantyRecord({
      tenantId: 'tnt_a',
      vehicleId: 'v1',
      branchId: 'b1',
      branchName: 'B1',
      orderId: 'ro_123',
      orderCode: 'RO-1',
      serviceType: 'maintenance',
      startDate: '2026-11-06',
      startKm: 100,
      items: [
        { id: 'it1', name: 'Thay dầu', technicianId: 'u1' },
        { id: 'it2', name: 'Phanh', technicianId: null },
      ],
      term: { days: 30, km: 0, versionId: 'cfg1' },
      createdAt: new Date('2026-11-06T00:00:00Z'),
    });
    expect(r.items.map((i) => [i.key, i.expiresOn, i.termVersionId])).toEqual([
      ['1', '2026-12-06', 'cfg1'],
      ['2', '2026-12-06', 'cfg1'],
    ]);
  });
});

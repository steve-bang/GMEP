import { describe, expect, it } from 'vitest';
import { AppError } from '@/platform/errors/errors';
import { sanitizeAuditValues } from '@/platform/audit/sanitize';
import { TtlCache } from '@/platform/cache/ttlCache';
import { assertEffectiveFrom, businessDateOf, pickEffective } from '@/platform/effective/effective';
import {
  DEFAULT_NUMBERING,
  draftReference,
  formatNumber,
  periodKey,
  type NumberingContext,
} from '@/platform/numbering/numbering';
import { PiiPolicy, maskAddress, maskEmail, maskPhone } from '@/platform/pii/pii';
import { resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import {
  BRANCH_STATE_RULES,
  CONFIG_TYPES,
  DEFAULT_PASSWORD_POLICY,
  DEFAULT_SESSION_POLICY,
  ROLE_CODES,
  assertBranchWritable,
  checkPasswordPolicy,
  defaultRoleSeeds,
  hashForHistory,
  knownPermissions,
  newOpaqueToken,
  hashToken,
  sessionLimitsFor,
  configVersionId,
} from '@/modules/sys';

describe('FR-SYS-013 / ba-answers §2 role matrix seed', () => {
  const roles = Object.fromEntries(defaultRoleSeeds().map((r) => [r.code, r]));
  it('seeds exactly the 10 FRD role codes', () => {
    expect(
      defaultRoleSeeds()
        .map((r) => r.code)
        .sort(),
    ).toEqual([...ROLE_CODES].sort());
  });
  it('fixes the old placeholder: branch manager does not create warehouses, storekeeper only views', () => {
    expect(roles.QL!.permissions).not.toContain('warehouse:create');
    expect(roles.QL!.permissions).toContain('warehouse:update');
    expect(roles.TK!.permissions).toEqual(expect.arrayContaining(['warehouse:view']));
    expect(roles.TK!.permissions.filter((p) => p.startsWith('warehouse:'))).toEqual([
      'warehouse:view',
    ]);
    expect(roles.AD!.permissions).toContain('warehouse:create');
  });
  it('system admin has no approve/reject and no customer data; owner has approve rights', () => {
    expect(roles.AD!.permissions.filter((p) => /:(approve|reject)$/.test(p))).toEqual([]);
    expect(roles.CH!.permissions).toEqual(
      expect.arrayContaining(['user:approve', 'tax-rate:approve', 'role:approve']),
    );
  });
  it('accountant maintains tax rates; branch roles see no audit export', () => {
    expect(roles.KT!.permissions).toEqual(
      expect.arrayContaining(['tax-rate:create', 'tax-rate:update']),
    );
    expect(roles.QL!.permissions).not.toContain('audit-log:export');
    expect(roles.TH!.permissions).toEqual([]);
  });
  it('only CH and QV may consolidate; every permission is a known resource:action', () => {
    expect(
      defaultRoleSeeds()
        .filter((r) => r.canConsolidate)
        .map((r) => r.code)
        .sort(),
    ).toEqual(['CH', 'QV']);
    const known = knownPermissions();
    for (const r of defaultRoleSeeds())
      for (const p of r.permissions) expect(known.has(p)).toBe(true);
  });
});

describe('FR-SYS-001 password policy (only the two documented rules)', () => {
  it('enforces minimum length and the last-5 history, nothing else', () => {
    const hist = [hashForHistory('Old-Password-1')];
    expect(checkPasswordPolicy('short', [], DEFAULT_PASSWORD_POLICY)).toEqual([
      'policy.password.min_length',
    ]);
    expect(checkPasswordPolicy('Old-Password-1', hist, DEFAULT_PASSWORD_POLICY)).toEqual([
      'policy.password.reused',
    ]);
    expect(checkPasswordPolicy('aaaaaaaaaa', [], DEFAULT_PASSWORD_POLICY)).toEqual([]); // no invented complexity rules
    expect(checkPasswordPolicy('garage-quan7-mua-thu', hist, DEFAULT_PASSWORD_POLICY)).toEqual([]);
  });
  it('history depth and length come from configuration', () => {
    const hist = [hashForHistory('first-password-x'), hashForHistory('second-password-x')];
    expect(
      checkPasswordPolicy('second-password-x', hist, { minLength: 10, historyDepth: 1 }),
    ).toEqual([]);
    expect(
      checkPasswordPolicy('second-password-x', hist, { minLength: 10, historyDepth: 2 }),
    ).toEqual(['policy.password.reused']);
    expect(checkPasswordPolicy('twelve-chars', [], { minLength: 14, historyDepth: 5 })).toEqual([
      'policy.password.min_length',
    ]);
  });
  it('tokens are 256-bit, stored hashed and differ each time', () => {
    const a = newOpaqueToken();
    const b = newOpaqueToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.raw.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a.raw)).toBe(a.id);
    expect(a.id).not.toContain(a.raw);
  });
});

describe('ba-answers §1.5 session policy per role', () => {
  it('uses BA defaults, the smallest idle for multi-role users, and a 12 h absolute limit', () => {
    expect(sessionLimitsFor(DEFAULT_SESSION_POLICY, ['QL'])).toEqual({
      idleMs: 30 * 60_000,
      absoluteMs: 12 * 3_600_000,
    });
    expect(sessionLimitsFor(DEFAULT_SESSION_POLICY, ['CH']).idleMs).toBe(15 * 60_000);
    expect(sessionLimitsFor(DEFAULT_SESSION_POLICY, ['QL', 'KT']).idleMs).toBe(15 * 60_000);
  });
});

describe('FR-SYS-011 branch state table (ba-answers §5)', () => {
  it('active allows everything; closing blocks new orders but not open ones; locked blocks writes', () => {
    expect(() => assertBranchWritable('active', 'new_order', ['QL'])).not.toThrow();
    expect(() => assertBranchWritable('closing', 'new_order', ['QL'])).toThrowError(
      expect.objectContaining({ code: 'branch_closing' }),
    );
    expect(() => assertBranchWritable('closing', 'edit_open_order', ['QL'])).not.toThrow();
    expect(() => assertBranchWritable('locked', 'edit_open_order', ['CH'])).toThrowError(
      expect.objectContaining({ code: 'branch_locked' }),
    );
  });
  it('admin_only rows let CH/AD through and nobody else', () => {
    expect(() => assertBranchWritable('closing', 'edit_master', ['AD'])).not.toThrow();
    expect(() => assertBranchWritable('closing', 'edit_master', ['QL'])).toThrow(AppError);
  });
  it('is configuration: a custom table changes the behaviour without code changes', () => {
    const custom = {
      ...BRANCH_STATE_RULES,
      closing: { ...BRANCH_STATE_RULES.closing, new_order: true },
    };
    expect(() => assertBranchWritable('closing', 'new_order', ['QL'], custom)).not.toThrow();
  });
});

describe('NFR-SEC-03 PII policy and masks (ba-answers §7)', () => {
  const as = (...roleCodes: string[]) => ({
    assignments: roleCodes.map((r) => ({ roleCode: r, branchId: 'b' })),
  });
  const pii = new PiiPolicy();
  it('mask formats', () => {
    expect(maskPhone('0901 234 567')).toBe('09•• ••• 567');
    expect(maskEmail('ha.nguyen@gmail.com')).toBe('h•••@gmail.com');
    expect(maskAddress('12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM')).toBe(
      '••••••, Quận 1, TP.HCM',
    );
  });
  it('levels per role; the full value is never present for masked/hidden levels', () => {
    expect(pii.present(as('CV'), 'phone', '0901234567')).toEqual({
      value: '0901234567',
      masked: false,
      reveal: 'none',
    });
    expect(pii.present(as('CH'), 'phone', '0901234567')).toMatchObject({
      value: '09•• ••• 567',
      masked: true,
      reveal: 'plain',
    });
    expect(pii.present(as('KT'), 'phone', '0901234567').reveal).toBe('reason');
    expect(pii.present(as('TK'), 'phone', '0901234567')).toMatchObject({
      masked: true,
      reveal: 'none',
    });
    expect(pii.present(as('TK'), 'address', '1 A, B, C')).toEqual({
      value: undefined,
      masked: true,
      reveal: 'none',
    });
    expect(pii.present(as('TH'), 'phone', '0901234567').value).toBeUndefined();
    expect(pii.present(as('AD'), 'phone', '0901234567').value).toBeUndefined();
    expect(pii.present(as('???'), 'phone', '0901234567').value).toBeUndefined(); // unknown role: fail closed
  });
  it('multi-role users get the union (most open level)', () => {
    expect(pii.present(as('TK', 'QL'), 'phone', '0901234567').masked).toBe(false);
  });
  it('policy is a table: a client decision changes data, not code', () => {
    const strict = new PiiPolicy({ CV: { phone: 'masked', email: 'masked', address: 'masked' } });
    expect(strict.present(as('CV'), 'phone', '0901234567').masked).toBe(true);
  });
});

describe('FR-SYS-003 audit never stores personal values (BA conflict resolution #2)', () => {
  it('replaces PII fields by a changed marker and keeps the field name', () => {
    const r = sanitizeAuditValues(
      { name: 'A', phone: '0901234567' },
      { name: 'B', phone: '0912345678', address: 'x' },
    );
    expect(JSON.stringify(r)).not.toMatch(/0901234567|0912345678|"x"/);
    expect(r.after).toMatchObject({ name: 'B', phone: '[đã đổi]', address: '[đã đổi]' });
    expect(r.piiChanged.sort()).toEqual(['address', 'phone']);
  });
  it('unchanged PII is not mentioned; nested objects are cleaned too', () => {
    const r = sanitizeAuditValues({ phone: '1' }, { phone: '1', nested: { email: 'a@b.c' } });
    expect(r.after).not.toHaveProperty('phone');
    expect(JSON.stringify(r.after)).not.toContain('a@b.c');
  });
});

describe('BA-13 numbering rules (ba-answers §6)', () => {
  const ctx = (docType: string, date: string, seqWidth?: number): NumberingContext => ({
    companyId: 'c',
    branchId: 'b',
    branchCode: 'Q7',
    docType,
    businessDate: date,
    series: { ...DEFAULT_NUMBERING[docType]!, ...(seqWidth ? { seqWidth } : {}) },
  });
  it('format LOẠI-MÃCN-YYMM-STT with a period from the businessDate', () => {
    expect(formatNumber(ctx('repair-order', '2026-11-03'), 7)).toBe('RO-Q7-2611-00007');
    expect(formatNumber(ctx('receipt-voucher', '2026-12-31'), 12)).toBe('PT-Q7-2612-00012');
  });
  it('the sequence grows beyond the width instead of truncating', () => {
    expect(formatNumber(ctx('quote', '2026-01-02'), 100000)).toBe('BG-Q7-2601-100000');
  });
  it('groups: operative documents are group A (relaxed), accounting/stock/cash are group B (strict)', () => {
    for (const t of ['repair-order', 'quote', 'intake', 'appointment'])
      expect(DEFAULT_NUMBERING[t]).toMatchObject({ group: 'A', gapPolicy: 'relaxed' });
    for (const t of ['receipt-voucher', 'goods-receipt', 'goods-issue', 'stock-transfer'])
      expect(DEFAULT_NUMBERING[t]).toMatchObject({ group: 'B', gapPolicy: 'strict' });
  });
  it('period reset is configuration (month/year/none)', () => {
    const s = DEFAULT_NUMBERING['repair-order']!;
    expect(periodKey({ ...s, period: 'year' }, '2026-05-01')).toBe('26');
    expect(periodKey({ ...s, period: 'none' }, '2026-05-01')).toBe('ALL');
    expect(() => periodKey(s, 'not-a-date')).toThrow(AppError);
  });
  it('drafts of group B carry a temporary reference, not a number', () => {
    expect(draftReference('abc-123-def-456')).toMatch(/^NHAP-[A-Z0-9]{1,8}$/);
  });
});

describe('FR-SYS-004 effective-dated configuration rules', () => {
  const v = (
    id: string,
    effectiveFrom: string,
    status: 'approved' | 'pending' | 'rejected' = 'approved',
  ) => ({ id, effectiveFrom, status, payload: {} });
  it('picks the approved version with the greatest effectiveFrom not after the date', () => {
    const versions = [
      v('a', '2026-01-01'),
      v('b', '2027-01-01'),
      v('c', '2026-06-01', 'pending'),
      v('d', '2026-03-01', 'rejected'),
    ];
    expect(pickEffective(versions, '2025-12-31')).toBeNull();
    expect(pickEffective(versions, '2026-07-01')?.id).toBe('a');
    expect(pickEffective(versions, '2027-01-01')?.id).toBe('b');
  });
  it('rejects past or impossible effective dates', () => {
    expect(() => assertEffectiveFrom('2026-10-31', '2026-11-01')).toThrowError(
      expect.objectContaining({ code: 'config_effective_in_past' }),
    );
    expect(() => assertEffectiveFrom('2026-02-30', '2026-01-01')).toThrow(AppError);
    expect(() => assertEffectiveFrom('2026-11-01', '2026-11-01')).not.toThrow();
  });
  it('business date uses Asia/Ho_Chi_Minh, not UTC', () => {
    expect(businessDateOf(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
  });
  it('every type has a payload schema that rejects floats for money and rates', () => {
    expect(CONFIG_TYPES['tax-rate']!.payload.safeParse({ name: 'x', rateBp: 8.5 }).success).toBe(
      false,
    );
    expect(CONFIG_TYPES['tax-rate']!.payload.safeParse({ name: 'x', rateBp: 800 }).success).toBe(
      true,
    );
    expect(
      CONFIG_TYPES['price-item']!.payload.safeParse({ name: 'x', costVnd: 1.5, listPriceVnd: 2 })
        .success,
    ).toBe(false);
  });
  it('version ids are deterministic per (type, scope, date)', () => {
    expect(configVersionId('labor-rate', 'branch:br_q7', '2027-01-01')).toBe(
      'labor-rate__branch~br_q7__2027-01-01',
    );
  });
});

describe('H1 TtlCache', () => {
  it('expires entries, invalidates by tag and bounds its size', () => {
    let now = 1000;
    const c = new TtlCache<string>(30_000, () => now, 3);
    c.set('a', 'A', ['user:1']);
    c.set('b', 'B', ['user:2']);
    expect(c.get('a')).toBe('A');
    expect(c.invalidateTag('user:1')).toBe(1);
    expect(c.get('a')).toBeUndefined();
    now += 30_001;
    expect(c.get('b')).toBeUndefined();
    for (const k of ['1', '2', '3', '4']) c.set(k, k);
    expect(c.size).toBeLessThanOrEqual(3);
  });
  it('ttl 0 disables caching', () => {
    const c = new TtlCache<string>(0);
    c.set('a', 'A');
    expect(c.get('a')).toBeUndefined();
  });
});

describe('BA §4 working scope resolution', () => {
  const base = (over: Partial<Actor>): Actor => ({
    userId: 'u',
    companyId: 'c',
    displayName: 'x',
    canConsolidate: false,
    workingBranchId: null,
    assignments: [
      { roleCode: 'QL', branchId: 'b1' },
      { roleCode: 'QL', branchId: 'b2' },
    ],
    rolePermissions: { QL: ['warehouse:view'], CH: ['warehouse:view'] },
    ...over,
  });
  it('multi-branch non-consolidating user must pick a branch (409 scope_required)', () => {
    expect(() => resolveWorkingScope(base({}), 'warehouse:view')).toThrowError(
      expect.objectContaining({ code: 'scope_required' }),
    );
  });
  it('a working branch narrows the scope; a branch without the permission is 403', () => {
    expect(resolveWorkingScope(base({ workingBranchId: 'b2' }), 'warehouse:view')).toMatchObject({
      kind: 'branches',
      branchIds: ['b2'],
    });
    expect(() =>
      resolveWorkingScope(base({ workingBranchId: 'b9' }), 'warehouse:view'),
    ).toThrowError(expect.objectContaining({ code: 'forbidden' }));
  });
  it('consolidating roles see the whole permitted scope without choosing', () => {
    const a = base({ canConsolidate: true, assignments: [{ roleCode: 'CH', branchId: '*' }] });
    expect(resolveWorkingScope(a, 'warehouse:view')).toMatchObject({ kind: 'all' });
  });
});

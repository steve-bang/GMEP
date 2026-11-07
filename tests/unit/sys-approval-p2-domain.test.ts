import { describe, expect, it } from 'vitest';
import {
  checkNewDelegation,
  delegationCovers,
  delegationInForce,
  escalationAction,
  reauthRequired,
  requiredLevel,
  unconfiguredLimits,
  workingMinutesBetween,
  type ApprovalDelegation,
  type WorkSchedule,
} from '@/modules/sys';

/**
 * Slice 2.5, pure rules: FR-SYS-033 (matrix: unconfigured goes to the top, accumulated spend), FR-SYS-034 (T1, T2 by
 * working time), FR-SYS-033 delegation, RULE-036. The amounts are ILLUSTRATIVE test values, not client limits.
 */
const lim = { selfMaxVnd: 500_000, level1MaxVnd: 5_000_000, dueHours: 24 };

describe('limits (RULE-011, RULE-036)', () => {
  it('RULE-036: no limit issued -> level 2 for every value, even 0 and even for a kind that may pass alone', () => {
    const u = unconfiguredLimits('expense');
    expect(u.topOnly).toBe(true);
    expect(u.level1MaxVnd).toBe(0);
    for (const v of [0, 1, 500_000, 9_999_999_999]) expect(requiredLevel('expense', v, u)).toBe(2);
  });

  it('keeps only hours-based technical fallbacks, no money number', () => {
    expect(unconfiguredLimits('day_reopen')).toMatchObject({ validHours: 2, selfMaxVnd: 0 });
    expect(unconfiguredLimits('customer_refund').level1MaxVnd).toBe(0);
  });

  it('RULE-036: the limit is compared with value + accumulated (a split spend cannot slip under it)', () => {
    expect(requiredLevel('expense', 300_000, lim, 0)).toBe(0);
    expect(requiredLevel('expense', 300_000, lim, 300_000)).toBe(1);
    expect(requiredLevel('expense', 2_000_000, lim, 3_000_001)).toBe(2);
    expect(() => requiredLevel('expense', 1, lim, -1)).toThrow();
    expect(() => requiredLevel('expense', 1, lim, 0.5)).toThrow();
  });

  it('R106 as configuration: the flag wins over the legacy list; silent config falls back to it', () => {
    expect(reauthRequired('day_reopen', lim)).toBe(true);
    expect(reauthRequired('expense', lim)).toBe(false);
    expect(reauthRequired('expense', { ...lim, reauthOnApprove: true })).toBe(true);
    expect(reauthRequired('day_reopen', { ...lim, reauthOnApprove: false })).toBe(false);
  });
});

describe('working time (FR-SYS-034)', () => {
  // Mon-Fri 08:00-17:00 local (UTC+7)
  const s: WorkSchedule = { days: [1, 2, 3, 4, 5], startMinute: 480, endMinute: 1020 };
  const at = (iso: string) => new Date(iso);
  it('counts only the window of working days', () => {
    // Monday 2026-11-02 16:00 to 18:00 local = 09:00 to 11:00 UTC: only the hour until 17:00 counts
    expect(workingMinutesBetween(at('2026-11-02T09:00:00Z'), at('2026-11-02T11:00:00Z'), s)).toBe(
      60,
    );
    // Friday 16:00 local to Monday 09:00 local: 1 h Friday + 1 h Monday
    expect(workingMinutesBetween(at('2026-11-06T09:00:00Z'), at('2026-11-09T02:00:00Z'), s)).toBe(
      120,
    );
    // a Sunday has no working time
    expect(workingMinutesBetween(at('2026-11-08T00:00:00Z'), at('2026-11-08T12:00:00Z'), s)).toBe(
      0,
    );
  });
  it('no schedule in force = wall-clock time; reversed range = 0', () => {
    expect(
      workingMinutesBetween(at('2026-11-02T00:00:00Z'), at('2026-11-02T02:00:00Z'), null),
    ).toBe(120);
    expect(
      workingMinutesBetween(at('2026-11-02T02:00:00Z'), at('2026-11-02T00:00:00Z'), null),
    ).toBe(0);
  });
});

describe('reminder and escalation (FR-SYS-015, FR-SYS-034)', () => {
  const l = { dueHours: 24, escalateAfterHours: 48 };
  const pending = { status: 'pending' as const, level: 1 as const };
  it('nothing before T1; one reminder after T1; escalation after T1 + T2; each once', () => {
    expect(escalationAction(pending, l, 24 * 60 - 1)).toBe('none');
    expect(escalationAction(pending, l, 24 * 60)).toBe('remind');
    expect(escalationAction({ ...pending, remindedAt: new Date() }, l, 24 * 60)).toBe('none');
    expect(escalationAction({ ...pending, remindedAt: new Date() }, l, 72 * 60)).toBe('escalate');
    expect(escalationAction(pending, l, 72 * 60)).toBe('escalate');
    expect(escalationAction({ ...pending, escalatedAt: new Date() }, l, 100 * 60)).toBe('remind');
    expect(
      escalationAction(
        { ...pending, escalatedAt: new Date(), remindedAt: new Date() },
        l,
        100 * 60,
      ),
    ).toBe('none');
  });
  it('without T2 a request is only reminded; level 2 is only reminded; decided ones are left alone', () => {
    expect(escalationAction(pending, { dueHours: 24 }, 1000 * 60)).toBe('remind');
    expect(escalationAction({ ...pending, level: 2 }, l, 1000 * 60)).toBe('remind');
    expect(escalationAction({ ...pending, status: 'approved' as never }, l, 1000 * 60)).toBe(
      'none',
    );
  });
});

describe('delegation (FR-SYS-033, RULE-036)', () => {
  const t = (iso: string) => new Date(iso);
  const d: ApprovalDelegation = {
    id: 'd1',
    tenantId: 't',
    delegatorId: 'mgr',
    delegateId: 'cv',
    kinds: ['expense'],
    branchIds: ['b1'],
    validFrom: t('2026-11-01T00:00:00Z'),
    validUntil: t('2026-11-03T00:00:00Z'),
    status: 'active',
    reason: 'nghỉ phép',
    createdAt: t('2026-11-01T00:00:00Z'),
    createdBy: 'owner',
    updatedAt: t('2026-11-01T00:00:00Z'),
    updatedBy: 'owner',
    version: 1,
  };
  const req = { kind: 'expense' as const, branchId: 'b1', requestedBy: 'tn' };
  it('the right ends at validUntil (exclusive) and when revoked', () => {
    expect(delegationInForce(d, t('2026-11-02T00:00:00Z'))).toBe(true);
    expect(delegationInForce(d, t('2026-11-03T00:00:00Z'))).toBe(false);
    expect(delegationInForce(d, t('2026-10-31T23:59:59Z'))).toBe(false);
    expect(delegationInForce({ ...d, status: 'revoked' }, t('2026-11-02T00:00:00Z'))).toBe(false);
  });
  it('covers only its kinds and branches, and never a request the delegator raised', () => {
    const now = t('2026-11-02T00:00:00Z');
    expect(delegationCovers(d, req, now)).toBe(true);
    expect(delegationCovers(d, { ...req, kind: 'day_reopen' }, now)).toBe(false);
    expect(delegationCovers(d, { ...req, branchId: 'b2' }, now)).toBe(false);
    expect(delegationCovers(d, { ...req, requestedBy: 'mgr' }, now)).toBe(false);
  });
  it('a new delegation needs two people, kinds, branches and a period in the future', () => {
    const now = t('2026-11-02T00:00:00Z');
    const base = { ...d, validFrom: now, validUntil: t('2026-11-05T00:00:00Z') };
    expect(checkNewDelegation(base, now)).toEqual({ ok: true });
    expect(checkNewDelegation({ ...base, delegateId: 'mgr' }, now)).toMatchObject({ ok: false });
    expect(checkNewDelegation({ ...base, kinds: [] }, now)).toMatchObject({ ok: false });
    expect(checkNewDelegation({ ...base, branchIds: [] }, now)).toMatchObject({ ok: false });
    expect(checkNewDelegation({ ...base, validUntil: now }, now)).toMatchObject({ ok: false });
  });
});

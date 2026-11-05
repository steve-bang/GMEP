import { describe, expect, it } from 'vitest';
import { checkOtp, decideOtpIssue, hashOtp, otpRecordExpiry, type OtpState } from '@/modules/rec';

/**
 * A4 hardening: one decision for issuing a code (run before and inside the write transaction), the soft lock lasts
 * `lockMs` (not the limiter window), a hard lock after `maxFailedTotal` wrong tries over all codes, and the TTL keeps
 * the counter. Numbers are developer proposals [Cần xác nhận: Chủ dự án].
 */
const now = new Date('2026-11-05T03:00:00Z');
const at = (ms: number) => new Date(now.getTime() + ms);
type Cur = OtpState & { resendAfter: Date };
const cur = (over: Partial<Cur> = {}): Cur => ({
  selectionHash: 'sel',
  n: 1,
  salt: 's',
  codeHash: hashOtp('s', 'L', '123456'),
  codeExpiresAt: at(240_000),
  resendAfter: at(30_000),
  attempts: 0,
  maxAttempts: 5,
  ...over,
});
const inp = { n: 1, selectionHash: 'sel', lockMs: 900_000 };

describe('decideOtpIssue', () => {
  it('no record: issue', () => {
    expect(decideOtpIssue(null, now, inp)).toEqual({ kind: 'issue' });
  });
  it('same attempt inside the cooldown with a valid code: same', () => {
    expect(decideOtpIssue(cur(), now, inp)).toEqual({ kind: 'same' });
  });
  it('another selection or version inside the cooldown: cooldown with the seconds left', () => {
    expect(decideOtpIssue(cur(), now, { ...inp, selectionHash: 'x' })).toEqual({
      kind: 'cooldown',
      retryAfterSeconds: 30,
    });
    expect(decideOtpIssue(cur(), now, { ...inp, n: 2 }).kind).toBe('cooldown');
  });
  it('same attempt after the cooldown: issue; a used code is not "same"', () => {
    expect(decideOtpIssue(cur({ resendAfter: at(-1) }), now, inp)).toEqual({ kind: 'issue' });
    expect(decideOtpIssue(cur({ consumedAt: now }), now, inp).kind).toBe('cooldown');
  });
  it('same attempt whose code expired inside the cooldown: cooldown, then issue', () => {
    const c = cur({ codeExpiresAt: at(-1) });
    expect(decideOtpIssue(c, now, inp).kind).toBe('cooldown');
    expect(decideOtpIssue({ ...c, resendAfter: at(-1) }, now, inp).kind).toBe('issue');
  });
  it('soft lock lasts lockMs, whatever the limiter window is', () => {
    const c = cur({ lockedAt: now, resendAfter: at(-1) });
    expect(decideOtpIssue(c, at(899_999), inp)).toEqual({ kind: 'locked', hard: false });
    expect(decideOtpIssue(c, at(900_000), inp).kind).toBe('issue');
    expect(decideOtpIssue(c, at(60_000), { ...inp, lockMs: 60_000 }).kind).toBe('issue');
    expect(decideOtpIssue(c, at(901_000), { ...inp, lockMs: 3_600_000 })).toEqual({
      kind: 'locked',
      hard: false,
    });
  });
  it('hard lock never releases, whatever lockMs and the time', () => {
    const c = cur({ lockedAt: now, hardLockedAt: now, resendAfter: at(-1) });
    expect(decideOtpIssue(c, at(10 * 3_600_000), inp)).toEqual({ kind: 'locked', hard: true });
    expect(decideOtpIssue(c, at(10 * 3_600_000), { ...inp, lockMs: 1 }).kind).toBe('locked');
  });
});

describe('checkOtp hard lock and the total counter', () => {
  const input = (code: string) => ({
    linkId: 'L',
    n: 1,
    selectionHash: 'sel',
    code,
    maxFailedTotal: 15,
  });
  it('a hard locked link refuses even the right code', () => {
    expect(checkOtp(cur({ hardLockedAt: now }), now, input('123456')).kind).toBe('hard_locked');
  });
  it('failedTotal carries over (missing = 0) and reaching the limit is a hard lock', () => {
    expect(checkOtp(cur(), now, input('000000'))).toMatchObject({ failedTotal: 1, hard: false });
    expect(checkOtp(cur({ failedTotal: 9 }), now, input('000000'))).toMatchObject({
      attempts: 1,
      lock: false,
      failedTotal: 10,
      hard: false,
    });
    expect(checkOtp(cur({ failedTotal: 14 }), now, input('000000'))).toMatchObject({
      attempts: 1,
      lock: true,
      failedTotal: 15,
      hard: true,
    });
  });
});

describe('otpRecordExpiry', () => {
  const codeExpiresAt = at(300_000);
  const month = 30 * 24 * 3_600_000;
  it('without failures: a day after the code expires', () => {
    expect(
      otpRecordExpiry({ codeExpiresAt, now, failedTotal: 0, failureMemoryMs: month }).getTime(),
    ).toBe(codeExpiresAt.getTime() + 86_400_000);
  });
  it('with failures: at least failureMemoryMs from now and never earlier than before', () => {
    expect(
      otpRecordExpiry({ codeExpiresAt, now, failedTotal: 1, failureMemoryMs: month }).getTime(),
    ).toBe(now.getTime() + month);
    const later = at(2 * month);
    expect(
      otpRecordExpiry({
        codeExpiresAt,
        now,
        failedTotal: 1,
        previous: later,
        failureMemoryMs: month,
      }),
    ).toEqual(later);
  });
});

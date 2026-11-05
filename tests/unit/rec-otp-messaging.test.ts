import { describe, expect, it } from 'vitest';
import { renderEmail } from '@/infrastructure/email/templates';
import { renderShortText } from '@/infrastructure/messaging/templates';
import { ChannelMessageGateway } from '@/infrastructure/messaging/messageGateway';
import { loadEnv } from '@/platform/config/env';
import { canSendServiceMessage, type Consent } from '@/modules/crm';
import { CONFIG_TYPES } from '@/modules/sys';
import {
  checkOtp,
  generateOtpCode,
  hashOtp,
  otpRequired,
  sameDigest,
  type OtpState,
} from '@/modules/rec';

/**
 * A4: one-time code on the customer's approval (QUO-04/05, R27), messaging consent (FR-CRM-010, PDPL), channel
 * availability. Thresholds here are SAMPLE numbers, not the client's [Cần xác nhận: Chủ dự án].
 */

describe('QUO-04/05 otpRequired: three levels', () => {
  it('off never asks, always asks, above_threshold asks strictly above the value', () => {
    expect(otpRequired('off', undefined, 99_000_000)).toBe(false);
    expect(otpRequired('always', undefined, 1)).toBe(true);
    expect(otpRequired('above_threshold', 5_000_000, 5_000_000)).toBe(false);
    expect(otpRequired('above_threshold', 5_000_000, 5_000_001)).toBe(true);
    expect(otpRequired('above_threshold', 5_000_000, 1_000_000)).toBe(false);
  });
  it('a missing threshold fails closed (asks for the code)', () => {
    expect(otpRequired('above_threshold', undefined, 1)).toBe(true);
  });
});

describe('QUO-04/05 one-time code', () => {
  it('is 6 digits, zero padded', () => {
    expect(generateOtpCode(() => 7)).toBe('000007');
    expect(generateOtpCode(() => 999_999)).toBe('999999');
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
  it('hash is salted and bound to the link; digests compare in constant time', () => {
    const a = hashOtp('s1', 'link-a', '123456');
    expect(a).not.toContain('123456');
    expect(hashOtp('s2', 'link-a', '123456')).not.toBe(a);
    expect(hashOtp('s1', 'link-b', '123456')).not.toBe(a);
    expect(sameDigest(a, hashOtp('s1', 'link-a', '123456'))).toBe(true);
    expect(sameDigest(a, hashOtp('s1', 'link-a', '123457'))).toBe(false);
    expect(sameDigest(a, 'zz')).toBe(false);
  });

  const now = new Date('2026-11-05T03:00:00Z');
  const state = (over: Partial<OtpState> = {}): OtpState => ({
    selectionHash: 'sel',
    n: 1,
    salt: 'salt',
    codeHash: hashOtp('salt', 'L', '123456'),
    codeExpiresAt: new Date(now.getTime() + 300_000),
    attempts: 0,
    maxAttempts: 3,
    ...over,
  });
  const input = (code: string, over = {}) => ({
    linkId: 'L',
    n: 1,
    selectionHash: 'sel',
    code,
    maxFailedTotal: 15,
    ...over,
  });

  it('accepts the right code, counts a wrong one', () => {
    expect(checkOtp(state(), now, input('123456'))).toEqual({ kind: 'ok' });
    expect(checkOtp(state(), now, input('000000'))).toEqual({
      kind: 'invalid',
      attempts: 1,
      lock: false,
      failedTotal: 1,
      hard: false,
    });
  });
  it('locks on the last allowed wrong try and stays locked even for the right code', () => {
    expect(checkOtp(state({ attempts: 2 }), now, input('000000'))).toEqual({
      kind: 'invalid',
      attempts: 3,
      lock: true,
      failedTotal: 1,
      hard: false,
    });
    expect(checkOtp(state({ attempts: 3 }), now, input('123456')).kind).toBe('locked');
    expect(checkOtp(state({ lockedAt: now }), now, input('123456')).kind).toBe('locked');
  });
  it('refuses an expired code', () => {
    const later = new Date(now.getTime() + 300_000);
    expect(checkOtp(state(), later, input('123456')).kind).toBe('expired');
  });
  it('needs a fresh code when none exists, the selection or version differs, or it was used', () => {
    expect(checkOtp(null, now, input('123456')).kind).toBe('required');
    expect(checkOtp(state(), now, input('123456', { selectionHash: 'other' })).kind).toBe(
      'required',
    );
    expect(checkOtp(state(), now, input('123456', { n: 2 })).kind).toBe('required');
    expect(checkOtp(state({ consumedAt: now }), now, input('123456')).kind).toBe('required');
  });
});

describe('FR-CRM-010 service message consent (any granted service consent, per-channel withdrawal)', () => {
  const c = (over: Partial<Consent>): Consent => ({
    id: 'c1',
    companyId: 'cmp',
    branchId: 'br',
    customerId: 'cus',
    purpose: 'service',
    channel: 'sms',
    basis: 'contract',
    status: 'granted',
    grantedAt: new Date('2026-11-01T00:00:00Z'),
    createdBy: 'u',
    version: 1,
    ...over,
  });
  it('a service consent collected in person allows sms, zalo and email', () => {
    const inPerson = [c({ channel: 'in_person' })];
    for (const ch of ['sms', 'zalo', 'email'] as const)
      expect(canSendServiceMessage(inPerson, ch)).toBe(true);
    expect(canSendServiceMessage([], 'sms')).toBe(false);
  });
  it('a service consent for one channel also allows the others (channel is not a per-channel permission)', () => {
    expect(canSendServiceMessage([c({})], 'sms')).toBe(true);
    expect(canSendServiceMessage([c({})], 'zalo')).toBe(true);
  });
  it('marketing-only or reminder-only consent never allows service messages', () => {
    for (const purpose of ['marketing', 'reminder', 'sharing'] as const)
      expect(canSendServiceMessage([c({ purpose, basis: 'consent' })], 'sms')).toBe(false);
  });
  it('a withdrawn service consent never counts as a grant', () => {
    expect(canSendServiceMessage([c({ status: 'withdrawn' })], 'sms')).toBe(false);
    expect(canSendServiceMessage([c({ status: 'withdrawn', channel: 'in_person' })], 'zalo')).toBe(
      false,
    );
  });
  it('a withdrawal for the sending channel blocks it while another channel stays allowed', () => {
    const list = [
      c({ id: 'a', channel: 'in_person' }),
      c({
        id: 'b',
        channel: 'zalo',
        status: 'withdrawn',
        withdrawnAt: new Date('2026-11-02T00:00:00Z'),
      }),
    ];
    expect(canSendServiceMessage(list, 'zalo')).toBe(false);
    expect(canSendServiceMessage(list, 'sms')).toBe(true);
    expect(canSendServiceMessage(list, 'email')).toBe(true);
  });
  it('a later granted consent for that channel lifts the block; an earlier one does not', () => {
    const withdrawn = c({
      id: 'b',
      channel: 'zalo',
      status: 'withdrawn',
      withdrawnAt: new Date('2026-11-02T00:00:00Z'),
    });
    const later = c({ id: 'g', channel: 'zalo', grantedAt: new Date('2026-11-03T00:00:00Z') });
    const earlier = c({ id: 'e', channel: 'zalo', grantedAt: new Date('2026-11-01T12:00:00Z') });
    expect(canSendServiceMessage([withdrawn, later], 'zalo')).toBe(true);
    expect(canSendServiceMessage([withdrawn, earlier], 'zalo')).toBe(false);
  });
});

describe('message templates and channel availability', () => {
  it('short text and email OTP carry the code, refuse a bad code or a non-http link', () => {
    expect(renderShortText('approval-otp', { code: '123456', expiresMinutes: '5' })).toContain(
      '123456',
    );
    expect(() => renderShortText('approval-otp', { code: '12ab56' })).toThrow();
    expect(() => renderShortText('quote-link', { link: 'javascript:1' })).toThrow();
    expect(renderShortText('quote-link', { link: 'https://x.vn/b/t' })).toContain(
      'https://x.vn/b/t',
    );
    const mail = renderEmail({ template: 'approval-otp', vars: { code: '123456' } });
    expect(mail.text).toContain('123456');
    expect(mail.html).not.toContain('href');
    const link = renderEmail({ template: 'quote-link', vars: { link: 'https://x.vn/b/t' } });
    expect(link.text).toContain('https://x.vn/b/t');
  });
  it('a channel is available only when an adapter is configured', () => {
    const adapter = { send: async () => {} };
    expect(new ChannelMessageGateway({}).availableChannels()).toEqual([]);
    expect(new ChannelMessageGateway({ email: adapter }).availableChannels()).toEqual(['email']);
    expect(new ChannelMessageGateway({ sms: adapter, email: adapter }).availableChannels()).toEqual(
      ['sms', 'email'],
    );
  });
  it('dev channels are refused in prod', () => {
    const base = {
      GMEP_ENV: 'prod',
      EMAIL_SMTP_URL: 'smtp://x',
      EMAIL_FROM: 'GMEP <a@b.vn>',
    };
    expect(() => loadEnv({ ...base, MESSAGE_DEV_CHANNELS: 'sms' })).toThrow(/MESSAGE_DEV_CHANNELS/);
    expect(() =>
      loadEnv({ ...base, GMEP_ENV: 'staging', MESSAGE_DEV_CHANNELS: 'sms,zalo' }),
    ).not.toThrow();
    expect(() =>
      loadEnv({ ...base, GMEP_ENV: 'staging', MESSAGE_DEV_CHANNELS: 'viber' }),
    ).toThrow();
  });
});

describe('quote-approval config: OTP levels', () => {
  const schema = CONFIG_TYPES['quote-approval']!.payload;
  const base = { allowDeclineRequired: true, verbalApproval: true };
  it('accepts the three levels; above_threshold needs an integer threshold', () => {
    expect(schema.safeParse({ ...base, otpMode: 'off' }).success).toBe(true);
    expect(schema.safeParse({ ...base, otpMode: 'always' }).success).toBe(true);
    expect(schema.safeParse({ ...base, otpMode: 'above_threshold' }).success).toBe(false);
    expect(
      schema.safeParse({ ...base, otpMode: 'above_threshold', otpThresholdVnd: 3_000_000 }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...base, otpMode: 'above_threshold', otpThresholdVnd: 1.5 }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...base, otpMode: 'sometimes' }).success).toBe(false);
    expect(schema.safeParse({ ...base, otpMode: 'off', otpTtlSeconds: 10 }).success).toBe(false);
  });
});

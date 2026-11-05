import { describe, expect, it } from 'vitest';
import { isQuoteExpired, quoteDuePhase, transitionQuote } from '@/modules/rec';

describe('quoteDuePhase (R10, R17: background job selection)', () => {
  const base = { status: 'sent' as const, validUntil: '2026-11-10' };
  it('R10: nothing before the reminder window, even for a sent quote', () => {
    expect(quoteDuePhase(base, '2026-11-08', 1)).toBeNull();
  });
  it('R17: reminder from validUntil minus the lead time, through the last valid day', () => {
    expect(quoteDuePhase(base, '2026-11-09', 1)).toBe('remind');
    expect(quoteDuePhase(base, '2026-11-10', 1)).toBe('remind');
    expect(quoteDuePhase(base, '2026-11-10', 0)).toBe('remind');
    expect(quoteDuePhase(base, '2026-11-09', 0)).toBeNull();
  });
  it('R10: expire only after the last valid day (same rule as isQuoteExpired)', () => {
    expect(quoteDuePhase(base, '2026-11-11', 1)).toBe('expire');
    expect(isQuoteExpired('sent', base.validUntil, '2026-11-11')).toBe(true);
    expect(quoteDuePhase(base, '2026-11-10', 1)).not.toBe('expire');
  });
  it('R17: reminded once per validUntil; a new version reminds again; month rollover works', () => {
    expect(quoteDuePhase({ ...base, remindedFor: '2026-11-10' }, '2026-11-10', 1)).toBeNull();
    expect(quoteDuePhase({ ...base, remindedFor: '2026-11-03' }, '2026-11-10', 1)).toBe('remind');
    expect(quoteDuePhase({ status: 'sent', validUntil: '2026-12-01' }, '2026-11-30', 1)).toBe(
      'remind',
    );
  });
  it('R10: draft, decided, already expired or without validity are never selected', () => {
    for (const status of [
      'draft',
      'approved_full',
      'approved_partial',
      'rejected',
      'expired',
    ] as const)
      expect(quoteDuePhase({ status, validUntil: '2026-01-01' }, '2026-11-10', 1)).toBeNull();
    expect(quoteDuePhase({ status: 'sent' }, '2026-11-10', 1)).toBeNull();
  });
  it('R10: the expire event exists only from sent (state machine)', () => {
    expect(transitionQuote('sent', 'expire')).toEqual({ ok: true, state: 'expired' });
    expect(transitionQuote('draft', 'expire')).toMatchObject({ ok: false });
    expect(transitionQuote('expired', 'expire')).toMatchObject({ ok: false });
  });
});

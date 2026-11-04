import { describe, expect, it } from 'vitest';
import { emptyAccount, receiptMethodsOf, refundableVnd, type Payment } from '@/modules/acc';
import { APPROVAL_KIND_DEFS, isApprovalExpired, REAUTH_ON_APPROVE } from '@/modules/sys';

const acct = (o: Partial<ReturnType<typeof emptyAccount>> = {}) => ({
  ...emptyAccount({ companyId: 'c', branchId: 'b', orderId: 'o', orderNumber: 'LSC-1' }),
  ...o,
});
const receipt = (id: string, method: string): Payment =>
  ({ id, kind: 'receipt', lines: [{ method, amountVnd: 1 }] }) as unknown as Payment;

describe('R105: one ceiling for deposit refund and customer refund', () => {
  it('a cancelled order whose deposit was refunded has nothing more to refund', () => {
    const a = acct({
      receivedVnd: 0,
      depositHeldVnd: 0,
      deposits: [
        {
          id: 'd',
          number: 'PC',
          totalVnd: 500_000,
          appliedVnd: 0,
          refundedVnd: 500_000,
          reversed: false,
        },
      ],
    });
    expect(refundableVnd(0, a, true)).toBe(0);
  });
  it('a held deposit never adds to what receipts can give back, and the total not falling gives 0', () => {
    const a = acct({ receivedVnd: 1_000_000, depositHeldVnd: 300_000 });
    expect(refundableVnd(1_000_000, a, false)).toBe(0);
    expect(refundableVnd(900_000, a, false)).toBe(100_000);
  });
  it('the original methods are those of net receipts only', () => {
    const m = receiptMethodsOf([receipt('a', 'cash'), receipt('b', 'qr')], new Set(['b']));
    expect([...m]).toEqual(['cash']);
  });
});

describe('R106: approval validity and password re-entry', () => {
  const at = new Date('2026-11-04T08:00:00Z');
  it('expires after validHours; no validHours means no expiry', () => {
    expect(isApprovalExpired(at, new Date('2026-11-04T09:59:00Z'), 2)).toBe(false);
    expect(isApprovalExpired(at, new Date('2026-11-04T10:01:00Z'), 2)).toBe(true);
    expect(isApprovalExpired(at, new Date('2027-01-01T00:00:00Z'), undefined)).toBe(false);
  });
  it('day_reopen defaults to 2 hours and asks for the password; customer_refund is always needed', () => {
    expect(APPROVAL_KIND_DEFS.day_reopen.defaults.validHours).toBe(2);
    expect(REAUTH_ON_APPROVE).toContain('day_reopen');
    expect(APPROVAL_KIND_DEFS.customer_refund.defaults.level1MaxVnd).toBe(10_000_000);
  });
});

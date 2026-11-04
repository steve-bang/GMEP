import { describe, expect, it } from 'vitest';
import {
  agingKey,
  applyCustomerRefund,
  applyDeposit,
  applyReceipt,
  applyRefund,
  applyReversal,
  balanceOf,
  canReverse,
  checkVariance,
  dayCloseBlockers,
  dayWindow,
  debtCovers,
  depositHeld,
  emptyAccount,
  expenseApprovalNeed,
  hasExpenseSource,
  planDepositApplication,
  recomputeAccount,
  refundableVnd,
  sumLines,
  validateLines,
  type CashShift,
  type OrderAccount,
  type Payment,
} from '@/modules/acc';
import {
  APPROVAL_KIND_DEFS,
  approverPermission,
  checkDecision,
  isOverdue,
  requiredLevel,
} from '@/modules/sys';

const AT = new Date('2026-11-04T03:00:00Z');
const base = { companyId: 'c', branchId: 'b', orderId: 'ro1', orderNumber: 'RO-1' };
const policy = {
  methods: ['cash', 'transfer', 'card', 'qr'] as const,
  nonCashReferenceRequired: true,
};

describe('FR-ACC-001 payment lines', () => {
  it('accepts several methods; non-cash needs its reference; amounts are positive integers', () => {
    expect(
      validateLines(
        [
          { method: 'cash', amountVnd: 500_000 },
          { method: 'transfer', amountVnd: 300_000, reference: 'FT1' },
          { method: 'qr', amountVnd: 1, reference: 'QR1' },
        ],
        { ...policy, methods: [...policy.methods] },
      ),
    ).toEqual([]);
    const errs = validateLines(
      [
        { method: 'card', amountVnd: 100 },
        { method: 'cash', amountVnd: 0 },
        { method: 'cash', amountVnd: 1.5 },
      ],
      { ...policy, methods: [...policy.methods] },
    );
    expect(errs.map((e) => e.field)).toEqual([
      'lines.0.reference',
      'lines.1.amountVnd',
      'lines.2.amountVnd',
    ]);
  });
  it('a method that is switched off is refused; an empty list is refused unless a deposit pays', () => {
    expect(
      validateLines([{ method: 'qr', amountVnd: 10, reference: 'x' }], {
        methods: ['cash'],
        nonCashReferenceRequired: true,
      })[0]!.field,
    ).toBe('lines.0.method');
    expect(validateLines([], { methods: ['cash'], nonCashReferenceRequired: true })).toHaveLength(
      1,
    );
    expect(
      validateLines(
        [],
        { methods: ['cash'], nonCashReferenceRequired: true },
        { allowEmpty: true },
      ),
    ).toEqual([]);
  });
  it('sums are exact integers', () => {
    expect(
      sumLines([
        { method: 'cash', amountVnd: 2_300_000 },
        { method: 'card', amountVnd: 5_350_000 },
      ]),
    ).toBe(7_650_000);
  });
});

describe('FR-ACC-001/002 order account: received + outstanding always add up to the receivable', () => {
  it('G4-ACC-01 example: 7.650.000 receivable, 2.000.000 deposit applied, 5.650.000 collected, nothing left', () => {
    let a = emptyAccount(base);
    a = applyDeposit(a, { id: 'dep1', number: 'PT-1', totalVnd: 2_000_000 }, AT);
    expect(balanceOf(7_650_000, a)).toMatchObject({
      receivedVnd: 0,
      depositHeldVnd: 2_000_000,
      outstandingVnd: 7_650_000,
    });
    const plan = planDepositApplication(a.deposits, balanceOf(7_650_000, a).outstandingVnd);
    expect(plan).toEqual([{ depositId: 'dep1', depositNumber: 'PT-1', amountVnd: 2_000_000 }]);
    a = applyReceipt(a, { totalVnd: 5_650_000, applications: plan }, AT);
    expect(balanceOf(7_650_000, a)).toMatchObject({
      receivedVnd: 7_650_000,
      depositHeldVnd: 0,
      outstandingVnd: 0,
      overpaidVnd: 0,
    });
  });
  it('deposits are used oldest first and never more than the outstanding amount', () => {
    let a = emptyAccount(base);
    a = applyDeposit(a, { id: 'd1', number: 'PT-1', totalVnd: 300_000 }, AT);
    a = applyDeposit(a, { id: 'd2', number: 'PT-2', totalVnd: 500_000 }, AT);
    expect(planDepositApplication(a.deposits, 400_000)).toEqual([
      { depositId: 'd1', depositNumber: 'PT-1', amountVnd: 300_000 },
      { depositId: 'd2', depositNumber: 'PT-2', amountVnd: 100_000 },
    ]);
    expect(planDepositApplication(a.deposits, 0)).toEqual([]);
  });
  it('a refund leaves the held part; reversing the refund puts it back', () => {
    let a = applyDeposit(emptyAccount(base), { id: 'd1', number: 'PT-1', totalVnd: 300_000 }, AT);
    a = applyRefund(a, 'd1', 100_000, AT);
    expect(a.depositHeldVnd).toBe(200_000);
    expect(depositHeld(a.deposits[0]!)).toBe(200_000);
    a = applyReversal(
      a,
      { kind: 'expense', id: 'x', totalVnd: 100_000, applications: [], depositId: 'd1' },
      AT,
    );
    expect(a.depositHeldVnd).toBe(300_000);
  });
  it('reversing a receipt gives back what it used; the aggregate equals the sum of the posted payments after any sequence', () => {
    // a deterministic pseudo random walk over receipts, deposits and reversals
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n) + 1;
    for (let round = 0; round < 40; round++) {
      let a: OrderAccount = emptyAccount(base);
      const posted: Payment[] = [];
      const reversed = new Set<string>();
      const receivable = 10_000_000;
      for (let i = 0; i < 12; i++) {
        const out = balanceOf(receivable, a).outstandingVnd;
        const r = rnd(4);
        if (r === 1 && out > 0) {
          const amt = rnd(2_000_000);
          const id = `d${i}`;
          if (amt <= receivable - balanceOf(receivable, a).receivedVnd - a.depositHeldVnd) {
            a = applyDeposit(a, { id, number: id, totalVnd: amt }, AT);
            posted.push({
              id,
              kind: 'deposit',
              totalVnd: amt,
              applications: [],
              applicationVnd: 0,
            } as unknown as Payment);
          }
        } else if (r === 2 && out > 0) {
          const plan = planDepositApplication(a.deposits, out);
          const used = plan.reduce((s, x) => s + x.amountVnd, 0);
          const pay = Math.min(out - used, rnd(3_000_000));
          if (used + pay > 0) {
            const id = `r${i}`;
            a = applyReceipt(a, { totalVnd: pay, applications: plan }, AT);
            posted.push({
              id,
              kind: 'receipt',
              totalVnd: pay,
              applications: plan,
              applicationVnd: used,
            } as unknown as Payment);
          }
        } else if (r === 3 && posted.length) {
          const p = posted[rnd(posted.length) - 1]!;
          if (canReverse(p, a, reversed.has(p.id)).ok) {
            a = applyReversal(a, p, AT);
            reversed.add(p.id);
          }
        }
        const re = recomputeAccount(base, posted, reversed);
        expect(re).toEqual({
          receivedVnd: a.receivedVnd,
          depositAppliedVnd: a.depositAppliedVnd,
          depositHeldVnd: a.depositHeldVnd,
        });
        const b = balanceOf(receivable, a);
        expect(b.receivedVnd + b.outstandingVnd - b.overpaidVnd).toBe(receivable);
        expect(a.depositHeldVnd).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('RULE-010: a reversal cannot be reversed or repeated; a deposit that was used is reversed only after its use is', () => {
    const a = applyReceipt(
      applyDeposit(emptyAccount(base), { id: 'd', number: 'P', totalVnd: 100 }, AT),
      { totalVnd: 0, applications: [{ depositId: 'd', depositNumber: 'P', amountVnd: 60 }] },
      AT,
    );
    expect(canReverse({ kind: 'reversal', id: 'x' }, a, false)).toEqual({
      ok: false,
      reason: 'reversal_of_reversal',
    });
    expect(canReverse({ kind: 'receipt', id: 'x' }, a, true)).toEqual({
      ok: false,
      reason: 'payment_already_reversed',
    });
    expect(canReverse({ kind: 'deposit', id: 'd' }, a, false)).toEqual({
      ok: false,
      reason: 'deposit_in_use',
    });
    expect(canReverse({ kind: 'receipt', id: 'x' }, a, false)).toEqual({ ok: true });
  });
});

describe('FR-ACC-006 / R44 debt covers the outstanding amount', () => {
  const debt = {
    id: 'x',
    amountVnd: 1_000_000,
    dueDate: '2026-12-01',
    reason: 'r',
    approvalId: 'a',
    approvedBy: 'u',
    approvedAt: AT,
    status: 'open' as const,
  };
  it('nothing outstanding needs no debt; a smaller debt does not cover; a settled debt does not count', () => {
    expect(debtCovers(balanceOf(500, { ...emptyAccount(base), receivedVnd: 500 }))).toBe(true);
    expect(debtCovers(balanceOf(1_000_000, { ...emptyAccount(base), debt }))).toBe(true);
    expect(debtCovers(balanceOf(1_000_001, { ...emptyAccount(base), debt }))).toBe(false);
    expect(
      debtCovers(
        balanceOf(1_000_000, { ...emptyAccount(base), debt: { ...debt, status: 'settled' } }),
      ),
    ).toBe(false);
  });
});

describe('FR-SYS-004 approval levels (RULE-011): limits are data', () => {
  it('an expense within the self limit needs none; up to the manager limit level 1; above it level 2', () => {
    const lim = { selfMaxVnd: 500_000, level1MaxVnd: 5_000_000, dueHours: 24 };
    expect(requiredLevel('expense', 500_000, lim)).toBe(0);
    expect(requiredLevel('expense', 500_001, lim)).toBe(1);
    expect(requiredLevel('expense', 5_000_000, lim)).toBe(1);
    expect(requiredLevel('expense', 5_000_001, lim)).toBe(2);
  });
  it('a reversal, a debt and a cash variance always need a decision whatever the value; the fallback never lets an expense through alone', () => {
    for (const k of ['payment_reversal', 'debt_handover', 'cash_variance'] as const)
      expect(
        requiredLevel(k, 0, {
          selfMaxVnd: 1_000_000_000,
          level1MaxVnd: 2_000_000_000,
          dueHours: 1,
        }),
      ).toBe(1);
    expect(requiredLevel('expense', 1)).toBe(1);
    expect(APPROVAL_KIND_DEFS.expense.defaults.selfMaxVnd).toBe(0);
    expect(() => requiredLevel('expense', 1.5)).toThrow();
  });
  it('the requester never decides their own request (by person), only a pending request is decided', () => {
    expect(checkDecision({ status: 'pending', requestedBy: 'a' }, 'a')).toEqual({
      ok: false,
      reason: 'approval_self_decision',
    });
    expect(checkDecision({ status: 'pending', requestedBy: 'a' }, 'b')).toEqual({ ok: true });
    expect(checkDecision({ status: 'approved', requestedBy: 'a' }, 'b')).toEqual({
      ok: false,
      reason: 'approval_not_pending',
    });
    expect(approverPermission(1)).toBe('approval-l1:approve');
    expect(approverPermission(2)).toBe('approval-l2:approve');
  });
  it('overdue only while pending', () => {
    const due = new Date('2026-11-04T00:00:00Z');
    expect(isOverdue({ status: 'pending', dueAt: due }, AT)).toBe(true);
    expect(isOverdue({ status: 'approved', dueAt: due }, AT)).toBe(false);
  });
});

describe('FR-ACC-004 shift variance and day close', () => {
  it('counted minus book; any difference needs an explanation; above the tolerance it needs approval', () => {
    expect(checkVariance(5_870_000, 5_720_000, 0)).toEqual({
      varianceVnd: -150_000,
      needsExplanation: true,
      needsApproval: true,
    });
    expect(checkVariance(5_870_000, 5_870_000, 0)).toEqual({
      varianceVnd: 0,
      needsExplanation: false,
      needsApproval: false,
    });
    expect(checkVariance(1000, 1050, 50)).toEqual({
      varianceVnd: 50,
      needsExplanation: true,
      needsApproval: false,
    });
  });
  const shift = (o: Partial<CashShift>): CashShift =>
    ({ id: 's', status: 'closed', varianceStatus: 'none', ...o }) as CashShift;
  it('UAT-07: an open shift, a pending or rejected difference block the day; approved and explained do not', () => {
    expect(dayCloseBlockers([shift({ status: 'open' })]).map((b) => b.code)).toEqual([
      'shift_open',
    ]);
    expect(dayCloseBlockers([shift({ varianceStatus: 'pending_approval' })])[0]!.code).toBe(
      'variance_pending',
    );
    expect(dayCloseBlockers([shift({ varianceStatus: 'rejected' })])[0]!.code).toBe(
      'variance_rejected',
    );
    expect(
      dayCloseBlockers([
        shift({ varianceStatus: 'approved' }),
        shift({ varianceStatus: 'explained' }),
        shift({}),
      ]),
    ).toEqual([]);
  });
  it('the business day window is the Vietnamese calendar day', () => {
    const w = dayWindow('2026-11-04');
    expect(w.from.toISOString()).toBe('2026-11-03T17:00:00.000Z');
    expect(w.to.getTime() - w.from.getTime()).toBe(86_400_000);
  });
});

describe('FR-ACC-006 debt age', () => {
  it('buckets by days past the due date with configurable cut-offs', () => {
    expect(agingKey('2026-11-10', '2026-11-04')).toBe('notDue');
    expect(agingKey('2026-11-04', '2026-11-04')).toBe('notDue');
    expect(agingKey('2026-11-03', '2026-11-04')).toBe('d1_30');
    expect(agingKey('2026-10-05', '2026-11-04')).toBe('d1_30');
    expect(agingKey('2026-10-04', '2026-11-04')).toBe('d31_60');
    expect(agingKey('2026-09-05', '2026-11-04')).toBe('d31_60');
    expect(agingKey('2026-09-04', '2026-11-04')).toBe('over60');
    expect(agingKey('2026-10-30', '2026-11-04', [7, 14])).toBe('d1_30');
    expect(agingKey('2026-10-25', '2026-11-04', [7, 14])).toBe('d31_60');
    expect(agingKey('2026-10-10', '2026-11-04', [7, 14])).toBe('over60');
  });
});

describe('expense approval need (RULE-011, R57, R58, R64)', () => {
  const limits = {
    selfMaxVnd: 500_000,
    level1MaxVnd: 5_000_000,
    dueHours: 24,
    shiftCapVnd: 2_000_000,
  };
  const base = {
    depositRefund: false,
    sourceMissing: false,
    amountVnd: 100_000,
    limits,
    selfApprovedInShiftVnd: 0,
  };
  it('R58: within the own tier and under the shift cap needs nothing', () => {
    expect(expenseApprovalNeed(base)).toMatchObject({ kind: 'expense', level: 0 });
  });
  it('R58: the voucher that passes the running shift cap goes to a manager; the cap itself is allowed', () => {
    expect(expenseApprovalNeed({ ...base, selfApprovedInShiftVnd: 1_900_000 }).level).toBe(0);
    const over = expenseApprovalNeed({ ...base, selfApprovedInShiftVnd: 1_900_001 });
    expect(over).toMatchObject({ level: 1, cappedByShift: true });
  });
  it('RULE-011: above the own tier a manager decides, above the manager tier the owner', () => {
    expect(expenseApprovalNeed({ ...base, amountVnd: 500_001 }).level).toBe(1);
    expect(expenseApprovalNeed({ ...base, amountVnd: 5_000_001 }).level).toBe(2);
  });
  it('R64: a voucher without a source document is always decided by a manager, whatever its value', () => {
    expect(expenseApprovalNeed({ ...base, sourceMissing: true, amountVnd: 1 }).level).toBe(1);
    expect(expenseApprovalNeed({ ...base, sourceMissing: true, amountVnd: 6_000_000 }).level).toBe(
      2,
    );
  });
  it('R57: a deposit refund is its own kind, never self-decided, owner above 50.000.000', () => {
    const refundLimits = { selfMaxVnd: 0, level1MaxVnd: 50_000_000, dueHours: 24 };
    const r = (amountVnd: number) =>
      expenseApprovalNeed({ ...base, depositRefund: true, amountVnd, limits: refundLimits });
    expect(r(1)).toMatchObject({ kind: 'deposit_refund', level: 1 });
    expect(r(50_000_000).level).toBe(1);
    expect(r(50_000_001).level).toBe(2);
  });
  it('R64: an order, a deposit or a reference each count as a source document', () => {
    expect(hasExpenseSource({})).toBe(false);
    expect(hasExpenseSource({ orderId: 'o' })).toBe(true);
    expect(hasExpenseSource({ depositId: 'd' })).toBe(true);
    expect(hasExpenseSource({ sourceRef: 'HD-1' })).toBe(true);
  });
});

describe('customer refund (FR-ACC-016, RULE-010)', () => {
  const base = (): OrderAccount => ({
    ...emptyAccount({ companyId: 'c', branchId: 'b', orderId: 'o', orderNumber: 'RO-1' }),
    receivedVnd: 1_200_000,
  });

  it('a live order can give back only what it was paid above the receivable; a cancelled one all net receipts', () => {
    expect(refundableVnd(1_000_000, base(), false)).toBe(200_000);
    expect(refundableVnd(1_200_000, base(), false)).toBe(0);
    expect(refundableVnd(1_500_000, base(), false)).toBe(0);
    expect(refundableVnd(1_000_000, base(), true)).toBe(1_200_000);
    expect(refundableVnd(0, { ...base(), receivedVnd: 0 }, true)).toBe(0);
  });

  it('deposits are not refundable here (they have their own refund) and never push the amount above the receipts', () => {
    const a = { ...base(), receivedVnd: 100_000, depositAppliedVnd: 1_000_000 };
    expect(refundableVnd(1_000_000, a, false)).toBe(100_000);
  });

  it('the refund lowers net received; reversing the refund restores it; recompute agrees', () => {
    const at = new Date('2026-11-04T03:00:00Z');
    const after = applyCustomerRefund(base(), 150_000, at);
    expect(after.receivedVnd).toBe(1_050_000);
    const refund = {
      id: 'p2',
      kind: 'expense' as const,
      customerRefund: true,
      totalVnd: 150_000,
      applications: [],
      depositId: undefined,
    };
    expect(applyReversal(after, refund, at).receivedVnd).toBe(1_200_000);
    const receipt = { id: 'p1', kind: 'receipt', totalVnd: 1_200_000, applicationVnd: 0 };
    const re = recomputeAccount(
      { companyId: 'c', branchId: 'b', orderId: 'o', orderNumber: 'RO-1' },
      [receipt, { ...refund }] as unknown as Payment[],
      new Set(),
    );
    expect(re.receivedVnd).toBe(1_050_000);
    expect(
      recomputeAccount(
        { companyId: 'c', branchId: 'b', orderId: 'o', orderNumber: 'RO-1' },
        [receipt, { ...refund }] as unknown as Payment[],
        new Set(['p2']),
      ).receivedVnd,
    ).toBe(1_200_000);
  });

  it('RULE-011: refund and day reopen are always decided by someone else; a reopen is the owner (level 2)', () => {
    expect(APPROVAL_KIND_DEFS.customer_refund.alwaysNeeded).toBe(true);
    expect(requiredLevel('customer_refund', 1)).toBe(1);
    expect(requiredLevel('customer_refund', 10_000_001)).toBe(2);
    expect(APPROVAL_KIND_DEFS.day_reopen.alwaysNeeded).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { mayBeOtherBranch, resolveScope, type Actor, type Permission } from '@/platform/rbac/rbac';

// BA §25 F-1(3): writes are fenced to the working branch; reads, company-level resources and "no working branch" are not.
const actor = (over: Partial<Actor> = {}, branch = '*'): Actor => ({
  userId: 'u',
  companyId: 'c',
  displayName: 'x',
  assignments: [{ roleCode: 'R', branchId: branch }],
  rolePermissions: {
    R: [
      'stock-document:update',
      'stock-document:view',
      'payment:create',
      'repair-order:update',
      'invoice:approve',
      'tax-rate:update',
      'user:manage',
    ] as Permission[],
  },
  canConsolidate: true,
  workingBranchId: null,
  ...over,
});

describe('resolveScope write fence (F-1(3))', () => {
  it.each([
    'stock-document:update',
    'payment:create',
    'repair-order:update',
    'invoice:approve',
  ] as const)('%s is narrowed to the working branch (INV, ACC, REC, EIN)', (p) => {
    expect(resolveScope(actor({ workingBranchId: 'br_q7' }), p)).toMatchObject({
      kind: 'branches',
      branchIds: ['br_q7'],
    });
  });
  it('a read keeps the whole permission scope; no working branch keeps it for writes too', () => {
    expect(resolveScope(actor({ workingBranchId: 'br_q7' }), 'stock-document:view').kind).toBe(
      'all',
    );
    expect(resolveScope(actor(), 'stock-document:update').kind).toBe('all');
  });
  it('company-level resources are not fenced', () => {
    expect(resolveScope(actor({ workingBranchId: 'br_q7' }), 'tax-rate:update').kind).toBe('all');
    expect(resolveScope(actor({ workingBranchId: 'br_q7' }), 'user:manage').kind).toBe('all');
  });
  it('a right held only at another branch is refused while working at this one', () => {
    expect(() =>
      resolveScope(actor({ workingBranchId: 'br_q7' }, 'br_td'), 'payment:create'),
    ).toThrow();
  });
  it('mayBeOtherBranch is true only for a wide actor with a working branch', () => {
    expect(mayBeOtherBranch(actor({ workingBranchId: 'br_q7' }))).toBe(true);
    expect(mayBeOtherBranch(actor())).toBe(false);
    expect(mayBeOtherBranch(actor({ workingBranchId: 'br_q7' }, 'br_q7'))).toBe(false);
  });
});

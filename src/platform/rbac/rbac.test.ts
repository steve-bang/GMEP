import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/errors';
import { allBranchesScope, branchesScope, narrowScope, scopeAllows } from '../scope/scope';
import { hasPermission, resolveScope, type Actor } from './rbac';

const actor = (assignments: Actor['assignments']): Actor => ({
  userId: 'u1',
  companyId: 'c1',
  displayName: 'Test',
  canConsolidate: false,
  workingBranchId: null,
  assignments,
  rolePermissions: {
    CH: ['warehouse:view', 'warehouse:create'],
    QL: ['warehouse:view', 'warehouse:create'],
    TK: ['warehouse:view'],
  },
});

describe('resolveScope (FR-SYS-002, FR-SYS-012, FR-SYS-013)', () => {
  it('company-wide assignment gives the all-branches scope', () => {
    expect(
      resolveScope(actor([{ roleCode: 'CH', branchId: '*' }]), 'warehouse:view'),
    ).toMatchObject({ kind: 'all', companyId: 'c1' });
  });
  it('unions branches across roles, per permission (FR-SYS-012)', () => {
    const a = actor([
      { roleCode: 'QL', branchId: 'b1' },
      { roleCode: 'TK', branchId: 'b2' },
    ]);
    expect(resolveScope(a, 'warehouse:view')).toMatchObject({
      kind: 'branches',
      branchIds: ['b1', 'b2'],
    });
    // create is granted only where the role has it: not hereditary across branches
    expect(resolveScope(a, 'warehouse:create')).toMatchObject({
      kind: 'branches',
      branchIds: ['b1'],
    });
  });
  it('a person with several roles gets no more than the union', () => {
    const a = actor([{ roleCode: 'TK', branchId: 'b1' }]);
    expect(hasPermission(a, 'warehouse:create')).toBe(false);
    expect(() => resolveScope(a, 'warehouse:create')).toThrow(AppError);
  });
  it('no assignment or unknown role means 403, never an empty "see nothing" scope', () => {
    expect(() => resolveScope(actor([]), 'warehouse:view')).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
    expect(() =>
      resolveScope(actor([{ roleCode: 'XX', branchId: 'b1' }]), 'warehouse:view'),
    ).toThrow(AppError);
  });
  it('wildcard dominates specific branches', () => {
    const a = actor([
      { roleCode: 'QL', branchId: 'b1' },
      { roleCode: 'CH', branchId: '*' },
    ]);
    expect(resolveScope(a, 'warehouse:view').kind).toBe('all');
  });
});

describe('Scope helpers (NFR-ISO-01)', () => {
  it('scopeAllows respects company and branch', () => {
    const s = branchesScope('c1', ['b1']);
    expect(scopeAllows(s, 'c1', 'b1')).toBe(true);
    expect(scopeAllows(s, 'c1', 'b2')).toBe(false);
    expect(scopeAllows(s, 'c2', 'b1')).toBe(false);
    expect(scopeAllows(s, 'c1', null)).toBe(false);
    expect(scopeAllows(allBranchesScope('c1'), 'c1', 'anything')).toBe(true);
    expect(scopeAllows(allBranchesScope('c1'), 'c2', 'anything')).toBe(false);
  });
  it('narrowScope can only shrink the scope, never widen it', () => {
    const s = branchesScope('c1', ['b1', 'b2']);
    expect(narrowScope(s, 'b2')).toMatchObject({ kind: 'branches', branchIds: ['b2'] });
    expect(narrowScope(s, 'b3')).toBeNull();
    expect(narrowScope(s, undefined)).toBe(s);
    expect(narrowScope(allBranchesScope('c1'), 'b9')).toMatchObject({ branchIds: ['b9'] });
  });
});

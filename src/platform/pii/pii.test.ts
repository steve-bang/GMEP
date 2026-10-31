import { describe, expect, it } from 'vitest';
import type { Actor } from '../rbac/rbac';
import { maskEverythingPolicy } from './pii';

const actor: Actor = {
  userId: 'u',
  companyId: 'c',
  displayName: 'x',
  assignments: [],
  rolePermissions: {},
};

describe('PII masking placeholder (NFR-SEC-03; real policy pending)', () => {
  it('masks phone except the last 3 digits and hides addresses, for everyone', () => {
    expect(maskEverythingPolicy.present('phone', '0901 234 567', actor)).toBe('•••••••567');
    expect(maskEverythingPolicy.present('address', '12 Nguyễn Huệ, Q1', actor)).toBe('••••••');
    expect(maskEverythingPolicy.canReveal('phone', actor)).toBe(false);
  });
});

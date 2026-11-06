import { describe, expect, it } from 'vitest';
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_PERMISSIONS,
  TENANT_ID_PATTERN,
  TENANT_STATUSES,
  TENANT_TRANSITIONS,
  allowedTransitions,
  decideTransition,
  newTenantDefaults,
  tenantAllowsSignIn,
  type TenantStatus,
} from '@/modules/sys';

const at = (status: TenantStatus, legalHold = false) => ({ status, legalHold });

describe('tenant lifecycle (FR-TEN-003)', () => {
  it('has the 13 states of the analysis and every transition uses known states', () => {
    expect(TENANT_STATUSES).toHaveLength(13);
    for (const r of TENANT_TRANSITIONS) {
      expect(TENANT_STATUSES).toContain(r.from);
      expect(TENANT_STATUSES).toContain(r.to);
    }
  });
  it('purged, rejected and cancelled are final: no way back (FR-TEN-003 AC)', () => {
    for (const s of ['purged', 'rejected', 'cancelled'] as const)
      expect(allowedTransitions(s)).toHaveLength(0);
    expect(decideTransition(at('purged'), 'active', { actor: 'platform', reason: 'oops' })).toEqual(
      { ok: false, code: 'transition_not_allowed' },
    );
  });
  it('refuses an edge that is not in the table and an actor that may not use it', () => {
    expect(
      decideTransition(at('onboarding'), 'suspended', { actor: 'platform', reason: 'abc' }).ok,
    ).toBe(false);
    // only the system finishes provisioning (the platform cannot push a tenant to onboarding by hand)
    expect(decideTransition(at('provisioning'), 'onboarding', { actor: 'platform' })).toEqual({
      ok: false,
      code: 'actor_not_allowed',
    });
    expect(decideTransition(at('provisioning'), 'onboarding', { actor: 'system' }).ok).toBe(true);
  });
  it('suspend, terminate and purge need a reason (FR-TEN-003 AC) and a second person (RULE-027)', () => {
    for (const [from, to] of [
      ['active', 'suspended'],
      ['active', 'terminating'],
      ['terminating', 'terminated'],
      ['terminated', 'purged'],
    ] as const) {
      expect(decideTransition(at(from), to, { actor: 'platform' })).toEqual({
        ok: false,
        code: 'reason_required',
      });
      const ok = decideTransition(at(from), to, { actor: 'platform', reason: 'Vi phạm hợp đồng' });
      expect(ok.ok && ok.rule.approval).toBe('two_person');
    }
  });
  it('a legal hold blocks purged (analysis 5.4)', () => {
    expect(
      decideTransition(at('terminated', true), 'purged', {
        actor: 'platform',
        reason: 'Hết hạn giữ',
      }),
    ).toEqual({ ok: false, code: 'legal_hold' });
  });
  it('only states with a live workspace let users sign in', () => {
    const open = TENANT_STATUSES.filter(tenantAllowsSignIn).sort();
    expect(open).toEqual(['active', 'onboarding', 'restricted', 'suspended', 'terminating']);
  });
  it('a new tenant is on the free plan: no subscription clock, no trial field (RULE-035)', () => {
    const d = newTenantDefaults();
    expect(d.plan).toBe('free');
    expect(d.subscriptionStatus).toBe('none');
    expect(JSON.stringify(d)).not.toMatch(/trial|expire/i);
    expect(TENANT_STATUSES).not.toContain('trial' as never);
  });
  it('tenant codes: lower-case slug, immutable id', () => {
    expect(TENANT_ID_PATTERN.test('tnt_main')).toBe(true);
    expect(TENANT_ID_PATTERN.test('Tnt Main')).toBe(false);
    expect(TENANT_ID_PATTERN.test('a')).toBe(false);
  });
});

describe('platform roles (FR-TEN-011)', () => {
  it('no platform role may view tenant business data by default (support sessions are MT-1)', () => {
    for (const r of PLATFORM_ROLES)
      expect(PLATFORM_ROLE_PERMISSIONS[r]).not.toContain('tenant-data:view');
  });
  it('only the owner approves two-person moves; the administrator proposes them', () => {
    expect(PLATFORM_ROLE_PERMISSIONS.CNT).toContain('tenant:transition-approve');
    for (const r of ['QTN', 'HTN', 'VHB'] as const)
      expect(PLATFORM_ROLE_PERMISSIONS[r]).not.toContain('tenant:transition-approve');
  });
  it('platform role codes do not collide with the 10 tenant roles', async () => {
    const { ROLE_CODES } = await import('@/modules/sys');
    for (const r of PLATFORM_ROLES) expect(ROLE_CODES as readonly string[]).not.toContain(r);
  });
});

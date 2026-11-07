import { describe, expect, it } from 'vitest';
import '@/infrastructure/repos/queries';
import { registeredQueries } from '@/platform/store/docStore';

/**
 * RULE-017 / FR-TEN-009 (ADR 0002 §6): no business query runs across tenants. Every registered query shape has
 * `tenantId` as an equality field, except the short, justified list below (identity plumbing keyed by an id that is
 * globally unique, and platform-zone collections that hold no tenant business data). A new shape without `tenantId`
 * fails here until someone argues for it in this list.
 */
const PLATFORM_OR_IDENTITY: Record<string, string> = {
  'users.byEmail':
    'sign-in and invitation resolve an identity by email before any tenant is known (FR-TEN-016)',
  'roleAssignments.byUser':
    'keyed by the membership id (globally unique); loadActor filters by the membership tenant',
  'sessions.byUser': 'keyed by the membership id (globally unique)',
  'authTokens.byUserKind': 'keyed by the membership id (globally unique)',
  'notifications.byUser': 'keyed by the membership id (globally unique)',
  'tenants.list': 'platform zone: tenant records are not business data (FR-TEN-001)',
  'platformAuditLogs.list': 'platform zone: immutable platform audit (FR-TEN-013)',
};

describe('every query shape is tenant-scoped (RULE-017)', () => {
  const shapes = registeredQueries();
  it('registers shapes at all', () => expect(shapes.length).toBeGreaterThan(100));
  it('has tenantId as an equality field unless justified', () => {
    const bare = shapes
      .filter((s) => !s.eq.includes('tenantId'))
      .map((s) => s.name.replace(/\[.*$/, '').replace(/@scope$/, ''));
    const unjustified = [...new Set(bare)].filter((n) => !(n in PLATFORM_OR_IDENTITY));
    expect(unjustified).toEqual([]);
  });
  it('keeps the justified list honest: every entry still exists', () => {
    const names = new Set(shapes.map((s) => s.name.replace(/\[.*$/, '').replace(/@scope$/, '')));
    for (const k of Object.keys(PLATFORM_OR_IDENTITY)) expect(names.has(k), k).toBe(true);
  });
});

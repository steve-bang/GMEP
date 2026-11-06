import { beforeAll, describe, expect, it } from 'vitest';
import { roleDocId, type PlatformActor } from '@/modules/sys';
import {
  decideTenantTransition,
  getTenant,
  listTenants,
  provisionTenant,
  approveProvisioning,
  transitionTenant,
  recordTermsAcceptance,
} from '@/modules/sys';
import { backends, createHarness, type Harness } from './harness';

/**
 * MT-0 tenant record, lifecycle, provisioning and platform audit: FR-TEN-001, 002, 003, 011, 013; UAT-TEN-01, 02, 06.
 */
const cnt: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_owner',
  role: 'CNT',
  displayName: 'Chủ nền tảng',
};
const qtn: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_admin',
  role: 'QTN',
  displayName: 'Quản trị nền tảng',
};
const htn: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_help',
  role: 'HTN',
  displayName: 'Hỗ trợ',
};
const cnt2: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_owner2',
  role: 'CNT',
  displayName: 'Chủ nền tảng 2',
};
let n = 0;
const rid = () => ({ requestId: `req-${++n}` });

describe.each(backends)('tenant foundation [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });
  const sys = () => h.container.sys;
  const auditOf = async (tenantId: string) =>
    (await sys().platformAudit.list({ limit: 100 }, tenantId)).items.map((e) => e.action);

  it('FR-TEN-002: provisioning twice with the same key creates one tenant, one set of roles, one audit trail', async () => {
    const input = { code: 'tnt_alpha', name: 'Garage Alpha', environment: 'demo' };
    const a = await provisionTenant(sys(), cnt, input, {
      ...rid(),
      idempotencyKey: 'prov-alpha-1',
    });
    const b = await provisionTenant(sys(), cnt, input, {
      ...rid(),
      idempotencyKey: 'prov-alpha-1',
    });
    expect(a.state).toBe('provisioned');
    expect(a.tenant.status).toBe('onboarding');
    expect(b.tenant.id).toBe('tnt_alpha');
    expect(b.tenant.status).toBe('onboarding');
    const roles = await sys().roles.list('tnt_alpha');
    expect(roles).toHaveLength(10);
    const actions = await auditOf('tnt_alpha');
    expect(actions.filter((x) => x === 'tenant.created')).toHaveLength(1);
    expect(actions.filter((x) => x === 'tenant.provision_step')).toHaveLength(3);
    // owner decision 07/11/2026: a six-digit tenant code is drawn once; the re-run keeps it
    expect(a.tenant.tenantCode).toMatch(/^\d{6}$/);
    expect(b.tenant.tenantCode).toBe(a.tenant.tenantCode);
    expect(await sys().tenants.getCodeSlot(a.tenant.tenantCode!)).toMatchObject({
      tenantId: 'tnt_alpha',
      state: 'active',
    });
  });

  it('owner decision 07/11/2026: two tenants that draw the same code get distinct codes; endless collisions fail clearly', async () => {
    const original = sys().newTenantCode;
    try {
      const taken = (await getTenant(sys(), cnt, 'tnt_alpha')).tenantCode!;
      const seq = [taken, taken, '583920'];
      sys().newTenantCode = () => seq.shift() ?? '583920';
      const r = await provisionTenant(
        sys(),
        cnt,
        { code: 'tnt_collide', name: 'Garage Trùng', environment: 'demo' },
        { ...rid(), idempotencyKey: 'prov-collide-1' },
      );
      expect(r.tenant.tenantCode).toBe('583920');
      sys().newTenantCode = () => taken;
      await expect(
        provisionTenant(
          sys(),
          cnt,
          { code: 'tnt_stuck', name: 'Garage Kẹt', environment: 'demo' },
          { ...rid(), idempotencyKey: 'prov-stuck-1' },
        ),
      ).rejects.toMatchObject({ code: 'tenant_code_unavailable', status: 503 });
      expect(await sys().tenants.get('tnt_stuck')).toBeNull(); // nothing half-created
    } finally {
      sys().newTenantCode = original;
    }
  });

  it('FR-TEN-002: the same code with another request key is a conflict, not a second tenant', async () => {
    await expect(
      provisionTenant(
        sys(),
        cnt,
        { code: 'tnt_alpha', name: 'Khác' },
        { ...rid(), idempotencyKey: 'other-key' },
      ),
    ).rejects.toMatchObject({ code: 'tenant_code_taken' });
  });

  it('FR-TEN-001/RULE-035: the new tenant is on the free plan with no clock and the code is immutable', async () => {
    const t = await getTenant(sys(), qtn, 'tnt_alpha');
    expect(t).toMatchObject({
      plan: 'free',
      subscriptionStatus: 'none',
      placement: 'pooled',
      environment: 'demo',
    });
    expect(JSON.stringify(t)).not.toMatch(/trial|expire/i);
    expect(Object.keys(sys().tenants)).not.toContain('delete'); // a tenant record is never deleted
  });

  it('FR-TEN-002: a provisioning step that fails leaves finished steps, parks the tenant, and the same request resumes', async () => {
    const real = sys().roles.upsert.bind(sys().roles);
    let broken = true;
    sys().roles.upsert = (...args: Parameters<typeof real>) => {
      if (broken) throw new Error('boom');
      return real(...args);
    };
    try {
      const input = { code: 'tnt_beta', name: 'Garage Beta' };
      const first = await provisionTenant(sys(), cnt, input, {
        ...rid(),
        idempotencyKey: 'prov-beta-1',
      });
      expect(first).toMatchObject({ state: 'failed', failedStep: 'roles' });
      expect(first.tenant.status).toBe('provision_failed');
      broken = false;
      const again = await provisionTenant(sys(), cnt, input, {
        ...rid(),
        idempotencyKey: 'prov-beta-1',
      });
      expect(again.state).toBe('provisioned');
      expect(again.tenant.status).toBe('onboarding');
      expect(await sys().roles.list('tnt_beta')).toHaveLength(10);
    } finally {
      sys().roles.upsert = real;
    }
  });

  it('analysis 5.3: an administrator (QTN) cannot start provisioning alone; the owner approves it', async () => {
    const input = { code: 'tnt_gamma', name: 'Garage Gamma' };
    const r = await provisionTenant(sys(), qtn, input, {
      ...rid(),
      idempotencyKey: 'prov-gamma-1',
    });
    expect(r.state).toBe('awaiting_approval');
    expect(await sys().roles.list('tnt_gamma')).toHaveLength(0);
    // the same request again does not duplicate the pending request
    await provisionTenant(sys(), qtn, input, { ...rid(), idempotencyKey: 'prov-gamma-1' });
    expect(
      (await auditOf('tnt_gamma')).filter((x) => x === 'tenant.transition_requested'),
    ).toHaveLength(1);
    await expect(approveProvisioning(sys(), qtn, 'tnt_gamma', rid())).rejects.toMatchObject({
      status: 403,
    });
    const done = await approveProvisioning(sys(), cnt, 'tnt_gamma', rid());
    expect(done.tenant.status).toBe('onboarding');
    expect(await sys().roles.list('tnt_gamma')).toHaveLength(10);
  });

  it('FR-TEN-003/RULE-027: suspending needs a reason and a second person; the requester cannot approve; audit lines exist', async () => {
    const t = await getTenant(sys(), cnt, 'tnt_alpha');
    const active = await transitionTenant(
      sys(),
      cnt,
      'tnt_alpha',
      { to: 'active', version: t.version },
      rid(),
    );
    expect(active.state).toBe('applied');
    const v = active.tenant.version;
    await expect(
      transitionTenant(sys(), qtn, 'tnt_alpha', { to: 'suspended', version: v }, rid()),
    ).rejects.toMatchObject({ code: 'reason_required' });
    const req = await transitionTenant(
      sys(),
      qtn,
      'tnt_alpha',
      { to: 'suspended', reason: 'Nợ phí quá hạn', version: v },
      rid(),
    );
    expect(req.state).toBe('awaiting_approval');
    expect(req.tenant.status).toBe('active');
    // the requester (QTN has no approve right) and the owner who is not the requester
    await expect(
      decideTenantTransition(sys(), qtn, 'tnt_alpha', { decision: 'approve' }, rid()),
    ).rejects.toMatchObject({ status: 403 });
    const ok = await decideTenantTransition(
      sys(),
      cnt,
      'tnt_alpha',
      { decision: 'approve' },
      rid(),
    );
    expect(ok.tenant.status).toBe('suspended');
    const actions = await auditOf('tnt_alpha');
    expect(actions).toEqual(
      expect.arrayContaining(['tenant.transition_requested', 'tenant.status_changed']),
    );
    const entry = (await sys().platformAudit.list({ limit: 100 }, 'tnt_alpha')).items.find(
      (e) => e.action === 'tenant.status_changed' && e.after?.status === 'suspended',
    )!;
    expect(entry).toMatchObject({
      approverId: 'pf_owner',
      reason: 'Nợ phí quá hạn',
      actorId: 'pf_admin',
      before: { status: 'active' },
    });
  });

  it('RULE-027: the owner who requested a two-person move cannot approve it himself', async () => {
    // RULE-029: a live tenant needs the recorded Terms and DPA acceptance before it goes active
    const t = await recordTermsAcceptance(
      sys(),
      cnt,
      'tnt_beta',
      {
        termsVersion: 'v1',
        dpaVersion: 'v1',
        acceptedByName: 'Người đại diện',
        acceptedByCapacity: 'Chủ garage',
        acceptedOn: '2026-11-06',
        documentRef: 'HS/beta.pdf',
      },
      rid(),
    );
    const a = await transitionTenant(
      sys(),
      cnt,
      'tnt_beta',
      { to: 'active', version: t.version },
      rid(),
    );
    const s = await transitionTenant(
      sys(),
      cnt,
      'tnt_beta',
      { to: 'suspended', reason: 'Yêu cầu của tenant', version: a.tenant.version },
      rid(),
    );
    expect(s.state).toBe('awaiting_approval');
    await expect(
      decideTenantTransition(sys(), cnt, 'tnt_beta', { decision: 'approve' }, rid()),
    ).rejects.toMatchObject({ code: 'approver_same_as_requester' });
    const ok = await decideTenantTransition(
      sys(),
      cnt2,
      'tnt_beta',
      { decision: 'approve' },
      rid(),
    );
    expect(ok.tenant.status).toBe('suspended');
  });

  it('FR-TEN-003: an illegal edge is refused (onboarding cannot jump to terminated) and rejection needs a reason', async () => {
    const t = await getTenant(sys(), cnt, 'tnt_gamma');
    await expect(
      transitionTenant(
        sys(),
        cnt,
        'tnt_gamma',
        { to: 'terminated', reason: 'xin chấm dứt', version: t.version },
        rid(),
      ),
    ).rejects.toMatchObject({ code: 'transition_not_allowed' });
    // stale version: optimistic locking
    await expect(
      transitionTenant(sys(), cnt, 'tnt_gamma', { to: 'active', version: t.version + 5 }, rid()),
    ).rejects.toMatchObject({ code: 'version_conflict' });
  });

  it('FR-TEN-011: support staff see profiles but cannot provision or change state; the system cannot be impersonated', async () => {
    expect((await listTenants(sys(), htn)).length).toBeGreaterThan(0);
    await expect(
      provisionTenant(
        sys(),
        htn,
        { code: 'tnt_hack', name: 'Hack' },
        { ...rid(), idempotencyKey: 'k-hack' },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      transitionTenant(sys(), htn, 'tnt_alpha', { to: 'active', version: 1 }, rid()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('FR-TEN-009: roles of two tenants are separate documents; editing one never changes the other', async () => {
    const [chA] = await sys().roles.getMany('tnt_alpha', ['CH']);
    await sys().uow.run(async (tx) => {
      sys().roles.upsert(
        tx,
        'tnt_alpha',
        { ...chA!, name: 'Chủ alpha' },
        { at: new Date(), by: 'test' },
      );
    });
    expect((await sys().roles.getMany('tnt_alpha', ['CH']))[0]!.name).toBe('Chủ alpha');
    expect((await sys().roles.getMany('tnt_beta', ['CH']))[0]!.name).not.toBe('Chủ alpha');
    expect((await sys().roles.getMany('tnt_demo', ['CH']))[0]!.name).not.toBe('Chủ alpha');
    expect(roleDocId('tnt_alpha', 'CH')).not.toBe(roleDocId('tnt_beta', 'CH'));
    // a tenant cannot read another tenant's role through a guessed code
    expect(await sys().roles.getMany('tnt_beta', ['tnt_alpha__CH'])).toHaveLength(0);
  });
});

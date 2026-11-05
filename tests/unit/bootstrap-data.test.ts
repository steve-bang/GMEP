import { describe, expect, it } from 'vitest';
import type { DocData } from '@/platform/store/docStore';
import {
  bootstrapDocs,
  loadBootstrapConfig,
  runBootstrap,
  type BootstrapConfig,
} from '@/infrastructure/seed/bootstrap';

const SRC = {
  BOOTSTRAP_CONFIRM_PROJECT: 'gmep-staging',
  BOOTSTRAP_COMPANY_NAME: 'Garage Test',
  BOOTSTRAP_BRANCH_CODE: 'q7',
  BOOTSTRAP_BRANCH_NAME: 'Chi nhánh Quận 7',
  BOOTSTRAP_OWNER_EMAIL: 'Chu@Example.vn',
  BOOTSTRAP_OWNER_NAME: 'Chủ Garage',
};
const NOW = new Date('2026-11-05T00:00:00Z');

function memory() {
  const m = new Map<string, DocData>();
  const users: string[] = [];
  return {
    m,
    users,
    store: {
      async get(c: string, id: string) {
        return m.get(`${c}/${id}`) ?? null;
      },
      async create(c: string, id: string, d: DocData) {
        if (m.has(`${c}/${id}`)) throw new Error('exists');
        m.set(`${c}/${id}`, d);
      },
    },
    identity: {
      async ensureUser(u: { uid: string }) {
        if (!users.includes(u.uid)) users.push(u.uid);
      },
    },
  };
}

describe('bootstrap data (security checklist 9; FR-SYS-001/002)', () => {
  it('needs every required variable and a matching project confirmation', () => {
    expect(() => loadBootstrapConfig({}, 'gmep-staging')).toThrow(/BOOTSTRAP_COMPANY_NAME/);
    expect(() => loadBootstrapConfig(SRC, 'gmep-prod')).toThrow(/CONFIRM_PROJECT/);
    const c = loadBootstrapConfig(SRC, 'gmep-staging');
    expect(c).toMatchObject({
      branchCode: 'Q7',
      ownerEmail: 'chu@example.vn',
      companyId: 'cmp_main',
    });
  });

  it('creates the minimum set only: no demo data, no password anywhere', () => {
    const cfg = loadBootstrapConfig(SRC, 'gmep-staging');
    const docs = bootstrapDocs(cfg, NOW);
    const cols = new Set(docs.map((d) => d.collection));
    expect([...cols].sort()).toEqual(
      [
        'branchCodes',
        'branches',
        'companies',
        'roleAssignments',
        'roles',
        'userKeys',
        'users',
        'warehouses',
      ].sort(),
    );
    expect(docs.filter((d) => d.collection === 'roles')).toHaveLength(10);
    const text = JSON.stringify(docs);
    expect(text).not.toMatch(/Demo!Pass|demo\.gmep|password/i);
    expect(docs.find((d) => d.collection === 'users')!.data.status).toBe('invited');
  });

  it('is idempotent: a second run creates nothing and issues no new link', async () => {
    const cfg = loadBootstrapConfig(SRC, 'gmep-staging');
    const io = memory();
    const run = () =>
      runBootstrap(cfg, {
        store: io.store,
        identity: io.identity,
        now: NOW,
        appBaseUrl: 'https://x.vn/',
      });
    const first = await run();
    expect(first.activationLink).toMatch(/^https:\/\/x\.vn\/activate\?token=[\w-]{43}$/);
    const size = io.m.size;
    const second = await run();
    expect(second.created).toEqual([]);
    expect(second.activationLink).toBeNull();
    expect(io.m.size).toBe(size);
    // only the hash of the token is stored
    const raw = new URL(first.activationLink!).searchParams.get('token')!;
    expect([...io.m.keys()].some((k) => k.includes(raw))).toBe(false);
  });

  it('reissues a link only on request and only for an owner who has not activated', async () => {
    const cfg = loadBootstrapConfig(SRC, 'gmep-staging');
    const io = memory();
    const base = { store: io.store, identity: io.identity, now: NOW, appBaseUrl: 'https://x.vn' };
    await runBootstrap(cfg, base);
    const again: BootstrapConfig = { ...cfg, reissueInvite: true };
    expect((await runBootstrap(again, base)).activationLink).not.toBeNull();
    io.m.set('users/u_owner', { ...io.m.get('users/u_owner')!, status: 'active' });
    expect((await runBootstrap(again, base)).activationLink).toBeNull();
    await expect(runBootstrap({ ...cfg, ownerEmail: 'other@example.vn' }, base)).rejects.toThrow(
      /different email/,
    );
  });
});

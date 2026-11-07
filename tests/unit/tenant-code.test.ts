import { describe, expect, it } from 'vitest';
import {
  isGuessableTenantCode,
  normalizeTenantCodeInput,
  pickTenantCode,
  randomTenantCode,
  tenantCodeSlotFree,
  workerLoginAddress,
  TENANT_CODE_MAX_ATTEMPTS,
} from '@/modules/sys';
import { migrateToTenant, type MigrationIo } from '@/infrastructure/migration/tenantMigration';
import { loadBootstrapConfig, runBootstrap } from '@/infrastructure/seed/bootstrap';
import type { DocData } from '@/platform/store/docStore';

/** Owner decision 07/11/2026: the "Mã công ty" is a six-digit random tenant code, unique platform-wide. */
describe('tenant code (owner decision 07/11/2026)', () => {
  it('format: exactly six digits as a string, leading zeros kept', () => {
    const draws = [48_213, 999_998, 7];
    const codes = draws.map((n) => randomTenantCode((max) => (expect(max).toBe(1_000_000), n)));
    expect(codes).toEqual(['048213', '999998', '000007']);
    for (let i = 0; i < 500; i++) expect(randomTenantCode()).toMatch(/^\d{6}$/);
  });

  it('guessable codes are excluded: six identical digits, runs of consecutive digits, repeated blocks', () => {
    for (const c of [
      '000000',
      '111111',
      '999999',
      '123456',
      '012345',
      '456789',
      '987654',
      '543210',
    ])
      expect(isGuessableTenantCode(c), c).toBe(true);
    for (const c of ['121212', '909090', '123123', '007007'])
      expect(isGuessableTenantCode(c), c).toBe(true);
    for (const c of ['048213', '482913', '730561', '100000', '123457', '000001'])
      expect(isGuessableTenantCode(c), c).toBe(false);
    // the draw skips them: a source stuck on 000000 first, then a real code
    const seq = [0, 0, 123_456, 48_213];
    expect(randomTenantCode(() => seq.shift()!)).toBe('048213');
  });

  it('the random draw is not ordered or derived: 2,000 draws are spread and mostly distinct', () => {
    const codes = Array.from({ length: 2000 }, () => randomTenantCode());
    expect(new Set(codes).size).toBeGreaterThan(1990);
    const firstDigits = new Set(codes.map((c) => c[0]));
    expect(firstDigits.size).toBe(10);
  });

  it('input normalisation: white space removed, anything not six digits is null (neutral path)', () => {
    expect(normalizeTenantCodeInput(' 048 213 ')).toBe('048213');
    expect(normalizeTenantCodeInput('048\t213')).toBe('048213');
    for (const bad of ['', '48213', '0482130', 'tnt_demo', '04821a', '048-213', '٠٤٨٢١٣'])
      expect(normalizeTenantCodeInput(bad), bad).toBeNull();
  });

  it('collisions: a taken code is drawn again; too many taken draws give up (null)', async () => {
    const taken = new Set(['482913', '730561']);
    const seq = ['482913', '730561', '583920'];
    const isFree = async (c: string) => !taken.has(c);
    expect(await pickTenantCode(() => seq.shift()!, isFree)).toBe('583920');
    let calls = 0;
    expect(
      await pickTenantCode(() => {
        calls++;
        return '482913';
      }, isFree),
    ).toBeNull();
    expect(calls).toBe(TENANT_CODE_MAX_ATTEMPTS);
  });

  it('a retired code is free only after its holding period', () => {
    const now = new Date('2026-11-07T00:00:00Z');
    const base = { code: '482913', tenantId: 't', assignedAt: now };
    expect(tenantCodeSlotFree(null, now)).toBe(true);
    expect(tenantCodeSlotFree({ ...base, state: 'active' }, now)).toBe(false);
    expect(
      tenantCodeSlotFree(
        { ...base, state: 'retired', releaseAfter: new Date(now.getTime() + 1) },
        now,
      ),
    ).toBe(false);
    expect(tenantCodeSlotFree({ ...base, state: 'retired', releaseAfter: now }, now)).toBe(true);
  });

  it('the internal sign-in address hashes the tenant id, never the tenant code (stable across a reissue)', () => {
    expect(workerLoginAddress('tnt_demo', 'NV0001')).toBe(workerLoginAddress('tnt_demo', 'nv0001'));
    expect(workerLoginAddress('tnt_demo', 'NV0001')).not.toContain('482913');
  });
});

type Store = Map<string, Map<string, Record<string, unknown>>>;
const ioOf = (s: Store): MigrationIo => ({
  async list(c) {
    return [...(s.get(c)?.entries() ?? [])].map(([id, data]) => ({ id, data }));
  },
  async set(c, id, data) {
    if (!s.has(c)) s.set(c, new Map());
    s.get(c)!.set(id, data);
  },
  async remove(c, id) {
    s.get(c)?.delete(id);
  },
});

describe('migrate-to-tenant assigns tenant codes (owner decision 07/11/2026)', () => {
  const store = (): Store =>
    new Map([
      ['companies', new Map([['tnt_main', { name: 'Garage Một', legalEntityIds: [] }]])],
      [
        'tenants',
        new Map<string, Record<string, unknown>>([
          ['tnt_demo2', { name: 'Garage Demo 2', status: 'active' }],
          ['tnt_coded', { name: 'Đã có mã', tenantCode: '583920' }],
        ]),
      ],
      ['tenantCodes', new Map([['583920', { tenantId: 'tnt_coded', state: 'active' }]])],
    ]);

  it('dry run: reports the tenants that would get a code (including tenant number 1), writes nothing', async () => {
    const s = store();
    const r = await migrateToTenant(ioOf(s), { tenantId: 'tnt_main', apply: false });
    expect(r.changed.tenantCodes).toBe(2);
    expect(s.get('tenantCodes')!.size).toBe(1);
    expect(s.get('tenants')!.get('tnt_demo2')).not.toHaveProperty('tenantCode');
  });

  it('apply: every tenant without a code gets a unique one (collisions redrawn), a second run changes nothing', async () => {
    const s = store();
    const seq = ['583920', '583920', '102938', '102938', '564738'];
    const r = await migrateToTenant(ioOf(s), {
      tenantId: 'tnt_main',
      apply: true,
      newTenantCode: () => seq.shift()!,
    });
    expect(r.warnings).toEqual([]);
    const codes = ['tnt_main', 'tnt_demo2', 'tnt_coded'].map(
      (id) => s.get('tenants')!.get(id)!.tenantCode as string,
    );
    expect(new Set(codes).size).toBe(3);
    expect(codes[2]).toBe('583920');
    expect(codes.slice(0, 2).sort()).toEqual(['102938', '564738']);
    for (const [id, c] of [
      ['tnt_main', codes[0]],
      ['tnt_demo2', codes[1]],
    ] as const)
      expect(s.get('tenantCodes')!.get(c!)).toMatchObject({ tenantId: id, state: 'active' });
    const again = await migrateToTenant(ioOf(s), { tenantId: 'tnt_main', apply: true });
    expect(again.changed.tenantCodes).toBeUndefined();
    expect(s.get('tenants')!.get('tnt_main')!.tenantCode).toBe(codes[0]);
  });

  it('a lock already naming the tenant (earlier run stopped between the two writes) is reused', async () => {
    const s = store();
    s.get('tenantCodes')!.set('675849', { tenantId: 'tnt_demo2', state: 'active' });
    await migrateToTenant(ioOf(s), {
      tenantId: 'tnt_main',
      apply: true,
      newTenantCode: () => '918273',
    });
    expect(s.get('tenants')!.get('tnt_demo2')!.tenantCode).toBe('675849');
    expect(s.get('tenants')!.get('tnt_main')!.tenantCode).toBe('918273');
  });
});

describe('bootstrap gives the first tenant its code (owner decision 07/11/2026)', () => {
  it('creates the lock with the tenant, once', async () => {
    const m = new Map<string, DocData>();
    const io = {
      store: {
        async get(c: string, id: string) {
          return m.get(`${c}/${id}`) ?? null;
        },
        async create(c: string, id: string, d: DocData) {
          if (m.has(`${c}/${id}`)) throw new Error('exists');
          m.set(`${c}/${id}`, d);
        },
      },
      identity: { ensureUser: async () => undefined },
      now: new Date('2026-11-07T00:00:00Z'),
      appBaseUrl: 'https://x.vn',
    };
    const cfg = loadBootstrapConfig(
      {
        BOOTSTRAP_CONFIRM_PROJECT: 'gmep-staging',
        BOOTSTRAP_TENANT_NAME: 'Garage Test',
        BOOTSTRAP_BRANCH_CODE: 'q7',
        BOOTSTRAP_BRANCH_NAME: 'Chi nhánh Quận 7',
        BOOTSTRAP_OWNER_EMAIL: 'chu@example.vn',
        BOOTSTRAP_OWNER_NAME: 'Chủ Garage',
      },
      'gmep-staging',
    );
    m.set('tenantCodes/482913', { tenantId: 'other', state: 'active' });
    const seq = ['482913', '583920'];
    await runBootstrap(cfg, { ...io, newTenantCode: () => seq.shift()! });
    expect(m.get(`tenants/${cfg.tenantId}`)).toMatchObject({ tenantCode: '583920' });
    expect(m.get('tenantCodes/583920')).toMatchObject({ tenantId: cfg.tenantId, state: 'active' });
    const size = m.size;
    await runBootstrap(cfg, io);
    expect(m.size).toBe(size);
  });
});

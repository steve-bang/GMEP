import { describe, expect, it } from 'vitest';
import { demoDocs } from '@/infrastructure/seed/demo';
import {
  exportTenant,
  verifyTenantExport,
  type ExportSource,
} from '@/infrastructure/migration/tenantExport';
import { bulkTenantDocs, type DocMap } from '@/infrastructure/migration/rehearsal';

/**
 * FR-TEN-006 (minimum), RULE-020, 021: the one-tenant export contains that tenant and nothing of another, carries an
 * integrity code that catches any change, and leaves credentials out. Fake data only.
 */
const build = (): { docs: DocMap; files: Map<string, Uint8Array> } => {
  const docs: DocMap = new Map();
  const put = (c: string, id: string, d: Record<string, unknown>) => {
    if (!docs.has(c)) docs.set(c, new Map());
    docs.get(c)!.set(id, d);
  };
  for (const d of demoDocs())
    put(d.collection, d.id, structuredClone(d.data) as Record<string, unknown>);
  for (const t of ['tnt_demo', 'tnt_demo2'])
    for (const d of bulkTenantDocs(t, [`br_x_${t}`], 3)) put(d.collection, d.id, d.data);
  put('authTokens', 'tok1', { tenantId: 'tnt_demo', hash: 'secret-hash' });
  const files = new Map<string, Uint8Array>([
    ['invoice-xml/tnt_demo/br_q7/a.xml', Buffer.from('<a>demo</a>')],
    ['invoice-xml/tnt_demo2/br_x/b.xml', Buffer.from('<b>other tenant</b>')],
    ['rec-photos-order/tnt_demo/br_q7/p.jpg', Buffer.from('jpg-demo')],
    ['rec-photos-order/tnt_demo2/br_x/q.jpg', Buffer.from('jpg-other')],
  ]);
  return { docs, files };
};
const sourceOf = ({ docs, files }: ReturnType<typeof build>): ExportSource => ({
  async byTenant(c, t) {
    return [...(docs.get(c) ?? [])]
      .filter(([, d]) => d.tenantId === t)
      .map(([id, data]) => ({ id, data }));
  },
  async tenantRecord(t) {
    const d = docs.get('tenants')?.get(t);
    return d ? { id: t, data: d } : null;
  },
  async listFiles() {
    return [...files.keys()];
  },
  async readFile(p) {
    const b = files.get(p);
    return b ? { bytes: b, contentType: 'application/octet-stream' } : null;
  },
});

describe('FR-TEN-006 tenant export', () => {
  it('holds only the tenant: no other tenant id in any document or file, no credentials', async () => {
    const pkg = await exportTenant(sourceOf(build()), 'tnt_demo', new Date('2026-11-06T00:00:00Z'));
    expect(pkg.manifest.collections.payments).toBe(3);
    expect(pkg.manifest.collections.tenants).toBe(1);
    expect(pkg.manifest.files.map((f) => f.path).sort()).toEqual([
      'invoice-xml/tnt_demo/br_q7/a.xml',
      'rec-photos-order/tnt_demo/br_q7/p.jpg',
    ]);
    for (const [path, bytes] of pkg.entries) {
      if (path === 'manifest.json') continue;
      const text = Buffer.from(bytes).toString('utf8');
      expect(text, path).not.toMatch(/tnt_demo2/);
      expect(text, path).not.toMatch(/other tenant|jpg-other/);
    }
    expect(pkg.entries.has('data/authTokens.jsonl')).toBe(false);
    expect(JSON.stringify([...pkg.entries.keys()])).not.toMatch(/secret-hash/);
    // the other tenant exports its own data, equally clean
    const other = await exportTenant(sourceOf(build()), 'tnt_demo2', new Date());
    for (const [path, bytes] of other.entries) {
      if (path === 'manifest.json') continue;
      expect(Buffer.from(bytes).toString('utf8'), path).not.toMatch(/"tnt_demo"/);
    }
  });

  it('a source that returns a foreign document makes the export fail instead of leaking it', async () => {
    const src = sourceOf(build());
    const bad: ExportSource = {
      ...src,
      async byTenant(c, t) {
        return c === 'payments'
          ? [{ id: 'x', data: { tenantId: 'tnt_demo2', amountVnd: 1 } }]
          : src.byTenant(c, t);
      },
    };
    await expect(exportTenant(bad, 'tnt_demo', new Date())).rejects.toThrow(/isolation/);
  });

  it('the integrity code detects a changed, removed or added file', async () => {
    const pkg = await exportTenant(sourceOf(build()), 'tnt_demo', new Date());
    expect(verifyTenantExport(pkg.entries)).toEqual([]);
    const changed = new Map(pkg.entries);
    changed.set('data/payments.jsonl', Buffer.from('{}\n'));
    expect(verifyTenantExport(changed).join()).toMatch(/changed data\/payments/);
    const removed = new Map(pkg.entries);
    removed.delete('files/invoice-xml/tnt_demo/br_q7/a.xml');
    expect(verifyTenantExport(removed).join()).toMatch(/missing files/);
    const added = new Map(pkg.entries);
    added.set('files/x/tnt_demo/y.txt', Buffer.from('x'));
    expect(verifyTenantExport(added).join()).toMatch(/unlisted/);
    // editing the manifest to hide a change breaks the integrity code
    const m = JSON.parse(Buffer.from(pkg.entries.get('manifest.json')!).toString());
    m.data[0].sha256 = 'f'.repeat(64);
    const forged = new Map(pkg.entries);
    forged.set('manifest.json', Buffer.from(JSON.stringify(m)));
    expect(verifyTenantExport(forged).length).toBeGreaterThan(0);
  });

  it('refuses a malformed tenant id', async () => {
    await expect(exportTenant(sourceOf(build()), '../x', new Date())).rejects.toThrow();
  });
});

import { createHash } from 'node:crypto';
import type { StoredFile } from '@/platform/files/fileStore';
import { TENANT_COLLECTIONS, type MigrationDoc } from './tenantMigration';
import { stableJson } from './rehearsal';

/**
 * FR-TEN-006 (minimum), RULE-020, 021: exports ONE tenant's data, read only (nothing is deleted or changed).
 *
 * Isolation: every collection is read with `tenantId == <tenant>` (the tenant record by its id, files by the object path
 * `<area>/<tenant>/...`), then every document is checked again before it is written, so a wrong source can only make the
 * export fail, never leak another tenant. Credentials are not part of the export: password-reset and invitation token
 * hashes, quote OTPs and the e-mail outbox. The integrity code is a SHA-256 over the sorted per-file hashes (data and
 * files): `verifyTenantExport` recomputes it, so a changed, missing or added file is detected.
 */
export const EXPORT_COLLECTIONS: readonly string[] = [
  ...TENANT_COLLECTIONS.filter((c) => !EXCLUDED(c)),
  'roles',
];
function EXCLUDED(c: string): boolean {
  return c === 'authTokens' || c === 'quoteOtps' || c === 'emailOutbox';
}
export const EXPORT_EXCLUDED = ['authTokens', 'quoteOtps', 'emailOutbox', 'userKeys', 'sessions'];

export interface ExportSource {
  /** documents of one collection whose `tenantId` equals the tenant */
  byTenant(collection: string, tenantId: string): Promise<MigrationDoc[]>;
  tenantRecord(tenantId: string): Promise<MigrationDoc | null>;
  listFiles(prefix: string): Promise<string[]>;
  readFile(path: string): Promise<StoredFile | null>;
}

export interface ExportManifest {
  format: 'gmep-tenant-export/1';
  tenantId: string;
  exportedAt: string;
  collections: Record<string, number>;
  files: { path: string; sha256: string; bytes: number }[];
  data: { path: string; sha256: string; documents: number }[];
  excluded: string[];
  integrity: { algorithm: 'sha256'; value: string };
}

export interface ExportPackage {
  manifest: ExportManifest;
  /** relative path -> bytes (data/*.jsonl, files/<object path>) */
  entries: Map<string, Uint8Array>;
}

const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const encode = (v: unknown): unknown => {
  if (v instanceof Date) return { $date: v.toISOString() };
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function')
    return { $date: (v as { toDate(): Date }).toDate().toISOString() };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = encode(x);
    return o;
  }
  return v;
};

export const integrityOf = (m: Pick<ExportManifest, 'data' | 'files' | 'tenantId'>): string =>
  sha(
    stableJson({
      tenantId: m.tenantId,
      data: [...m.data].sort((a, b) => a.path.localeCompare(b.path)),
      files: [...m.files].sort((a, b) => a.path.localeCompare(b.path)),
    }),
  );

export async function exportTenant(
  src: ExportSource,
  tenantId: string,
  now: Date,
): Promise<ExportPackage> {
  if (!/^[a-z][a-z0-9_]{2,39}$/.test(tenantId)) throw new Error('invalid tenant id');
  const entries = new Map<string, Uint8Array>();
  const data: ExportManifest['data'] = [];
  const collections: Record<string, number> = {};
  const add = (collection: string, docs: MigrationDoc[]) => {
    for (const d of docs) {
      const own = d.data.tenantId === tenantId || (collection === 'tenants' && d.id === tenantId);
      if (!own) throw new Error(`isolation: ${collection}/${d.id} does not belong to ${tenantId}`);
    }
    if (docs.length === 0) return;
    const sorted = [...docs].sort((a, b) => a.id.localeCompare(b.id));
    const body = Buffer.from(
      sorted.map((d) => JSON.stringify({ id: d.id, d: encode(d.data) })).join('\n') + '\n',
    );
    const path = `data/${collection}.jsonl`;
    entries.set(path, body);
    data.push({ path, sha256: sha(body), documents: docs.length });
    collections[collection] = docs.length;
  };
  const rec = await src.tenantRecord(tenantId);
  if (rec) add('tenants', [{ id: rec.id, data: { ...rec.data, tenantId } }]);
  for (const c of EXPORT_COLLECTIONS) add(c, await src.byTenant(c, tenantId));

  const files: ExportManifest['files'] = [];
  for (const path of (await src.listFiles('')).sort()) {
    // object paths are `<area>/<tenant>/<branch>/<name>`: only this tenant's second segment qualifies
    if (path.split('/')[1] !== tenantId) continue;
    const f = await src.readFile(path);
    if (!f) continue;
    entries.set(`files/${path}`, f.bytes);
    files.push({ path, sha256: sha(f.bytes), bytes: f.bytes.byteLength });
  }
  const base = { tenantId, data, files };
  const manifest: ExportManifest = {
    format: 'gmep-tenant-export/1',
    tenantId,
    exportedAt: now.toISOString(),
    collections,
    files,
    data,
    excluded: EXPORT_EXCLUDED,
    integrity: { algorithm: 'sha256', value: integrityOf(base) },
  };
  entries.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  return { manifest, entries };
}

/** Recomputes every hash and the integrity code; returns the problems found (empty = intact). */
export function verifyTenantExport(entries: Map<string, Uint8Array>): string[] {
  const problems: string[] = [];
  const raw = entries.get('manifest.json');
  if (!raw) return ['manifest.json missing'];
  const m = JSON.parse(Buffer.from(raw).toString('utf8')) as ExportManifest;
  for (const d of m.data) {
    const b = entries.get(d.path);
    if (!b) problems.push(`missing ${d.path}`);
    else if (sha(b) !== d.sha256) problems.push(`changed ${d.path}`);
  }
  for (const f of m.files) {
    const b = entries.get(`files/${f.path}`);
    if (!b) problems.push(`missing files/${f.path}`);
    else if (sha(b) !== f.sha256) problems.push(`changed files/${f.path}`);
  }
  const listed = new Set([
    'manifest.json',
    ...m.data.map((d) => d.path),
    ...m.files.map((f) => `files/${f.path}`),
  ]);
  for (const k of entries.keys()) if (!listed.has(k)) problems.push(`unlisted ${k}`);
  if (integrityOf(m) !== m.integrity.value) problems.push('integrity code mismatch');
  return problems;
}

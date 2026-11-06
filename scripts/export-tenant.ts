/**
 * FR-TEN-006 (minimum), RULE-020, 021: exports ONE tenant's data to a directory, read only. Nothing is deleted.
 *   pnpm tsx --tsconfig tsconfig.json scripts/export-tenant.ts --tenant tnt_x --out <new-dir>
 *   pnpm tsx --tsconfig tsconfig.json scripts/export-tenant.ts --verify <dir>
 * Writes data/<collection>.jsonl, files/<object path> (e-invoice XML/PDF, photos) and manifest.json with a SHA-256 per
 * file and an integrity code. `--verify` recomputes them and exits 2 on any difference. Credentials (token hashes, OTPs,
 * mail outbox) are not exported. The output holds personal data of the tenant: store and hand it over accordingly.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { loadEnv } from '@/platform/config/env';
import { getDb } from '@/infrastructure/firestore/client';
import { FirebaseFileStore } from '@/infrastructure/files/firebaseFileStore';
import {
  exportTenant,
  verifyTenantExport,
  type ExportSource,
} from '@/infrastructure/migration/tenantExport';

const opt = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : undefined;
};

function readDir(dir: string): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.set(relative(dir, p).split('\\').join('/'), readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

async function main() {
  const verify = opt('verify');
  if (verify) {
    const problems = verifyTenantExport(readDir(verify));
    console.log(JSON.stringify({ dir: verify, intact: problems.length === 0, problems }, null, 2));
    if (problems.length) process.exitCode = 2;
    return;
  }
  const tenantId = opt('tenant');
  const out = opt('out');
  if (!tenantId || !out)
    throw new Error('usage: --tenant <tenantId> --out <new-dir> | --verify <dir>');
  if (existsSync(out) && readdirSync(out).length > 0) throw new Error('--out must be empty or new');
  const env = loadEnv(process.env);
  const db = getDb(env);
  const files = new FirebaseFileStore(env);
  const src: ExportSource = {
    async byTenant(collection, t) {
      const snap = await db.collection(collection).where('tenantId', '==', t).get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async tenantRecord(t) {
      const d = await db.collection('tenants').doc(t).get();
      return d.exists ? { id: d.id, data: d.data()! } : null;
    },
    listFiles: (prefix) => files.list(prefix),
    readFile: (path) => files.get(path),
  };
  const pkg = await exportTenant(src, tenantId, new Date());
  for (const [rel, bytes] of pkg.entries) {
    const p = join(out, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, bytes);
  }
  console.log(
    JSON.stringify(
      {
        tenantId,
        out,
        collections: pkg.manifest.collections,
        files: pkg.manifest.files.length,
        integrity: pkg.manifest.integrity,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

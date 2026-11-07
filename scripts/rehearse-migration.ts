/**
 * FR-TEN-031 / UAT-TEN-11 / Q37 gate: rehearses scripts/migrate-to-tenant.ts on the Firebase Emulator with a large data set.
 *   pnpm exec firebase emulators:exec --only firestore,auth --project demo-gmep \
 *     "pnpm tsx --tsconfig tsconfig.json scripts/rehearse-migration.ts [--per-branch 1500] [--out <dir>]"
 * Steps: seed + bulk tenant data (numbers, counters, money, e-invoice requests with provider keys) -> turn it into the
 * pre-MT-0 shape -> backup -> dry run (must write nothing) -> apply -> compare EVERY document with the original -> run again
 * (must change nothing) -> rollback drill (restore the backup, equals the legacy data; migrate again, equals the original).
 * Prints a JSON report; exit code 2 when any check fails. Emulator only.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from '@/platform/config/env';
import { getDb } from '@/infrastructure/firestore/client';
import { seedFirestoreEmulator } from '@/infrastructure/seed/seed';
import { migrateToTenant } from '@/infrastructure/migration/tenantMigration';
import {
  ALL_COLLECTIONS,
  bulkTenantDocs,
  countDocs,
  diffDocMaps,
  downgradeToLegacy,
  onlyTenant,
} from '@/infrastructure/migration/rehearsal';
import {
  clearCollections,
  firestoreMigrationIo,
  fromJsonLines,
  loadCollections,
  toJsonLines,
  writeDocMap,
} from '@/infrastructure/migration/firestoreSnapshot';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? (process.argv[i + 1] ?? d) : d;
};
const T = 'tnt_demo';

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error('Emulator only: FIRESTORE_EMULATOR_HOST not set.');
  const env = loadEnv(process.env);
  const db = getDb(env);
  // A fresh private directory (0700) unless --out is given: no predictable path in the shared temp dir.
  const given = arg('out', '');
  const out = given || mkdtempSync(join(tmpdir(), 'gmep-rehearsal-'));
  if (given) mkdirSync(out, { recursive: true, mode: 0o700 });
  const checks: Record<string, boolean | number | string> = {};
  const t0 = Date.now();
  const lap = (l: string) => (checks[`ms.${l}`] = Date.now() - t0);

  await clearCollections(db, ALL_COLLECTIONS);
  await seedFirestoreEmulator(env);
  const bulk = new Map<string, Map<string, Record<string, unknown>>>();
  for (const d of bulkTenantDocs(T, ['br_q7', 'br_td'], Number(arg('per-branch', '1500')))) {
    if (!bulk.has(d.collection)) bulk.set(d.collection, new Map());
    bulk.get(d.collection)!.set(d.id, d.data);
  }
  await writeDocMap(db, bulk);
  const original = onlyTenant(await loadCollections(db, ALL_COLLECTIONS), T);
  checks.documents = countDocs(original);
  lap('seeded');

  // the legacy world: one company, pre-MT-0 shape
  await clearCollections(db, ALL_COLLECTIONS);
  const legacy = downgradeToLegacy(original, T);
  await writeDocMap(db, legacy);
  const backup = toJsonLines(await loadCollections(db, ALL_COLLECTIONS));
  writeFileSync(join(out, 'legacy-backup.jsonl'), backup, { mode: 0o600 });
  checks.backupBytes = backup.length;

  const io = firestoreMigrationIo(db);
  const dry = await migrateToTenant(io, { tenantId: T, apply: false });
  const afterDry = await loadCollections(db, ALL_COLLECTIONS);
  checks.dryRunWroteNothing = diffDocMaps(legacy, afterDry).length === 0;
  lap('dryRun');

  const run = await migrateToTenant(io, { tenantId: T, apply: true });
  checks.reconciled = run.reconciled;
  checks.warnings = run.warnings.length;
  const migrated = await loadCollections(db, ALL_COLLECTIONS);
  const diff = diffDocMaps(original, migrated, ['tenants', 'companies']);
  checks.documentsDifferingFromOriginal = diff.length;
  checks.migratedEqualsOriginal = diff.length === 0;
  lap('apply');

  const again = await migrateToTenant(io, { tenantId: T, apply: true });
  checks.secondRunChangedNothing = Object.values(again.changed).every((n) => n === 0);

  // rollback drill: the backup is the plan
  await clearCollections(db, ALL_COLLECTIONS);
  await writeDocMap(db, fromJsonLines(backup)); // the same thing `migrate-to-tenant.ts --restore` does
  const restored = await loadCollections(db, ALL_COLLECTIONS);
  checks.rollbackRestoresLegacy = diffDocMaps(legacy, restored).length === 0;
  await migrateToTenant(io, { tenantId: T, apply: true });
  checks.reapplyAfterRollbackEqualsOriginal =
    diffDocMaps(original, await loadCollections(db, ALL_COLLECTIONS), ['tenants', 'companies'])
      .length === 0;
  lap('rollbackDrill');

  const report = {
    tenantId: T,
    checks,
    changed: run.changed,
    rekeyed: run.rekeyed.length,
    diffSample: diff.slice(0, 10),
    moneyBefore: run.before.sums,
    moneyAfter: run.after.sums,
  };
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  void dry;
  const ok = [
    checks.dryRunWroteNothing,
    checks.reconciled,
    checks.migratedEqualsOriginal,
    checks.secondRunChangedNothing,
    checks.rollbackRestoresLegacy,
    checks.reapplyAfterRollbackEqualsOriginal,
  ].every(Boolean);
  if (!ok) process.exitCode = 2;
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

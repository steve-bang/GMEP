/**
 * FR-TEN-031: converts Emulator data written before MT-0 into tenant number 1. DRY-RUN unless `--apply`.
 *   pnpm tsx --tsconfig tsconfig.json scripts/migrate-to-tenant.ts --tenant tnt_main [--apply] [--backup <file.jsonl>]
 *   pnpm tsx --tsconfig tsconfig.json scripts/migrate-to-tenant.ts --restore <file.jsonl>      (rollback: wipes and restores)
 * `--tenant` MUST equal the old company id: the value is kept so document numbers, counters and the e-invoice provider
 * keys (`gmep:<tenant>:<request>`) stay valid. `--backup` writes every collection to a JSON-lines file BEFORE the apply:
 * that file is the rollback plan (`--restore`). Refuses to run unless FIRESTORE_EMULATOR_HOST is set: there is no real data
 * yet, and this tool must never be pointed at production by accident (a rehearsal on a copy of real data needs a decision).
 * Prints the reconciliation (counts and money sums before and after) as JSON. Rehearsal: scripts/rehearse-migration.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from '@/platform/config/env';
import { getDb } from '@/infrastructure/firestore/client';
import { migrateToTenant } from '@/infrastructure/migration/tenantMigration';
import { ALL_COLLECTIONS } from '@/infrastructure/migration/rehearsal';
import {
  clearCollections,
  firestoreMigrationIo,
  fromJsonLines,
  loadCollections,
  toJsonLines,
  writeDocMap,
} from '@/infrastructure/migration/firestoreSnapshot';

const opt = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  const v = i >= 0 ? args[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : undefined;
};

async function main() {
  const args = process.argv.slice(2);
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set (emulator only).');
  const db = getDb(loadEnv(process.env));
  const restore = opt(args, '--restore');
  if (restore) {
    const map = fromJsonLines(readFileSync(restore, 'utf8'));
    await clearCollections(db, ALL_COLLECTIONS);
    await writeDocMap(db, map);
    console.log(JSON.stringify({ restored: restore, collections: map.size }));
    return;
  }
  const tenantId = opt(args, '--tenant');
  if (!tenantId)
    throw new Error('usage: --tenant <tenantId> [--apply] [--backup <file>] | --restore <file>');
  const apply = args.includes('--apply');
  const backup = opt(args, '--backup');
  if (apply && !backup)
    throw new Error('--apply needs --backup <file>: the backup is the rollback plan.');
  if (backup) writeFileSync(backup, toJsonLines(await loadCollections(db, ALL_COLLECTIONS)));
  const report = await migrateToTenant(firestoreMigrationIo(db), { tenantId, apply });
  console.log(JSON.stringify(report, null, 2));
  if (report.apply && !report.reconciled) process.exitCode = 2;
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

/**
 * FR-TEN-031: converts Emulator data written before MT-0 into tenant number 1. DRY-RUN unless `--apply`.
 *   pnpm tsx --tsconfig tsconfig.json scripts/migrate-to-tenant.ts --tenant tnt_main [--apply]
 * Refuses to run unless FIRESTORE_EMULATOR_HOST is set: there is no real data yet, and this tool must never be pointed at
 * production by accident. Prints the reconciliation (counts and money sums before and after) as JSON.
 */
import { loadEnv } from '@/platform/config/env';
import { getDb } from '@/infrastructure/firestore/client';
import { migrateToTenant, type MigrationIo } from '@/infrastructure/migration/tenantMigration';

async function main() {
  const args = process.argv.slice(2);
  const tenantId = args[args.indexOf('--tenant') + 1];
  if (!tenantId || tenantId.startsWith('--'))
    throw new Error('usage: --tenant <tenantId> [--apply]');
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set (emulator only).');
  const db = getDb(loadEnv(process.env));
  const io: MigrationIo = {
    async list(collection) {
      const snap = await db.collection(collection).get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async set(collection, id, data) {
      await db.collection(collection).doc(id).set(data);
    },
    async remove(collection, id) {
      await db.collection(collection).doc(id).delete();
    },
  };
  const report = await migrateToTenant(io, { tenantId, apply: args.includes('--apply') });
  console.log(JSON.stringify(report, null, 2));
  if (report.apply && !report.reconciled) process.exitCode = 2;
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

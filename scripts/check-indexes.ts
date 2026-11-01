/**
 * S8 / H3: verifies that every query the repositories can issue is covered by a composite index in
 * firestore.indexes.json. The query catalogue is NOT hand-written here: it is the registry that
 * infrastructure/repos/queries.ts fills (the store refuses unregistered shapes), so adding a
 * repository query without registering it fails at runtime and in tests/unit/indexes.test.ts.
 * The Emulator does not enforce indexes, so this static check guards "passes locally, fails in prod".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { registeredQueries } from '@/platform/store/docStore';
import {
  indexSatisfies,
  requiredIndex,
  requiredIndexDefs,
  type IndexDef,
} from '@/platform/store/indexes';
import '@/infrastructure/repos/queries';

if (process.argv.includes('--write')) {
  const indexes = requiredIndexDefs();
  // Firestore TTL policies (H2): documents are deleted after `expiresAt`; see infra/firestore-ttl.md
  const ttl = ['idempotencyKeys', 'rateLimits', 'notifications', 'emailOutbox'].map((c) => ({
    collectionGroup: c,
    fieldPath: 'expiresAt',
    ttl: true,
    indexes: [] as unknown[],
  }));
  writeFileSync(
    'firestore.indexes.json',
    JSON.stringify({ indexes, fieldOverrides: ttl }, null, 2) + '\n',
  );
  console.log(
    `Wrote ${indexes.length} composite indexes and ${ttl.length} TTL policies to firestore.indexes.json`,
  );
  process.exit(0);
}

const file = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: IndexDef[] };
let missing = 0;
for (const shape of registeredQueries()) {
  const need = requiredIndex(shape);
  if (!need) {
    console.log(`ok   ${shape.name} (single-field, automatic)`);
    continue;
  }
  if (file.indexes.some((d) => indexSatisfies(d, need))) console.log(`ok   ${shape.name}`);
  else {
    missing++;
    console.error(`MISSING index for ${shape.name}: ${JSON.stringify(need)}`);
  }
}
if (missing) {
  console.error(
    `${missing} query shape(s) have no composite index in firestore.indexes.json (run pnpm indexes:generate)`,
  );
  process.exit(1);
}
console.log(`All ${registeredQueries().length} query shapes are covered by firestore.indexes.json`);

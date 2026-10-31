/**
 * S8: verifies that every query the Firestore adapters can issue (src/infrastructure/firestore/queries.ts)
 * is covered by a composite index in firestore.indexes.json. The Emulator does not enforce indexes,
 * so this is the guard that keeps "passes locally, fails in prod" out. Exit code 1 on any gap.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  allQuerySpecs,
  indexSatisfies,
  requiredIndex,
  type IndexDef,
} from '@/infrastructure/firestore/queries';

if (process.argv.includes('--write')) {
  // Regenerate firestore.indexes.json from the query catalogue (deduplicated, stable order).
  const seen = new Map<string, IndexDef>();
  for (const spec of allQuerySpecs()) {
    const need = requiredIndex(spec);
    if (!need) continue;
    const def: IndexDef = {
      collectionGroup: need.collectionGroup,
      queryScope: 'COLLECTION',
      fields: [
        ...need.equalityFields.map((f) => ({ fieldPath: f, order: 'ASCENDING' as const })),
        ...need.orderFields,
      ],
    };
    seen.set(JSON.stringify(def), def);
  }
  const indexes = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d);
  writeFileSync(
    'firestore.indexes.json',
    JSON.stringify({ indexes, fieldOverrides: [] }, null, 2) + '\n',
  );
  console.log(`Wrote ${indexes.length} composite indexes to firestore.indexes.json`);
  process.exit(0);
}

const file = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: IndexDef[] };
let missing = 0;
for (const spec of allQuerySpecs()) {
  const need = requiredIndex(spec);
  if (!need) {
    console.log(`ok   ${spec.name} (single-field, automatic)`);
    continue;
  }
  if (file.indexes.some((d) => indexSatisfies(d, need))) console.log(`ok   ${spec.name}`);
  else {
    missing++;
    console.error(`MISSING index for ${spec.name}: ${JSON.stringify(need)}`);
  }
}
if (missing) {
  console.error(`${missing} query variant(s) have no composite index in firestore.indexes.json`);
  process.exit(1);
}
console.log('All query variants are covered by firestore.indexes.json');

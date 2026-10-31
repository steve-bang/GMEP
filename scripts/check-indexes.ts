/**
 * S8: verifies that every query the Firestore adapters can issue (src/infrastructure/firestore/queries.ts)
 * is covered by a composite index in firestore.indexes.json. The Emulator does not enforce indexes,
 * so this is the guard that keeps "passes locally, fails in prod" out. Exit code 1 on any gap.
 */
import { readFileSync } from 'node:fs';
import {
  allQuerySpecs,
  indexSatisfies,
  requiredIndex,
  type IndexDef,
} from '@/infrastructure/firestore/queries';

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

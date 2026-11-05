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
  indexBudget,
  INDEX_FAIL_ABOVE,
  INDEX_LIMIT,
  INDEX_WARN_AT,
} from '@/platform/store/indexBudget';
import {
  indexSatisfies,
  requiredIndex,
  requiredIndexDefs,
  type IndexDef,
} from '@/platform/store/indexes';
import { countByModule, ownerOf, prefixCandidates, sliceOf } from '@/platform/store/indexReport';
import '@/infrastructure/repos/queries';

if (process.argv.includes('--write')) {
  const indexes = requiredIndexDefs();
  // Firestore TTL policies (H2): documents are deleted after `expiresAt`; see infra/firestore-ttl.md
  const ttl = [
    'idempotencyKeys',
    'rateLimits',
    'notifications',
    'emailOutbox',
    'messageOutbox',
    'quoteOtps',
    'messageDeliveries',
  ].map((c) => ({
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

if (process.argv.includes('--budget') || process.argv.includes('--report')) {
  // Per-module table and per-index owner/queries (markdown, paste into docs/dev/index-budget.md)
  const declaredDefs = (
    JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: IndexDef[] }
  ).indexes;
  const queries = registeredQueries();
  const rows: string[] = [];
  for (const d of declaredDefs) {
    const mod = ownerOf(d.collectionGroup);
    const users = queries
      .filter((q) => {
        const need = requiredIndex(q);
        return need ? indexSatisfies(d, need) : false;
      })
      .map((q) => q.name);
    const f = d.fields
      .map((x) => `${x.fieldPath}${x.order === 'DESCENDING' ? ' desc' : ''}`)
      .join(', ');
    rows.push(
      `| ${mod} | ${d.collectionGroup} | ${f} | ${d.queryScope} | ${sliceOf(d.collectionGroup)} | ${users.join('; ') || 'NONE (unused)'} |`,
    );
  }
  console.log(
    `Declared ${declaredDefs.length}/${INDEX_LIMIT} (warn ${INDEX_WARN_AT}, fail above ${INDEX_FAIL_ABOVE}).`,
  );
  console.log('| Module | Indexes |\n| --- | ---: |');
  for (const [m, n] of countByModule(declaredDefs)) console.log(`| ${m} | ${n} |`);
  console.log(
    '\n| Module | Collection | Fields | Scope | FR, slice | Queries |\n| --- | --- | --- | --- | --- | --- |',
  );
  console.log(rows.sort().join('\n'));
  // Conservative merge candidates (never an automatic removal), see platform/store/indexReport.ts
  const cands = prefixCandidates(declaredDefs);
  console.log(`\n${cands.length} prefix candidate(s)`);
  for (const c of cands) console.log(`prefix-candidate: ${c.reason}`);
  const unused = rows.filter((r) => r.endsWith('NONE (unused)'));
  console.log(`${unused.length} index(es) used by no registered query`);
  process.exit(0);
}

const file = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: IndexDef[] };

// R68 (BA §20): see platform/store/indexBudget.ts
const declared = file.indexes.length;
const budget = indexBudget(declared);
if (budget === 'fail') {
  console.error(
    `${declared} composite indexes declared: over the budget of ${INDEX_FAIL_ABOVE} (limit ${INDEX_LIMIT}, the rest is reserved). Reuse an existing query shape, filter in memory over a bounded set, or denormalise a key field (R68).`,
  );
  process.exit(1);
}
if (budget === 'warn')
  console.warn(
    `WARNING: ${declared}/${INDEX_LIMIT} composite indexes declared (warn at ${INDEX_WARN_AT}, fail above ${INDEX_FAIL_ABOVE}).`,
  );
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

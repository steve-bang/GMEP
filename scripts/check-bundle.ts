/**
 * R-12 / ADR §4: nothing Firebase may reach the browser. Scans every file Next.js emits for the
 * browser (.next/static) plus the public folder for Firebase SDK / project identifiers.
 * Fails on any hit. Run after `pnpm build`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = process.argv.length > 2 ? process.argv.slice(2) : ['.next/static', 'public'];
const FORBIDDEN = [
  /firebase/i,
  /firebaseapp\.com/i,
  /googleapis\.com\/identitytoolkit/i,
  /firestore\.googleapis/i,
  /AIza[0-9A-Za-z_-]{35}/,
  /@firebase\//,
];
// Signed media URLs (ADR A1) are plain <img>/<video> URLs, not SDK code; storage.googleapis.com is allowed in CSP later.

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let files = 0;
const hits: string[] = [];
for (const root of ROOTS) {
  for (const f of walk(root)) {
    if (!/\.(js|mjs|css|html|json|map|txt|svg)$/.test(f)) continue;
    files++;
    const text = readFileSync(f, 'utf8');
    for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${f}: ${re}`);
  }
}
if (files === 0) {
  console.error('No browser bundle files found; run `pnpm build` first.');
  process.exit(2);
}
if (hits.length) {
  console.error(`Firebase references found in browser output:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`Browser bundle clean: ${files} files scanned, no Firebase references.`);

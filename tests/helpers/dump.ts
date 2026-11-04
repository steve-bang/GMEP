import { getDb } from '@/infrastructure/firestore/client';
import type { Harness } from '../integration/harness';

/**
 * Every collection of the running backend as JSON text (test-only forensic view, used to prove what is NOT stored,
 * e.g. raw tokens, or what the audit trail does not contain, e.g. full personal data).
 */
export async function dumpCollections(h: Harness): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (h.backend === 'memory') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = (h.container.memory!.db as any).cols as Map<string, Map<string, unknown>>;
    for (const [name, docs] of cols) out[name] = JSON.stringify([...docs.values()]);
    return out;
  }
  const db = getDb(h.container.env);
  for (const col of await db.listCollections()) {
    const snap = await col.get();
    out[col.id] = JSON.stringify(snap.docs.map((d) => d.data()));
  }
  return out;
}

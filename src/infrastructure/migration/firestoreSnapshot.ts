import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { DocMap } from './rehearsal';
import type { MigrationIo } from './tenantMigration';

/**
 * Firestore helpers for the migration tools (FR-TEN-031, FR-TEN-006): read whole collections into a DocMap, write a DocMap
 * back, and a JSON-lines snapshot that survives dates. Used by the migration CLI (backup/restore = the rollback plan),
 * the rehearsal and the tenant export. Emulator or a copy; the CLIs refuse anything else.
 */
const fromStore = (v: unknown): unknown => {
  if (v instanceof Timestamp) return v.toDate();
  if (Array.isArray(v)) return v.map(fromStore);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = fromStore(x);
    return o;
  }
  return v;
};

export async function loadCollections(db: Firestore, collections: string[]): Promise<DocMap> {
  const out: DocMap = new Map();
  for (const c of collections) {
    const m = new Map<string, Record<string, unknown>>();
    const snap = await db.collection(c).get();
    for (const d of snap.docs) m.set(d.id, fromStore(d.data()) as Record<string, unknown>);
    out.set(c, m);
  }
  return out;
}

export async function clearCollections(db: Firestore, collections: string[]): Promise<void> {
  for (const c of collections) {
    const snap = await db.collection(c).select().get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = db.batch();
      for (const d of snap.docs.slice(i, i + 400)) b.delete(d.ref);
      await b.commit();
    }
  }
}

export async function writeDocMap(db: Firestore, map: DocMap): Promise<void> {
  for (const [c, docs] of map) {
    const entries = [...docs];
    for (let i = 0; i < entries.length; i += 400) {
      const b = db.batch();
      for (const [id, data] of entries.slice(i, i + 400)) b.set(db.collection(c).doc(id), data);
      await b.commit();
    }
  }
}

export function firestoreMigrationIo(db: Firestore): MigrationIo {
  return {
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
}

const replacer = (_k: string, v: unknown) => v;
const encode = (v: unknown): unknown => {
  if (v instanceof Date) return { $date: v.toISOString() };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = encode(x);
    return o;
  }
  return v;
};
const decode = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === '$date') return new Date((v as { $date: string }).$date);
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = decode(x);
    return o;
  }
  return v;
};

/** One line per document: `{"c": collection, "id": id, "d": data}`. */
export function toJsonLines(map: DocMap): string {
  const lines: string[] = [];
  for (const [c, docs] of map)
    for (const [id, d] of docs) lines.push(JSON.stringify({ c, id, d: encode(d) }, replacer));
  return lines.join('\n') + '\n';
}

export function fromJsonLines(text: string): DocMap {
  const out: DocMap = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const { c, id, d } = JSON.parse(line) as { c: string; id: string; d: unknown };
    if (!out.has(c)) out.set(c, new Map());
    out.get(c)!.set(id, decode(d) as Record<string, unknown>);
  }
  return out;
}

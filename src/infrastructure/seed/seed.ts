import { getAuth } from 'firebase-admin/auth';
import type { Env } from '@/platform/config/env';
import { getAdminApp, getDb } from '../firestore/client';
import type { MemoryDb } from '../store/memoryDocStore';
import type { MemoryIdentityProvider } from '../memory/memoryIdentity';
import { DEMO_PASSWORD, demoDocs, demoUsers } from './demo';

/** Seeds the Emulator Suite. Refuses to run unless both emulator hosts are configured. */
export async function seedFirestoreEmulator(env: Env): Promise<void> {
  if (!env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'Refusing to seed: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must be set (emulator only).',
    );
  }
  const db = getDb(env);
  const auth = getAuth(getAdminApp(env));
  for (const u of demoUsers) {
    try {
      await auth.deleteUser(u.id);
    } catch {
      /* not present */
    }
    await auth.createUser({
      uid: u.id,
      email: u.email,
      password: DEMO_PASSWORD,
      displayName: u.displayName,
      disabled: u.status === 'disabled',
    });
  }
  const docs = demoDocs();
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400))
      batch.set(db.collection(d.collection).doc(d.id), d.data);
    await batch.commit();
  }
}

export function seedMemory(mem: { db: MemoryDb; identity: MemoryIdentityProvider }): void {
  for (const u of demoUsers)
    mem.identity.addAccount(u.email, u.id, DEMO_PASSWORD, u.status === 'disabled');
  for (const d of demoDocs()) mem.db.col(d.collection).set(d.id, structuredClone(d.data));
}

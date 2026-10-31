import { getAuth } from 'firebase-admin/auth';
import type { Env } from '@/platform/config/env';
import { normalizeSearch } from '@/platform/text/normalize';
import { warehouseId, type Warehouse } from '@/modules/sys';
import { getAdminApp, getDb } from '../firestore/client';
import { warehouseToDoc } from '../firestore/mappers';
import type { MemoryDb, MemoryIdentityProvider } from '../memory/memory';
import {
  DEMO_COMPANY,
  DEMO_PASSWORD,
  demoAssignments,
  demoBranches,
  demoRoles,
  demoUsers,
  demoWarehouseSeeds,
} from './demo';

const SEED_TIME = new Date('2026-10-01T00:00:00.000Z');

export function demoWarehouses(): Warehouse[] {
  return demoWarehouseSeeds.map((w) => ({
    id: warehouseId(w.branchId, w.code),
    companyId: DEMO_COMPANY,
    branchId: w.branchId,
    code: w.code,
    name: w.name,
    nameNorm: normalizeSearch(w.name),
    status: 'active',
    createdAt: SEED_TIME,
    createdBy: 'seed',
    updatedAt: SEED_TIME,
    updatedBy: 'seed',
    version: 1,
  }));
}

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
  const batch = db.batch();
  for (const u of demoUsers) {
    const { id, ...rest } = u;
    batch.set(db.collection('users').doc(id), rest);
  }
  for (const b of demoBranches) {
    const { id, ...rest } = b;
    batch.set(db.collection('branches').doc(id), rest);
  }
  for (const r of demoRoles)
    batch.set(db.collection('roles').doc(r.code), { name: r.name, permissions: r.permissions });
  for (const a of demoAssignments) {
    const { id, ...rest } = a;
    batch.set(db.collection('roleAssignments').doc(id), rest);
  }
  for (const w of demoWarehouses())
    batch.set(db.collection('warehouses').doc(w.id), warehouseToDoc(w));
  await batch.commit();
}

export function seedMemory(mem: { db: MemoryDb; identity: MemoryIdentityProvider }): void {
  for (const u of demoUsers) {
    mem.db.col('users').set(u.id, u);
    mem.identity.addAccount(u.email, u.id, DEMO_PASSWORD);
  }
  for (const b of demoBranches) mem.db.col('branches').set(b.id, b);
  for (const r of demoRoles) mem.db.col('roles').set(r.code, r);
  for (const a of demoAssignments) mem.db.col('roleAssignments').set(a.id, a);
  for (const w of demoWarehouses()) mem.db.col('warehouses').set(w.id, w);
}

import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Env } from '@/platform/config/env';

/**
 * Admin SDK bootstrap (server only). With FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
 * set the SDK talks to the Emulator Suite and needs no credentials. In dev/staging/prod it uses
 * Application Default Credentials of the Cloud Run service account: no key files in the repo.
 */
export function getAdminApp(env: Env): App {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({ projectId: env.GCLOUD_PROJECT });
}

let db: Firestore | undefined;

export function getDb(env: Env): Firestore {
  if (db) return db;
  const app = getAdminApp(env);
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

/**
 * Creates the minimum data of a real environment (company, branch, warehouse, roles, owner account). Idempotent.
 * NOT for the emulator (use `pnpm seed`). Needs Application Default Credentials and the BOOTSTRAP_* variables, see
 * docs/dev/deploy-guide.md section 8. Prints the owner's single-use activation link once: treat it as a secret.
 */
import { getAuth } from 'firebase-admin/auth';
import { loadEnv } from '@/platform/config/env';
import { getAdminApp, getDb } from '@/infrastructure/firestore/client';
import { loadBootstrapConfig, runBootstrap } from '@/infrastructure/seed/bootstrap';
import { randomBytes } from 'node:crypto';

async function main() {
  const env = loadEnv();
  if (env.GMEP_ENV === 'local' || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error(
      'Bootstrap is for dev/staging/prod only (no emulator hosts, GMEP_ENV not local).',
    );
  const baseUrl = env.APP_BASE_URL ?? env.APP_ORIGIN;
  if (!baseUrl) throw new Error('APP_BASE_URL or APP_ORIGIN is required (activation link).');
  const cfg = loadBootstrapConfig(process.env, env.GCLOUD_PROJECT);
  const db = getDb(env);
  const auth = getAuth(getAdminApp(env));
  const res = await runBootstrap(cfg, {
    now: new Date(),
    appBaseUrl: baseUrl,
    store: {
      async get(collection, id) {
        const s = await db.collection(collection).doc(id).get();
        return s.exists ? (s.data() as Record<string, unknown>) : null;
      },
      async create(collection, id, data) {
        await db.collection(collection).doc(id).create(data);
      },
    },
    identity: {
      async ensureUser(u) {
        try {
          await auth.getUser(u.uid);
        } catch (e) {
          if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
          await auth.createUser({
            ...u,
            password: randomBytes(32).toString('base64url'),
          });
        }
      },
    },
  });
  console.log(`created: ${res.created.length}, already present: ${res.skipped.length}`);
  if (res.activationLink)
    console.log(`Owner activation link (single use, 72 h):\n${res.activationLink}`);
  else console.log('No new activation link issued.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

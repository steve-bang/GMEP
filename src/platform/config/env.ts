import { z } from 'zod';

/**
 * Server-side configuration from the environment. Nothing here is ever shipped to the browser
 * (no NEXT_PUBLIC_* variables are defined). Secrets come only from env / Secret Manager.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GMEP_ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
  GMEP_DATA_BACKEND: z.enum(['firestore', 'memory']).default('firestore'),
  GCLOUD_PROJECT: z.string().default('demo-gmep'),
  FIREBASE_API_KEY: z.string().default('demo-api-key'),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  FIREBASE_STORAGE_EMULATOR_HOST: z.string().optional(),
  APP_ORIGIN: z.string().url().optional(),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 14)
    .default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(1).default(30),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().min(1).default(24),
  LOG_LEVEL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const env = schema.parse(source);
  if (env.GMEP_ENV === 'local' && env.GMEP_DATA_BACKEND === 'firestore') {
    // Safety: local runs must never reach real Google services.
    if (!env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error(
        'GMEP_ENV=local requires FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST (Firebase Emulator Suite). Refusing to contact real Google services.',
      );
    }
  }
  if (env.GMEP_ENV !== 'local' && env.GMEP_DATA_BACKEND === 'memory') {
    throw new Error('GMEP_DATA_BACKEND=memory is for tests/local only.');
  }
  return env;
}

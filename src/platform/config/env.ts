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
  /** private bucket for business files (e-invoice XML/PDF); defaults to the project's default bucket */
  GMEP_FILES_BUCKET: z.string().optional(),
  APP_ORIGIN: z.string().url().optional(),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 14)
    .default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(1).default(30),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().min(1).default(24),
  /** H1: seconds a verified session/actor is served from memory (= max staleness of a revocation on other instances) */
  AUTH_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(300).default(30),
  CONFIG_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(600).default(60),
  /** number of trusted reverse proxies in front of the app (Cloud Run = 1) for X-Forwarded-For */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  /** brand-new links in emails (invitation, reset) are built from this; falls back to APP_ORIGIN */
  APP_BASE_URL: z.string().url().optional(),
  /** shared secret of the internal cron endpoint (header x-cron-secret); unset = endpoint disabled (404). Secret Manager in real envs */
  CRON_SECRET: z.string().min(32).optional(),
  /** Cloud Scheduler OIDC: expected `aud` and the scheduler service-account email; both set = Bearer tokens accepted */
  CRON_OIDC_AUDIENCE: z.string().min(1).optional(),
  CRON_OIDC_SERVICE_ACCOUNT: z.string().email().optional(),
  /** company whose branches the cron endpoint processes (single legal entity today [Cần xác nhận]) */
  CRON_COMPANY_ID: z.string().min(1).optional(),
  /** SMTP url of the transactional email provider (secret). Unset outside prod = dev outbox collection */
  EMAIL_SMTP_URL: z.string().min(1).optional(),
  /** sender, e.g. "GMEP <no-reply@example.vn>" */
  EMAIL_FROM: z.string().min(3).optional(),
  /**
   * A4: dev adapters for the short-message channels, comma list of `sms`, `zalo`. They only write to the `messageOutbox`
   * collection and send nothing. Refused in prod (the outbox holds links and codes in clear text); a real provider is another adapter.
   */
  MESSAGE_DEV_CHANNELS: z
    .string()
    .regex(/^(sms|zalo)(,(sms|zalo))*$/)
    .optional(),
  LOG_LEVEL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const env = schema.parse(source);
  if (!env.CRON_OIDC_AUDIENCE !== !env.CRON_OIDC_SERVICE_ACCOUNT) {
    throw new Error('CRON_OIDC_AUDIENCE and CRON_OIDC_SERVICE_ACCOUNT must be set together.');
  }
  if (!env.EMAIL_SMTP_URL !== !env.EMAIL_FROM) {
    throw new Error('EMAIL_SMTP_URL and EMAIL_FROM must be set together.');
  }
  if (env.GMEP_ENV === 'prod' && !env.EMAIL_SMTP_URL) {
    throw new Error(
      'GMEP_ENV=prod requires EMAIL_SMTP_URL and EMAIL_FROM (invitation and reset emails).',
    );
  }
  if (env.GMEP_ENV === 'prod' && env.MESSAGE_DEV_CHANNELS) {
    throw new Error('MESSAGE_DEV_CHANNELS is for local, test and staging only (never prod).');
  }
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

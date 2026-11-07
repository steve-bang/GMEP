import { describe, expect, it } from 'vitest';
import { einFakeProviderEnabled, loadEnv } from './env';

const PROD = {
  GMEP_ENV: 'prod',
  EMAIL_SMTP_URL: 'smtps://u:p@smtp.example.vn:465',
  EMAIL_FROM: 'GMEP <no-reply@example.vn>',
  GCLOUD_PROJECT: 'gmep-prod',
  FIREBASE_API_KEY: 'k-real',
  APP_BASE_URL: 'https://gmep.example.vn',
  CRON_TENANT_ID: 'tnt_main',
  CRON_OIDC_AUDIENCE: 'https://gmep.example.vn',
  CRON_OIDC_SERVICE_ACCOUNT: 'cron@gmep-prod.iam.gserviceaccount.com',
};

describe('environment safety', () => {
  it('refuses to run locally against real Google services (no emulator hosts)', () => {
    expect(() => loadEnv({ GMEP_ENV: 'local', GMEP_DATA_BACKEND: 'firestore' })).toThrow(
      /Emulator/,
    );
  });
  it('accepts local runs when both emulator hosts are present', () => {
    const env = loadEnv({
      GMEP_ENV: 'local',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    });
    expect(env.GCLOUD_PROJECT).toBe('demo-gmep');
    expect(env.SESSION_TTL_HOURS).toBe(12);
  });
  it('rejects the in-memory backend outside local', () => {
    expect(() => loadEnv({ GMEP_ENV: 'staging', GMEP_DATA_BACKEND: 'memory' })).toThrow(/memory/);
  });
  it('requires SMTP settings in prod and only as a pair', () => {
    expect(() => loadEnv({ GMEP_ENV: 'prod' })).toThrow(/EMAIL_SMTP_URL/);
    expect(() => loadEnv({ GMEP_ENV: 'dev', EMAIL_FROM: 'GMEP <a@b.vn>' })).toThrow(/together/);
    const env = loadEnv(PROD);
    expect(env.EMAIL_FROM).toContain('no-reply');
  });
  // security checklist 9: prod fails fast on fake adapters and missing settings
  it('prod refuses the fake e-invoice adapter and the dev message outbox', () => {
    expect(() => loadEnv({ ...PROD, EINVOICE_FAKE_PROVIDER: 'true' })).toThrow(
      /EINVOICE_FAKE_PROVIDER/,
    );
    expect(() => loadEnv({ ...PROD, MESSAGE_DEV_CHANNELS: 'sms' })).toThrow(/MESSAGE_DEV_CHANNELS/);
    expect(() => loadEnv({ ...PROD, EMAIL_SMTP_URL: undefined, EMAIL_FROM: undefined })).toThrow(
      /EMAIL_SMTP_URL/,
    );
  });
  it('prod lists every missing or demo setting at once, without values', () => {
    let msg = '';
    try {
      loadEnv({
        GMEP_ENV: 'prod',
        EMAIL_SMTP_URL: 'smtps://u:secretpw@h:465',
        EMAIL_FROM: 'GMEP <a@b.vn>',
      });
    } catch (e) {
      msg = (e as Error).message;
    }
    for (const n of ['GCLOUD_PROJECT', 'FIREBASE_API_KEY', 'APP_BASE_URL', 'CRON_SECRET'])
      expect(msg).toContain(n);
    expect(msg).not.toContain('secretpw');
    expect(() => loadEnv({ ...PROD, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toThrow(
      /EMULATOR/,
    );
  });
  it('the fake e-invoice adapter is on by default outside prod only', () => {
    expect(einFakeProviderEnabled(loadEnv({ GMEP_ENV: 'staging' }))).toBe(true);
    expect(
      einFakeProviderEnabled(loadEnv({ GMEP_ENV: 'staging', EINVOICE_FAKE_PROVIDER: 'false' })),
    ).toBe(false);
    expect(einFakeProviderEnabled(loadEnv(PROD))).toBe(false);
  });
});

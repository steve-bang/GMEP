import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

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
    const env = loadEnv({
      GMEP_ENV: 'prod',
      EMAIL_SMTP_URL: 'smtps://u:p@smtp.example.vn:465',
      EMAIL_FROM: 'GMEP <no-reply@example.vn>',
    });
    expect(env.EMAIL_FROM).toContain('no-reply');
  });
});

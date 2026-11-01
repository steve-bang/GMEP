/**
 * Session cookie (ADR §6.3). The `__Host-` prefix forces Secure, Path=/ and no Domain,
 * which prevents subdomain cookie injection. HttpOnly + SameSite=Lax.
 * Chromium accepts Secure cookies on http://localhost, so local dev/e2e work unchanged.
 */
export const SESSION_COOKIE = '__Host-gmep_session';
/** Random device id used by lockout counter A (BA §1.4); not a credential, not personal data. */
export const DEVICE_COOKIE = '__Host-gmep_device';

export function serializeSessionCookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function serializeDeviceCookie(value: string): string {
  return `${DEVICE_COOKIE}=${value}; Max-Age=${400 * 24 * 3600}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

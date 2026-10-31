/**
 * Session cookie (ADR §6.3). The `__Host-` prefix forces Secure, Path=/ and no Domain,
 * which prevents subdomain cookie injection. HttpOnly + SameSite=Lax.
 * Chromium accepts Secure cookies on http://localhost, so local dev/e2e work unchanged.
 */
export const SESSION_COOKIE = '__Host-gmep_session';

export function serializeSessionCookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

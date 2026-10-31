import { readCookie, SESSION_COOKIE } from '@/platform/http/cookies';
import { resolveSession, type Session } from '@/modules/sys';
import { getContainer } from './container';

/** Authenticates a Route Handler request from its session cookie. Throws 401 AppError. */
export async function authenticate(req: Request): Promise<Session> {
  const cookie = readCookie(req.headers.get('cookie'), SESSION_COOKIE);
  return resolveSession(getContainer().sys, cookie);
}

export function allowedOrigins(): string[] {
  const o = getContainer().env.APP_ORIGIN;
  return o ? [o] : [];
}

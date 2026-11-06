import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppError } from '@/platform/errors/errors';
import { SESSION_COOKIE } from '@/platform/http/cookies';
import { safeNext } from '@/platform/http/safeNext';
import { resolveSession, type Session } from '@/modules/sys';
import { getContainer } from './container';

/**
 * For Server Components: resolves the session once per request (React cache, shared by the
 * layout and the page) and redirects to /login when there is none. Pages call the application
 * layer directly with the returned Actor, so they get the same Scope enforcement as the API.
 */
export const requireSession = cache(async (): Promise<Session> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    return await resolveSession(getContainer().sys, cookie);
  } catch (err) {
    // a cookie that no longer works = expired/revoked session (state-copy §2.1); no cookie = plain login
    if (err instanceof AppError && err.status === 401) {
      // x-gm-next is set by src/proxy.ts (path + query of the page request); sanitised again here
      const next = safeNext((await headers()).get('x-gm-next'));
      const qs = new URLSearchParams();
      if (cookie) qs.set('expired', '1');
      if (next !== '/') qs.set('next', next);
      redirect(qs.size ? `/login?${qs}` : '/login');
    }
    throw err;
  }
});

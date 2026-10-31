import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppError } from '@/platform/errors/errors';
import { SESSION_COOKIE } from '@/platform/http/cookies';
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
    if (err instanceof AppError && err.status === 401) redirect('/login');
    throw err;
  }
});

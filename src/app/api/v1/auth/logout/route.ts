import { clearSessionCookie, readCookie, SESSION_COOKIE } from '@/platform/http/cookies';
import { apiRoute, json } from '@/platform/http/route';
import { logout } from '@/modules/sys';
import { allowedOrigins } from '@/composition/auth';
import { getContainer } from '@/composition/container';

export const runtime = 'nodejs';

/** Revokes the server-side session record, then clears the cookie. Idempotent. */
export const POST = apiRoute(
  async ({ req, requestId }) => {
    const cookie = readCookie(req.headers.get('cookie'), SESSION_COOKIE);
    await logout(getContainer().sys, cookie, requestId);
    return json({}, { headers: { 'set-cookie': clearSessionCookie() } });
  },
  { allowedOrigins },
);

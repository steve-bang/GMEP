import { clearSessionCookie, readCookie, SESSION_COOKIE } from '@/platform/http/cookies';
import { json } from '@/platform/http/route';
import { logout } from '@/modules/sys';
import { api } from '@/composition/api';

export const runtime = 'nodejs';

/** Revokes the server-side session record, then clears the cookie. Idempotent. */
export const POST = api(async ({ req, requestId, sys }) => {
  await logout(sys, readCookie(req.headers.get('cookie'), SESSION_COOKIE), requestId);
  return json({}, { headers: { 'set-cookie': clearSessionCookie() } });
});

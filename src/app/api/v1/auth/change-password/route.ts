import { readCookie, serializeSessionCookie, SESSION_COOKIE } from '@/platform/http/cookies';
import { json, readJson } from '@/platform/http/route';
import { changeTemporaryPassword } from '@/modules/sys';
import { api, clientAddress } from '@/composition/api';

export const runtime = 'nodejs';

/**
 * P2-C: the session opened with a temporary password changes it (current + new password, consent to the tenant's rules)
 * and is replaced by a full session. Any other session answers 409; no session answers 401.
 */
export const POST = api(async ({ req, requestId, sys }) => {
  const result = await changeTemporaryPassword(
    sys,
    readCookie(req.headers.get('cookie'), SESSION_COOKIE),
    await readJson(req),
    { address: clientAddress(req), requestId },
  );
  const res = json({ user: result.user });
  res.headers.append(
    'set-cookie',
    serializeSessionCookie(result.sessionCookie, result.maxAgeSeconds),
  );
  return res;
});

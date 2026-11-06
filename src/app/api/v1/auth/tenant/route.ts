import { z } from 'zod';
import { AppError } from '@/platform/errors/errors';
import { readCookie, serializeSessionCookie, SESSION_COOKIE } from '@/platform/http/cookies';
import { json, readJson } from '@/platform/http/route';
import { selectTenant } from '@/modules/sys';
import { api } from '@/composition/api';

export const runtime = 'nodejs';

const bodySchema = z.object({ tenantId: z.string().min(1).max(64) });

/**
 * FR-TEN-016, 017, RULE-026: choose or switch the tenant of the session. The id is only a CHOICE among the person's own
 * memberships (anything else answers 404 like an unknown tenant); the tenant of every later request is derived from the
 * session, never from the client (FR-TEN-010). A new session replaces the old one.
 */
export const POST = api(async ({ req, requestId, sys }) => {
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) throw new AppError('not_found', 404);
  const result = await selectTenant(
    sys,
    readCookie(req.headers.get('cookie'), SESSION_COOKIE),
    parsed.data.tenantId,
    requestId,
  );
  const res = json({ user: result.user });
  res.headers.append(
    'set-cookie',
    serializeSessionCookie(result.sessionCookie, result.maxAgeSeconds),
  );
  return res;
});

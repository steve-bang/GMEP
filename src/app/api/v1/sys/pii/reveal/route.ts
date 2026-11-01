import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** "Hiện": the only place a full personal value leaves the server. Never cached. */
export const POST = authed(async ({ req, sys: d, session, requestId }) => {
  const r = await mod.revealPii(d, session.actor, session.sessionId, await readJson(req), {
    requestId,
  });
  return json(r, { headers: { 'cache-control': 'no-store' } });
});

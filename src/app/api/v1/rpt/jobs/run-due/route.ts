import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { runDueRollups } from '@/modules/rpt';

export const runtime = 'nodejs';

/**
 * Refreshes today and the recent days of the branches in scope; creates a missing recent day. Idempotent: a repeat
 * writes nothing when the sources did not change (no scheduler yet: Cloud Scheduler or the report screen calls it).
 */
export const POST = authed(async ({ req, rpt, session, requestId }) => {
  const body = await readJson(req).catch(() => ({}));
  return json(await runDueRollups(rpt, session.actor, body, { requestId }));
});

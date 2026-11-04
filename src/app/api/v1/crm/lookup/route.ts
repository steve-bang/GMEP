import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { lookupExact } from '@/modules/crm';

export const runtime = 'nodejs';

/** Cross-branch exact lookup (plate or full phone), white-listed projection (BA §10 P1/P2). POST keeps the phone out of URLs and logs. */
export const POST = authed(async ({ req, crm, session, requestId }) =>
  json(
    await lookupExact(crm, session.actor, await readJson(req), {
      requestId,
      sessionId: session.sessionId,
    }),
  ),
);

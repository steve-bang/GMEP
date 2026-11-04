import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { runDueRequests } from '@/modules/ein';

export const runtime = 'nodejs';

/** FR-EIN-010: handle the requests that are due for another attempt (a scheduler or the queue screen calls this). */
export const POST = authed(async ({ ein, session, requestId }) =>
  json(await runDueRequests(ein, session.actor, { requestId })),
);

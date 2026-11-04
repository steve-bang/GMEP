import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listPartRequests } from '@/modules/rec';

export const runtime = 'nodejs';

/** Part requests by status. */
export const GET = authed(async ({ rec, session, query }) =>
  json(await listPartRequests(rec, session.actor, query())),
);

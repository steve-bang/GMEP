import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listOrders } from '@/modules/rec';

export const runtime = 'nodejs';

/** List of repair orders of the working branch. */
export const GET = authed(async ({ rec, session, query }) =>
  json(await listOrders(rec, session.actor, query())),
);

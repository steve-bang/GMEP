import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listOpenReservations } from '@/modules/inv';

export const runtime = 'nodejs';

/** BA-07 / I2: shortage list (`kind=short`) and long-held report (`kind=long-held&days=`). */
export const GET = authed(async ({ inv, session, query }) =>
  json({ items: await listOpenReservations(inv, session.actor, query()) }),
);

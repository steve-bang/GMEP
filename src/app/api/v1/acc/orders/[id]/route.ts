import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getOrderMoney } from '@/modules/acc';

export const runtime = 'nodejs';

/** R44 / G4-ACC-01: balance of the order, its payments and what the user may do. */
export const GET = authed(async ({ acc, session, params }) =>
  json(await getOrderMoney(acc, session.actor, params.id ?? '')),
);

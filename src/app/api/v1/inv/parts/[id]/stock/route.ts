import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getPartStock } from '@/modules/inv';

export const runtime = 'nodejs';

/** FR-INV-003: the four numbers of one part in each warehouse of the working scope. */
export const GET = authed(async ({ inv, session, params }) =>
  json({ items: await getPartStock(inv, session.actor, params.id ?? '') }),
);

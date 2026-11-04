import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listStockCard } from '@/modules/inv';

export const runtime = 'nodejs';

/** RULE-009: the stock card of a part in one warehouse (?warehouseId=). */
export const GET = authed(async ({ inv, session, params, query }) =>
  json(await listStockCard(inv, session.actor, params.id ?? '', query())),
);

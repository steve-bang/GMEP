import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getPartPrices } from '@/modules/inv';

export const runtime = 'nodejs';

/** FR-INV-025 link: standard list prices from the price lists (effective-dated `price-item` config). */
export const GET = authed(async ({ inv, session, params }) =>
  json({ items: await getPartPrices(inv, session.actor, params.id ?? '') }),
);

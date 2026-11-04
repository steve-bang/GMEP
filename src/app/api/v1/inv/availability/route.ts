import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getAvailability, parseAvailabilityQuery } from '@/modules/inv';

export const runtime = 'nodejs';

/** FR-INV-020: available quantity only (what an advisor sees when quoting): ?partIds=a,b&warehouseId=. */
export const GET = authed(async ({ inv, session, query }) =>
  json({ items: await getAvailability(inv, session.actor, parseAvailabilityQuery(query())) }),
);

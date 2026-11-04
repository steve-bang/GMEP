import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listStock } from '@/modules/inv';

export const runtime = 'nodejs';

/** FR-INV-003/013: balances (?lowStock=true for the reorder list, compared with AVAILABLE, RULE-008). */
export const GET = authed(async ({ inv, session, query }) =>
  json(await listStock(inv, session.actor, query())),
);

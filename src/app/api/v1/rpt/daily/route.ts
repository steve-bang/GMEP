import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getDaily } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-003 / FR-RPT-013: the daily report of one branch; the formula is part of the answer. */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await getDaily(rpt, session.actor, query())),
);

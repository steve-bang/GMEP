import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getIndicators } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-016 (without stock accuracy): average per order, quote approval rate (server-side scope, per-section view permissions). */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await getIndicators(rpt, session.actor, query())),
);

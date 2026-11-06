import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getRanking } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-002 (ranking), FR-RPT-010: branches of the actor scope ranked on the same period (server-side scope, per-section view permissions). */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await getRanking(rpt, session.actor, query())),
);

import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getDashboard } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-001 (one branch, or the permitted branches summed from their own rollup documents). Sections are cut by permission on the server. */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await getDashboard(rpt, session.actor, query())),
);

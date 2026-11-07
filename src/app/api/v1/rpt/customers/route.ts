import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getCustomerReport } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-015 (without receivables): customer visits, new vs returning (server-side scope, per-section view permissions). */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await getCustomerReport(rpt, session.actor, query())),
);

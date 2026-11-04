import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listAlerts } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-008 minimum (G4-RPT-09): exception alerts of the day in the actor's scope and permissions. */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await listAlerts(rpt, session.actor, query())),
);

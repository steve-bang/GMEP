import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listBranchGroups } from '@/modules/rpt';

export const runtime = 'nodejs';

/** Q84: configured branch groups (regions) the actor may filter by (server-side scope, per-section view permissions). */
export const GET = authed(async ({ rpt, session }) =>
  json(await listBranchGroups(rpt, session.actor)),
);

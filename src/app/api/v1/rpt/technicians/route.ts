import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getTechnicians } from '@/modules/rpt';

export const runtime = 'nodejs';

/** Phase 1 report `technicians` of one branch (server-side scope and per-source view permissions). */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await getTechnicians(rpt, session.actor, query())),
);

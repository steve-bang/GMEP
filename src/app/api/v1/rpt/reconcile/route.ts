import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getReconcile } from '@/modules/rpt';

export const runtime = 'nodejs';

/** Phase 1 report `reconcile` of one branch (server-side scope and per-source view permissions). */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await getReconcile(rpt, session.actor, query())),
);

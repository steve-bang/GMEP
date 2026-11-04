import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listMyWork } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-013: own work of the technician. */
export const GET = authed(async ({ rec, session, query }) =>
  json(await listMyWork(rec, session.actor, query())),
);

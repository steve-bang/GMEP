import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listServiceWorkflows } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-032: the steps configured for each service type in force today. */
export const GET = authed(async ({ rec, session }) =>
  json({ items: await listServiceWorkflows(rec, session.actor) }),
);

import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getQcChecklist } from '@/modules/rec';

export const runtime = 'nodejs';

/** Quality-check list of the order (effective-dated config). */
export const GET = authed(async ({ rec, session, params }) =>
  json(await getQcChecklist(rec, session.actor, params.id ?? '')),
);

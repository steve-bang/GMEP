import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getBoard } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-022: dispatch board of the working branch. */
export const GET = authed(async ({ rec, session, query }) =>
  json(await getBoard(rec, session.actor, query())),
);

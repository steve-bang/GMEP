import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getCashbook } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-003: the cash book of one day of the working branch. */
export const GET = authed(async ({ acc, session, query }) =>
  json(await getCashbook(acc, session.actor, query().date)),
);

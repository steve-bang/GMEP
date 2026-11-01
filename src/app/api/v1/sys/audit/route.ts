import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-003 read-only audit viewer; page size 25 or 100; scope enforced in the query. */
export const GET = authed(async ({ sys: d, session, query }) =>
  json(await mod.listAudit(d, session.actor, query())),
);

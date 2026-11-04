import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { rebuildRollup } from '@/modules/rpt';

export const runtime = 'nodejs';

/** Recomputes one day from the source documents (also an official day); audited, safe to repeat. */
export const POST = authed(async ({ req, rpt, session, requestId }) =>
  json(await rebuildRollup(rpt, session.actor, await readJson(req), { requestId })),
);

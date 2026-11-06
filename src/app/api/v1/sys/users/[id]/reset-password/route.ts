import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** P2-C: a manager sets a new temporary password for a staff member without email (revokes every session). */
export const POST = authed(async ({ req, sys: d, session, params, requestId }) =>
  json(
    await mod.resetWorkerPassword(d, session.actor, params.id ?? '', await readJson(req), {
      requestId,
    }),
  ),
);

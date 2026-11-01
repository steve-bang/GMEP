import { readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const POST = authed(async ({ req, sys: d, session, params, requestId }) =>
  created(
    await mod.addAssignment(d, session.actor, params.id ?? '', await readJson(req), { requestId }),
    false,
  ),
);

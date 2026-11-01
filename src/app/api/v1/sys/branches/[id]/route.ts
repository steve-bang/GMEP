import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys: d, session, params }) =>
  json(await mod.getBranch(d, session.actor, params.id ?? '')),
);

export const PATCH = authed(async ({ req, sys: d, session, params, requestId }) =>
  json(
    await mod.updateBranch(d, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

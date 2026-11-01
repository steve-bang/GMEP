import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const PUT = authed(async ({ req, sys: d, session, params, requestId }) =>
  json(
    await mod.updateRole(d, session.actor, params.code ?? '', await readJson(req), { requestId }),
  ),
);

import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const POST = authed(async ({ req, sys: d, session, params, requestId }) =>
  json(
    await mod.setUserStatus(d, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

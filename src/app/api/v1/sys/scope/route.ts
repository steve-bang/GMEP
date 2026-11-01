import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** Scope picker data and choice (BA §4). The working branch is server-side session state. */
export const GET = authed(async ({ sys: d, session }) =>
  json(await mod.getScopeInfo(d, session.actor)),
);

export const PUT = authed(async ({ req, sys: d, session }) =>
  json(await mod.setWorkingScope(d, session.actor, session.sessionId, await readJson(req))),
);

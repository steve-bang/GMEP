import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const PATCH = authed(async ({ req, sys: d, session, params, requestId }) =>
  json(
    await mod.updatePriceList(d, session.actor, params.id ?? '', await readJson(req), {
      requestId,
    }),
  ),
);

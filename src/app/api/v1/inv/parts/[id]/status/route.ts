import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { setPartStatus } from '@/modules/inv';

export const runtime = 'nodejs';

/** Deactivate / reactivate a part (history is kept, RULE-009). */
export const POST = authed(async ({ req, inv, session, params, requestId }) =>
  json(
    await setPartStatus(inv, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

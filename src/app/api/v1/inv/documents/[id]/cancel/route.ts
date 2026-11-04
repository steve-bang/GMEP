import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { cancelDocument } from '@/modules/inv';

export const runtime = 'nodejs';

/** Cancels a draft (never touched stock, never had a number). */
export const POST = authed(async ({ req, inv, session, params, requestId }) =>
  json(
    await cancelDocument(inv, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

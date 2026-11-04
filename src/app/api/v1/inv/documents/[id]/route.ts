import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getDocument, updateDocument } from '@/modules/inv';

export const runtime = 'nodejs';

export const GET = authed(async ({ inv, session, params }) =>
  json(await getDocument(inv, session.actor, params.id ?? '')),
);

/** Edits a draft only; a posted document is corrected by a reversal (RULE-010). */
export const PATCH = authed(async ({ req, inv, session, params, requestId }) =>
  json(
    await updateDocument(inv, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

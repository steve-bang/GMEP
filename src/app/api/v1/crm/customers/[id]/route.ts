import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getCustomer, updateCustomer } from '@/modules/crm';

export const runtime = 'nodejs';

/** Out-of-scope id -> 404, identical to a missing one. Opening a record with full personal data is access-logged. */
export const GET = authed(async ({ crm, session, params, requestId }) =>
  json(
    await getCustomer(crm, session.actor, params.id ?? '', {
      requestId,
      sessionId: session.sessionId,
    }),
  ),
);

export const PATCH = authed(async ({ req, crm, session, params, requestId }) =>
  json(
    await updateCustomer(crm, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

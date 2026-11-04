import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { closeDataRequest } from '@/modules/crm';

export const runtime = 'nodejs';

/** Completes or rejects with a result; completing a delete request anonymises the customer (FR-CRM-011). */
export const POST = authed(async ({ req, crm, session, params, requestId }) =>
  json(
    await closeDataRequest(crm, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

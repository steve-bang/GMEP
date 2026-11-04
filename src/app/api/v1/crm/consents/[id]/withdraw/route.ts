import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { withdrawConsent } from '@/modules/crm';

export const runtime = 'nodejs';

/** FR-CRM-010: withdrawal stops advertising at once; the record stays as history. */
export const POST = authed(async ({ req, crm, session, params, requestId }) =>
  json(
    await withdrawConsent(crm, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

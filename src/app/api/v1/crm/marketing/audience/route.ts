import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { selectMarketingAudience } from '@/modules/crm';

export const runtime = 'nodejs';

/** FR-CRM-013: keeps only customers with an active advertising consent for the channel and reports how many were dropped. */
export const POST = authed(async ({ req, crm, session }) =>
  json(await selectMarketingAudience(crm, session.actor, await readJson(req))),
);

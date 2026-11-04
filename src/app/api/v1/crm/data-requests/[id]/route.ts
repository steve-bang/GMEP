import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getDataRequest } from '@/modules/crm';

export const runtime = 'nodejs';

export const GET = authed(async ({ crm, session, params }) =>
  json(await getDataRequest(crm, session.actor, params.id ?? '')),
);

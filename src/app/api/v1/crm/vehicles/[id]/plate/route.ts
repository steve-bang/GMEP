import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { changePlate } from '@/modules/crm';

export const runtime = 'nodejs';

export const POST = authed(async ({ req, crm, session, params, requestId }) =>
  json(await changePlate(crm, session.actor, params.id ?? '', await readJson(req), { requestId })),
);

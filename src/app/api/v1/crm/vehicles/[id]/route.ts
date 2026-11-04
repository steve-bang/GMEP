import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getVehicle, updateVehicle } from '@/modules/crm';

export const runtime = 'nodejs';

export const GET = authed(async ({ crm, session, params }) =>
  json(await getVehicle(crm, session.actor, params.id ?? '')),
);

export const PATCH = authed(async ({ req, crm, session, params, requestId }) =>
  json(
    await updateVehicle(crm, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);

import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listVehicleHistory } from '@/modules/crm';

export const runtime = 'nodejs';

/** FR-CRM-004: repair history of the vehicle at every branch (white-listed projection). */
export const GET = authed(async ({ crm, session, params, query }) =>
  json(await listVehicleHistory(crm, session.actor, params.id ?? '', query())),
);

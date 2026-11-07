import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listVehicleWarranties } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-018, 036, FR-CRM-016: warranty coverage of a vehicle in the scope (`vehicleId`), every branch via P4. */
export const GET = authed(async ({ rec, session, query }) =>
  json(await listVehicleWarranties(rec, session.actor, String(query().vehicleId ?? ''))),
);

import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listDeclinedItems } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-024: items the customer refused or left undone on earlier quotes of the vehicle (`vehicleId`), in scope. */
export const GET = authed(async ({ rec, session, query }) =>
  json(await listDeclinedItems(rec, session.actor, String(query().vehicleId ?? ''))),
);

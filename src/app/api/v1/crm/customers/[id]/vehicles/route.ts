import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listCustomerVehicles } from '@/modules/crm';

export const runtime = 'nodejs';

export const GET = authed(async ({ crm, session, params }) =>
  json({ items: await listCustomerVehicles(crm, session.actor, params.id ?? '') }),
);

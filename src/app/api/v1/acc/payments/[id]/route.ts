import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getPayment } from '@/modules/acc';

export const runtime = 'nodejs';

export const GET = authed(async ({ acc, session, params }) =>
  json(await getPayment(acc, session.actor, params.id ?? '')),
);

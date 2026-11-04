import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getOrder } from '@/modules/rec';

export const runtime = 'nodejs';

/** One repair order with items, requests, QC and handover. */
export const GET = authed(async ({ rec, session, params }) =>
  json(await getOrder(rec, session.actor, params.id ?? '')),
);

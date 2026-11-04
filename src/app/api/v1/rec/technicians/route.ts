import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listTechnicians } from '@/modules/rec';

export const runtime = 'nodejs';

/** Technicians that can take an item. */
export const GET = authed(async ({ rec, session }) =>
  json({ items: await listTechnicians(rec, session.actor) }),
);

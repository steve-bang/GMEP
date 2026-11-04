import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { pickParts } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-006: parts with the list price and the AVAILABLE quantity only. */
export const GET = authed(async ({ rec, session, query }) =>
  json({ items: await pickParts(rec, session.actor, query()) }),
);

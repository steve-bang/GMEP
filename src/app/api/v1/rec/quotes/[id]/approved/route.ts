import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getApprovedQuote } from '@/modules/rec';

export const runtime = 'nodejs';

/** The approved lines of a quote (lineKey, price version, tax key): the hand-over to the repair order (slice 1.6). */
export const GET = authed(async ({ rec, session, params }) =>
  json(await getApprovedQuote(rec, session.actor, params.id ?? '')),
);

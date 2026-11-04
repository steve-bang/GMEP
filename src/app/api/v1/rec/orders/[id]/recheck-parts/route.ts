import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { recheckParts } from '@/modules/rec';

export const runtime = 'nodejs';

/** Re-runs the idempotent stock hold of the approved part lines (a shortage may have been filled). */
export const POST = authed(async ({ rec, session, params, requestId }) =>
  json(await recheckParts(rec, session.actor, params.id ?? '', { requestId })),
);

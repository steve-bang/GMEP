import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getInvoice } from '@/modules/ein';

export const runtime = 'nodejs';

/** G4-EIN-03: one invoice with its versions, buyer data presented by role, request and allowed actions. */
export const GET = authed(async ({ ein, session, params, requestId }) =>
  json(await getInvoice(ein, session.actor, params.id ?? '', { requestId })),
);

import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { syncInvoice } from '@/modules/ein';

export const runtime = 'nodejs';

/** FR-EIN-005: pull the provider-side status now (asks first, never sends a second invoice). */
export const POST = authed(async ({ ein, session, params, requestId }) =>
  json(await syncInvoice(ein, session.actor, params.id ?? '', { requestId })),
);

import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { retryRequest } from '@/modules/ein';

export const runtime = 'nodejs';

/** FR-EIN-010/013: "Thử lại" asks the provider first and sends only when it holds nothing for the request. */
export const POST = authed(async ({ ein, session, params, requestId }) =>
  json(await retryRequest(ein, session.actor, params.id ?? '', { requestId })),
);

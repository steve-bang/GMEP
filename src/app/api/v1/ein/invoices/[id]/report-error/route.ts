import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { reportInvoiceError } from '@/modules/ein';

export const runtime = 'nodejs';

/** G4-EIN-03: the cashier tells the accountant an invoice looks wrong (a notification, no request). */
export const POST = authed(async ({ req, ein, session, params, requestId, idempotencyKey }) => {
  const r = await reportInvoiceError(ein, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});

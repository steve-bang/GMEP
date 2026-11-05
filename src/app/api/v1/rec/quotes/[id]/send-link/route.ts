import { readJson, json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { sendQuoteLink } from '@/modules/rec';

export const runtime = 'nodejs';

/**
 * FR-REC-008, FR-CRM-010: sends the customer link of the current sent version over sms, zalo or email to the
 * contact on file (never to a number in the request). Needs the customer's service consent for the channel.
 * Idempotency-Key required: a repeat sends nothing. 200 = sent, 202 = accepted and retried by the job.
 */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await sendQuoteLink(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return json(r.body, {
    status: r.status,
    headers: r.replayed ? { 'idempotent-replayed': 'true' } : {},
  });
});

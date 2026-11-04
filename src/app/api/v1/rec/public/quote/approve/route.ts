import { json, readJson } from '@/platform/http/route';
import { parseIdempotencyKey } from '@/platform/idempotency/idempotency';
import { api, clientAddress } from '@/composition/api';
import { approveViaLink } from '@/modules/rec';

export const runtime = 'nodejs';

/**
 * FR-REC-009: the customer approves through the link. No login; the token travels in the body (never in a
 * URL that the request logger would record), is rate limited and throttled per address and per token.
 */
export const POST = api(async ({ req, rec, requestId }) => {
  const body = (await readJson(req)) as { token?: unknown } & Record<string, unknown>;
  const { token, ...rest } = body;
  const r = await approveViaLink(rec, typeof token === 'string' ? token : '', rest, {
    requestId,
    idempotencyKey: parseIdempotencyKey(req.headers.get('idempotency-key'), true)!,
    address: clientAddress(req),
  });
  return json(r.response.body, {
    status: r.response.status,
    headers: r.replayed ? { 'idempotent-replayed': 'true' } : {},
  });
});

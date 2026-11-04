import { json, readJson } from '@/platform/http/route';
import { parseIdempotencyKey } from '@/platform/idempotency/idempotency';
import { api, clientAddress } from '@/composition/api';
import { rejectViaLink } from '@/modules/rec';

export const runtime = 'nodejs';

/** "Từ chối toàn bộ báo giá" on the customer page (ba-answers-03 Câu 2). */
export const POST = api(async ({ req, rec, requestId }) => {
  const body = (await readJson(req)) as { token?: unknown } & Record<string, unknown>;
  const { token, ...rest } = body;
  const r = await rejectViaLink(rec, typeof token === 'string' ? token : '', rest, {
    requestId,
    idempotencyKey: parseIdempotencyKey(req.headers.get('idempotency-key'), true)!,
    address: clientAddress(req),
  });
  return json(r.response.body, {
    status: r.response.status,
    headers: r.replayed ? { 'idempotent-replayed': 'true' } : {},
  });
});

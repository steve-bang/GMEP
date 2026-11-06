import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { mergeCustomers } from '@/modules/crm';

export const runtime = 'nodejs';

/** FR-CRM-003: merge `sourceId` into this customer (nothing deleted, audited on both). Idempotency-Key required. */
export const POST = authed(async ({ req, crm, session, params, requestId, idempotencyKey }) => {
  const r = await mergeCustomers(crm, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return json(r.response.body, { status: r.response.status });
});

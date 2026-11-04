import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createCustomer, listCustomerDtos } from '@/modules/crm';

export const runtime = 'nodejs';

/** FR-CRM-001/002 list and diacritics-insensitive search (name, phone, plate), scope enforced in the repository (NFR-ISO-01). */
export const GET = authed(async ({ crm, sys, session, query }) => {
  const params = query();
  if (params.q) await sys.limiter.hit('search', session.user.id);
  return json(await listCustomerDtos(crm, session.actor, params));
});

/** FR-CRM-001 create. Idempotency-Key required; audit in the same transaction. */
export const POST = authed(async ({ req, crm, session, requestId, idempotencyKey }) => {
  const r = await createCustomer(crm, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});

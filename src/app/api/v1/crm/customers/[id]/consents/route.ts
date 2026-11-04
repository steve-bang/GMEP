import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { listConsents, recordConsent } from '@/modules/crm';

export const runtime = 'nodejs';

/** FR-CRM-010: consent history (withdrawn records stay listed). */
export const GET = authed(async ({ crm, session, params }) =>
  json({ items: await listConsents(crm, session.actor, params.id ?? '') }),
);

export const POST = authed(async ({ req, crm, session, params, requestId, idempotencyKey }) => {
  const r = await recordConsent(crm, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});

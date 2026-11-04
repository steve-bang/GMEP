import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { changeOwner, listVehicleOwnerships } from '@/modules/crm';

export const runtime = 'nodejs';

/** FR-CRM-014: effective-dated ownership history. */
export const GET = authed(async ({ crm, session, params }) =>
  json({ items: await listVehicleOwnerships(crm, session.actor, params.id ?? '') }),
);

/** Owner change keeps history: closes the open record, opens a new one. */
export const POST = authed(async ({ req, crm, session, params, requestId, idempotencyKey }) => {
  const r = await changeOwner(crm, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return json(r.response.body, {
    status: r.response.status,
    headers: r.replayed ? { 'idempotent-replayed': 'true' } : {},
  });
});

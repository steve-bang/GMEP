import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { holdStock, listReservationsByPart } from '@/modules/inv';

export const runtime = 'nodejs';

/** Holds on a part by quote / order (?partId=). */
export const GET = authed(async ({ inv, session, query }) =>
  json(await listReservationsByPart(inv, session.actor, query())),
);

/** FR-INV-020: reserve (target quantity semantics, compared with available). */
export const POST = authed(async ({ req, inv, session, requestId, idempotencyKey }) => {
  const r = await holdStock(inv, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});

import { authed, created } from '@/composition/api';
import { recordReceiptPrint } from '@/modules/acc';

export const runtime = 'nodejs';

/** Audit `payment.printed` with the count; the posted payment is never changed (RULE-010). Idempotent. */
export const POST = authed(async ({ acc, session, params, requestId, idempotencyKey }) => {
  const r = await recordReceiptPrint(acc, session.actor, params.id ?? '', {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});

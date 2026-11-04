import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { createOrderForQuote } from '@/modules/rec';

export const runtime = 'nodejs';

/** R37 fallback "Tạo lệnh": the same idempotent path the approval uses. */
export const POST = authed(async ({ rec, session, params, requestId }) =>
  json(await createOrderForQuote(rec, session.actor, params.id ?? '', { requestId })),
);

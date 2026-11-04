import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listPayments, type PaymentListQuery } from '@/modules/acc';

export const runtime = 'nodejs';

/** G4-ACC-02: payments of the working branch in a date window. */
export const GET = authed(async ({ acc, session, query }) => {
  const q = query();
  const kinds = ['receipt', 'deposit', 'expense', 'reversal'] as const;
  const methods = ['cash', 'transfer', 'card', 'qr'] as const;
  const f: PaymentListQuery = {
    ...(q.from ? { from: q.from } : {}),
    ...(q.to ? { to: q.to } : {}),
    ...(kinds.includes(q.kind as (typeof kinds)[number])
      ? { kind: q.kind as (typeof kinds)[number] }
      : {}),
    ...(methods.includes(q.method as (typeof methods)[number])
      ? { method: q.method as (typeof methods)[number] }
      : {}),
  };
  return json(await listPayments(acc, session.actor, f));
});

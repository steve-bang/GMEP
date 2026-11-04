import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listInvoices, type DisplayStatus } from '@/modules/ein';

export const runtime = 'nodejs';

const STATUSES: DisplayStatus[] = [
  'not_issued',
  'issued',
  'adjustment',
  'replacement',
  'cancelled',
  'abandoned',
];

/** G4-EIN-01 / FR-EIN-006: invoices of the working branch, newest first; status and text filter in memory over a bounded window. */
export const GET = authed(async ({ ein, session, query }) => {
  const q = query();
  const status = STATUSES.find((s) => s === q.status);
  const limit = Number(q.limit);
  return json(
    await listInvoices(ein, session.actor, {
      ...(status ? { status } : {}),
      ...(q.from ? { from: q.from } : {}),
      ...(q.to ? { to: q.to } : {}),
      ...(q.q ? { q: q.q } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      ...(Number.isInteger(limit) && limit > 0 ? { limit } : {}),
    }),
  );
});

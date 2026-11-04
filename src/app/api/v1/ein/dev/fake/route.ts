import { z } from 'zod';
import { AppError } from '@/platform/errors/errors';
import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getContainer } from '@/composition/container';

export const runtime = 'nodejs';

const schema = z.object({
  op: z.enum(['issue', 'cancel', 'query', 'status', 'artifacts']).optional(),
  outcome: z
    .enum([
      'ok',
      'timeout_before',
      'timeout_after',
      'data_error',
      'rejected',
      'unavailable',
      'processing',
    ])
    .optional(),
  times: z.number().int().min(1).max(20).optional(),
  reset: z.boolean().optional(),
});

/**
 * LOCAL / TEST ONLY: scripts the fake provider (a timeout, a rejection...) so the error paths can be demonstrated and
 * covered by the browser tests. It does not exist outside GMEP_ENV=local (404), whatever the caller's role.
 */
export const POST = authed(async ({ req, session }) => {
  const c = getContainer();
  if (c.env.GMEP_ENV !== 'local') throw new AppError('not_found', 404);
  if (!session.actor.assignments.some((a) => a.roleCode === 'AD' || a.roleCode === 'CH'))
    throw new AppError('forbidden', 403);
  const b = schema.parse(await readJson(req));
  if (b.reset) c.fakeProvider.reset();
  if (b.op && b.outcome) c.fakeProvider.script(b.op, b.outcome, b.times ?? 1);
  return json({ invoices: c.fakeProvider.invoiceCount, calls: c.fakeProvider.calls });
});

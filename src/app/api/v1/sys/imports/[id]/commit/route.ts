import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { commitImport } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-007: writes a validated batch in steps; repeating the call on a committed batch returns it unchanged. */
export const POST = authed(async ({ sys, session, params, requestId, idempotencyKey }) => {
  idempotencyKey();
  return json(await commitImport(sys, session.actor, params.id ?? '', { requestId }));
});

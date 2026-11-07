import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { runApprovalEscalation } from '@/modules/sys';

export const runtime = 'nodejs';

/**
 * FR-SYS-015, 034: reminds and escalates overdue requests of the caller's tenant by branch working time. Idempotent by
 * the request documents themselves (no scheduler yet: Cloud Scheduler or the owner's screen calls it).
 */
export const POST = authed(async ({ sys, session, requestId }) =>
  json(await runApprovalEscalation(sys, session.actor, { requestId })),
);

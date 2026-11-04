import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listApprovals, type ApprovalTab } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-004: the approval queue of the working branch (tab = toDecide | mine | done). */
export const GET = authed(async ({ sys, session, query }) => {
  const q = query();
  const tab = (['toDecide', 'mine', 'done'] as const).includes(q.tab as ApprovalTab)
    ? (q.tab as ApprovalTab)
    : 'toDecide';
  return json(
    await listApprovals(sys, session.actor, { tab, ...(q.kind ? { kind: q.kind } : {}) }),
  );
});

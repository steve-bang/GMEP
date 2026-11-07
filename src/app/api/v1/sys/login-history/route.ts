import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-014: own sign-in history, or `?userId=` of another person with `login-history:view` in scope (audited). */
export const GET = authed(async ({ sys: d, session, query, requestId }) => {
  const userId = query().userId;
  return json(
    await mod.listLoginHistory(
      d,
      session.actor,
      typeof userId === 'string' && userId ? userId : undefined,
      { requestId },
    ),
  );
});

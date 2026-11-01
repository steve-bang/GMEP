import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys: d, session, query }) => {
  const q = query();
  return json(
    await mod.listMyNotifications(d, session.actor, {
      ...(q.limit ? { limit: Number(q.limit) } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      includeOld: q.all === '1',
    }),
  );
});

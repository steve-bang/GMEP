import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getShellInfo } from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys, session }) => {
  const shell = await getShellInfo(sys, session.actor);
  return json({ userId: session.actor.userId, ...shell });
});

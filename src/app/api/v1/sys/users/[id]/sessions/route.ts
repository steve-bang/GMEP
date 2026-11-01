import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** Admin session list and forced logout (`user:manage`). */
export const GET = authed(async ({ sys: d, session, params }) =>
  json({ items: await mod.listUserSessions(d, session.actor, params.id ?? '') }),
);

export const DELETE = authed(async ({ sys: d, session, params, requestId }) => {
  await mod.revokeUserSessions(d, session.actor, params.id ?? '', { requestId });
  return json({});
});

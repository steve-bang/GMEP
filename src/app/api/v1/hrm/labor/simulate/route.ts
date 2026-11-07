import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { simulateLabor } from '@/modules/hrm';

export const runtime = 'nodejs';

/** G3-HRM-06 "thử tính": a pure calculation, nothing is stored (POST only because the body is a draft rule). */
export const POST = authed(async ({ req, session }) =>
  json(simulateLabor(session.actor, await readJson(req))),
);

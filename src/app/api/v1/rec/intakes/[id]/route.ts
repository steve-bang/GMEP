import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getIntake, updateIntake } from '@/modules/rec';

export const runtime = 'nodejs';

export const GET = authed(async ({ rec, session, params }) =>
  json(await getIntake(rec, session.actor, params.id ?? '')),
);

/** Saves a wizard step into the draft (optimistic `version`). */
export const PATCH = authed(async ({ req, rec, session, params, requestId }) =>
  json(await updateIntake(rec, session.actor, params.id ?? '', await readJson(req), { requestId })),
);

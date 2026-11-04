import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getPart, updatePart } from '@/modules/inv';

export const runtime = 'nodejs';

export const GET = authed(async ({ inv, session, params }) =>
  json(await getPart(inv, session.actor, params.id ?? '')),
);

/** Quantities are not editable here (FR-INV-021): only catalogue fields. */
export const PATCH = authed(async ({ req, inv, session, params, requestId }) =>
  json(await updatePart(inv, session.actor, params.id ?? '', await readJson(req), { requestId })),
);

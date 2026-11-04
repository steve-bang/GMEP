import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getQuote, updateQuote } from '@/modules/rec';

export const runtime = 'nodejs';

/** `?v=<n>` shows an older version (read-only). */
export const GET = authed(async ({ rec, session, params, query }) => {
  const n = Number(query().v);
  return json(
    await getQuote(
      rec,
      session.actor,
      params.id ?? '',
      Number.isInteger(n) && n > 0 ? n : undefined,
    ),
  );
});

/** Edits the lines: a draft in place, a sent version becomes the next version (optimistic `version`). */
export const PATCH = authed(async ({ req, rec, session, params, requestId }) =>
  json(await updateQuote(rec, session.actor, params.id ?? '', await readJson(req), { requestId })),
);

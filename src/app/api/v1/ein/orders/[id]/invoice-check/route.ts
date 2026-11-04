import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { previewIssue } from '@/modules/ein';

export const runtime = 'nodejs';

/** FR-EIN-011: everything that would block issuing, with the buyer prefilled from the order and the customer. */
export const GET = authed(async ({ ein, session, params }) =>
  json(await previewIssue(ein, session.actor, params.id ?? '')),
);

/** Same check with the buyer fields the user changed in the form (nothing is stored). */
export const POST = authed(async ({ req, ein, session, params }) => {
  const body = (await readJson(req)) as { buyer?: unknown } | null;
  return json(await previewIssue(ein, session.actor, params.id ?? '', body?.buyer));
});

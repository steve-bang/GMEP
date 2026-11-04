import { readJson, json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { issueQuoteLink } from '@/modules/rec';

export const runtime = 'nodejs';

/**
 * FR-REC-008: issues (or replaces) the customer link of the current sent version. The raw token is returned
 * once and never stored; for that reason there is no stored idempotent response here, and issuing
 * again deliberately revokes the previous link.
 */
export const POST = authed(async ({ req, rec, session, params, requestId }) =>
  json(
    await issueQuoteLink(rec, session.actor, params.id ?? '', await readJson(req), { requestId }),
    {
      status: 201,
    },
  ),
);

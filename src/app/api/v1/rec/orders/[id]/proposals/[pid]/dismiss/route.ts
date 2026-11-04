import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { dismissProposal } from '@/modules/rec';

export const runtime = 'nodejs';

export const POST = authed(async ({ req, rec, session, params, requestId }) =>
  json(
    await dismissProposal(
      rec,
      session.actor,
      params.id ?? '',
      params.pid ?? '',
      await readJson(req),
      { requestId },
    ),
  ),
);

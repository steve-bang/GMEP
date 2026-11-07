import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listServicePackages } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-020: active maintenance packages, each as quote items ready for the quote edit. */
export const GET = authed(async ({ rec, session }) =>
  json({ items: await listServicePackages(rec, session.actor) }),
);

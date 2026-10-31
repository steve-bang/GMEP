import { apiRoute, json } from '@/platform/http/route';
import { getShellInfo } from '@/modules/sys';
import { allowedOrigins, authenticate } from '@/composition/auth';
import { getContainer } from '@/composition/container';

export const runtime = 'nodejs';

export const GET = apiRoute(
  async ({ req }) => {
    const { actor } = await authenticate(req);
    const shell = await getShellInfo(getContainer().sys, actor);
    return json({ userId: actor.userId, ...shell });
  },
  { allowedOrigins },
);

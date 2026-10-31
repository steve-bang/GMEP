import { z } from 'zod';
import { AppError } from '@/platform/errors/errors';
import { serializeSessionCookie } from '@/platform/http/cookies';
import { apiRoute, json, readJson } from '@/platform/http/route';
import { login } from '@/modules/sys';
import { allowedOrigins } from '@/composition/auth';
import { getContainer } from '@/composition/container';

export const runtime = 'nodejs';

const bodySchema = z.object({
  identifier: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
});

export const POST = apiRoute(
  async ({ req, requestId, log }) => {
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw new AppError('invalid_credentials', 401);
    try {
      const result = await login(getContainer().sys, { ...parsed.data, requestId });
      log.info({ userId: result.user.id }, 'login ok'); // user id only; never the identifier or password
      return json(
        { user: result.user },
        {
          headers: {
            'set-cookie': serializeSessionCookie(result.sessionCookie, result.maxAgeSeconds),
          },
        },
      );
    } catch (err) {
      if (err instanceof AppError && err.status === 401)
        log.warn({ code: err.code }, 'login failed');
      throw err;
    }
  },
  { allowedOrigins },
);

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@/platform/errors/errors';
import {
  DEVICE_COOKIE,
  readCookie,
  serializeDeviceCookie,
  serializeSessionCookie,
} from '@/platform/http/cookies';
import { problemResponse } from '@/platform/http/problem';
import { json, readJson } from '@/platform/http/route';
import { login } from '@/modules/sys';
import { api, clientAddress } from '@/composition/api';

export const runtime = 'nodejs';

const bodySchema = z.object({
  identifier: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
});

/** FR-SYS-001. Device id comes from a random cookie (lockout counter A); network address from the edge. */
export const POST = api(async ({ req, requestId, log, sys }) => {
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) throw new AppError('invalid_credentials', 401);
  const existing = readCookie(req.headers.get('cookie'), DEVICE_COOKIE);
  const deviceId = existing && /^[A-Za-z0-9-]{16,64}$/.test(existing) ? existing : randomUUID();
  try {
    const result = await login(sys, {
      ...parsed.data,
      requestId,
      deviceId,
      address: clientAddress(req),
      userAgent: req.headers.get('user-agent') ?? '',
    });
    log.info({ userId: result.user.id }, 'login ok'); // user id only; never the identifier or password
    const res = json({ user: result.user });
    res.headers.append(
      'set-cookie',
      serializeSessionCookie(result.sessionCookie, result.maxAgeSeconds),
    );
    if (deviceId !== existing) res.headers.append('set-cookie', serializeDeviceCookie(deviceId));
    return res;
  } catch (err) {
    if (err instanceof AppError && (err.status === 401 || err.status === 429)) {
      log.warn({ code: err.code }, 'login failed');
      const res = problemResponse(err, requestId);
      // the device cookie is set on failures too, otherwise counter A could never accumulate
      if (deviceId !== existing) res.headers.append('set-cookie', serializeDeviceCookie(deviceId));
      return res;
    }
    throw err;
  }
});

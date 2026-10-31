import { ZodError } from 'zod';
import { AppError, type FieldError } from '../errors/errors';

/** RFC 9457 problem details with a stable `code`, Vietnamese `title`/`detail` and `traceId`. */
export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  traceId: string;
  errors?: FieldError[];
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export function problemFromError(err: unknown, traceId: string): ProblemBody {
  if (err instanceof AppError) {
    return {
      type: `urn:gmep:problem:${err.code}`,
      title: err.title,
      status: err.status,
      detail: err.detail,
      code: err.code,
      traceId,
      ...(err.errors.length ? { errors: err.errors } : {}),
    };
  }
  if (err instanceof ZodError) {
    return problemFromError(
      new AppError(
        'validation_failed',
        422,
        err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      ),
      traceId,
    );
  }
  return problemFromError(new AppError('internal', 500), traceId);
}

export function problemResponse(err: unknown, traceId: string): Response {
  const body = problemFromError(err, traceId);
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: {
      'content-type': PROBLEM_CONTENT_TYPE,
      'x-request-id': traceId,
      'cache-control': 'no-store',
    },
  });
}

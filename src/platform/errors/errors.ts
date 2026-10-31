import { translate } from '../i18n/messages';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Application error carrying a stable `code`. Mapped to RFC 9457 problem+json by the HTTP layer.
 * `title`/`detail` come from the Vietnamese i18n resources (errors.<code>.*).
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly errors: FieldError[] = [],
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'AppError';
  }
  get title(): string {
    return translate(`errors.${this.code}.title`);
  }
  get detail(): string {
    return translate(`errors.${this.code}.detail`);
  }
}

export const unauthenticated = () => new AppError('unauthenticated', 401);
export const invalidCredentials = () => new AppError('invalid_credentials', 401);
export const forbidden = () => new AppError('forbidden', 403);
/** Out-of-scope records are indistinguishable from missing ones (NFR-ISO-01). */
export const notFound = () => new AppError('not_found', 404);
export const validationFailed = (errors: FieldError[]) =>
  new AppError('validation_failed', 422, errors);
export const conflict = (code: string) => new AppError(code, 409);

import { AppError } from '@/platform/errors/errors';

/**
 * Server-component data loading: expected application errors (403, 404, 409 scope, 400, 422) become
 * values the page renders as states (no permission, not found, choose a branch, error); anything
 * else is rethrown to the error boundary (`error.tsx`, 500 page).
 */
export type Loaded<T> = { data: T; error?: undefined } | { data?: undefined; error: AppError };

export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { data: await fn() };
  } catch (e) {
    if (e instanceof AppError && e.status < 500) return { error: e };
    throw e;
  }
}

import { z } from 'zod';
import { AppError } from '../errors/errors';

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
});

export interface Page<T> {
  items: T[];
  /** Opaque cursor for the next page, or null when this is the last page. No total by default (Firestore read cost). */
  nextCursor: string | null;
}

export interface CursorPosition {
  /** value of the sort field of the last returned row */
  v: string;
  /** document id of the last returned row (tie-breaker) */
  id: string;
}

const cursorSchema = z.object({ v: z.string(), id: z.string() });

export function encodeCursor(pos: CursorPosition): string {
  return Buffer.from(JSON.stringify(pos), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): CursorPosition | undefined {
  if (!cursor) return undefined;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
    throw new AppError('invalid_cursor', 400);
  }
}

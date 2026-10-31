import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, pageQuerySchema } from './pagination';

describe('cursor pagination', () => {
  it('round-trips a cursor', () => {
    const c = encodeCursor({ v: 'wh-chinh', id: 'wh_br_q7_WH-CHINH' });
    expect(decodeCursor(c)).toEqual({ v: 'wh-chinh', id: 'wh_br_q7_WH-CHINH' });
  });
  it('rejects tampered cursors with a stable error code', () => {
    expect(() => decodeCursor('not-base64-json')).toThrowError(
      expect.objectContaining({ code: 'invalid_cursor', status: 400 }),
    );
    expect(() => decodeCursor(Buffer.from('{"v":1}').toString('base64url'))).toThrow();
  });
  it('limits page size to 100 and defaults to 25', () => {
    expect(pageQuerySchema.parse({}).limit).toBe(25);
    expect(() => pageQuerySchema.parse({ limit: '101' })).toThrow();
    expect(() => pageQuerySchema.parse({ limit: '0' })).toThrow();
  });
});

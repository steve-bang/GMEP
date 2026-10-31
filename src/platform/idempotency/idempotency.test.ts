import { describe, expect, it } from 'vitest';
import { fingerprintOf, idempotencyDocId, parseIdempotencyKey } from './idempotency';

describe('Idempotency-Key helpers (plan §2.8)', () => {
  it('requires a key when asked, and validates its shape', () => {
    expect(() => parseIdempotencyKey(null, true)).toThrowError(
      expect.objectContaining({ code: 'idempotency_key_required' }),
    );
    expect(parseIdempotencyKey(null, false)).toBeNull();
    expect(() => parseIdempotencyKey('short', true)).toThrowError(
      expect.objectContaining({ code: 'idempotency_key_invalid' }),
    );
    expect(() => parseIdempotencyKey('has spaces in it!', true)).toThrow();
    expect(parseIdempotencyKey('0b1f2c3d-4e5f-6789', true)).toBe('0b1f2c3d-4e5f-6789');
  });
  it('scopes the stored key by user and route', () => {
    const a = idempotencyDocId('u1', 'POST /x', 'key-12345678');
    expect(a).toBe(idempotencyDocId('u1', 'POST /x', 'key-12345678'));
    expect(a).not.toBe(idempotencyDocId('u2', 'POST /x', 'key-12345678'));
    expect(a).not.toBe(idempotencyDocId('u1', 'POST /y', 'key-12345678'));
  });
  it('fingerprints bodies independent of key order', () => {
    expect(fingerprintOf({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(
      fingerprintOf({ b: { d: [1, 2], c: 2 }, a: 1 }),
    );
    expect(fingerprintOf({ a: 1 })).not.toBe(fingerprintOf({ a: 2 }));
  });
});

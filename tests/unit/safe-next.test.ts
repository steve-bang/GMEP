import { describe, expect, it } from 'vitest';
import { safeNext } from '@/platform/http/safeNext';

describe('safeNext (return URL sanitiser)', () => {
  it('keeps same-origin paths with query', () => {
    expect(safeNext('/rec/orders/1?tab=parts')).toBe('/rec/orders/1?tab=parts');
  });
  it.each([
    undefined,
    null,
    '',
    'rec/orders',
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/a\\b',
    '/a\nb',
    '/login?next=/x',
  ])('falls back to / for %s', (v) => {
    expect(safeNext(v as string | null | undefined)).toBe('/');
  });
});

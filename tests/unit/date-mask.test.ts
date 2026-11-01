import { describe, expect, it } from 'vitest';
import { maskViDate } from '@/ui/dateMask';

describe('dd/MM/yyyy mask', () => {
  it('masks digits as dd/MM/yyyy while typing', () => {
    expect(maskViDate('3')).toBe('3');
    expect(maskViDate('3110')).toBe('31/10');
    expect(maskViDate('31102026')).toBe('31/10/2026');
    expect(maskViDate('31/10/2026999')).toBe('31/10/2026');
    expect(maskViDate('2026-10-31')).toBe('31/10/2026');
  });
});

import { describe, expect, it } from 'vitest';
import { formatBp, parsePercentToBp } from './percent';

describe('basis point <-> percent (integer only; examples are format checks, not tax rates)', () => {
  it('formats without floats', () => {
    expect(formatBp(1000)).toBe('10%');
    expect(formatBp(850)).toBe('8,5%');
    expect(formatBp(825)).toBe('8,25%');
    expect(formatBp(0)).toBe('0%');
    expect(formatBp(5)).toBe('0,05%');
  });
  it('parses user input to basis points and refuses bad input', () => {
    expect(parsePercentToBp('10')).toBe(1000);
    expect(parsePercentToBp('8,5')).toBe(850);
    expect(parsePercentToBp('8.25 %')).toBe(825);
    expect(parsePercentToBp('8,255')).toBeNull();
    expect(parsePercentToBp('abc')).toBeNull();
    expect(parsePercentToBp('101')).toBeNull();
    expect(parsePercentToBp('-1')).toBeNull();
  });
  it('round-trips every value from 0 to 100%', () => {
    for (let bp = 0; bp <= 10_000; bp += 5)
      expect(parsePercentToBp(formatBp(bp).replace('%', ''))).toBe(bp);
  });
  it('rejects non-integer basis points', () => {
    expect(() => formatBp(8.5)).toThrow(RangeError);
  });
});

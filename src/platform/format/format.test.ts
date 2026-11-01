import { describe, expect, it } from 'vitest';
import { businessDate, formatDate, formatDateTime, isoToVi, viToIso } from './date';
import { formatVnd, parseVndInput } from './vnd';

describe('VND formatting (integer money only)', () => {
  it('formats integer VND with dot grouping and the dong sign', () => {
    expect(formatVnd(1250000).replace(/ /g, ' ')).toBe('1.250.000 ₫');
    expect(formatVnd(0).replace(/ /g, ' ')).toBe('0 ₫');
    expect(formatVnd(-500000).replace(/ /g, ' ')).toBe('-500.000 ₫');
  });
  it('rejects non-integer amounts instead of rounding (no floats for money)', () => {
    expect(() => formatVnd(1000.5)).toThrow(RangeError);
    expect(() => formatVnd(Number.NaN)).toThrow(RangeError);
    expect(() => formatVnd(2 ** 60)).toThrow(RangeError);
  });
  it('parses user input to integers and refuses decimals', () => {
    expect(parseVndInput('1.250.000')).toBe(1250000);
    expect(parseVndInput('1 250 000 ₫')).toBe(1250000);
    expect(parseVndInput('-500.000')).toBe(-500000);
    expect(parseVndInput('12,5')).toBeNull();
    expect(parseVndInput('abc')).toBeNull();
    expect(parseVndInput('')).toBeNull();
  });
});

describe('date formatting (dd/MM/yyyy, Asia/Ho_Chi_Minh)', () => {
  it('formats in the Vietnam timezone, not UTC', () => {
    // 2026-10-30 18:30 UTC is already 31/10/2026 01:30 in Vietnam (UTC+7)
    const d = new Date('2026-10-30T18:30:00Z');
    expect(formatDate(d)).toBe('31/10/2026');
    expect(formatDateTime(d)).toBe('31/10/2026 01:30');
    expect(businessDate(d)).toBe('2026-10-31');
  });
  it('uses 24 hour time', () => {
    expect(formatDateTime(new Date('2026-01-02T09:05:00Z'))).toBe('02/01/2026 16:05');
  });
});

describe('dd/MM/yyyy input helpers (date fields never depend on the browser locale)', () => {
  it('converts both ways and rejects non-dates', () => {
    expect(isoToVi('2027-01-01')).toBe('01/01/2027');
    expect(isoToVi('')).toBe('');
    expect(viToIso('01/01/2027')).toBe('2027-01-01');
    expect(viToIso('1/2/2027')).toBe('2027-02-01');
    expect(viToIso('2027-01-01')).toBe('2027-01-01');
    expect(viToIso('31/02/2027')).toBeNull();
    expect(viToIso('12/31/2027')).toBeNull();
    expect(viToIso('')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeSearch } from './normalize';

describe('diacritics-safe search normalisation', () => {
  it.each([
    ['Đỗ Văn  Ánh', 'do van anh'],
    ['KHO CHÍNH Thủ Đức', 'kho chinh thu duc'],
    ['  Nguyễn  ', 'nguyen'],
    ['đồng sơn', 'dong son'],
    ['51A-123.45', '51a-123.45'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSearch(input)).toBe(expected);
  });
  it('composed and decomposed input normalise identically', () => {
    expect(normalizeSearch('Việt'.normalize('NFC'))).toBe(normalizeSearch('Việt'.normalize('NFD')));
  });
});

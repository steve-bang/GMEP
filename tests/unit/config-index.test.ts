import { describe, expect, it } from 'vitest';
import { CONFIG_DESCRIPTORS, CONFIG_GROUPS, type ConfigVersionDto } from '@/modules/sys';
import { filterCards, foldVi, groupCards } from '../../src/app/(shell)/sys/config/configIndex';
import { typeBadges } from '../../src/app/(shell)/sys/config/configBadges';

const v = (
  id: string,
  status: ConfigVersionDto['status'],
  effectiveFrom: string,
  scopeKey = 'tenant',
) => ({ id, status, effectiveFrom, scopeKey }) as ConfigVersionDto;

describe('FR-SYS-004: config index helpers', () => {
  it('foldVi drops Vietnamese diacritics, d-stroke and case', () => {
    expect(foldVi('  Thuế   Đơn giá ')).toBe('thue don gia');
  });

  it('filterCards matches title or lead, every word, ignoring diacritics', () => {
    const cards = [
      { title: 'Thuế suất', lead: 'VAT theo ngày' },
      { title: 'Giờ công', lead: 'Đơn giá nhân công' },
    ];
    expect(filterCards(cards, 'THUE').map((c) => c.title)).toEqual(['Thuế suất']);
    expect(filterCards(cards, 'don gia cong').map((c) => c.title)).toEqual(['Giờ công']);
    expect(filterCards(cards, '  ')).toHaveLength(2);
    expect(filterCards(cards, 'khong co')).toEqual([]);
  });

  it('groupCards keeps group order and drops empty groups', () => {
    const cards = [
      { group: 'system' as const, n: 1 },
      { group: 'pricing' as const, n: 2 },
      { group: 'system' as const, n: 3 },
    ];
    const g = groupCards(cards, CONFIG_GROUPS);
    expect(g.map((x) => x.group)).toEqual(['pricing', 'system']);
    expect(g[1]!.cards.map((c) => c.n)).toEqual([1, 3]);
  });

  it('every descriptor group is a known group', () => {
    for (const d of Object.values(CONFIG_DESCRIPTORS)) expect(CONFIG_GROUPS).toContain(d.group);
  });

  it('typeBadges counts pending and flags an approved version not yet in force', () => {
    const today = '2026-11-12';
    const b = typeBadges(
      [
        v('a', 'approved', '2026-01-01'),
        v('b', 'approved', '2026-12-01'),
        v('c', 'pending', '2026-12-15'),
        v('d', 'pending', '2026-12-20', 'branch:x'),
        v('e', 'rejected', '2026-11-30'),
      ],
      today,
    );
    expect(b).toEqual({ pending: 2, upcoming: true });
    expect(typeBadges([v('a', 'approved', '2026-01-01')], today)).toEqual({
      pending: 0,
      upcoming: false,
    });
  });
});

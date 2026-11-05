import { describe, expect, it } from 'vitest';
import { publicPhotoSources } from '@/modules/rec';
import type { PhotoRef } from '@/modules/rec/domain/entities';

const ref = (id: string, extra: Partial<PhotoRef> = {}): PhotoRef => ({
  id,
  contentType: 'image/jpeg',
  size: 10,
  sha256: 'h',
  takenBy: 'u',
  takenAt: new Date(0),
  ...extra,
});
const hidden = { at: new Date(0), by: 'm', reason: 'Nhầm xe khác' };
const own = { companyId: 'c', branchId: 'b' };

describe('FR-REC-034 / R104: which photos reach the customer', () => {
  it('intake photos are shown, hidden ones never', () => {
    const out = publicPhotoSources({
      intake: { id: 'i1', ...own, photos: [ref('a'), ref('b', { hidden })] },
      order: null,
      quoteId: 'q1',
      max: 30,
    });
    expect(out.map((s) => [s.ref.id, s.kind, s.parent])).toEqual([['a', 'intake', 'intake']]);
  });

  it('order photos only when attached to a proposal that became THIS quote (FR-REC-014)', () => {
    const out = publicPhotoSources({
      intake: null,
      order: {
        id: 'o1',
        ...own,
        photos: [
          ref('p1', { proposalId: 'pr1' }),
          ref('p2', { proposalId: 'pr2' }), // proposal of another quote
          ref('p3'), // general order photo, internal
          ref('p4', { proposalId: 'pr1', hidden }),
        ],
        proposals: [
          { id: 'pr1', quoteId: 'q1' },
          { id: 'pr2', quoteId: 'q2' },
        ],
      },
      quoteId: 'q1',
      max: 30,
    });
    expect(out.map((s) => [s.ref.id, s.kind])).toEqual([['p1', 'proposal']]);
  });

  it('is capped and tolerates records without photos', () => {
    expect(publicPhotoSources({ intake: null, order: null, quoteId: 'q', max: 5 })).toEqual([]);
    const many = Array.from({ length: 8 }, (_, i) => ref(`x${i}`));
    expect(
      publicPhotoSources({
        intake: { id: 'i', ...own, photos: many },
        order: null,
        quoteId: 'q',
        max: 5,
      }),
    ).toHaveLength(5);
  });
});

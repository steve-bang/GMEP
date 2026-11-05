import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_OWNER,
  countByModule,
  ownerOf,
  prefixCandidates,
  sliceOf,
} from '@/platform/store/indexReport';
import type { IndexDef } from '@/platform/store/indexes';

const def = (
  collectionGroup: string,
  fields: string[],
  queryScope: IndexDef['queryScope'] = 'COLLECTION',
): IndexDef => ({
  collectionGroup,
  queryScope,
  fields: fields.map((f) =>
    f.endsWith(' desc')
      ? { fieldPath: f.slice(0, -5), order: 'DESCENDING' as const }
      : { fieldPath: f, order: 'ASCENDING' as const },
  ),
});

describe('index report (R68 budget, check:indexes --report)', () => {
  it('counts per module, largest first', () => {
    const defs = [
      def('parts', ['a', 'b']),
      def('users', ['a', 'b']),
      def('customers', ['a', 'b']),
      def('customers', ['a', 'c']),
      def('mystery', ['a', 'b']),
    ];
    expect(countByModule(defs)).toEqual([
      ['CRM', 2],
      ['?', 1],
      ['INV', 1],
      ['SYS', 1],
    ]);
  });

  it('lists a strict prefix with the same collection, scope and directions as a candidate', () => {
    const short = def('customers', ['companyId', 'nameNorm']);
    const long = def('customers', ['companyId', 'nameNorm', 'createdAt']);
    const out = prefixCandidates([long, short]);
    expect(out).toHaveLength(1);
    expect(out[0]!.shorter).toBe(short);
    expect(out[0]!.longer).toBe(long);
    expect(out[0]!.reason).toContain('only safe if');
  });

  it('does not list non-prefixes, other directions, other collections, other scopes or equal length', () => {
    const base = def('customers', ['companyId', 'nameNorm']);
    expect(prefixCandidates([base, def('customers', ['companyId', 'nameNorm desc', 'x'])])).toEqual(
      [],
    );
    expect(prefixCandidates([base, def('customers', ['nameNorm', 'companyId', 'x'])])).toEqual([]);
    expect(prefixCandidates([base, def('vehicles', ['companyId', 'nameNorm', 'x'])])).toEqual([]);
    expect(
      prefixCandidates([
        base,
        def('customers', ['companyId', 'nameNorm', 'x'], 'COLLECTION_GROUP'),
      ]),
    ).toEqual([]);
    expect(prefixCandidates([base, def('customers', ['companyId', 'other'])])).toEqual([]);
  });

  it('every collection with a declared index has an owner and a slice', () => {
    const declared = (
      JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: IndexDef[] }
    ).indexes;
    const missing = [...new Set(declared.map((d) => d.collectionGroup))].filter(
      (c) => ownerOf(c) === '?' || sliceOf(c) === '?',
    );
    expect(missing).toEqual([]);
    expect(Object.keys(COLLECTION_OWNER).length).toBeGreaterThan(30);
  });
});

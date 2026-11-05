import { describe, expect, it } from 'vitest';
import { mapPool } from '@/platform/async/mapPool';

describe('mapPool', () => {
  it('keeps the result order and never runs more than the limit at once', async () => {
    let live = 0;
    let peak = 0;
    const out = await mapPool([5, 1, 4, 2, 3, 0], 2, async (n) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, n));
      live--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30, 0]);
    expect(peak).toBeLessThanOrEqual(2);
  });
  it('rejects like Promise.all and handles an empty list', async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
    expect(await mapPool([], 5, async () => 1)).toEqual([]);
  });
});

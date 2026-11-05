/**
 * Runs `fn` over `items` with at most `limit` in flight, keeping the result order. A rejection stops starting new work
 * and rejects the whole call (like Promise.all). Used where a bounded list of by-key reads would otherwise run one
 * after the other.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i]!, i);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

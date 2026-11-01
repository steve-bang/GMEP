/**
 * Small in-process TTL cache (H1). Entries carry tags so a permission/role/session change can
 * invalidate exactly the affected entries. With several Cloud Run instances an invalidation only
 * reaches the instance that performed it; the others serve a stale entry for at most `ttlMs`.
 * That bound is the documented maximum staleness of revocation/permission changes.
 */
export class TtlCache<V> {
  private readonly map = new Map<string, { value: V; expiresAt: number; tags: Set<string> }>();
  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 5000,
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: V, tags: Iterable<string> = []): void {
    if (this.ttlMs <= 0) return;
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { value, expiresAt: this.now() + this.ttlMs, tags: new Set(tags) });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  /** Drops every entry carrying the tag (e.g. `user:u1`, `role:QL`). */
  invalidateTag(tag: string): number {
    let n = 0;
    for (const [k, e] of this.map) {
      if (e.tags.has(tag)) {
        this.map.delete(k);
        n++;
      }
    }
    return n;
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

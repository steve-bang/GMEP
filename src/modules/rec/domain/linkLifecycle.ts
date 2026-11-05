import type { QuoteLink } from './entities';
import type { MessageQueue } from './messaging';

/**
 * Pure decisions of the quote-link delivery lifecycle (WP-A findings 1 and 6). No I/O.
 */

/**
 * Activating a delivered link replaces the version's current link ONLY when the current one is older than the new one
 * and still live: a link staff copied between the send and the gateway answer is newer and must not be revoked.
 */
export function shouldRevokeOnActivation(
  old: Pick<QuoteLink, 'createdAt' | 'revokedAt'> | null,
  newCreatedAt: Date,
): boolean {
  return !!old && !old.revokedAt && old.createdAt.getTime() < newCreatedAt.getTime();
}

/** Drops the items whose `expiresAt` has passed (items without one never expire here). Returns the same object when nothing was dropped. */
export function pruneQueue(queue: MessageQueue, now: Date): MessageQueue {
  const entries = Object.entries(queue.items);
  const live = entries.filter(([, i]) => !i.expiresAt || i.expiresAt.getTime() > now.getTime());
  if (live.length === entries.length) return queue;
  return { ...queue, items: Object.fromEntries(live) };
}

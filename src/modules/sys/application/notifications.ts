import type { Page } from '@/platform/pagination/pagination';
import { decodeCursor, encodeCursor } from '@/platform/pagination/pagination';
import { notFound } from '@/platform/errors/errors';
import type { Actor } from '@/platform/rbac/rbac';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { Notification, NotificationKind } from '../domain/entities';
import type { SysDeps } from '../ports/deps';

const DAY = 86_400_000;

/**
 * FR-SYS-009 basics: stages in-system notifications INSIDE the caller's transaction, so there is
 * no notification for a rolled-back change. Content is an i18n key plus non-personal params
 * (BA §7.1: notifications never carry names, phones or addresses). Delivery channels (email/Zalo)
 * are later slices behind their own ports.
 */
export function notifyUsers(
  deps: SysDeps,
  tx: Tx,
  n: {
    companyId: string;
    userIds: readonly string[];
    kind: NotificationKind;
    titleKey: string;
    params?: Record<string, string>;
    link?: string;
    branchId?: string | null;
  },
): void {
  const now = deps.clock.now();
  for (const userId of new Set(n.userIds)) {
    deps.notifications.create(tx, {
      id: deps.newId(),
      companyId: n.companyId,
      userId,
      branchId: n.branchId ?? null,
      kind: n.kind,
      titleKey: n.titleKey,
      params: n.params ?? {},
      link: n.link ?? null,
      createdAt: now,
      readAt: null,
      expiresAt: new Date(now.getTime() + deps.config.notificationRetentionDays * DAY),
    });
  }
}

export interface NotificationDto {
  id: string;
  kind: string;
  titleKey: string;
  params: Record<string, string>;
  link: string | null;
  createdAt: string;
  read: boolean;
}

const toDto = (n: Notification): NotificationDto => ({
  id: n.id,
  kind: n.kind,
  titleKey: n.titleKey,
  params: n.params,
  link: n.link,
  createdAt: n.createdAt.toISOString(),
  read: n.readAt !== null,
});

/** Own notifications only (no cross-user path exists); the bell hides entries older than the configured days. */
export async function listMyNotifications(
  deps: SysDeps,
  actor: Actor,
  q: { limit?: number; cursor?: string; includeOld?: boolean },
): Promise<Page<NotificationDto>> {
  const limit = Math.min(Math.max(q.limit ?? 25, 1), 100);
  const cursor = decodeCursor(q.cursor);
  const page = await deps.notifications.listForUser(actor.userId, limit, cursor);
  const cutoff = deps.clock.now().getTime() - deps.config.notificationBellDays * DAY;
  const items = q.includeOld
    ? page.items
    : page.items.filter((n) => n.createdAt.getTime() >= cutoff);
  const last = page.items.at(-1);
  return {
    items: items.map(toDto),
    nextCursor: page.nextCursor ?? (last && false ? encodeCursor({ v: '', id: '' }) : null),
  };
}

export async function markNotificationRead(deps: SysDeps, actor: Actor, id: string): Promise<void> {
  const ok = await deps.notifications.markRead(actor.userId, id, deps.clock.now());
  if (!ok) throw notFound();
}

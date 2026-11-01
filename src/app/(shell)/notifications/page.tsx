import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { listMyNotifications } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, PageHeader, Pager, type SearchParams } from '@/ui/components/PageParts';
import { MarkRead } from './MarkRead';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
});

/** FR-SYS-009 basics: own notifications only; entries older than the bell window are hidden (BA §8.1). */
export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const cursor = first((await searchParams).cursor);
  const { actor } = await requireSession();
  const res = await load(() =>
    listMyNotifications(getContainer().sys, actor, { limit: 25, ...(cursor ? { cursor } : {}) }),
  );
  const header = <PageHeader title={t('notifications.title')} />;
  if (res.error)
    return (
      <>
        {header}
        <ErrorFor error={res.error} t={t} />
      </>
    );
  return (
    <>
      {header}
      {res.data.items.length === 0 ? (
        <EmptyState title={t('notifications.emptyTitle')} text={t('notifications.emptyText')} />
      ) : (
        <ul className="stack" data-testid="notifications">
          {res.data.items.map((n) => (
            <li key={n.id} className="g5-actions">
              <span>
                {n.read ? null : <strong aria-label={t('notifications.unread')}>● </strong>}
                {t(n.titleKey, n.params)}{' '}
                <span className="text-secondary">· {fmt.format(new Date(n.createdAt))}</span>
              </span>
              {n.link ? <Link href={n.link}>{t('notifications.open')}</Link> : null}
              {n.read ? null : <MarkRead id={n.id} label={t('notifications.markRead')} />}
            </li>
          ))}
        </ul>
      )}
      <Pager
        base="/notifications"
        query={{}}
        {...(cursor ? { cursor } : {})}
        next={res.data.nextCursor}
        labels={{
          prev: t('warehouses.prev'),
          next: t('warehouses.next'),
          aria: t('common.pagination'),
        }}
      />
    </>
  );
}

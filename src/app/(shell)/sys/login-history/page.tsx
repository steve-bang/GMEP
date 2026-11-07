import { getTranslations } from 'next-intl/server';
import { listLoginHistory } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, PageHeader, type SearchParams } from '@/ui/components/PageParts';
import { rptLabels } from '../../rpt/rptUi';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * FR-SYS-014: sign-in history of the viewer; `?userId=` shows another person's when the role may (audited on the server).
 * No IP address is shown or kept; failed attempts are not recorded per account [Cần xác nhận].
 */
export default async function LoginHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const userId = first((await searchParams).userId);
  const l = rptLabels('loginHistory');
  const res = await load(() =>
    listLoginHistory(getContainer().sys, actor, userId || undefined, { requestId: 'page' }),
  );
  const header = <PageHeader title={l.title!} />;
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
      <p className="text-secondary">{l.lead}</p>
      {res.data.items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText!} />
      ) : (
        <DataTable<(typeof res.data.items)[number]>
          caption={l.title!}
          toolbar={l.title!}
          rows={res.data.items}
          rowKey={(x) => x.at}
          columns={[
            { key: 'a', header: l.colAt!, render: (x) => fmt.format(new Date(x.at)) },
            { key: 'd', header: l.colDevice!, render: (x) => x.device || '—' },
            { key: 's', header: l.colState!, render: (x) => l[`state_${x.state}`] },
            {
              key: 'l',
              header: l.colLastSeen!,
              render: (x) => fmt.format(new Date(x.lastSeenAt)),
            },
          ]}
        />
      )}
      <p className="text-secondary">{l.failedNote}</p>
    </>
  );
}

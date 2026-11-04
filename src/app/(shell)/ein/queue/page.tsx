import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import { listQueue, type QueueRowDto } from '@/modules/ein';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { EinPage, einLabels, fill, money } from '../einUi';
import { QueueTable } from './QueueTable';

export const dynamic = 'force-dynamic';

/** G4-EIN-06 / FR-EIN-010, 013: open issue requests; retry always asks the provider first. */
export default async function QueuePage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const l = einLabels('queue');
  const crumbs = [{ label: t('shell.nav.invoices'), href: '/ein' }];
  const res = await load(() => listQueue(getContainer().ein, actor));
  const head = { title: l.title!, desc: l.lead!, crumbs };
  if (res.error)
    return (
      <EinPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </EinPage>
    );
  const rows: (QueueRowDto & {
    createdLabel: string;
    nextLabel: string | null;
    valueLabel: string;
  })[] = res.data.items.map((r) => ({
    ...r,
    createdLabel: formatDateTime(new Date(r.createdAt)),
    nextLabel: r.nextAttemptAt ? formatDateTime(new Date(r.nextAttemptAt)) : null,
    valueLabel: money(r.valueVnd),
  }));
  return (
    <EinPage
      {...head}
      actions={
        <Link className="btn btn--secondary" href="/ein/warnings">
          {t('ein.list.warnings')}
        </Link>
      }
    >
      <QueueTable
        rows={rows}
        total={res.data.total}
        labels={l}
        common={einLabels('common')}
        count={fill(l.count!, { n: res.data.total })}
      />
    </EinPage>
  );
}

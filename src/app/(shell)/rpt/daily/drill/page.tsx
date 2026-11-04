import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getDrill, REF_METRICS, type DocRef, type RefMetric } from '@/modules/rpt';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { dmy, fill, hrefOf, money, Note, RptPage, rptLabels } from '../../rptUi';

export const dynamic = 'force-dynamic';

/** G4-RPT-10 / FR-RPT-011: the source documents behind one figure; every row opens the document in its own module. */
export default async function DrillPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const date = first(sp.date) ?? '';
  const metric = first(sp.metric) ?? '';
  const branchId = first(sp.branchId);
  const l = rptLabels('drill');
  const crumbs = [
    { label: t('shell.nav.reports'), href: '/rpt' },
    { label: t('shell.nav.dailyReport'), href: '/rpt/daily' },
  ];
  const head = { title: l.title!, desc: l.lead!, crumbs };
  if (!REF_METRICS.includes(metric as RefMetric))
    return (
      <RptPage {...head}>
        <EmptyState title={t('states.notFoundTitle')} text={t('states.notFoundText')} />
      </RptPage>
    );
  const res = await load(() =>
    getDrill(getContainer().rpt, actor, { date, metric, ...(branchId ? { branchId } : {}) }),
  );
  if (res.error)
    return (
      <RptPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RptPage>
    );
  const d = res.data;
  return (
    <RptPage {...head} title={fill(l.titleFor!, { metric: l[`metric_${d.metric}`]! })}>
      <p className="text-secondary" data-testid="drill-scope">
        {d.branchName} · {dmy(d.date)}
      </p>
      {d.truncated ? <Note tone="warning">{l.truncated}</Note> : null}
      {d.refs.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable<DocRef>
          caption={l.title!}
          rows={d.refs}
          rowKey={(r) => `${r.kind}-${r.id}`}
          toolbar={fill(l.count!, { n: d.refs.length })}
          columns={[
            {
              key: 'doc',
              header: l.colDoc!,
              render: (r) => (
                <Link href={hrefOf(r)} data-testid="drill-link">
                  {r.label}
                </Link>
              ),
            },
            { key: 'kind', header: l.colKind!, render: (r) => l[`kind_${r.kind}`] },
            { key: 'note', header: l.colNote!, render: (r) => r.note ?? '' },
            {
              key: 'v',
              header: l.colValue!,
              numeric: true,
              render: (r) => (r.valueVnd === undefined ? '—' : money(r.valueVnd)),
            },
          ]}
        />
      )}
    </RptPage>
  );
}

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { listAlerts, ALERT_KINDS, type AlertRow } from '@/modules/rpt';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { fill, hrefOf, money, Note, RptPage, rptLabels } from '../rptUi';

export const dynamic = 'force-dynamic';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** G4-RPT-09 / FR-RPT-008 minimum: the exception list of the day inside the user's scope and permissions. */
export default async function AlertsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const rawDate = first(sp.date);
  const l = rptLabels('alerts');
  const c = rptLabels('common');
  const res = await load(() =>
    listAlerts(getContainer().rpt, actor, rawDate && ISO.test(rawDate) ? { date: rawDate } : {}),
  );
  const head = {
    title: l.title!,
    desc: l.lead!,
    crumbs: [{ label: t('shell.nav.reports'), href: '/rpt' }],
  };
  if (res.error)
    return (
      <RptPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RptPage>
    );
  const d = res.data;
  return (
    <RptPage {...head}>
      <section className="card">
        <div className="card__body">
          <DateFilter
            base="/rpt/alerts"
            fields={[{ name: 'date', label: c.date!, iso: d.date }]}
            applyLabel={c.apply!}
            resetLabel={c.reset!}
          />
        </div>
      </section>
      <section className="rpt-kpis" aria-label={l.title}>
        {ALERT_KINDS.map((k) => (
          <div className="card kpi" key={k}>
            <span className="kpi__label">{l[`kind_${k}`]}</span>
            <span className="kpi__value" data-testid={`count-${k}`}>
              {d.counts[k]}
            </span>
            <span className="kpi__meta">{l[`hint_${k}`]}</span>
          </div>
        ))}
      </section>
      {d.truncated ? <Note tone="warning">{l.truncated}</Note> : null}
      {d.items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable<AlertRow>
          caption={l.title!}
          rows={d.items}
          rowKey={(r) => `${r.branchId}-${r.kind}-${r.ref.id}`}
          toolbar={fill(l.count!, { n: d.items.length })}
          columns={[
            {
              key: 'k',
              header: l.colKind!,
              render: (r) => <span className="tag tag--warning">{l[`kind_${r.kind}`]}</span>,
            },
            { key: 'b', header: l.colBranch!, render: (r) => r.branchName },
            {
              key: 'd',
              header: l.colDoc!,
              render: (r) => (
                <Link href={hrefOf(r.ref)} data-testid="alert-link">
                  {r.ref.label}
                </Link>
              ),
            },
            {
              key: 'a',
              header: l.colAge!,
              numeric: true,
              render: (r) => fill(l.days!, { n: r.ageDays }),
            },
            {
              key: 'v',
              header: l.colValue!,
              numeric: true,
              render: (r) => (r.valueVnd ? money(r.valueVnd) : '—'),
            },
          ]}
        />
      )}
    </RptPage>
  );
}

import { getTranslations } from 'next-intl/server';
import { getRanking, listBranchGroups, RANK_METRICS, type RankMetric } from '@/modules/rpt';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { businessDate } from '@/platform/format/date';
import { Field, fill, Note, pctOf, RptPage, rptLabels } from '../rptUi';
import { money } from '../rptUi';

export const dynamic = 'force-dynamic';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const RATIO: readonly RankMetric[] = ['quoteApprovalBp', 'returningCustomerBp'];
const COUNT: readonly RankMetric[] = ['ordersClosed'];

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * FR-RPT-002 (ranking half), FR-RPT-010: branches of the viewer's scope ranked on one period; a configured group (region,
 * Q84) narrows the view. The branch ranking is for the owner and the regional manager (Q85, `report-ranking:view`).
 */
export default async function RankingPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const today = businessDate(new Date());
  const from = first(sp.from);
  const to = first(sp.to);
  const metricIn = first(sp.metric);
  const groupId = first(sp.groupId);
  const l = rptLabels('ranking');
  const metric: RankMetric = (RANK_METRICS as readonly string[]).includes(metricIn ?? '')
    ? (metricIn as RankMetric)
    : 'exTaxVnd';
  const container = getContainer();
  const res = await load(async () => ({
    report: await getRanking(container.rpt, actor, {
      from: from && ISO.test(from) ? from : addDays(today, -6),
      to: to && ISO.test(to) ? to : today,
      metric,
      ...(groupId ? { groupId } : {}),
    }),
    groups: (await listBranchGroups(container.rpt, actor).catch(() => ({ items: [] }))).items,
  }));
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
  const d = res.data.report;
  const show = (v: number | null) =>
    v === null
      ? '—'
      : RATIO.includes(d.metric)
        ? pctOf(v)
        : COUNT.includes(d.metric)
          ? String(v)
          : money(v);
  return (
    <RptPage {...head}>
      <section className="card no-print">
        <div className="card__body">
          <form
            method="get"
            action="/rpt/ranking"
            className="row"
            style={{ gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'end' }}
          >
            <Field id="rk-from" label={rptLabels('rep').from!}>
              <input className="input" id="rk-from" name="from" type="date" defaultValue={d.from} />
            </Field>
            <Field id="rk-to" label={rptLabels('rep').to!}>
              <input className="input" id="rk-to" name="to" type="date" defaultValue={d.to} />
            </Field>
            <Field id="rk-metric" label={l.metric!}>
              <select className="select" id="rk-metric" name="metric" defaultValue={d.metric}>
                {RANK_METRICS.map((m) => (
                  <option key={m} value={m}>
                    {l[`metric_${m}`]}
                  </option>
                ))}
              </select>
            </Field>
            {res.data.groups.length > 0 ? (
              <Field id="rk-group" label={l.group!}>
                <select
                  className="select"
                  id="rk-group"
                  name="groupId"
                  defaultValue={d.groupId ?? ''}
                >
                  <option value="">{l.allGroups}</option>
                  {res.data.groups.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <button type="submit" className="btn btn--secondary">
              {rptLabels('common').apply}
            </button>
          </form>
        </div>
      </section>
      {d.provisionalDays > 0 ? (
        <Note tone="warning" testId="rank-provisional">
          {fill(l.provisionalNote!, { n: d.provisionalDays })}
        </Note>
      ) : null}
      {d.group?.partial ? (
        <Note tone="info" testId="rank-group-partial">
          {fill(l.groupPartialNote!, { n: d.group.inScope, m: d.group.total })}
        </Note>
      ) : null}
      {d.commonDates.length > 0 ? (
        <Note tone="info" testId="rank-common-days">
          {fill(l.commonDaysNote!, { n: d.commonDates.length })}
        </Note>
      ) : null}
      {d.missingDays > 0 ? (
        <Note tone="info" testId="rank-missing">
          {fill(l.missingNote!, { n: d.missingDays })}
        </Note>
      ) : null}
      {d.rows.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText!} />
      ) : (
        <DataTable<(typeof d.rows)[number]>
          caption={`${l[`metric_${d.metric}`]} · ${d.from} - ${d.to}`}
          toolbar={`${l[`metric_${d.metric}`]}`}
          rows={d.rows}
          rowKey={(x) => x.branchId}
          columns={[
            { key: 'r', header: l.colRank!, numeric: true, render: (x) => x.rank ?? '—' },
            { key: 'b', header: l.colBranch!, render: (x) => `${x.code} · ${x.name}` },
            {
              key: 'v',
              header: l.colValue!,
              numeric: true,
              render: (x) => (x.value === null ? l.noRank : show(x.value)),
            },
            { key: 'd', header: l.colDays!, numeric: true, render: (x) => x.presentDays },
            {
              key: 'm',
              header: l.colMissing!,
              numeric: true,
              render: (x) => x.missingDates.length,
            },
            {
              key: 's',
              header: l.colState!,
              render: (x) => (
                <span className={`tag tag--${x.provisional ? 'warning' : 'success'}`}>
                  {x.provisional ? l.provisional : l.official}
                </span>
              ),
            },
          ]}
        />
      )}
      <p data-testid="rank-total">
        <strong>{l.total}:</strong> {show(d.total)}
      </p>
      <p className="text-secondary">
        {l.formula}: {l[`formula_${d.metric}`]}
      </p>
    </RptPage>
  );
}

import { getTranslations } from 'next-intl/server';
import { getCustomerReport, getIndicators, listBranchGroups } from '@/modules/rpt';
import { hasPermission } from '@/platform/rbac/rbac';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { businessDate } from '@/platform/format/date';
import { Field, fill, money, Note, pctOf, RptPage, rptLabels } from '../rptUi';

export const dynamic = 'force-dynamic';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * FR-RPT-015 (customer visits, new vs returning; receivables wait for slice 2.7) and FR-RPT-016 (average per order, quote
 * approval rate; stock accuracy waits for slice 2.3). Read from the daily rollups of the viewer's branches.
 */
export default async function IndicatorsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const today = businessDate(new Date());
  const from = first(sp.from);
  const to = first(sp.to);
  const groupId = first(sp.groupId);
  const l = rptLabels('indicators');
  const q = {
    from: from && ISO.test(from) ? from : addDays(today, -6),
    to: to && ISO.test(to) ? to : today,
    ...(groupId ? { groupId } : {}),
  };
  const container = getContainer();
  const res = await load(async () => ({
    customers: hasPermission(actor, 'customer:view')
      ? await getCustomerReport(container.rpt, actor, q)
      : null,
    indicators: await getIndicators(container.rpt, actor, q),
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
  const { customers, indicators, groups } = res.data;
  const avg = indicators.indicators.find((x) => x.metric === 'avgPerOrderVnd');
  const approval = indicators.indicators.find((x) => x.metric === 'quoteApprovalBp');
  return (
    <RptPage {...head}>
      <section className="card no-print">
        <div className="card__body">
          <form
            method="get"
            action="/rpt/indicators"
            className="row"
            style={{ gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'end' }}
          >
            <Field id="ind-from" label={rptLabels('rep').from!}>
              <input
                className="input"
                id="ind-from"
                name="from"
                type="date"
                defaultValue={q.from}
              />
            </Field>
            <Field id="ind-to" label={rptLabels('rep').to!}>
              <input className="input" id="ind-to" name="to" type="date" defaultValue={q.to} />
            </Field>
            {groups.length > 0 ? (
              <Field id="ind-group" label={rptLabels('ranking').group!}>
                <select
                  className="select"
                  id="ind-group"
                  name="groupId"
                  defaultValue={groupId ?? ''}
                >
                  <option value="">{rptLabels('ranking').allGroups}</option>
                  {groups.map((g) => (
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
      {indicators.provisionalDays > 0 ? (
        <Note tone="warning">{fill(l.provisionalNote!, { n: indicators.provisionalDays })}</Note>
      ) : null}
      {customers ? (
        <>
          <Note tone="info">
            {l.visitsNote} {l.noReceivables}
          </Note>
          {customers.rows.some((r) => r.unavailableDates.length > 0) ? (
            <Note tone="warning">
              {fill(l.unavailable!, {
                n: customers.rows.reduce((s, r) => s + r.unavailableDates.length, 0),
              })}
            </Note>
          ) : null}
          <DataTable<(typeof customers.rows)[number]>
            caption={l.customersTitle!}
            toolbar={l.customersTitle!}
            rows={customers.rows}
            rowKey={(x) => x.branchId}
            columns={[
              { key: 'b', header: l.colBranch!, render: (x) => `${x.code} · ${x.name}` },
              { key: 'v', header: l.colVisits!, numeric: true, render: (x) => x.visits },
              { key: 'n', header: l.colNew!, numeric: true, render: (x) => x.newCount },
              { key: 'r', header: l.colReturning!, numeric: true, render: (x) => x.returningCount },
              {
                key: 'p',
                header: l.colReturningRate!,
                numeric: true,
                render: (x) => pctOf(x.returningBp),
              },
            ]}
          />
          <p data-testid="cust-total">
            <strong>{l.total}:</strong> {customers.total.visits} · {customers.total.newCount} ·{' '}
            {customers.total.returningCount} · {pctOf(customers.total.returningBp)}
          </p>
        </>
      ) : null}
      {avg ? (
        <>
          <DataTable<(typeof avg.rows)[number]>
            caption={l.avgTitle!}
            toolbar={l.avgTitle!}
            rows={avg.rows}
            rowKey={(x) => x.branchId}
            columns={[
              { key: 'b', header: l.colBranch!, render: (x) => x.code },
              {
                key: 'a',
                header: l.colAvg!,
                numeric: true,
                render: (x) => (x.value === null ? '—' : money(x.value)),
              },
            ]}
          />
          <p className="text-secondary" data-testid="avg-total">
            {l.total}: {avg.total === null ? '—' : money(avg.total)} · {avg.formula}
          </p>
        </>
      ) : null}
      {approval ? (
        <>
          <DataTable<(typeof approval.rows)[number]>
            caption={l.approvalTitle!}
            toolbar={l.approvalTitle!}
            rows={approval.rows}
            rowKey={(x) => x.branchId}
            columns={[
              { key: 'b', header: l.colBranch!, render: (x) => x.code },
              {
                key: 'a',
                header: l.colApproval!,
                numeric: true,
                render: (x) => pctOf(x.value),
              },
              { key: 'p', header: l.colPending!, numeric: true, render: (x) => x.pending },
            ]}
          />
          <p className="text-secondary" data-testid="approval-total">
            {l.total}: {pctOf(approval.total)} · {approval.formula}
          </p>
        </>
      ) : null}
    </RptPage>
  );
}

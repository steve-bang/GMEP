import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { businessDate } from '@/platform/format/date';
import { getMonthly } from '@/modules/rpt';
import { listServiceTypes } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { ReportTools } from '../RptActions';
import {
  dmy,
  Field,
  FilterForm,
  fill,
  Kpi,
  Kpis,
  money,
  Note,
  RptPage,
  rptLabels,
  UnlinkedNote,
} from '../rptUi';

export const dynamic = 'force-dynamic';
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * FR-RPT-002 / 013 / 014: monthly report of one branch, summed from the daily rollups. Missing days are listed, never
 * counted as zero; end-of-period figures come from the last day with a rollup.
 */
export default async function MonthlyReportPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const rawMonth = first(sp.month);
  const branchId = first(sp.branchId);
  const serviceType = first(sp.serviceType);
  const l = rptLabels('rep');
  const month = rawMonth && MONTH.test(rawMonth) ? rawMonth : businessDate(new Date()).slice(0, 7);
  const container = getContainer();
  const res = await load(() =>
    getMonthly(container.rpt, actor, {
      month,
      ...(branchId ? { branchId } : {}),
      ...(serviceType ? { serviceType } : {}),
    }),
  );
  const types = await listServiceTypes(container.rec, actor).catch(() => []);
  const head = {
    title: l.monthlyTitle!,
    desc: l.monthlyLead!,
    crumbs: [{ label: t('shell.nav.reports'), href: '/rpt' }],
  };
  if (res.error)
    return (
      <RptPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RptPage>
    );
  const d = res.data;
  const r = d.report;
  // FR-RPT-002: change against the same day range of the month before (basis points -> one-decimal percent)
  const cmp = r.comparison;
  const change = (bp: number | null | undefined): string | undefined => {
    if (!cmp) return l.vsPrevNa;
    if (bp === null || bp === undefined) return l.vsPrevZero;
    // basis points -> percent with one decimal, rounded (not cut); a zero change has no sign
    const tenths = Math.round(Math.abs(bp) / 10);
    const pct = `${bp > 0 && tenths > 0 ? '+' : bp < 0 && tenths > 0 ? '-' : ''}${Math.trunc(tenths / 10)},${tenths % 10}%`;
    return fill(l.vsPrev!, {
      month: cmp.month.slice(5) + '/' + cmp.month.slice(0, 4),
      days: cmp.days,
      change: pct,
    });
  };
  return (
    <RptPage {...head}>
      <FilterForm
        action="/rpt/monthly"
        branchId={d.branchId}
        applyLabel={rptLabels('common').apply!}
      >
        <Field id="m-month" label={l.month!}>
          <input className="input" id="m-month" name="month" type="month" defaultValue={month} />
        </Field>
        <Field id="m-svc" label={l.serviceType!}>
          <select
            className="select"
            id="m-svc"
            name="serviceType"
            defaultValue={d.serviceType ?? ''}
          >
            <option value="">{l.allServiceTypes}</option>
            {types.map((x) => (
              <option key={x.code} value={x.code}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <span data-testid="monthly-branch">{d.branchName}</span>
      </FilterForm>
      <Note tone={r.missingDates.length ? 'warning' : 'info'} testId="monthly-days">
        {fill(l.monthlyDays!, { present: r.present, days: r.days, official: r.official })}
        {r.missingDates.length ? (
          <> · {fill(l.monthlyMissing!, { n: r.missingDates.length })}</>
        ) : null}
      </Note>
      {d.serviceType ? (
        <Note tone="info" testId="monthly-filtered">
          {l.filteredNote}
          {d.breakdownUnavailableDates.length ? (
            <> {fill(l.breakdownMissing!, { n: d.breakdownUnavailableDates.length })}</>
          ) : null}
        </Note>
      ) : null}
      {cmp && cmp.missingDates.length > 0 ? (
        <Note tone="warning" testId="monthly-prev-missing">
          {fill(l.vsPrevMissing!, { n: cmp.missingDates.length })}
        </Note>
      ) : null}
      {d.unlinked ? <UnlinkedNote u={d.unlinked} labels={l} /> : null}
      <Kpis>
        <Kpi
          label={l.kRevenue!}
          value={money(r.revenue.exTaxVnd)}
          formula={l.fRevenue!}
          meta={<span data-testid="m-revenue-delta">{change(cmp?.deltaBp.exTaxVnd)}</span>}
          testId="m-revenue"
        />
        <Kpi
          label={l.kOrders!}
          value={String(r.orders.closed)}
          meta={<span data-testid="m-closed-delta">{change(cmp?.deltaBp.closed)}</span>}
          testId="m-closed"
        />
        <Kpi
          label={l.kAvg!}
          value={money(r.revenue.avgPerOrderVnd)}
          formula={l.fAvg!}
          testId="m-avg"
        />
        {d.visible.money ? (
          <Kpi label={l.kInflow!} value={money(r.money.inflowVnd)} testId="m-inflow" />
        ) : null}
      </Kpis>
      <div className="rpt-two">
        <section className="table-wrap" aria-label={l.exTax}>
          <div className="table-scroll">
            <table className="table table--compact" data-testid="m-split">
              <caption className="sr-only">{l.exTax}</caption>
              <tbody>
                <tr>
                  <td>{l.labor}</td>
                  <td className="col-num">{money(r.revenue.laborVnd)}</td>
                </tr>
                <tr>
                  <td>{l.parts}</td>
                  <td className="col-num">{money(r.revenue.partsVnd)}</td>
                </tr>
                <tr className="rpt-total-row">
                  <td>{l.exTax}</td>
                  <td className="col-num">{money(r.revenue.exTaxVnd)}</td>
                </tr>
                <tr>
                  <td>{l.taxOther}</td>
                  <td className="col-num">{money(r.revenue.taxAndOtherVnd)}</td>
                </tr>
                {d.visible.invoices ? (
                  <tr>
                    <td>{l.invIssued}</td>
                    <td className="col-num">
                      {r.invoices.issuedCount} · {money(r.invoices.issuedVnd)}
                    </td>
                  </tr>
                ) : null}
                {d.visible.stock ? (
                  <tr>
                    <td>{l.stockNoSource}</td>
                    <td className="col-num">
                      {r.stock.issuesWithoutSource} / {r.stock.issueDocuments}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="table-wrap" aria-label={l.endTitle}>
          <div className="table-toolbar">
            <strong>{l.endTitle}</strong>
          </div>
          <div className="table-scroll">
            <table className="table table--compact" data-testid="m-end">
              <caption className="sr-only">{l.endTitle}</caption>
              <tbody>
                <tr>
                  <td>{l.openAtEnd}</td>
                  <td className="col-num">{r.endOfPeriod.openAtEnd}</td>
                </tr>
                {d.visible.receivables ? (
                  <>
                    <tr>
                      <td>{l.openDebt}</td>
                      <td className="col-num">{money(r.endOfPeriod.openDebtVnd)}</td>
                    </tr>
                    <tr>
                      <td>{l.overdueDebt}</td>
                      <td className="col-num">{money(r.endOfPeriod.overdueDebtVnd)}</td>
                    </tr>
                  </>
                ) : null}
                {d.visible.invoices ? (
                  <tr>
                    <td>{l.notInvoiced}</td>
                    <td className="col-num">{r.endOfPeriod.closedWithoutInvoiceCount}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span className="table-meta">
              {r.endOfPeriod.date ? fill(l.endNote!, { date: dmy(r.endOfPeriod.date) }) : l.empty}
            </span>
          </div>
        </section>
      </div>
      <DataTable<(typeof r.series)[number]>
        caption={l.trendTitle!}
        toolbar={l.trendTitle!}
        rows={r.series}
        rowKey={(x) => x.date}
        columns={[
          {
            key: 'd',
            header: l.colDate!,
            render: (x) => (
              <Link href={`/rpt/daily?date=${x.date}&branchId=${encodeURIComponent(d.branchId)}`}>
                {dmy(x.date)}
              </Link>
            ),
          },
          { key: 'c', header: l.colOrders!, numeric: true, render: (x) => x.closed },
          { key: 'r', header: l.exTax!, numeric: true, render: (x) => money(x.exTaxVnd) },
        ]}
      />
      <ReportTools
        body={{
          kind: 'monthly',
          month,
          branchId: d.branchId,
          ...(d.serviceType ? { serviceType: d.serviceType } : {}),
        }}
        labels={l}
        mayExport={d.mayExport}
      />
    </RptPage>
  );
}

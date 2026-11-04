import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getDaily } from '@/modules/rpt';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { ExportButton, RunButtons } from '../RptActions';
import {
  dmy,
  drillHref,
  fill,
  Kpi,
  Kpis,
  money,
  Note,
  RptPage,
  rptLabels,
  StateTag,
} from '../rptUi';

export const dynamic = 'force-dynamic';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * G4-RPT-03 / FR-RPT-003, 013: the daily report of one branch. Revenue = labor + parts of the approved lines, before
 * tax; the page prints the formula next to the figure. The reconciliation line is the design's: received for the orders
 * completed that day + open debt = order total including tax. A day closed in ACC is official, otherwise provisional.
 */
export default async function DailyReportPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const rawDate = first(sp.date);
  const branchId = first(sp.branchId);
  const l = rptLabels('daily');
  const c = rptLabels('common');
  const res = await load(() =>
    getDaily(getContainer().rpt, actor, {
      ...(rawDate && ISO.test(rawDate) ? { date: rawDate } : {}),
      ...(branchId ? { branchId } : {}),
    }),
  );
  const crumbs = [{ label: t('shell.nav.reports'), href: '/rpt' }];
  const head = { title: l.title!, desc: l.lead!, crumbs };
  if (res.error)
    return (
      <RptPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RptPage>
    );
  const d = res.data;
  const r = d.rollup;
  const keep = { branchId: d.branchId };
  return (
    <RptPage {...head}>
      <section className="card">
        <div className="card__body">
          <div
            className="row"
            style={{ gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'end' }}
          >
            <DateFilter
              base="/rpt/daily"
              fields={[{ name: 'date', label: c.date!, iso: d.date }]}
              keep={keep}
              applyLabel={c.apply!}
              resetLabel={c.reset!}
            />
            <span data-testid="daily-branch">{d.branchName}</span>
            {r ? <StateTag official={r.official} l={c} /> : null}
            {r ? (
              <span className="text-secondary">
                {fill(c.asOf!, {
                  time: new Date(r.computedAt).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  }),
                })}
              </span>
            ) : null}
          </div>
        </div>
      </section>
      {!r ? (
        <EmptyState
          title={c.noRollupTitle!}
          text={c.noRollupText}
          actions={
            d.mayRun ? (
              <RunButtons date={d.date} branchId={d.branchId} labels={rptLabels('run')} />
            ) : null
          }
        />
      ) : (
        <>
          {r.truncated.length > 0 ? (
            <Note tone="warning">{fill(c.truncated!, { list: r.truncated.join(', ') })}</Note>
          ) : null}
          <Kpis>
            <Kpi
              label={l.kRevenue!}
              value={money(r.revenue.exTaxVnd)}
              formula={l.fRevenue!}
              testId="d-revenue"
              meta={fill(l.kRevenueMeta!, { n: r.orders.closed })}
            />
            <Kpi
              label={l.kTotal!}
              value={money(r.revenue.orderTotalVnd)}
              testId="d-total"
              formula={l.fTotal!}
              href={drillHref(d.date, 'closed', d.branchId)}
            />
            <Kpi
              label={l.kReceived!}
              value={money(r.money.receivedForClosedVnd)}
              testId="d-received"
            />
            <Kpi
              label={l.kDebt!}
              value={money(r.money.debtForClosedVnd)}
              testId="d-debt"
              tone={r.money.debtForClosedVnd > 0 ? 'warning' : undefined}
            />
          </Kpis>
          <Note tone={r.money.gapVnd === 0 ? 'success' : 'warning'} testId="reconcile">
            {r.money.gapVnd === 0 ? (
              <strong>{l.reconcileOk}</strong>
            ) : (
              <>
                <strong>
                  {fill(l.reconcileGap!, { v: money(r.money.gapVnd), n: r.money.gapOrders })}
                </strong>{' '}
                <Link href={drillHref(d.date, 'unpaid', d.branchId)}>{l.seeOrders}</Link>
              </>
            )}{' '}
            <span className="text-secondary">{l.reconcileFormula}</span>
          </Note>
          <div className="rpt-two">
            <section className="table-wrap" aria-label={l.splitTitle}>
              <div className="table-toolbar">
                <strong>{l.splitTitle}</strong>
              </div>
              <div className="table-scroll">
                <table className="table table--compact" data-testid="split">
                  <caption className="sr-only">{l.splitTitle}</caption>
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
                    <tr>
                      <td>{l.avg}</td>
                      <td className="col-num">{money(r.revenue.avgPerOrderVnd)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span className="table-meta">{l.formulaNote}</span>
              </div>
            </section>
            <section className="table-wrap" aria-label={l.methodTitle}>
              <div className="table-toolbar">
                <strong>{l.methodTitle}</strong>
              </div>
              <div className="table-scroll">
                <table className="table table--compact" data-testid="by-method">
                  <caption className="sr-only">{l.methodTitle}</caption>
                  <tbody>
                    {Object.entries(r.money.byMethod).map(([m, v]) => (
                      <tr key={m}>
                        <td>{l[`method_${m}`] ?? m}</td>
                        <td className="col-num">{money(v)}</td>
                      </tr>
                    ))}
                    <tr className="rpt-total-row">
                      <td>{l.inflow}</td>
                      <td className="col-num" data-testid="d-inflow">
                        {money(r.money.inflowVnd)}
                      </td>
                    </tr>
                    <tr>
                      <td>{l.deposit}</td>
                      <td className="col-num">{money(r.money.depositVnd)}</td>
                    </tr>
                    <tr>
                      <td>{l.expense}</td>
                      <td className="col-num">{money(r.money.expenseVnd)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <Link href={drillHref(d.date, 'payments', d.branchId)}>{l.seePayments}</Link>
              </div>
            </section>
          </div>
          <section className="table-wrap" aria-label={l.flowTitle}>
            <div className="table-toolbar">
              <strong>{l.flowTitle}</strong>
            </div>
            <div className="table-scroll">
              <table className="table table--compact" data-testid="flow">
                <caption className="sr-only">{l.flowTitle}</caption>
                <tbody>
                  {(['opened', 'closed', 'handedOver', 'cancelled', 'openAtEnd'] as const).map(
                    (k) => (
                      <tr key={k}>
                        <td>{l[`flow_${k}`]}</td>
                        <td className="col-num">
                          <Link href={drillHref(d.date, k, d.branchId)}>{r.orders[k]}</Link>
                        </td>
                      </tr>
                    ),
                  )}
                  <tr>
                    <td>{l.invIssued}</td>
                    <td className="col-num">
                      <Link href={drillHref(d.date, 'invoicesIssued', d.branchId)}>
                        {r.invoices.issuedCount}
                      </Link>{' '}
                      · {money(r.invoices.issuedVnd)}
                    </td>
                  </tr>
                  <tr>
                    <td>{l.invMissing}</td>
                    <td className="col-num">
                      <Link href={drillHref(d.date, 'notInvoiced', d.branchId)}>
                        {r.invoices.closedWithoutInvoiceCount}
                      </Link>{' '}
                      · {money(r.invoices.closedWithoutInvoiceVnd)}
                    </td>
                  </tr>
                  <tr>
                    <td>{l.debtOpen}</td>
                    <td className="col-num">
                      <Link href={drillHref(d.date, 'openDebts', d.branchId)}>
                        {r.receivables.openDebtCount}
                      </Link>{' '}
                      · {money(r.receivables.openDebtVnd)}
                    </td>
                  </tr>
                  <tr>
                    <td>{l.stockNoSource}</td>
                    <td className="col-num" data-testid="d-stock">
                      <Link href={drillHref(d.date, 'stockWithoutSource', d.branchId)}>
                        {r.stock.issuesWithoutSource}
                      </Link>{' '}
                      / {r.stock.issueDocuments}
                    </td>
                  </tr>
                  <tr>
                    <td>{l.shiftVariance}</td>
                    <td className="col-num">
                      {r.cash.shiftsWithVariance} / {r.cash.shiftsClosed} ·{' '}
                      {money(r.cash.varianceVnd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <DataTable<{ date: string; exTaxVnd: number | null; official: boolean }>
            caption={l.trendTitle!}
            rows={d.series}
            rowKey={(x) => x.date}
            toolbar={l.trendTitle!}
            columns={[
              {
                key: 'd',
                header: c.date!,
                render: (x) => (
                  <Link
                    href={`/rpt/daily?date=${x.date}&branchId=${encodeURIComponent(d.branchId)}`}
                  >
                    {dmy(x.date)}
                  </Link>
                ),
              },
              {
                key: 'r',
                header: l.exTax!,
                numeric: true,
                render: (x) => (x.exTaxVnd === null ? '—' : money(x.exTaxVnd)),
              },
              {
                key: 's',
                header: c.state!,
                render: (x) =>
                  x.exTaxVnd === null ? '—' : <StateTag official={x.official} l={c} />,
              },
            ]}
          />
          <div className="rpt-two">
            {d.mayExport ? (
              <section className="card">
                <div className="card__body stack">
                  <strong>{l.exportTitle}</strong>
                  <span className="text-secondary">{l.exportHint}</span>
                  <ExportButton date={d.date} branchId={d.branchId} labels={rptLabels('run')} />
                </div>
              </section>
            ) : null}
            {d.mayRun ? (
              <section className="card">
                <div className="card__body stack">
                  <strong>{l.jobTitle}</strong>
                  <span className="text-secondary">{l.jobHint}</span>
                  <RunButtons date={d.date} branchId={d.branchId} labels={rptLabels('run')} />
                </div>
              </section>
            ) : null}
          </div>
        </>
      )}
    </RptPage>
  );
}

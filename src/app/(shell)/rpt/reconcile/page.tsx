import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getReconcile } from '@/modules/rpt';
import { listServiceTypes } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { ReportTools } from '../RptActions';
import {
  dmy,
  drillHref,
  Field,
  FilterForm,
  fill,
  money,
  Note,
  RptPage,
  rptLabels,
  UnlinkedNote,
} from '../rptUi';

export const dynamic = 'force-dynamic';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * FR-RPT-004 / 011: four-way reconciliation of one branch over a date range. Every failed cell links to the source
 * documents of that day (the existing drill-down); sections the user may not see are shown as such, never as "ok".
 */
export default async function ReconcilePage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const from = first(sp.from);
  const to = first(sp.to);
  const branchId = first(sp.branchId);
  const serviceType = first(sp.serviceType);
  const l = rptLabels('rep');
  const container = getContainer();
  const res = await load(() =>
    getReconcile(container.rpt, actor, {
      ...(from && ISO.test(from) ? { from } : {}),
      ...(to && ISO.test(to) ? { to } : {}),
      ...(branchId ? { branchId } : {}),
      ...(serviceType ? { serviceType } : {}),
    }),
  );
  const types = await listServiceTypes(container.rec, actor).catch(() => []);
  const head = {
    title: l.reconcileTitle!,
    desc: l.reconcileLead!,
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
  const v = d.visible;
  const hidden = <span className="text-secondary">{l.hidden}</span>;
  const cell = (show: boolean, node: React.ReactNode) => (show ? node : hidden);
  const link = (date: string, metric: string, text: React.ReactNode) => (
    <Link href={drillHref(date, metric, d.branchId)}>{text}</Link>
  );
  return (
    <RptPage {...head}>
      <FilterForm
        action="/rpt/reconcile"
        branchId={d.branchId}
        applyLabel={rptLabels('common').apply!}
      >
        <Field id="rc-from" label={l.from!}>
          <input className="input" id="rc-from" name="from" type="date" defaultValue={r.from} />
        </Field>
        <Field id="rc-to" label={l.to!}>
          <input className="input" id="rc-to" name="to" type="date" defaultValue={r.to} />
        </Field>
        <Field id="rc-svc" label={l.serviceType!}>
          <select
            className="select"
            id="rc-svc"
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
        <span data-testid="reconcile-branch">{d.branchName}</span>
      </FilterForm>
      {d.serviceType ? (
        <Note tone="info" testId="reconcile-filtered">
          {l.filteredNote}
          {d.breakdownUnavailableDates.length ? (
            <> {fill(l.breakdownMissing!, { n: d.breakdownUnavailableDates.length })}</>
          ) : null}
        </Note>
      ) : null}
      {d.unlinked ? <UnlinkedNote u={d.unlinked} labels={l} /> : null}
      <Note tone={r.reconciled ? 'success' : 'warning'} testId="reconcile-state">
        <strong>{r.reconciled ? l.reconcileOk : fill(l.reconcileBad!, { n: r.failedDays })}</strong>
        {r.missingDates.length ? (
          <> {fill(l.reconcileMissing!, { list: r.missingDates.map(dmy).join(', ') })}</>
        ) : null}
        <span className="text-secondary" style={{ display: 'block' }}>
          {[
            v.payments ? l.fPayments : null,
            v.invoices ? l.fInvoices : null,
            v.cash ? l.fCash : null,
            v.stock ? l.fStock : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </Note>
      <section className="table-wrap" aria-label={l.reconcileTitle}>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={l.reconcileTitle}>
          <table className="table table--compact" data-testid="reconcile-table">
            <caption className="sr-only">{l.reconcileTitle}</caption>
            <thead>
              <tr>
                <th scope="col">{l.colDate}</th>
                <th scope="col" className="col-num">
                  {l.colOrders}
                </th>
                <th scope="col" className="col-num">
                  {l.colTotal}
                </th>
                <th scope="col" className="col-num">
                  {l.colReceived}
                </th>
                <th scope="col" className="col-num">
                  {l.colDebt}
                </th>
                <th scope="col" className="col-num">
                  {l.colGap}
                </th>
                <th scope="col" className="col-num">
                  {l.colIssued}
                </th>
                <th scope="col" className="col-num">
                  {l.colNotInvoiced}
                </th>
                <th scope="col" className="col-num">
                  {l.colShiftVar}
                </th>
                <th scope="col" className="col-num">
                  {l.colGin}
                </th>
                <th scope="col" className="col-num">
                  {l.colNoSource}
                </th>
                <th scope="col">{l.colResult}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((x) => (
                <tr key={x.date} data-testid={`rc-${x.date}`}>
                  <td>
                    <Link
                      href={`/rpt/daily?date=${x.date}&branchId=${encodeURIComponent(d.branchId)}`}
                    >
                      {dmy(x.date)}
                    </Link>
                  </td>
                  <td className="col-num">{link(x.date, 'closed', x.closed)}</td>
                  <td className="col-num">{money(x.orderTotalVnd)}</td>
                  <td className="col-num">{cell(v.payments, money(x.receivedVnd))}</td>
                  <td className="col-num">
                    {cell(v.payments, link(x.date, 'openDebts', money(x.debtVnd)))}
                  </td>
                  <td className="col-num">
                    {cell(
                      v.payments,
                      x.gapVnd === 0 ? money(0) : link(x.date, 'unpaid', money(x.gapVnd)),
                    )}
                  </td>
                  <td className="col-num">
                    {cell(v.invoices, link(x.date, 'invoicesIssued', x.issuedCount))}
                  </td>
                  <td className="col-num">
                    {cell(v.invoices, link(x.date, 'notInvoiced', x.notInvoicedCount))}
                  </td>
                  <td className="col-num">{cell(v.cash, x.shiftsWithVariance)}</td>
                  <td className="col-num">{cell(v.stock, x.issueDocuments)}</td>
                  <td className="col-num">
                    {cell(v.stock, link(x.date, 'stockWithoutSource', x.withoutSource))}
                  </td>
                  <td>
                    <span className={`tag tag--${x.failed.length ? 'warning' : 'success'}`}>
                      {x.failed.length
                        ? x.failed
                            .map((k) => l[`check${k[0]!.toUpperCase()}${k.slice(1)}`])
                            .join(', ')
                        : l.ok}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="rpt-total-row" data-testid="rc-total">
                <td>{l.totalRow}</td>
                <td className="col-num">{r.totals.closed}</td>
                <td className="col-num">{money(r.totals.orderTotalVnd)}</td>
                <td className="col-num">{cell(v.payments, money(r.totals.receivedVnd))}</td>
                <td className="col-num">{cell(v.payments, money(r.totals.debtVnd))}</td>
                <td className="col-num">{cell(v.payments, money(r.totals.gapVnd))}</td>
                <td className="col-num">{cell(v.invoices, r.totals.issuedCount)}</td>
                <td className="col-num">{cell(v.invoices, r.totals.notInvoicedCount)}</td>
                <td className="col-num">{cell(v.cash, r.totals.shiftsWithVariance)}</td>
                <td className="col-num">{cell(v.stock, r.totals.issueDocuments)}</td>
                <td className="col-num">{cell(v.stock, r.totals.withoutSource)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <ReportTools
        body={{
          kind: 'reconcile',
          from: r.from,
          to: r.to,
          branchId: d.branchId,
          ...(d.serviceType ? { serviceType: d.serviceType } : {}),
        }}
        labels={l}
        mayExport={d.mayExport}
      />
    </RptPage>
  );
}

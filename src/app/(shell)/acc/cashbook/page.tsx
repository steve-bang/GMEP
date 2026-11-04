import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { businessDate, formatDateTime, isoToVi } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { expenseCategories, getCashbook } from '@/modules/acc';
import { listApprovals } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { AccPage, accLabels, KpiRow, money, Note } from '../accUi';
import { ExpensePanel, OpenShiftButton } from './CashPanels';

export const dynamic = 'force-dynamic';
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/** G4-ACC-04 / FR-ACC-003: the cash book of one day: entries in order with the running balance, totals that add up. */
export default async function CashbookPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const l = accLabels('cashbook');
  const c = accLabels('common');
  const today = businessDate(new Date());
  const date = first(sp.date) ?? today;
  const res = await load(async () => {
    const acc = getContainer().acc;
    const cb = await getCashbook(acc, actor, date);
    const cats = hasPermission(actor, 'cash-expense:view')
      ? await expenseCategories(acc, actor.companyId, today)
      : [];
    const mine = hasPermission(actor, 'approval:view')
      ? await listApprovals(getContainer().sys, actor, { tab: 'mine' }).catch(() => null)
      : null;
    const approved = (mine?.items ?? [])
      .filter(
        (a) =>
          (a.kind === 'expense' || a.kind === 'deposit_refund') &&
          a.status === 'approved' &&
          !a.consumed,
      )
      .map((a) => ({
        id: a.id,
        number: a.number,
        payee: a.subjectLabel,
        valueVnd: a.valueVnd,
      }));
    return { cb, cats, approved };
  });
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <AccPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const { cb, cats, approved } = res.data;
  const openShift = cb.shifts.find((s) => s.status === 'open');
  return (
    <AccPage
      {...head}
      actions={
        <Link className="btn btn--secondary" href="/acc/day-close">
          {l.toDayClose}
        </Link>
      }
    >
      {cb.closed ? (
        <Note tone="warning" testId="day-closed">
          {fill(l.dayClosed!, { date: isoToVi(cb.date) })}
        </Note>
      ) : null}
      <section className="card">
        <div className="card__body rec-actions" data-testid="shift-bar">
          {openShift ? (
            <>
              <span data-testid="shift-open">
                {fill(l.shiftOpen!, {
                  time: formatDateTime(new Date(openShift.openedAt)),
                  opening: money(openShift.openingVnd),
                })}
              </span>
              {cb.actions.closeShift.allowed ? (
                <Link
                  className="btn btn--primary"
                  href="/acc/cashbook/close"
                  data-testid="to-close-shift"
                >
                  {l.closeShift}
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <span data-testid="shift-none">{l.shiftNone}</span>
              {cb.actions.openShift.allowed ? <OpenShiftButton labels={l} common={c} /> : null}
            </>
          )}
          <span className="text-secondary">
            {l.balanceNow}:{' '}
            <strong data-testid="drawer-balance">{money(cb.drawer.balanceVnd)}</strong>
          </span>
        </div>
      </section>
      <section className="card">
        <div className="card__body">
          <DateFilter
            base="/acc/cashbook"
            fields={[{ name: 'date', label: l.date!, iso: date }]}
            applyLabel={c.apply!}
            resetLabel={c.reset!}
          />
        </div>
      </section>
      <KpiRow
        items={[
          {
            label: l.opening!,
            value: cb.openingVnd === null ? '—' : money(cb.openingVnd),
            testId: 'kpi-opening',
          },
          { label: l.cashIn!, value: money(cb.inVnd), testId: 'kpi-in' },
          { label: l.cashOut!, value: money(cb.outVnd), testId: 'kpi-out' },
          {
            label: l.closing!,
            value: cb.closingVnd === null ? '—' : money(cb.closingVnd),
            meta: l.formula,
            testId: 'kpi-closing',
          },
        ]}
      />
      {cb.entries.length === 0 ? (
        <EmptyState title={l.empty!} />
      ) : (
        <DataTable
          caption={l.title!}
          rows={cb.entries}
          rowKey={(e) => e.id}
          columns={[
            {
              key: 't',
              header: l.colTime!,
              render: (e) => formatDateTime(new Date(e.at)).slice(-5),
            },
            {
              key: 'd',
              header: l.colDoc!,
              render: (e) =>
                e.paymentId && e.documentNumber ? (
                  <Link className="code" href={`/acc/payments/${encodeURIComponent(e.paymentId)}`}>
                    {e.documentNumber}
                  </Link>
                ) : (
                  '—'
                ),
            },
            { key: 'x', header: l.colDesc!, render: (e) => e.description },
            {
              key: 'k',
              header: l.colKind!,
              render: (e) => (
                <StatusBadge
                  tone={
                    e.kind === 'reversal' ? 'danger' : e.kind === 'variance' ? 'warning' : 'neutral'
                  }
                >
                  {l[`kind_${e.kind}`]}
                </StatusBadge>
              ),
            },
            {
              key: 'i',
              header: l.colIn!,
              numeric: true,
              render: (e) => (e.direction === 'in' ? money(e.amountVnd) : ''),
            },
            {
              key: 'o',
              header: l.colOut!,
              numeric: true,
              render: (e) => (e.direction === 'out' ? money(e.amountVnd) : ''),
            },
            {
              key: 'b',
              header: l.colBalance!,
              numeric: true,
              render: (e) => money(e.balanceAfterVnd),
            },
          ]}
        />
      )}
      {cb.shifts.length ? (
        <section className="card" aria-labelledby="sh-h">
          <div className="card__header">
            <h2 className="card__title" id="sh-h">
              {l.shifts}
            </h2>
          </div>
          <DataTable
            caption={l.shifts!}
            rows={cb.shifts}
            rowKey={(s) => s.id}
            columns={[
              {
                key: 'a',
                header: l.colTime!,
                render: (s) => `${formatDateTime(new Date(s.openedAt))} · ${s.openedByName}`,
              },
              { key: 's', header: l.colKind!, render: (s) => l[`shiftState_${s.status}`] },
              {
                key: 'v',
                header: l.variance!,
                numeric: true,
                render: (s) => (s.varianceVnd === null ? '—' : money(s.varianceVnd)),
              },
            ]}
          />
        </section>
      ) : null}
      {hasPermission(actor, 'cash-expense:create') && !cb.closed ? (
        <ExpensePanel
          categories={cats}
          approved={approved}
          enabled={cb.actions.expense.allowed}
          labels={l}
          common={c}
        />
      ) : null}
    </AccPage>
  );
}

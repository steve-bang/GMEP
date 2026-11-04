import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { businessDate, formatDateTime, isoToVi } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { dayCloseId, getDayStatus } from '@/modules/acc';
import { findActiveApprovalFor } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { AccPage, accLabels, KpiRow, money, Note } from '../accUi';
import { ApprovedActionPanel } from '../ApprovedActionPanel';
import { DayCloseForm } from './DayCloseForm';

export const dynamic = 'force-dynamic';
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/** G4-ACC-09 / FR-ACC-004, UAT-07: conditions before the day can be locked. */
export default async function DayClosePage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const l = accLabels('day');
  const c = accLabels('common');
  const date = first(sp.date) ?? businessDate(new Date());
  const res = await load(() => getDayStatus(getContainer().acc, actor, date));
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <AccPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const d = res.data;
  const w = d.warnings;
  const warnLines = [
    w.openOrders.length ? fill(l.openOrders!, { n: w.openOrders.length }) : null,
    w.unpaidOrders ? fill(l.unpaid!, { n: w.unpaidOrders }) : null,
    w.expensesWithoutSource ? fill(l.expSrc!, { n: w.expensesWithoutSource }) : null,
  ].filter((x): x is string => !!x);
  // FR-ACC-005: only the current business day can be reopened, with the owner's approval
  const canReopen =
    d.closed && d.date === businessDate(new Date()) && hasPermission(actor, 'cash-day:update');
  const branchId = actor.workingBranchId ?? '';
  const reopenApproval =
    canReopen && hasPermission(actor, 'approval:view')
      ? await findActiveApprovalFor(getContainer().sys, actor, {
          kind: 'day_reopen',
          subjectId: dayCloseId(branchId, d.date),
          branchId,
        }).catch(() => null)
      : null;
  const ro = accLabels('reopen');
  return (
    <AccPage {...head}>
      <section className="card">
        <div className="card__body">
          <DateFilter
            base="/acc/day-close"
            fields={[{ name: 'date', label: l.date!, iso: date }]}
            applyLabel={c.apply!}
            resetLabel={c.reset!}
          />
        </div>
      </section>
      {d.closed ? (
        <Note tone="success" testId="day-closed-note">
          {fill(l.closedBy!, {
            time: formatDateTime(new Date(d.closedAt!)),
            name: d.closedByName ?? '',
          })}
        </Note>
      ) : null}
      <KpiRow
        items={[
          { label: l.cashIn!, value: money(d.cashInVnd) },
          { label: l.cashOut!, value: money(d.cashOutVnd) },
          {
            label: l.closing!,
            value: d.closingBalanceVnd === null ? '—' : money(d.closingBalanceVnd),
          },
        ]}
      />
      <section className="card" aria-labelledby="blk-h">
        <div className="card__header">
          <h2 className="card__title" id="blk-h">
            {l.blockers}
          </h2>
        </div>
        <div className="card__body stack" data-testid="blockers">
          {d.blockers.length === 0 ? (
            <p className="text-secondary">{d.closed ? '' : l.blockersNone}</p>
          ) : (
            <ul className="stack-2">
              {d.blockers.map((b, i) => (
                <li key={i}>
                  <StatusBadge tone="danger">{l[`blocker_${b.code}`]}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="card" aria-labelledby="wrn-h">
        <div className="card__header">
          <h2 className="card__title" id="wrn-h">
            {l.warnings}
          </h2>
        </div>
        <div className="card__body">
          {warnLines.length === 0 ? (
            <p className="text-secondary">{l.none}</p>
          ) : (
            <ul className="stack-2" data-testid="warnings">
              {warnLines.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {d.shifts.length ? (
        <DataTable
          caption={l.shifts!}
          rows={d.shifts}
          rowKey={(s) => s.id}
          columns={[
            { key: 'a', header: l.colShift!, render: (s) => formatDateTime(new Date(s.openedAt)) },
            { key: 'b', header: l.colBy!, render: (s) => s.openedByName },
            {
              key: 'v',
              header: l.colVariance!,
              numeric: true,
              render: (s) => (s.varianceVnd === null ? '—' : money(s.varianceVnd)),
            },
            {
              key: 's',
              header: l.colState!,
              render: (s) =>
                `${s.status === 'open' ? accLabels('cashbook').shiftState_open : accLabels('cashbook').shiftState_closed}`,
            },
          ]}
        />
      ) : null}
      {w.openOrders.length ? (
        <DataTable
          caption={l.openOrders!.replace('{n}', String(w.openOrders.length))}
          rows={w.openOrders}
          rowKey={(o) => o.id}
          columns={[
            {
              key: 'n',
              header: l.colOrder!,
              render: (o) => (
                <Link className="code" href={`/acc/orders/${encodeURIComponent(o.id)}`}>
                  {o.number}
                </Link>
              ),
            },
            {
              key: 'p',
              header: l.colPlate!,
              render: (o) => <span className="plate">{o.plate}</span>,
            },
            { key: 's', header: l.colStatus!, render: (o) => t(`rec.orders.status_${o.status}`) },
            { key: 'o', header: l.colOwed!, numeric: true, render: (o) => money(o.outstandingVnd) },
          ]}
        />
      ) : null}
      {canReopen ? (
        <ApprovedActionPanel
          testId="reopen"
          requestUrl="/api/v1/acc/day-close/reopen-request"
          executeUrl="/api/v1/acc/day-close/reopen"
          fixed={{ date: d.date }}
          fields={[{ name: 'reason', label: ro.reason!, kind: 'textarea' }]}
          approval={
            reopenApproval
              ? {
                  id: reopenApproval.id,
                  number: reopenApproval.number,
                  status: reopenApproval.status,
                  consumed: reopenApproval.consumed,
                }
              : null
          }
          labels={ro}
          common={c}
        />
      ) : null}
      {!d.closed ? (
        <DayCloseForm date={d.date} allowed={d.actions.close.allowed} labels={l} common={c} />
      ) : (
        <p className="text-secondary">{isoToVi(d.date)}</p>
      )}
    </AccPage>
  );
}

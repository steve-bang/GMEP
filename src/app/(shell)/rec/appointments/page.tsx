import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { businessDate } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { listAppointmentAdvisors, listAppointments, type AppointmentDto } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge, type BadgeTone } from '@/ui/components/StatusBadge';
import { RecPage } from '../RecPage';
import { AppointmentActions } from './AppointmentActions';
import { aptLabels } from './labels';

export const dynamic = 'force-dynamic';

const TONE: Record<string, BadgeTone> = {
  pending: 'info',
  arrived: 'success',
  cancelled: 'neutral',
  no_show: 'warning',
};
const viDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * G2-APT-01 / FR-REC-019, 027: the calendar of the working branch by day or week with the capacity of each day and the
 * card actions (Đã đến opens the pre-filled intake, edit, change advisor, cancel with a reason, no-show). Booking is
 * offered only when the branch has appointments on; the walk-in shortcut opens the intake.
 */
export default async function AppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const from = first(sp.from) ?? businessDate(new Date());
  const days = first(sp.view) === 'week' ? 7 : 1;
  const container = getContainer();
  const res = await load(async () => ({
    cal: await listAppointments(container.rec, actor, { from, days: String(days) }),
    advisors: await listAppointmentAdvisors(container.rec, actor).catch(() => []),
  }));
  const k = (key: string, v?: Record<string, string | number>) => t(`rec.appointments.${key}`, v);
  const canCreate = hasPermission(actor, 'appointment:create');
  const actions = (
    <>
      {canCreate && res.data?.cal.enabled ? (
        <Link className="btn btn--primary" href="/rec/appointments/new" data-testid="apt-new">
          {k('newAction')}
        </Link>
      ) : null}
      {hasPermission(actor, 'intake:create') ? (
        <Link className="btn btn--secondary" href="/rec/intakes/new" data-testid="walk-in">
          {k('walkIn')}
        </Link>
      ) : null}
    </>
  );
  const head = { title: k('title'), desc: k('lead'), actions };
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const { cal, advisors } = res.data;
  const l = aptLabels();
  const today = businessDate(new Date());
  const canUpdate = hasPermission(actor, 'appointment:update');
  const canArrive = canUpdate && hasPermission(actor, 'intake:create');
  const advisorName = (id: string | null) =>
    id ? (advisors.find((a) => a.id === id)?.name ?? '–') : k('advisorNone');
  const viewLink = (view: 'day' | 'week') =>
    `/rec/appointments?from=${cal.from}${view === 'week' ? '&view=week' : ''}`;
  return (
    <RecPage {...head}>
      {!cal.enabled ? (
        <div className="alert alert--info" role="note">
          <div className="alert__body">{k('disabled')}</div>
        </div>
      ) : null}
      {cal.truncated ? (
        <div className="alert alert--warning" role="note">
          <div className="alert__body">{k('truncated')}</div>
        </div>
      ) : null}
      <section className="card">
        <div className="card__body stack">
          <nav className="rec-chips" aria-label={k('title')}>
            <Link
              className={`btn ${days === 1 ? 'btn--primary' : 'btn--secondary'}`}
              href={viewLink('day')}
              aria-current={days === 1 ? 'page' : undefined}
            >
              {k('day')}
            </Link>
            <Link
              className={`btn ${days === 7 ? 'btn--primary' : 'btn--secondary'}`}
              href={viewLink('week')}
              aria-current={days === 7 ? 'page' : undefined}
            >
              {k('week')}
            </Link>
          </nav>
          <DateFilter
            base="/rec/appointments"
            fields={[{ name: 'from', label: k('from'), iso: cal.from }]}
            {...(days === 7 ? { keep: { view: 'week' } } : {})}
            applyLabel={t('rec.apply')}
            resetLabel={t('rec.reset')}
          />
        </div>
      </section>
      <div className="acc-kpis">
        {cal.days.map((d) => (
          <div className="card kpi" key={d.date} data-testid={`apt-day-${d.date}`}>
            <span className="kpi__label">{viDate(d.date)}</span>
            <span className="kpi__value">
              {d.capacity > 0
                ? k('capacity', { booked: d.booked, capacity: d.capacity })
                : k('noCapacity', { booked: d.booked })}
            </span>
            {d.over ? (
              <StatusBadge tone="danger">{k('over')}</StatusBadge>
            ) : d.full ? (
              <StatusBadge tone="warning">{k('full')}</StatusBadge>
            ) : null}
          </div>
        ))}
      </div>
      {cal.items.length === 0 ? (
        <EmptyState title={k('emptyTitle')} text={k('emptyText')} />
      ) : (
        <DataTable<AppointmentDto>
          caption={k('title')}
          rows={cal.items}
          rowKey={(x) => x.id}
          columns={[
            {
              key: 'time',
              header: k('colTime'),
              render: (x) => (days > 1 ? `${viDate(x.date)} ${x.time}` : x.time),
            },
            {
              key: 'number',
              header: k('colNumber'),
              render: (x) => <span className="code">{x.number}</span>,
            },
            { key: 'plate', header: t('rec.plate'), render: (x) => x.plate },
            { key: 'customer', header: t('rec.customer'), render: (x) => x.customerName },
            { key: 'service', header: k('colService'), render: (x) => x.serviceType ?? '–' },
            {
              key: 'advisor',
              header: k('colAdvisor'),
              render: (x) => advisorName(x.advisorId),
            },
            {
              key: 'status',
              header: t('rec.status'),
              render: (x) => (
                <span className="rec-chips">
                  <StatusBadge tone={TONE[x.status] ?? 'neutral'}>
                    {k(`status_${x.status}`)}
                  </StatusBadge>
                  {x.overCapacity ? (
                    <span className="tag tag--warning">{k('overFlag')}</span>
                  ) : null}
                </span>
              ),
            },
            {
              key: 'intake',
              header: k('colIntake'),
              render: (x) =>
                x.intakeId ? (
                  <Link className="code" href={`/rec/intakes/${encodeURIComponent(x.intakeId)}`}>
                    {x.intakeId.slice(0, 12)}
                  </Link>
                ) : (
                  '–'
                ),
            },
            ...(canUpdate || canArrive
              ? [
                  {
                    key: 'actions',
                    header: k('colActions'),
                    render: (x: AppointmentDto) =>
                      x.status === 'pending' ? (
                        <AppointmentActions
                          labels={l}
                          id={x.id}
                          number={x.number}
                          version={x.version}
                          advisorId={x.advisorId}
                          advisors={advisors}
                          canUpdate={canUpdate}
                          canArrive={canArrive}
                          due={x.date <= today}
                        />
                      ) : (
                        '–'
                      ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </RecPage>
  );
}

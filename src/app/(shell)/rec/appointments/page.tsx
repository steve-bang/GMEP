import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  addIsoDays,
  businessDate,
  daysBetween,
  isoToVi,
  isoWeekStart,
  viDayChip,
  viDayShort,
  viDayTitle,
  viToIso,
  viWeekTitle,
} from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import {
  APPOINTMENT_TABS,
  availableMessageChannels,
  getAppointment,
  listAppointmentAdvisors,
  listAppointmentReasons,
  listAppointments,
  listServiceTypes,
  type AppointmentTab,
} from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { Icon } from '@/ui/components/Icon';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { RecPage } from '../RecPage';
import { AppointmentBoard } from './AppointmentBoard';
import { AppointmentTabs, type TabDef } from './AppointmentTabs';
import { fill } from './appointmentText';
import { DateJump } from './DateJump';
import { aptLabels } from './labels';

export const dynamic = 'force-dynamic';

const asTab = (v: string | undefined): AppointmentTab =>
  (APPOINTMENT_TABS as readonly string[]).includes(v ?? '') ? (v as AppointmentTab) : 'upcoming';

/**
 * G2-APT-01 (FR-REC-019, 027, 044..047): five tabs (Sắp tới, Trễ hẹn, Đã đến, Đã hủy, Vắng) with counters that come from
 * the same server filter as the list, the date bar (Trước, Hôm nay, Sau, a dd/MM/yyyy field, day or ISO week from Monday)
 * and the capacity of the day. "Hôm nay" and "Trễ hẹn" come from the SERVER clock (Asia/Ho_Chi_Minh). Tab, view and day
 * live in the address. The Trễ hẹn tab ignores the viewed day and hides the date bar.
 */
export default async function AppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const l = aptLabels();
  const tab = asTab(first(sp.tab));
  const view = first(sp.view) === 'week' ? 'week' : 'day';
  const container = getContainer();
  const canUpdate = hasPermission(actor, 'appointment:update');
  const canCreate = hasPermission(actor, 'appointment:create');
  const serverToday = businessDate(new Date());
  const anchor = viToIso(first(sp.from)) ?? serverToday;
  const listFrom = view === 'week' ? isoWeekStart(anchor) : anchor;
  const reschedId = first(sp.resched);
  const res = await load(async () => ({
    cal: await listAppointments(container.rec, actor, {
      from: listFrom,
      days: view === 'week' ? '7' : '1',
      tab,
    }),
    advisors: await listAppointmentAdvisors(container.rec, actor).catch(() => []),
    services: await listServiceTypes(container.rec, actor).catch(() => []),
    cancelReasons: canUpdate
      ? await listAppointmentReasons(container.rec, actor, 'cancel').catch(() => null)
      : null,
    reschedReasons: canUpdate
      ? await listAppointmentReasons(container.rec, actor, 'reschedule').catch(() => null)
      : null,
    auto:
      canUpdate && reschedId
        ? await getAppointment(container.rec, actor, reschedId).catch(() => null)
        : null,
  }));
  const k = (key: string, v?: Record<string, string | number>) => fill(l[key], v ?? {});
  const actions = (
    <>
      {canCreate && res.data?.cal.enabled ? (
        <Link className="btn btn--primary" href="/rec/appointments/new" data-testid="apt-new">
          {l.newAction}
        </Link>
      ) : null}
      {hasPermission(actor, 'intake:create') ? (
        <Link className="btn btn--secondary" href="/rec/intakes/new" data-testid="walk-in">
          {l.walkIn}
        </Link>
      ) : null}
    </>
  );
  const head = { title: l.title!, desc: l.lead!, actions };
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const { cal, advisors } = res.data;
  const today = cal.now.date;
  const addr = (over: { tab?: AppointmentTab; from?: string; view?: 'day' | 'week' }) => {
    const q = new URLSearchParams();
    const tb = over.tab ?? tab;
    const vw = over.view ?? view;
    const from = over.from ?? anchor;
    if (tb !== 'upcoming') q.set('tab', tb);
    if (vw === 'week') q.set('view', 'week');
    if (from !== today) q.set('from', from);
    const s = q.toString();
    return `/rec/appointments${s ? `?${s}` : ''}`;
  };
  const overdue = cal.counts.overdue;
  const countText = (tabId: AppointmentTab) => {
    const c = cal.counts[tabId];
    return c.more ? `${c.n}+` : String(c.n);
  };
  const tabs: TabDef[] = APPOINTMENT_TABS.map((id) => ({
    id,
    label: l[`tab_${id}`]!,
    count: countText(id),
    countLabel: k('countLabel', { n: countText(id) }),
    warn: id === 'overdue' && cal.counts.overdue.n > 0,
    href: addr({ tab: id }),
  }));

  // ---- date bar ---------------------------------------------------------------------------------------------
  const isWeek = view === 'week';
  const step = isWeek ? 7 : 1;
  const prevFrom = addIsoDays(anchor, -step);
  const nextFrom = addIsoDays(anchor, step);
  const isNow = isWeek ? isoWeekStart(anchor) === isoWeekStart(today) : anchor === today;
  const dayDiff = daysBetween(anchor, today);
  const chip = isWeek
    ? isNow
      ? { text: l.chipThisWeek!, info: true }
      : null
    : dayDiff === 0
      ? { text: l.chipToday!, info: true }
      : dayDiff === 1
        ? { text: l.chipTomorrow!, info: false }
        : dayDiff === -1
          ? { text: l.chipYesterday!, info: false }
          : null;
  const full = isWeek ? viWeekTitle(anchor) : viDayTitle(anchor);
  const short = isWeek ? viWeekTitle(anchor) : viDayShort(anchor);
  const dayCap = !isWeek ? cal.days[0] : undefined;
  const todayLabel = isNow
    ? isWeek
      ? l.todayNowWeek
      : l.todayNowDay
    : isWeek
      ? l.todayGoWeek
      : k('todayGoDay', { date: isoToVi(today) });
  const capPct =
    dayCap && dayCap.capacity > 0
      ? Math.min(100, Math.round((dayCap.booked / dayCap.capacity) * 100))
      : 0;
  const capTone =
    !dayCap || dayCap.capacity === 0
      ? 'info'
      : dayCap.over
        ? 'danger'
        : capPct >= 80
          ? 'warning'
          : 'info';
  const serviceNames = Object.fromEntries(res.data.services.map((s) => [s.code, s.name]));
  const channel =
    (['sms', 'zalo'] as const).find((c) => availableMessageChannels(container.rec).includes(c)) ??
    null;
  const policy = cal.policy;

  const empty = {
    title: l[`empty_${tab}_t`]!,
    text: l[`empty_${tab}_x`],
  };

  return (
    <RecPage {...head}>
      {!cal.enabled ? (
        <EmptyState
          title={l.disabledTitle!}
          text={l.disabledText}
          actions={
            hasPermission(actor, 'intake:create') ? (
              <Link className="btn btn--primary" href="/rec/intakes/new">
                {l.walkIn}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="scope-banner" role="status">
            <span>
              <strong>{l.scopeTime}</strong>{' '}
              {tab === 'overdue' ? l.scopeAllDays : isWeek ? full : viDayTitle(anchor)}
            </span>
            <span>· {k('updatedAt', { time: cal.now.time })}</span>
          </div>
          {!canUpdate ? (
            <div className="alert alert--info" role="status">
              <Icon name="eye" />
              <div className="alert__body">{l.readOnly}</div>
            </div>
          ) : null}
          {overdue.n > 0 ? (
            <div className="alert alert--warning" role="status" data-testid="apt-overdue-alert">
              <Icon name="clock" />
              <div className="alert__body">
                <span className="alert__title">
                  {k('overdueAlertTitle', { n: overdue.more ? `${overdue.n}+` : overdue.n })}
                </span>
                <span>{l.overdueAlertText}</span>
              </div>
              {tab !== 'overdue' ? (
                <div className="alert__actions">
                  <Link className="btn btn--secondary btn--sm" href={addr({ tab: 'overdue' })}>
                    {l.overdueAlertGo}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
          {cal.truncated && tab !== 'overdue' ? (
            <div className="alert alert--warning" role="note">
              <div className="alert__body">{l.truncated}</div>
            </div>
          ) : null}

          <AppointmentTabs label={l.tabsLabel!} active={tab} tabs={tabs} />

          {tab !== 'overdue' ? (
            <section className="g2w-dbar" aria-label={l.dateBarLabel} data-testid="apt-datebar">
              <div className="g2w-dbar__block">
                <div className="g2w-dbar__title" aria-live="polite">
                  <h2 data-testid="apt-date-title">
                    <span className="g2w-dt-full">{full}</span>
                    <span className="g2w-dt-short">{short}</span>
                  </h2>
                  {chip ? (
                    <span
                      className={`badge badge--nodot ${chip.info ? 'badge--info' : 'badge--neutral'}`}
                      data-testid="apt-date-chip"
                    >
                      {chip.text}
                    </span>
                  ) : null}
                </div>
                <div className="g2w-dbar__nav" role="group" aria-label={l.dateNavLabel}>
                  <Link
                    className="btn-icon btn-icon--outline"
                    href={addr({ from: prevFrom })}
                    aria-label={
                      isWeek
                        ? k('prevWeek', { title: viWeekTitle(prevFrom) })
                        : k('prevDay', { date: isoToVi(prevFrom) })
                    }
                    data-testid="apt-prev"
                  >
                    <Icon name="chevron-left" />
                  </Link>
                  {isNow ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled
                      aria-label={todayLabel}
                      data-testid="apt-today"
                    >
                      {l.todayBtn}
                    </button>
                  ) : (
                    <Link
                      className="btn btn--secondary"
                      href={addr({ from: today })}
                      aria-label={todayLabel}
                      data-testid="apt-today"
                    >
                      {l.todayBtn}
                    </Link>
                  )}
                  <Link
                    className="btn-icon btn-icon--outline"
                    href={addr({ from: nextFrom })}
                    aria-label={
                      isWeek
                        ? k('nextWeek', { title: viWeekTitle(nextFrom) })
                        : k('nextDay', { date: isoToVi(nextFrom) })
                    }
                    data-testid="apt-next"
                  >
                    <Icon name="chevron-right" />
                  </Link>
                  <DateJump
                    value={isoToVi(anchor)}
                    hrefTemplate={addr({ from: '0000-00-00' })}
                    label={l.dateInputLabel!}
                    invalid={l.dateInvalid!}
                  />
                  <nav className="rec-chips" aria-label={l.viewLabel}>
                    <Link
                      className={`btn ${!isWeek ? 'btn--primary' : 'btn--secondary'}`}
                      href={addr({ view: 'day' })}
                      aria-current={!isWeek ? 'page' : undefined}
                      data-testid="apt-view-day"
                    >
                      {l.day}
                    </Link>
                    <Link
                      className={`btn ${isWeek ? 'btn--primary' : 'btn--secondary'}`}
                      href={addr({ view: 'week' })}
                      aria-current={isWeek ? 'page' : undefined}
                      data-testid="apt-view-week"
                    >
                      {l.week}
                    </Link>
                  </nav>
                </div>
              </div>
              {dayCap ? (
                <div className="g2w-dbar__cap" data-testid={`apt-day-${dayCap.date}`}>
                  <span className="field__label" id="cap-l">
                    {dayCap.date === today
                      ? l.capToday
                      : k('capDay', { title: viDayTitle(dayCap.date) })}
                  </span>
                  <div className={`progress progress--${capTone}`}>
                    <div className="progress__head">
                      <span>
                        <strong>
                          {dayCap.capacity > 0
                            ? k('capCount', { booked: dayCap.booked, capacity: dayCap.capacity })
                            : `${dayCap.booked}`}
                        </strong>
                        {dayCap.capacity > 0 ? '' : ' xe'}
                      </span>
                      <span>{dayCap.capacity > 0 ? `${capPct}%` : ''}</span>
                    </div>
                    {dayCap.capacity > 0 ? (
                      <div
                        className="progress__track"
                        role="progressbar"
                        aria-labelledby="cap-l"
                        aria-valuenow={dayCap.booked}
                        aria-valuemin={0}
                        aria-valuemax={dayCap.capacity}
                        aria-valuetext={k('weekDayAria', {
                          title: '',
                          booked: dayCap.booked,
                          cap: dayCap.capacity,
                        }).replace(/^: /, '')}
                      >
                        <div className="progress__bar" style={{ width: `${capPct}%` }} />
                      </div>
                    ) : null}
                  </div>
                  {dayCap.over ? (
                    <span className="badge badge--danger">{l.over}</span>
                  ) : dayCap.full ? (
                    <span className="badge badge--warning">{l.full}</span>
                  ) : dayCap.capacity > 0 ? (
                    <span className="badge badge--success">
                      {k('capFree', { n: dayCap.capacity - dayCap.booked })}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <div
            role="tabpanel"
            id={`pnl-${tab}`}
            aria-labelledby={`tab-${tab}`}
            tabIndex={0}
            className="g2w-stack"
          >
            {tab === 'overdue' ? (
              <div className="alert alert--info" role="note">
                <Icon name="info" />
                <div className="alert__body">
                  {k('overdueNote', { grace: policy.overdueGraceMinutes })}
                </div>
              </div>
            ) : null}
            {tab === 'overdue' && overdue.more ? (
              <div className="alert alert--warning" role="status">
                <Icon name="alert-triangle" />
                <div className="alert__body">{l.overdueMore}</div>
              </div>
            ) : null}
            {tab === 'upcoming' && isWeek ? (
              <div className="g2w-wk" role="group" aria-label={l.weekStripLabel}>
                {cal.days.map((d) => {
                  const fullDay = d.capacity > 0 && d.booked >= d.capacity;
                  return (
                    <Link
                      key={d.date}
                      href={addr({ from: d.date, view: 'day' })}
                      className={`g2w-wk__d${fullDay ? ' is-full' : ''}${d.date === today ? ' is-today' : ''}`}
                      aria-label={
                        d.capacity > 0
                          ? `${viDayTitle(d.date)}: ${d.booked}/${d.capacity}${d.over ? `, ${l.over}` : d.full ? `, ${l.full}` : ''}`
                          : k('weekDayAriaNoCap', { title: viDayTitle(d.date), booked: d.booked })
                      }
                      data-testid={`apt-day-${d.date}`}
                    >
                      <span>{viDayChip(d.date)}</span>
                      <strong>
                        {d.capacity > 0
                          ? k('capCount', { booked: d.booked, capacity: d.capacity })
                          : `${d.booked} xe`}
                      </strong>
                      {d.over ? <span>{l.over}</span> : d.full ? <span>{l.full}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
            {cal.items.length === 0 ? (
              <EmptyState
                title={empty.title}
                {...(empty.text ? { text: empty.text } : {})}
                {...(tab === 'upcoming' && canCreate
                  ? {
                      actions: (
                        <>
                          <Link className="btn btn--primary" href="/rec/appointments/new">
                            {l.new}
                          </Link>
                          {hasPermission(actor, 'intake:create') ? (
                            <Link className="btn btn--secondary" href="/rec/intakes/new">
                              {l.walkIn}
                            </Link>
                          ) : null}
                        </>
                      ),
                    }
                  : {})}
              />
            ) : (
              <AppointmentBoard
                labels={l}
                tab={tab}
                grouped={isWeek && tab !== 'overdue'}
                items={cal.items}
                now={cal.now}
                policy={policy}
                advisors={advisors}
                services={serviceNames}
                cancelReasons={res.data.cancelReasons?.items ?? []}
                rescheduleReasons={res.data.reschedReasons?.items ?? []}
                canUpdate={canUpdate}
                canArrive={canUpdate && hasPermission(actor, 'intake:create')}
                canOverride={hasPermission(actor, 'appointment-policy:update')}
                channel={channel}
                autoResched={
                  res.data.auto && res.data.auto.status === 'pending' ? res.data.auto : null
                }
              />
            )}
          </div>
        </>
      )}
    </RecPage>
  );
}

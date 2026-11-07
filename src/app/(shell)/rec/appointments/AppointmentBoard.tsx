'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AppointmentDto } from '@/modules/rec';
import { formatDateTime, isoToVi, viDayTitle } from '@/platform/format/date';
import { Icon } from '@/ui/components/Icon';
import { newKey, postJson } from '@/ui/components/postJson';
import { StatusBadge, type BadgeTone } from '@/ui/components/StatusBadge';
import {
  AbsentDialog,
  AdvisorDialog,
  CancelDialog,
  RescheduleDialog,
  type AptPolicy,
  type Reason,
} from './AppointmentDialogs';
import { atText, fill, lateText, telHref } from './appointmentText';
import { problemText } from './labels';

type Labels = Record<string, string>;
type Tab = 'upcoming' | 'overdue' | 'arrived' | 'cancelled' | 'no_show';
type Dlg = { kind: 'cancel' | 'resched' | 'absent' | 'advisor'; id: string } | null;

export interface BoardProps {
  labels: Labels;
  tab: Tab;
  /** week view groups the rows by day */
  grouped: boolean;
  items: AppointmentDto[];
  now: { date: string; time: string };
  policy: AptPolicy;
  advisors: { id: string; name: string }[];
  services: Record<string, string>;
  cancelReasons: Reason[];
  rescheduleReasons: Reason[];
  canUpdate: boolean;
  canArrive: boolean;
  canOverride: boolean;
  /** the message channel offered for "Báo cho khách" (none = only "Đã gọi điện") */
  channel: string | null;
  /** open this appointment's Dời lịch dialog on arrival (from the edit page link) */
  autoResched?: AppointmentDto | null;
}

const TAB_TONE: Record<Tab, BadgeTone> = {
  upcoming: 'info',
  overdue: 'warning',
  arrived: 'success',
  cancelled: 'danger',
  no_show: 'neutral',
};

/**
 * G2-APT-01 list of one tab (FR-REC-044..046): the rows, the detail drawer with the reschedule history and ONE set of
 * dialogs (Hủy, Dời lịch, Đánh dấu vắng, Đổi cố vấn) shared by every row. Every button carries the appointment number in
 * its accessible name. Which actions show comes from the server (`allowed`, the actor's rights); it re-checks all.
 */
export function AppointmentBoard(props: BoardProps) {
  const { labels: l } = props;
  const router = useRouter();
  const [dlg, setDlg] = useState<Dlg>(
    props.autoResched ? { kind: 'resched', id: props.autoResched.id } : null,
  );
  const [drawer, setDrawer] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [arriving, setArriving] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  const find = (id: string) =>
    props.items.find((x) => x.id === id) ??
    (props.autoResched?.id === id ? props.autoResched : undefined);
  const target = dlg ? find(dlg.id) : undefined;
  const drawerApt = drawer ? find(drawer) : undefined;

  async function arrive(a: AppointmentDto) {
    const k = `arrive:${a.id}:${a.version}`;
    if (!keys.current.has(k)) keys.current.set(k, newKey());
    setArriving(a.id);
    setRowError(null);
    const r = await postJson(
      `/api/v1/rec/appointments/${encodeURIComponent(a.id)}/arrive`,
      'POST',
      { version: a.version },
      keys.current.get(k)!,
    );
    setArriving(null);
    if (r.ok) {
      const intake = (r.data as { intake?: { id: string } | null }).intake;
      if (intake) router.push(`/rec/intakes/${encodeURIComponent(intake.id)}`);
      else router.refresh();
      return;
    }
    if (r.status !== 0) keys.current.delete(k);
    setRowError(problemText(l, r.problem, l.f_unexpected ?? ''));
    if (r.status === 409) router.refresh();
  }

  const closeDialog = () => setDlg(null);
  const done = (msg: string) => {
    setDlg(null);
    setDrawer(null);
    setFlash(msg);
    router.refresh();
  };
  const open = (kind: NonNullable<Dlg>['kind'], id: string) => {
    setDrawer(null);
    setRowError(null);
    setDlg({ kind, id });
  };

  const groups = props.grouped
    ? [...new Set(props.items.map((x) => x.date))].map((d) => ({
        date: d,
        rows: props.items.filter((x) => x.date === d),
      }))
    : [{ date: '', rows: props.items }];
  const listLabel = fill(l.listLabel, { tab: l[`tab_${props.tab}`] ?? '' });

  const row = (a: AppointmentDto) => {
    const od = props.tab === 'overdue';
    const showDate =
      od || props.tab === 'arrived' || props.tab === 'cancelled' || props.tab === 'no_show';
    const adv = a.advisorId ? props.advisors.find((x) => x.id === a.advisorId)?.name : null;
    const canAct = props.canUpdate;
    return (
      <li
        key={a.id}
        className={`g2w-arow${od ? ' is-overdue' : ''}`}
        data-testid={`apt-row-${a.number}`}
        data-status={a.status}
      >
        <div className="g2w-arow__time">
          {a.time}
          {showDate ? <small>{isoToVi(a.date)}</small> : null}
        </div>
        <div className="g2w-arow__main">
          <div className="g2w-arow__top">
            <strong className="plate">
              <button
                type="button"
                className="g2w-arow__open"
                onClick={() => setDrawer(a.id)}
                aria-label={fill(l.openDetail, { time: a.time, plate: a.plate })}
                data-testid="apt-open"
              >
                {a.plate}
              </button>
            </strong>
            {a.overdue ? (
              <StatusBadge tone="warning">{l.status_overdue}</StatusBadge>
            ) : (
              <StatusBadge tone={TAB_TONE[a.status === 'pending' ? 'upcoming' : (a.status as Tab)]}>
                {a.status === 'pending' ? l.status_booked : l[`status_${a.status}`]}
              </StatusBadge>
            )}
            {a.status === 'pending' && a.lateMinutes > 0 ? (
              <span className="tag tag--warning" data-testid="apt-late">
                {lateText(l, a.lateMinutes)}
              </span>
            ) : null}
            {a.stale ? <span className="tag tag--neutral">{l.stale}</span> : null}
            {a.overCapacity ? <span className="tag tag--warning">{l.overFlag}</span> : null}
          </div>
          <div>
            {a.customerName} ·{' '}
            {a.serviceType ? (props.services[a.serviceType] ?? a.serviceType) : '–'}
          </div>
          <div className="g2w-muted">
            {adv ? fill(l.advisorOf, { name: adv }) : l.advisorNone} ·{' '}
            <span className="code">{a.number}</span>
          </div>
          {a.rescheduleCount > 0 ? (
            <div className="g2w-arow__chips">
              <span className="tag tag--info" data-testid="apt-resched-count">
                {fill(l.reschedCount, { n: a.rescheduleCount })}
              </span>
              <span className="g2w-muted">
                {fill(l.originalAt, { at: atText(a.originalDate, a.originalTime) })}
              </span>
            </div>
          ) : null}
          {a.status === 'cancelled' && a.cancellation ? (
            <div className="g2w-muted" data-testid="apt-cancel-info">
              {fill(l.cancelInfo, {
                name: a.cancellation.reasonName,
                note: a.cancellation.note ? ` (${a.cancellation.note})` : '',
                by: a.cancellation.cancelledByName ?? '–',
                at: a.cancellation.cancelledAt
                  ? formatDateTime(new Date(a.cancellation.cancelledAt))
                  : '–',
              })}
            </div>
          ) : null}
          {a.status === 'arrived' && a.intakeId ? (
            <div className="g2w-muted">
              {l.arrivedInfo}:{' '}
              <Link className="code" href={`/rec/intakes/${encodeURIComponent(a.intakeId)}`}>
                {a.intakeId.slice(0, 12)}
              </Link>
            </div>
          ) : null}
        </div>
        {canAct && a.status === 'pending' ? (
          <div className="g2w-arow__actions">
            {od ? (
              <>
                <div className="g2w-arow__quick">
                  {a.customerPhone ? (
                    <a
                      className="btn btn--primary btn--sm"
                      href={telHref(a.customerPhone)}
                      aria-label={fill(l.a_callAria, { name: a.customerName, number: a.number })}
                      data-testid="apt-call"
                    >
                      <Icon name="phone" />
                      {l.a_call}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => open('resched', a.id)}
                    aria-label={fill(l.a_reschedAria, { number: a.number })}
                    data-testid="apt-resched"
                  >
                    <Icon name="calendar" />
                    {l.a_resched}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => open('absent', a.id)}
                    aria-label={fill(l.a_absentAria, { number: a.number })}
                    data-testid="apt-no-show"
                  >
                    <Icon name="circle-x" />
                    {l.a_absent}
                  </button>
                </div>
                <div className="g2w-arow__more">
                  {props.canArrive ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={arriving === a.id}
                      onClick={() => void arrive(a)}
                      aria-label={fill(l.a_arriveAria, { number: a.number })}
                      data-testid="apt-arrive"
                    >
                      {l.a_arrive}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => open('cancel', a.id)}
                    aria-label={fill(l.a_cancelAria, { number: a.number })}
                    data-testid="apt-cancel"
                  >
                    {l.a_cancelRow}
                  </button>
                </div>
              </>
            ) : (
              <div className="g2w-arow__quick">
                {props.canArrive ? (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={arriving === a.id}
                    onClick={() => void arrive(a)}
                    aria-label={fill(l.a_arriveAria, { number: a.number })}
                    data-testid="apt-arrive"
                  >
                    <Icon name="check" />
                    {l.a_arrive}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => open('resched', a.id)}
                  aria-label={fill(l.a_reschedAria, { number: a.number })}
                  data-testid="apt-resched"
                >
                  <Icon name="calendar" />
                  {l.a_resched}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => open('cancel', a.id)}
                  aria-label={fill(l.a_cancelAria, { number: a.number })}
                  data-testid="apt-cancel"
                >
                  <Icon name="x" />
                  {l.a_cancelRow}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <>
      {flash ? (
        <div className="alert alert--success" role="status" data-testid="apt-flash">
          <Icon name="check" />
          <div className="alert__body">{flash}</div>
          <div className="alert__actions">
            <button
              type="button"
              className="btn-icon"
              onClick={() => setFlash(null)}
              aria-label={l.flashClose}
            >
              <Icon name="x" />
            </button>
          </div>
        </div>
      ) : null}
      {rowError ? (
        <div className="alert alert--danger" role="alert" data-testid="apt-error">
          <div className="alert__body">{rowError}</div>
        </div>
      ) : null}
      {groups.map((g) => (
        <div className="g2w-stack" key={g.date || 'all'}>
          {g.date ? (
            <h3 className="g2w-agroup">
              {viDayTitle(g.date)}
              {g.date === props.now.date ? (
                <span className="badge badge--info badge--nodot">{l.chipToday}</span>
              ) : null}
            </h3>
          ) : null}
          <ul className="g2w-alist" aria-label={listLabel}>
            {g.rows.map(row)}
          </ul>
        </div>
      ))}

      {drawerApt ? (
        <Drawer
          l={l}
          apt={drawerApt}
          services={props.services}
          advisors={props.advisors}
          canUpdate={props.canUpdate}
          canArrive={props.canArrive}
          onClose={() => setDrawer(null)}
          onOpen={(kind) => open(kind, drawerApt.id)}
          onArrive={() => void arrive(drawerApt)}
        />
      ) : null}

      {dlg && target && dlg.kind === 'cancel' ? (
        <CancelDialog
          key={target.id}
          l={l}
          apt={target}
          reasons={props.cancelReasons}
          policy={props.policy}
          channel={props.channel}
          onClose={closeDialog}
          onDone={done}
          onSwitch={() => setDlg({ kind: 'resched', id: target.id })}
        />
      ) : null}
      {dlg && target && dlg.kind === 'resched' ? (
        <RescheduleDialog
          key={target.id}
          l={l}
          apt={target}
          reasons={props.rescheduleReasons}
          policy={props.policy}
          channel={props.channel}
          canOverride={props.canOverride}
          now={props.now}
          onClose={closeDialog}
          onDone={done}
          onReload={() => router.refresh()}
        />
      ) : null}
      {dlg && target && dlg.kind === 'absent' ? (
        <AbsentDialog l={l} apt={target} onClose={closeDialog} onDone={done} />
      ) : null}
      {dlg && target && dlg.kind === 'advisor' ? (
        <AdvisorDialog
          l={l}
          apt={target}
          advisors={props.advisors}
          onClose={closeDialog}
          onDone={done}
        />
      ) : null}
    </>
  );
}

// ---- detail drawer ------------------------------------------------------------------------------------------------

function Drawer(props: {
  l: Labels;
  apt: AppointmentDto;
  services: Record<string, string>;
  advisors: { id: string; name: string }[];
  canUpdate: boolean;
  canArrive: boolean;
  onClose: () => void;
  onOpen: (kind: 'cancel' | 'resched' | 'absent' | 'advisor') => void;
  onArrive: () => void;
}) {
  const { l, apt } = props;
  const box = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onClose = useRef(props.onClose);
  useEffect(() => {
    onClose.current = props.onClose;
  });
  useEffect(() => {
    // WCAG 2.4.3 / 2.1.2: focus moves in, Tab stays inside, Escape closes, focus returns to the opener
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose.current();
      if (e.key !== 'Tab' || !box.current) return;
      const items = [
        ...box.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])',
        ),
      ];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (!box.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  const pending = apt.status === 'pending';
  const adv = apt.advisorId ? props.advisors.find((x) => x.id === apt.advisorId)?.name : null;
  const kv: [string, React.ReactNode][] = [
    [l.kv_service!, apt.serviceType ? (props.services[apt.serviceType] ?? apt.serviceType) : '–'],
    [l.kv_at!, `${viDayTitle(apt.date)} ${apt.time}`],
    ...(apt.rescheduleCount > 0
      ? ([[l.kv_orig!, atText(apt.originalDate, apt.originalTime)]] as [string, string][])
      : []),
    [l.kv_advisor!, adv ?? l.advisorNone!],
    ...(apt.note ? ([[l.kv_apptNote!, apt.note]] as [string, string][]) : []),
    ...(apt.cancellation
      ? ([
          [
            l.kv_reason!,
            apt.cancellation.reasonName +
              (apt.cancellation.reasonCode === 'legacy' ? (l.kv_legacy ?? '') : ''),
          ],
          ...(apt.cancellation.note ? [[l.kv_note!, apt.cancellation.note]] : []),
          ...(apt.cancellation.cancelledByName
            ? [[l.kv_cancelBy!, apt.cancellation.cancelledByName]]
            : []),
        ] as [string, string][])
      : []),
  ];
  return (
    <div
      className="overlay overlay--drawer is-open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <aside
        ref={box}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-t"
        data-testid="apt-drawer"
      >
        <div className="card__header">
          <div>
            <h2 className="card__title" id="ap-t">
              {fill(l.drawerTitle, { time: apt.time, plate: apt.plate })}
            </h2>
            <div className="card__subtitle">
              {apt.customerName} · {apt.number}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn-icon"
            onClick={props.onClose}
            aria-label={l.closeLabel}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="card__body stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {apt.overdue ? (
              <StatusBadge tone="warning">{l.status_overdue}</StatusBadge>
            ) : (
              <StatusBadge tone={TAB_TONE[pending ? 'upcoming' : (apt.status as Tab)]}>
                {pending ? l.status_booked : l[`status_${apt.status}`]}
              </StatusBadge>
            )}
            <span className="g2w-muted">{atText(apt.date, apt.time)}</span>
            {pending && apt.lateMinutes > 0 ? (
              <span className="tag tag--warning">{lateText(l, apt.lateMinutes)}</span>
            ) : null}
            {apt.rescheduleCount > 0 ? (
              <span className="tag tag--info">
                {fill(l.reschedCount, { n: apt.rescheduleCount })}
              </span>
            ) : null}
          </div>
          <dl className="g2w-kv">
            {kv.map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <section className="stack" aria-label={l.histTitle} data-testid="apt-history">
            <h3 style={{ fontSize: 'var(--font-size-md)', margin: 0 }}>
              {apt.rescheduleCount > 0
                ? fill(l.histCount, { n: apt.rescheduleCount })
                : l.histTitle}
            </h3>
            {apt.reschedules.length === 0 ? (
              <p className="g2w-muted">{l.histNone}</p>
            ) : (
              <ul className="g2w-rhist">
                {apt.reschedules.map((r) => (
                  <li key={`${r.at}-${r.toDate}-${r.toTime}`}>
                    <strong className="num">
                      {atText(r.fromDate, r.fromTime)} → {atText(r.toDate, r.toTime)}
                    </strong>
                    <span>
                      {r.reasonName} ·{' '}
                      {r.requestedBy === 'customer' ? l.partyCustomer : l.partyWorkshop} ·{' '}
                      {r.byName || '–'} · {formatDateTime(new Date(r.at))}
                    </span>
                    {r.note ? (
                      <span className="g2w-muted">{fill(l.histNote, { note: r.note })}</span>
                    ) : null}
                    {r.late || r.overCapacity || r.overLimit ? (
                      <div className="g2w-arow__chips">
                        {r.late ? <span className="tag tag--warning">{l.flagLate}</span> : null}
                        {r.overCapacity ? (
                          <span className="tag tag--warning">{l.flagOver}</span>
                        ) : null}
                        {r.overLimit ? (
                          <span className="tag tag--warning">{l.flagLimit}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="card__footer" style={{ marginTop: 'auto', flexWrap: 'wrap' }}>
          {pending && !props.canUpdate ? (
            <p className="g2w-why" role="status" style={{ width: '100%' }}>
              <Icon name="lock" size="sm" />
              <span>{l.whyRo}</span>
            </p>
          ) : null}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {pending ? (
              <>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={!props.canUpdate}
                  onClick={() => props.onOpen('cancel')}
                  aria-label={fill(l.a_cancelAria, { number: apt.number })}
                  data-testid="apt-drawer-cancel"
                >
                  {l.d_cancel}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={!props.canUpdate}
                  onClick={() => props.onOpen('resched')}
                  aria-label={fill(l.a_reschedAria, { number: apt.number })}
                  data-testid="apt-drawer-resched"
                >
                  {l.d_resched}
                </button>
                {apt.overdue ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={!props.canUpdate}
                    onClick={() => props.onOpen('absent')}
                    aria-label={fill(l.a_absentAria, { number: apt.number })}
                  >
                    {l.d_absent}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={!props.canUpdate}
                  onClick={() => props.onOpen('advisor')}
                  aria-label={fill(l.a_advisorAria, { number: apt.number })}
                  data-testid="apt-drawer-advisor"
                >
                  {l.d_advisor}
                </button>
                {props.canUpdate ? (
                  <Link
                    className="btn btn--secondary"
                    href={`/rec/appointments/${encodeURIComponent(apt.id)}/edit`}
                    aria-label={`${l.a_edit} ${apt.number}`}
                    data-testid="apt-edit"
                  >
                    {l.d_edit}
                  </Link>
                ) : null}
                {props.canArrive ? (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={props.onArrive}
                    aria-label={fill(l.a_arriveAria, { number: apt.number })}
                  >
                    {l.d_arrive}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="g2w-muted">{l.drawerEnded}</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

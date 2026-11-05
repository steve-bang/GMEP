import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getDashboard, resolveRange, type DashboardDto } from '@/modules/rpt';
import { load } from '@/composition/pageData';
import { getContainer } from '@/composition/container';
import type { Session } from '@/modules/sys';
import { BarList, ColumnChart } from '@/ui/components/Charts';
import { RangeFilter } from '@/ui/components/RangeFilter';
import { businessDate, isoToVi } from '@/platform/format/date';
import { Icon } from '@/ui/components/Icon';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState, NoPermissionState } from '@/ui/components/States';
import { compactVnd } from '@/ui/charts/scale';
import { buildHomeModel, type KpiModel } from './dashboardModel';
import { fill, hrefOf, Kpi, money, Note, rptLabels, StateTag } from './rpt/rptUi';

type T = Awaited<ReturnType<typeof getTranslations>>;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const pctText = (bp: number) => `${(Math.abs(bp) / 100).toFixed(1).replace('.', ',')}%`;

/**
 * Home dashboard body (G1-DSH-01/03/04/05/08, FR-RPT-001). Data comes from the same `getDashboard` the
 * `GET /api/v1/rpt/dashboard` route serves, so the server has already removed every block the user may not see
 * (permission of the source module; revenue needs `report-daily:view`; several branches = the owner's sum).
 * This component only draws what is left and handles a missing block as "not shown", never as zero.
 */
export async function DashboardHome(props: {
  session: Session;
  /** old single-day link: the range of that one day */
  date?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  branchId?: string | undefined;
}) {
  const t = await getTranslations('dashboard');
  const tAll = await getTranslations();
  const tr = await getTranslations('rpt.dashboard');
  const rpt = getContainer().rpt;
  const ok = (v: string | undefined) => (v && ISO.test(v) ? v : undefined);
  const query = { date: ok(props.date), from: ok(props.from), to: ok(props.to) };
  const keep = props.branchId ? { branchId: props.branchId } : undefined;
  const today = businessDate(rpt.sys.clock.now());
  const res = await load(() =>
    getDashboard(rpt, props.session.actor, {
      ...(query.date ? { date: query.date } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(props.branchId ? { branchId: props.branchId } : {}),
    }),
  );
  if (res.error) {
    // a role without the dashboard view (e.g. technician) gets the plain "no permission" state with a way on
    if (res.error.status === 403)
      return <NoPermissionState title={t('noViewTitle')} text={t('noViewText')} />;
    // a refused range (from after to, too long) still shows the filter, so it can be corrected on the spot
    let shown: { from: string; to: string };
    try {
      shown = resolveRange(query, today, rpt.rpt.dashboardMaxDays);
    } catch {
      shown = {
        from: query.from ?? query.to ?? query.date ?? today,
        to: query.to ?? query.from ?? query.date ?? today,
      };
    }
    return (
      <div className="stack" data-testid="home-dashboard">
        <FilterCard
          t={t}
          from={shown.from}
          to={shown.to}
          days={null}
          today={today}
          maxDays={rpt.rpt.dashboardMaxDays}
          keep={keep}
        />
        <ErrorFor error={res.error} t={tAll as never} />
      </div>
    );
  }
  const d = res.data;
  const m = buildHomeModel(d);
  const missingBranches = d.rows.filter((r) => r.missing).length;
  // cards and bars that say "in the day" read "in the period" over several days
  const RANGE_WORDS = new Set(['k_revenue', 'k_opened', 'k_openAtEnd', 'k_inflow']);
  const label = (key: string) => t((m.multi && RANGE_WORDS.has(key) ? `${key}_r` : key) as never);
  const oLabel = (key: string) =>
    t(`o_${key}${m.multi && (key === 'opened' || key === 'openAtEnd') ? '_r' : ''}` as never);

  return (
    <div className="stack" data-testid="home-dashboard">
      <FilterCard
        t={t}
        from={d.from}
        to={d.to}
        days={d.days}
        today={d.today}
        maxDays={d.maxDays}
        keep={keep}
        meta={
          <>
            <span data-testid="home-lens">{t(`lens_${d.lens}` as never)}</span>
            {d.rows.length > 0 ? (
              <StateTag official={d.allOfficial} l={rptLabels('common')} />
            ) : null}
            {m.multi && d.snapshotDate ? (
              <span data-testid="home-snapshot">
                {t('snapshotNote', { date: isoToVi(d.snapshotDate) })}
              </span>
            ) : null}
            {d.lastComputedAt ? (
              <span className="dsh-filter__asof">
                {t('asOf', {
                  time: new Date(d.lastComputedAt).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  }),
                })}
              </span>
            ) : null}
          </>
        }
      />
      {d.missingDates.length > 0 && d.rows.some((r) => !r.missing) ? (
        <Note tone="warning" testId="missing-days">
          {t('missingDays', {
            n: d.missingDates.length,
            list:
              d.missingDates.slice(0, 5).map(shortDay).join(', ') +
              (d.missingDates.length > 5 ? '…' : ''),
          })}
        </Note>
      ) : null}
      {d.truncated.length > 0 ? (
        <Note tone="warning" testId="truncated">
          {t('truncated', { list: d.truncated.join(', ') })}
        </Note>
      ) : null}
      {d.rows.every((r) => r.missing) ? (
        <EmptyState
          title={t('emptyTitle')}
          text={t('emptyText')}
          actions={
            <Link className="btn btn--secondary" href="/rpt">
              {t('openReports')}
            </Link>
          }
        />
      ) : (
        <>
          {m.kpis.length > 0 ? (
            <section
              className="dsh-kpis"
              aria-label={t('kpis')}
              data-count={m.kpis.length}
              data-testid="home-kpis"
            >
              {m.kpis.map((k) => (
                <KpiCard key={k.id} k={k} label={label} fmt={{ t, tr }} d={d} />
              ))}
            </section>
          ) : null}
          <div className={`dsh-cols${m.trend || m.branchBars ? '' : ' dsh-cols--solo'}`}>
            {m.trend || m.branchBars ? (
              <div className="dsh-stack">
                {m.trend ? (
                  <ColumnChart
                    id="trend"
                    testId="chart-trend"
                    title={t(
                      m.trendBucket === 'week'
                        ? 'trendTitleWeek'
                        : m.multi
                          ? 'trendTitleRange'
                          : 'trendTitle',
                    )}
                    unit={t(m.trendBucket === 'week' ? 'trendUnitWeek' : 'trendUnit')}
                    points={m.trend.map((p) => ({
                      label: shortDay(p.date),
                      ...(p.days > 1 ? { fullLabel: `${shortDay(p.date)}–${shortDay(p.to)}` } : {}),
                      value: p.value,
                      provisional: p.provisional,
                      ...(p.missingDays > 0 && p.value !== null
                        ? { note: t('bucketMissing', { n: p.missingDays }) }
                        : {}),
                    }))}
                    format={money}
                    axisFormat={compactVnd}
                    emptyTop={4_000_000}
                    provisionalNote={t('provisional')}
                    noDataLabel={t('noData')}
                    tableLabel={t('chartTable')}
                    catName={t('catDay')}
                    valueName={t('trendValue')}
                    foot={t('trendFoot')}
                  />
                ) : null}
                {m.branchBars ? (
                  <BarList
                    id="branches"
                    testId="chart-branches"
                    title={t('branchTitle')}
                    unit={t('branchUnit')}
                    sub={t('scopeMany', { n: m.branchBars.length })}
                    items={m.branchBars.map((b) => ({ label: b.name, value: b.value }))}
                    format={money}
                    tableLabel={t('chartTable')}
                    catName={t('catBranch')}
                    valueName={t('branchValue')}
                    foot={
                      missingBranches > 0
                        ? `${t(m.multi ? 'branchFoot_r' : 'branchFoot')} ${t(m.multi ? 'branchMissing_r' : 'branchMissing', { n: missingBranches })}.`
                        : t(m.multi ? 'branchFoot_r' : 'branchFoot')
                    }
                  />
                ) : null}
              </div>
            ) : null}
            <div className="dsh-stack">
              <AlertCard d={d} t={t} tr={tr} />
            </div>
          </div>
          <div className="rpt-two">
            {m.orderBars ? (
              <BarList
                id="orders"
                testId="chart-orders"
                title={t(m.multi ? 'ordersTitleRange' : 'ordersTitle')}
                unit={t('ordersUnit')}
                items={m.orderBars.map((o) => ({
                  label: oLabel(o.key),
                  value: o.value,
                }))}
                format={(v) => String(v)}
                tableLabel={t('chartTable')}
                catName={t('catKind')}
                valueName={t('ordersValue')}
                series={2}
              />
            ) : null}
            {m.revenueSplit ? (
              <BarList
                id="split"
                testId="chart-split"
                title={t('splitTitle')}
                unit={t('splitUnit')}
                items={m.revenueSplit.map((o) => ({
                  label: t(`split_${o.key}` as never),
                  value: o.value,
                }))}
                format={money}
                tableLabel={t('chartTable')}
                catName={t('catKind')}
                valueName={t('splitValue')}
                series={3}
              />
            ) : null}
            {m.methodBars ? (
              <BarList
                id="methods"
                testId="chart-methods"
                title={t('methodTitle')}
                unit={t('methodUnit')}
                items={m.methodBars.map((o) => ({
                  label: methodLabel(t, o.key),
                  value: o.value,
                }))}
                format={money}
                tableLabel={t('chartTable')}
                catName={t('catKind')}
                valueName={t('methodValue')}
                series={4}
              />
            ) : null}
          </div>
        </>
      )}
      {!m.hasBlocks ? (
        <NoPermissionState title={t('noViewTitle')} text={t('noViewText')} />
      ) : (
        <Note tone="info">{t(m.multi ? 'footNoteRange' : 'footNote')}</Note>
      )}
    </div>
  );
}

const methodLabel = (t: T, key: string): string =>
  ['cash', 'transfer', 'card', 'qr'].includes(key) ? t(`method_${key}` as never) : key;

function KpiCard({
  k,
  label,
  fmt,
  d,
}: {
  k: KpiModel;
  label: (key: string) => string;
  fmt: { t: T; tr: T };
  d: DashboardDto;
}) {
  const { t } = fmt;
  const c = d.comparison;
  let meta: ReactNode;
  if (k.id === 'revenue') {
    const bp = k.deltaBp;
    meta =
      bp === null || bp === undefined ? (
        // never a percentage from a period that is only partly there: say how much of it is
        !c.previousComplete ? (
          <span data-testid="kpi-revenue-incomplete">
            {t('prevIncomplete', { x: c.previousDaysComplete, y: d.days })}
          </span>
        ) : !c.currentComplete ? (
          <span data-testid="kpi-revenue-incomplete">
            {t('currIncomplete', { x: c.currentDaysComplete, y: d.days })}
          </span>
        ) : (
          t('noCompare')
        )
      ) : (
        <>
          <span
            className={`kpi__delta kpi__delta--${bp > 0 ? 'up' : bp < 0 ? 'down' : 'flat'}`}
            data-testid="kpi-revenue-delta"
          >
            {bp !== 0 ? <Icon name={bp > 0 ? 'arrow-up' : 'arrow-down'} size="sm" /> : null}
            {bp > 0 ? '+' : bp < 0 ? '−' : ''}
            {pctText(bp)}
            <span className="sr-only"> {t(bp > 0 ? 'up' : bp < 0 ? 'down' : 'flat')}</span>
          </span>
          {d.days > 1 ? t('vsPrevPeriod', { n: d.days }) : t('vsYesterday')}
        </>
      );
  } else if (k.id === 'debt' && k.overdueVnd) {
    meta = (
      <>
        <span className="tag tag--danger">{t('overdue', { v: money(k.overdueVnd) })}</span>
      </>
    );
  } else if (k.id === 'stock' && k.value === 0) {
    meta = t('stockOk');
  }
  if (k.asOf && d.snapshotDate)
    meta = (
      <>
        {meta}
        <span className="kpi__scope">{t('asOfDate', { date: isoToVi(d.snapshotDate) })}</span>
      </>
    );
  return (
    <Kpi
      label={label(`k_${k.id}`)}
      value={k.kind === 'vnd' ? money(k.value) : String(k.value)}
      testId={`home-kpi-${k.id}`}
      {...(k.href ? { href: k.href } : {})}
      {...(k.tone ? { tone: k.tone } : {})}
      {...(meta ? { meta } : {})}
    />
  );
}

function AlertCard({ d, t, tr }: { d: DashboardDto; t: T; tr: T }) {
  return (
    <section className="card" aria-labelledby="home-alerts-h" data-testid="home-alerts">
      <div className="card__header">
        <div>
          <h2 className="card__title" id="home-alerts-h">
            {t('alertsTitle')}
            {d.alertTotal > 0 ? ` (${d.alertTotal})` : ''}
          </h2>
          <div className="card__subtitle">{t('alertsSub')}</div>
          {d.days > 1 && d.snapshotDate ? (
            <div className="card__subtitle">
              {t('alertsAsOf', { date: isoToVi(d.snapshotDate) })}
            </div>
          ) : null}
        </div>
      </div>
      {d.topAlerts.length === 0 && d.alertTotal === 0 ? (
        <div className="card__body">
          <p data-testid="home-no-alerts">
            <strong>{t('noAlertsTitle')}</strong>
            <span className="text-secondary" style={{ display: 'block' }}>
              {t('noAlertsText')}
            </span>
          </p>
        </div>
      ) : (
        <ul className="dsh-rows" data-testid="home-top-alerts">
          {d.topAlerts.map((a, i) => (
            <li key={`${a.kind}-${a.ref.id}-${i}`}>
              <Link className="dsh-row" href={hrefOf(a.ref)}>
                <span className="dsh-row__main">
                  <strong>{tr(`kind_${a.kind}` as never)}</strong>
                  <span className="dsh-row__sub">{a.ref.label}</span>
                </span>
                <span className="count-pill count-pill--warning">
                  {fill(t('alertAge'), { n: a.ageDays })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="card__footer">
        <Link className="btn btn--secondary btn--sm" href={`/rpt/alerts?date=${d.date}`}>
          {t('alertsAll')}
        </Link>
      </div>
    </section>
  );
}

export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="stack" aria-busy="true" role="status" data-testid="home-loading">
      <span className="sr-only">{label}</span>
      <div className="dsh-kpis" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card kpi">
            <span className="skeleton skeleton--text" />
            <span className="skeleton skeleton--kpi" />
          </div>
        ))}
      </div>
      <div className="dsh-cols" aria-hidden="true">
        <div className="card dsh-chart">
          <span className="skeleton skeleton--title" />
          <span className="skeleton" style={{ height: 200 }} />
        </div>
        <div className="card dsh-chart">
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--text" />
          <span className="skeleton skeleton--text" />
        </div>
      </div>
    </div>
  );
}

/** The filter card: range presets, the custom pair, the "viewing" line and (when the data is there) the lens, state and age of the numbers. */
function FilterCard({
  t,
  from,
  to,
  days,
  today,
  maxDays,
  keep,
  meta,
}: {
  t: T;
  from: string;
  to: string;
  /** null when the request was refused (no summary of what is shown) */
  days: number | null;
  today: string;
  maxDays: number;
  keep: Record<string, string> | undefined;
  meta?: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card__body dsh-filter">
        <RangeFilter
          key={`${from}|${to}`}
          base="/"
          from={from}
          to={to}
          today={today}
          maxDays={maxDays}
          {...(keep ? { keep } : {})}
          labels={{
            group: t('rangeLabel'),
            presets: {
              today: t('preset_today'),
              yesterday: t('preset_yesterday'),
              d7: t('preset_d7'),
              d30: t('preset_d30'),
            },
            custom: t('preset_custom'),
            from: t('from'),
            to: t('toDate'),
            apply: t('apply'),
            pickFrom: t('pickFrom'),
            pickTo: t('pickTo'),
            errors: {
              format: t('errFormat'),
              future: t('errFuture'),
              order: t('errOrder'),
              tooLong: t('errTooLong', { max: maxDays, n: '{n}' }),
            },
          }}
        />
        {days !== null ? (
          <p className="dsh-filter__summary" data-testid="range-summary" aria-live="polite">
            {days === 1
              ? t('viewingOne', { date: isoToVi(from) })
              : t('viewing', { from: isoToVi(from), to: isoToVi(to), n: days })}
          </p>
        ) : null}
        {meta ? <div className="dsh-filter__meta">{meta}</div> : null}
      </div>
    </section>
  );
}

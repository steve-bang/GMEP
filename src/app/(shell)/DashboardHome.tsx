import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getDashboard, type DashboardDto } from '@/modules/rpt';
import { load } from '@/composition/pageData';
import { getContainer } from '@/composition/container';
import type { Session } from '@/modules/sys';
import { BarList, ColumnChart } from '@/ui/components/Charts';
import { DateFilter } from '@/ui/components/DateFilter';
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
  date?: string | undefined;
  branchId?: string | undefined;
}) {
  const t = await getTranslations('dashboard');
  const tAll = await getTranslations();
  const tr = await getTranslations('rpt.dashboard');
  const res = await load(() =>
    getDashboard(getContainer().rpt, props.session.actor, {
      ...(props.date && ISO.test(props.date) ? { date: props.date } : {}),
      ...(props.branchId ? { branchId: props.branchId } : {}),
    }),
  );
  if (res.error) {
    // a role without the dashboard view (e.g. technician) gets the plain "no permission" state with a way on
    if (res.error.status === 403)
      return <NoPermissionState title={t('noViewTitle')} text={t('noViewText')} />;
    return <ErrorFor error={res.error} t={tAll as never} />;
  }
  const d = res.data;
  const m = buildHomeModel(d);
  const keep = props.branchId ? { branchId: props.branchId } : undefined;
  const missingBranches = d.rows.filter((r) => r.missing).length;
  const label = (key: string) => t(key as never);

  return (
    <div className="stack" data-testid="home-dashboard">
      <section className="card">
        <div className="card__body">
          <div className="dsh-filter">
            <DateFilter
              base="/"
              fields={[{ name: 'date', label: t('date'), iso: d.date }]}
              {...(keep ? { keep } : {})}
              applyLabel={t('apply')}
              resetLabel={t('reset')}
            />
            <span className="text-secondary" data-testid="home-lens">
              {t(`lens_${d.lens}` as never)}
            </span>
            {d.rows.length > 0 ? (
              <StateTag official={d.allOfficial} l={rptLabels('common')} />
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
          </div>
        </div>
      </section>
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
                <KpiCard key={k.id} k={k} label={label} fmt={{ t, tr }} />
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
                    title={t('trendTitle')}
                    unit={t('trendUnit')}
                    points={m.trend.map((p) => ({
                      label: shortDay(p.date),
                      value: p.value,
                      provisional: p.provisional,
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
                        ? `${t('branchFoot')} ${t('branchMissing', { n: missingBranches })}.`
                        : t('branchFoot')
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
                title={t('ordersTitle')}
                unit={t('ordersUnit')}
                items={m.orderBars.map((o) => ({
                  label: t(`o_${o.key}` as never),
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
        <Note tone="info">{t('footNote')}</Note>
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
}: {
  k: KpiModel;
  label: (key: string) => string;
  fmt: { t: T; tr: T };
}) {
  const { t } = fmt;
  let meta: ReactNode;
  if (k.id === 'revenue') {
    const bp = k.deltaBp;
    meta =
      bp === null || bp === undefined ? (
        t('noCompare')
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
          {t('vsYesterday')}
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

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { getDashboard, type BranchRow, type DashboardDto } from '@/modules/rpt';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { RunButtons } from './RptActions';
import { drillHref, fill, Kpi, Kpis, money, Note, RptPage, rptLabels, StateTag } from './rptUi';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * G4-RPT-01 / FR-RPT-001: role based dashboard of the day. The server removes every section the user may not see
 * (permission of the source module) before the page gets the data; the page only orders what is left by the user's lens.
 * Several branches = the owner's consolidated view, summed from each branch's own rollup document.
 */
export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const rawDate = first(sp.date);
  const branchId = first(sp.branchId);
  const l = rptLabels('dashboard');
  const c = rptLabels('common');
  const res = await load(() =>
    getDashboard(getContainer().rpt, actor, {
      ...(rawDate && ISO.test(rawDate) ? { date: rawDate } : {}),
      ...(branchId ? { branchId } : {}),
    }),
  );
  const head = { title: l.title!, desc: l.lead!, crumbs: [] as { label: string; href: string }[] };
  if (res.error)
    return (
      <RptPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RptPage>
    );
  const d = res.data;
  const mayRun = hasPermission(actor, 'report-job:manage');
  const single = d.rows.length === 1 ? d.rows[0]! : null;
  const keep = branchId ? { branchId } : undefined;
  return (
    <RptPage {...head}>
      <section className="card">
        <div className="card__body">
          <div
            className="row"
            style={{ gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'end' }}
          >
            <DateFilter
              base="/rpt"
              fields={[{ name: 'date', label: c.date!, iso: d.date }]}
              {...(keep ? { keep } : {})}
              applyLabel={c.apply!}
              resetLabel={c.reset!}
            />
            <span className="text-secondary" data-testid="lens">
              {l[`lens_${d.lens}`]}
            </span>
            {d.lastComputedAt ? (
              <span className="text-secondary">
                {fill(c.asOf!, {
                  time: new Date(d.lastComputedAt).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  }),
                })}
              </span>
            ) : null}
            {d.rows.length > 0 ? (
              <StateTag official={d.allOfficial} l={c as Record<string, string>} />
            ) : null}
          </div>
        </div>
      </section>
      {d.truncated.length > 0 ? (
        <Note tone="warning" testId="truncated">
          {fill(c.truncated!, { list: d.truncated.join(', ') })}
        </Note>
      ) : null}
      {d.rows.every((r) => r.missing) ? (
        <EmptyState
          title={c.noRollupTitle!}
          text={c.noRollupText}
          actions={
            mayRun && single ? (
              <RunButtons date={d.date} branchId={single.branchId} labels={rptLabels('run')} />
            ) : null
          }
        />
      ) : (
        <>
          <Sections d={d} single={single} l={l} />
          {d.consolidated ? <BranchTable d={d} l={l} c={c} /> : null}
          <AlertList d={d} l={l} />
        </>
      )}
      <Note tone="info">{l.footNote}</Note>
    </RptPage>
  );
}

const ORDER: Record<DashboardDto['lens'], string[]> = {
  owner: ['revenue', 'orders', 'money', 'receivables', 'invoices', 'stock'],
  manager: ['revenue', 'orders', 'money', 'receivables', 'invoices', 'stock'],
  advisor: ['orders', 'invoices', 'money', 'revenue', 'receivables', 'stock'],
  cashier: ['money', 'receivables', 'orders', 'invoices', 'revenue', 'stock'],
  storekeeper: ['stock', 'orders', 'money', 'revenue', 'receivables', 'invoices'],
};

function Sections({
  d,
  single,
  l,
}: {
  d: DashboardDto;
  single: BranchRow | null;
  l: Record<string, string>;
}) {
  const t = d.totals;
  const link = (metric: string) =>
    single ? drillHref(d.date, metric, single.branchId) : undefined;
  const make: Record<string, () => React.ReactNode> = {
    revenue: () => (
      <Kpi
        key="rev"
        label={l.kRevenue!}
        value={money(t.revenue.exTaxVnd)}
        formula={l.fRevenue!}
        testId="kpi-revenue"
        meta={
          d.previousExTaxVnd !== null
            ? fill(l.vsPrev!, { v: money(d.previousExTaxVnd) })
            : undefined
        }
      />
    ),
    orders: () => (
      <>
        <Kpi
          key="op"
          label={l.kOpened!}
          value={String(t.orders.opened)}
          testId="kpi-opened"
          {...(link('opened') ? { href: link('opened')! } : {})}
        />
        <Kpi
          key="cl"
          label={l.kClosed!}
          value={String(t.orders.closed)}
          testId="kpi-closed"
          {...(link('closed') ? { href: link('closed')! } : {})}
        />
        <Kpi
          key="ho"
          label={l.kHanded!}
          value={String(t.orders.handedOver)}
          testId="kpi-handed"
          {...(link('handedOver') ? { href: link('handedOver')! } : {})}
        />
        <Kpi
          key="oe"
          label={l.kOpenEnd!}
          value={String(t.orders.openAtEnd)}
          testId="kpi-open"
          {...(link('openAtEnd') ? { href: link('openAtEnd')! } : {})}
        />
      </>
    ),
    money: () => (
      <>
        <Kpi
          key="in"
          label={l.kInflow!}
          value={money(t.money.inflowVnd)}
          testId="kpi-inflow"
          {...(link('payments') ? { href: link('payments')! } : {})}
        />
        <Kpi
          key="gap"
          label={l.kGap!}
          value={money(t.money.gapVnd)}
          testId="kpi-gap"
          formula={l.fGap!}
          tone={t.money.gapVnd !== 0 ? 'warning' : undefined}
          {...(link('unpaid') ? { href: link('unpaid')! } : {})}
        />
      </>
    ),
    receivables: () => (
      <>
        <Kpi
          key="debt"
          label={l.kDebt!}
          value={money(t.receivables.openDebtVnd)}
          testId="kpi-debt"
          {...(link('openDebts') ? { href: link('openDebts')! } : {})}
        />
        <Kpi
          key="od"
          label={l.kOverdue!}
          value={money(t.receivables.overdueDebtVnd)}
          testId="kpi-overdue"
          tone={t.receivables.overdueDebtCount > 0 ? 'danger' : undefined}
        />
      </>
    ),
    invoices: () => (
      <>
        <Kpi
          key="ii"
          label={l.kInvoices!}
          value={String(t.invoices.issuedCount)}
          testId="kpi-invoices"
          {...(link('invoicesIssued') ? { href: link('invoicesIssued')! } : {})}
        />
        <Kpi
          key="ni"
          label={l.kUninvoiced!}
          value={String(t.invoices.closedWithoutInvoiceCount)}
          testId="kpi-uninvoiced"
          tone={t.invoices.closedWithoutInvoiceCount > 0 ? 'warning' : undefined}
          {...(link('notInvoiced') ? { href: link('notInvoiced')! } : {})}
        />
      </>
    ),
    stock: () => (
      <Kpi
        key="st"
        label={l.kStock!}
        value={String(t.stock.issuesWithoutSource)}
        testId="kpi-stock"
        formula={l.fStock!}
        tone={t.stock.issuesWithoutSource > 0 ? 'danger' : undefined}
        meta={t.stock.issuesWithoutSource === 0 ? l.stockOk : undefined}
        {...(link('stockWithoutSource') ? { href: link('stockWithoutSource')! } : {})}
      />
    ),
  };
  const shown = ORDER[d.lens].filter((k) => d.visible[k as keyof DashboardDto['visible']]);
  return (
    <Kpis>
      {shown.map((k) => (
        <div key={k} style={{ display: 'contents' }}>
          {make[k]!()}
        </div>
      ))}
    </Kpis>
  );
}

function BranchTable({
  d,
  l,
  c,
}: {
  d: DashboardDto;
  l: Record<string, string>;
  c: Record<string, string>;
}) {
  return (
    <DataTable<BranchRow>
      caption={l.byBranch!}
      rows={d.rows}
      rowKey={(r) => r.branchId}
      toolbar={fill(l.byBranchCount!, { n: d.rows.length })}
      footer={
        <span className="text-secondary" data-testid="branch-total">
          {fill(l.totalRow!, { n: d.totals.branches, v: money(d.totals.revenue.exTaxVnd) })}
        </span>
      }
      columns={[
        {
          key: 'b',
          header: l.colBranch!,
          render: (r) => (
            <Link href={`/rpt?date=${d.date}&branchId=${encodeURIComponent(r.branchId)}`}>
              {r.name}
            </Link>
          ),
        },
        {
          key: 's',
          header: l.colState!,
          render: (r) =>
            r.rollup ? (
              <StateTag official={r.rollup.official} l={c} />
            ) : (
              <span className="tag tag--neutral">{l.missing}</span>
            ),
        },
        {
          key: 'r',
          header: l.colRevenue!,
          numeric: true,
          render: (r) => (r.rollup ? money(r.rollup.revenue.exTaxVnd) : '—'),
        },
        {
          key: 'o',
          header: l.colClosed!,
          numeric: true,
          render: (r) => (r.rollup ? String(r.rollup.orders.closed) : '—'),
        },
        {
          key: 'a',
          header: l.colAlerts!,
          numeric: true,
          render: (r) =>
            r.rollup ? String(Object.values(r.rollup.alertCounts).reduce((x, y) => x + y, 0)) : '—',
        },
      ]}
    />
  );
}

function AlertList({ d, l }: { d: DashboardDto; l: Record<string, string> }) {
  if (d.alertTotal === 0 && d.topAlerts.length === 0)
    return (
      <Note tone="success" testId="no-alerts">
        {l.noAlerts}
      </Note>
    );
  return (
    <section className="card" aria-label={l.alertsTitle}>
      <div className="card__body stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{fill(l.alertsTitleN!, { n: d.alertTotal })}</strong>
          <Link href={`/rpt/alerts?date=${d.date}`} data-testid="alerts-link">
            {l.alertsAll}
          </Link>
        </div>
        <ul className="stack" data-testid="top-alerts">
          {d.topAlerts.map((a, i) => (
            <li key={`${a.kind}-${a.ref.id}-${i}`}>
              <span className="tag tag--warning">{l[`kind_${a.kind}`]}</span> {a.ref.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

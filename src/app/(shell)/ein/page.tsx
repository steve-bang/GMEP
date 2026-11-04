import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { businessDate, formatDateTime, isoToVi } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import {
  getConnection,
  listInvoices,
  listQueue,
  listWarnings,
  type DisplayStatus,
  type InvoiceDto,
} from '@/modules/ein';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Button } from '@/ui/components/Button';
import { EinPage, einLabels, fill, Kpis, money, Note, STATUS_TONE, SYNC_TONE } from './einUi';

export const dynamic = 'force-dynamic';

const STATUSES: DisplayStatus[] = [
  'not_issued',
  'issued',
  'adjustment',
  'replacement',
  'cancelled',
];

/** G4-EIN-01 / FR-EIN-005, 006: invoices of the working branch; status chips, date window and text search. */
export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const c = einLabels('common');
  const l = einLabels('list');
  const status = STATUSES.find((s) => s === first(sp.status));
  const from = first(sp.from);
  const to = first(sp.to);
  const q = first(sp.q);
  const cursor = first(sp.cursor);
  const today = businessDate(new Date());
  const res = await load(async () => {
    const ein = getContainer().ein;
    const list = await listInvoices(ein, actor, {
      ...(status ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const [warn, queue, conn, todayList] = await Promise.all([
      listWarnings(ein, actor).catch(() => null),
      hasPermission(actor, 'invoice-queue:view') ? listQueue(ein, actor).catch(() => null) : null,
      getConnection(ein, actor).catch(() => null),
      listInvoices(ein, actor, { from: today, to: today, limit: 100 }).catch(() => null),
    ]);
    return { list, warn, queue, conn, todayList };
  });
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <EinPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </EinPage>
    );
  const { list, warn, queue, conn, todayList } = res.data;
  const issuedToday = (todayList?.items ?? []).filter((i) => i.status === 'issued').length;
  const keep = { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(q ? { q } : {}) };
  const qs = (extra: Record<string, string>) =>
    new URLSearchParams({ ...keep, ...extra }).toString();
  return (
    <EinPage
      {...head}
      actions={
        <>
          {queue ? (
            <Link className="btn btn--secondary" href="/ein/queue">
              {l.queue}
            </Link>
          ) : null}
          <Link className="btn btn--secondary" href="/ein/warnings">
            {l.warnings}
          </Link>
        </>
      }
    >
      <Kpis
        items={[
          { label: l.issuedToday!, value: String(issuedToday), testId: 'kpi-issued-today' },
          {
            label: l.withoutInvoice!,
            value: warn ? String(warn.items.length) : '—',
            meta: l.withoutInvoiceMeta,
            testId: 'kpi-without',
          },
          {
            label: l.failed!,
            value: queue ? String(queue.total) : '—',
            meta: l.failedMeta,
            testId: 'kpi-failed',
          },
        ]}
      />
      {conn && !conn.activated ? (
        <Note tone="warning" testId="not-activated">
          <strong>{l.notActivatedTitle}</strong> {l.notActivatedText}
        </Note>
      ) : null}
      <section className="card">
        <div className="card__body stack">
          <FilterBar
            action="/ein"
            actions={
              <>
                <Button type="submit" variant="primary">
                  {c.search}
                </Button>
              </>
            }
          >
            <SearchField id="ein-q" label={l.searchLabel!} name="q" defaultValue={q ?? ''} />
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {from ? <input type="hidden" name="from" value={from} /> : null}
            {to ? <input type="hidden" name="to" value={to} /> : null}
          </FilterBar>
          <DateFilter
            base="/ein"
            fields={[
              { name: 'from', label: c.from!, ...(from ? { iso: from } : {}) },
              { name: 'to', label: c.to!, ...(to ? { iso: to } : {}) },
            ]}
            keep={{ ...(status ? { status } : {}), ...(q ? { q } : {}) }}
            applyLabel={c.apply!}
            resetLabel={c.reset!}
          />
          <div className="rec-chips">
            {[undefined, ...STATUSES].map((s) => (
              <Link
                key={s ?? 'all'}
                className={`chip${status === s ? ' is-selected' : ''}`}
                href={`/ein?${qs(s ? { status: s } : {})}`}
              >
                {s ? c[`status_${s}`] : c.all}
              </Link>
            ))}
          </div>
        </div>
      </section>
      {list.items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable<InvoiceDto>
          caption={l.title!}
          rows={list.items}
          rowKey={(i) => i.id}
          toolbar={fill(l.count!, { n: list.items.length })}
          footer={
            <>
              <span data-testid="effective-total">
                {l.effectiveTotal}: <strong>{money(list.effectiveTotalVnd)}</strong>
              </span>
              {list.truncated ? <span className="text-secondary"> · {l.truncated}</span> : null}
              {list.nextCursor ? (
                <>
                  {' '}
                  <Link
                    className="btn btn--secondary"
                    href={`/ein?${qs({ ...(status ? { status } : {}), cursor: list.nextCursor })}`}
                  >
                    {l.more}
                  </Link>
                </>
              ) : null}
            </>
          }
          columns={[
            {
              key: 'n',
              header: l.colNumber!,
              render: (i) => (
                <Link
                  className="code"
                  href={`/ein/invoices/${encodeURIComponent(i.id)}`}
                  data-testid="inv-no"
                >
                  {i.number ? `${i.number} · ${i.symbol}` : `${c.noNumber} · ${i.symbol}`}
                </Link>
              ),
            },
            {
              key: 'd',
              header: l.colDate!,
              render: (i) =>
                i.issuedAt
                  ? isoToVi(i.issuedAt.slice(0, 10))
                  : formatDateTime(new Date(i.createdAt)),
            },
            {
              key: 'b',
              header: l.colBuyer!,
              render: (i) => (
                <>
                  {i.buyerName}
                  <br />
                  <span className="text-secondary">
                    {i.buyerTaxCode ? `MST ${i.buyerTaxCode}` : c.kind_retail}
                  </span>
                </>
              ),
            },
            {
              key: 'o',
              header: l.colOrder!,
              render: (i) => (
                <Link href={`/rec/orders/${encodeURIComponent(i.orderId)}`}>{i.orderNumber}</Link>
              ),
            },
            { key: 't', header: l.colTotal!, numeric: true, render: (i) => money(i.totalVnd) },
            {
              key: 's',
              header: l.colStatus!,
              render: (i) => (
                <>
                  <StatusBadge tone={STATUS_TONE[i.displayStatus] ?? 'neutral'}>
                    {c[`status_${i.displayStatus}`]}
                  </StatusBadge>{' '}
                  {i.status === 'not_issued' || i.sync === 'failed' ? (
                    <StatusBadge tone={SYNC_TONE[i.sync] ?? 'neutral'}>
                      {c[`sync_${i.sync}`]}
                    </StatusBadge>
                  ) : null}
                  {i.replacedBy ? <span className="tag tag--warning">{l.replacedBy}</span> : null}
                  {i.adjustedBy.length ? (
                    <span className="tag tag--info">{l.adjustedBy}</span>
                  ) : null}
                </>
              ),
            },
            {
              key: 'x',
              header: l.colTax!,
              render: (i) => (
                <span className="code">
                  {i.taxAuthorityCode ? `${i.taxAuthorityCode.slice(0, 8)}…` : '—'}
                </span>
              ),
            },
          ]}
        />
      )}
    </EinPage>
  );
}

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatVnd } from '@/platform/format/vnd';
import { hasPermission } from '@/platform/rbac/rbac';
import { listStock } from '@/modules/inv';
import { listWarehouses } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { Button } from '@/ui/components/Button';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { ErrorFor, first, Pager, ScopeLine, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { InvPage } from './InvPage';
import { num, StockStatusBadge } from './StockNumbers';

/**
 * G3-INV-04 (all stock) and G3-INV-05 (below reorder level): the same table, the second one
 * filtered to lowStock and with the suggested order quantity. Everything is computed on AVAILABLE (RULE-008).
 */
export async function StockTable(props: {
  base: '/inv/stock' | '/inv/reorder';
  low: boolean;
  searchParams: SearchParams;
}) {
  const t = await getTranslations();
  const sp = await props.searchParams;
  const q = first(sp.q);
  const warehouseId = first(sp.warehouseId);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const { inv, sys } = getContainer();
  const head = {
    title: props.low ? t('inv.stock.reorderTitle') : t('inv.stock.title'),
    desc: props.low ? t('inv.stock.reorderLead') : t('inv.stock.lead'),
  };
  const res = await load(async () => {
    const page = await listStock(inv, actor, {
      limit: 25,
      ...(q ? { q } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      ...(props.low ? { lowStock: 'true' } : {}),
      ...(cursor ? { cursor } : {}),
    });
    // counts for the summary cards: the reorder list is small by definition (bounded read)
    const lowAll = props.low
      ? page
      : await listStock(inv, actor, {
          limit: inv.inv.lowStockMax > 100 ? 100 : inv.inv.lowStockMax,
          lowStock: 'true',
        });
    const warehouses = (await listWarehouses(sys, actor, { limit: 50 } as never)).items;
    return { page, lowAll, warehouses };
  });
  if (res.error)
    return (
      <InvPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  const { page, lowAll, warehouses } = res.data;
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;
  const showCost = hasPermission(actor, 'stock-cost:view');
  const out = lowAll.items.filter((b) => b.status === 'out').length;
  const low = lowAll.items.filter((b) => b.status === 'low').length;
  const query = { ...(q ? { q } : {}), ...(warehouseId ? { warehouseId } : {}) };
  return (
    <InvPage {...head}>
      <ScopeLine
        text={t('inv.scopeLine', { scope: warehouses.map((w) => w.name).join(', ') || '—' })}
      />
      <section className="grid grid--4" aria-label={t('inv.stock.title')}>
        <Link className="card kpi kpi--danger" href="/inv/reorder">
          <span className="kpi__label">{t('inv.stock.kpiOut')}</span>
          <span className="kpi__value" data-testid="kpi-out">
            {out}
          </span>
          <span className="kpi__meta">{t('inv.stock.kpiOutMeta')}</span>
        </Link>
        <Link className="card kpi kpi--warning" href="/inv/reorder">
          <span className="kpi__label">{t('inv.stock.kpiLow')}</span>
          <span className="kpi__value" data-testid="kpi-low">
            {low}
          </span>
          <span className="kpi__meta">{t('inv.stock.kpiLowMeta')}</span>
        </Link>
      </section>
      <FilterBar
        action={props.base}
        actions={
          <>
            <Link className="btn btn--ghost" href={props.base}>
              {t('inv.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('inv.apply')}
            </Button>
          </>
        }
      >
        <SearchField id="q" name="q" label={t('inv.stock.search')} defaultValue={q} />
        <div className="field">
          <label className="field__label" htmlFor="warehouseId">
            {t('inv.stock.warehouse')}
          </label>
          <select
            id="warehouseId"
            name="warehouseId"
            className="select"
            defaultValue={warehouseId ?? ''}
          >
            <option value="">{t('inv.stock.allWarehouses')}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState
          title={props.low ? t('inv.stock.reorderEmptyTitle') : t('inv.stock.emptyTitle')}
          text={props.low ? t('inv.stock.reorderEmptyText') : t('inv.stock.emptyText')}
        />
      ) : (
        <DataTable
          caption={props.low ? t('inv.stock.reorderTitle') : t('inv.stock.title')}
          rows={page.items}
          rowKey={(b) => b.id}
          toolbar={
            <span className="table-meta">
              {t('inv.stock.countNote', { count: page.items.length })}
            </span>
          }
          columns={[
            {
              key: 'code',
              header: t('inv.stock.code'),
              render: (b) => (
                <Link
                  className="code"
                  href={`/inv/parts/${encodeURIComponent(b.partId)}?wh=${encodeURIComponent(b.warehouseId)}`}
                  data-testid="stock-code"
                >
                  {b.partCode}
                </Link>
              ),
            },
            { key: 'part', header: t('inv.stock.part'), render: (b) => b.partName },
            { key: 'wh', header: t('inv.stock.warehouse'), render: (b) => whName(b.warehouseId) },
            {
              key: 'on',
              header: t('inv.detail.onHand'),
              numeric: true,
              render: (b) => num(b.onHand),
            },
            {
              key: 'rs',
              header: t('inv.detail.reserved'),
              numeric: true,
              render: (b) => num(b.reserved),
            },
            {
              key: 'it',
              header: t('inv.detail.inTransit'),
              numeric: true,
              render: (b) => num(b.inTransit),
            },
            {
              key: 'av',
              header: t('inv.detail.available'),
              numeric: true,
              render: (b) => <strong>{num(b.available)}</strong>,
            },
            {
              key: 'min',
              header: t('inv.detail.min'),
              numeric: true,
              render: (b) => num(b.minQty),
            },
            ...(props.low
              ? [
                  {
                    key: 'sg',
                    header: t('inv.detail.suggest'),
                    numeric: true,
                    render: (b: { suggestQty: number | null }) => num(b.suggestQty),
                  },
                ]
              : []),
            {
              key: 'st',
              header: t('inv.stock.status'),
              render: (b) => <StockStatusBadge status={b.status} />,
            },
            ...(showCost
              ? [
                  {
                    key: 'val',
                    header: t('inv.stock.value'),
                    numeric: true,
                    render: (b: { valueVnd: number | null }) =>
                      b.valueVnd === null ? '—' : formatVnd(b.valueVnd),
                  },
                ]
              : []),
          ]}
        />
      )}
      <p className="t-body-sm text-secondary">{t('inv.stock.noteBlock')}</p>
      <Pager
        base={props.base}
        query={query}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('inv.prev'), next: t('inv.next'), aria: t('common.pagination') }}
      />
    </InvPage>
  );
}

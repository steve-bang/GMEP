import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import { formatVnd } from '@/platform/format/vnd';
import { hasPermission } from '@/platform/rbac/rbac';
import {
  getAvailability,
  getPart,
  getPartPrices,
  getPartStock,
  listReservationsByPart,
  listStockCard,
} from '@/modules/inv';
import { listWarehouses } from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ActionButton, ResourceForm } from '@/ui/components/ResourceForm';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, Pager, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { InvPage } from '../../InvPage';
import { num, StockStatusBadge } from '../../StockNumbers';

export const dynamic = 'force-dynamic';

/** G3-INV-03 / FR-INV-003, 020, 021, 027: four numbers per warehouse, prices, stock card, holds. */
export default async function PartDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations();
  const { actor } = await requireSession();
  const { inv, sys } = getContainer();
  const crumbs = [{ label: t('inv.parts.title'), href: '/inv/parts' }];
  const can = (p: `${string}:${string}`) => hasPermission(actor, p as 'x:view');
  const res = await load(async () => {
    const part = await getPart(inv, actor, id);
    const stock = can('stock:view') ? await getPartStock(inv, actor, id) : null;
    const avail =
      !stock && can('stock-availability:view')
        ? (await getAvailability(inv, actor, { partIds: [id] }))[0]
        : null;
    const prices = await getPartPrices(inv, actor, id);
    const warehouses = can('warehouse:view')
      ? (await listWarehouses(sys, actor, { limit: 50 } as never)).items
      : [];
    const holds = can('stock-reservation:view')
      ? (await listReservationsByPart(inv, actor, { partId: id, status: 'holding' })).items
      : [];
    const wh = first(sp.wh) ?? stock?.[0]?.warehouseId;
    const cursor = first(sp.cursor);
    const card =
      stock && wh
        ? await listStockCard(inv, actor, id, {
            warehouseId: wh,
            limit: 15,
            ...(cursor ? { cursor } : {}),
          })
        : null;
    return { part, stock, avail, prices, warehouses, holds, card, wh };
  });
  if (res.error)
    return (
      <InvPage title={t('inv.parts.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  const { part, stock, avail, prices, warehouses, holds, card, wh } = res.data;
  const whName = (wid: string) => warehouses.find((w) => w.id === wid)?.name ?? wid;
  const showCost = can('stock-cost:view');
  return (
    <InvPage
      title={`${part.code} · ${part.name}`}
      desc={t('inv.parts.detailLead')}
      crumbs={crumbs}
      actions={
        <>
          {part.status === 'inactive' ? (
            <StatusBadge tone="neutral">{t('inv.parts.inactiveBadge')}</StatusBadge>
          ) : null}
          {can('part:update') ? (
            <Link
              className="btn btn--secondary"
              href={`/inv/parts/${encodeURIComponent(part.id)}/edit`}
            >
              {t('inv.parts.edit')}
            </Link>
          ) : null}
          {can('part:archive') ? (
            <ActionButton
              endpoint={`/api/v1/inv/parts/${encodeURIComponent(part.id)}/status`}
              body={{
                status: part.status === 'active' ? 'inactive' : 'active',
                version: part.version,
              }}
              label={
                part.status === 'active' ? t('inv.parts.deactivate') : t('inv.parts.reactivate')
              }
              confirm={part.status === 'active' ? t('inv.parts.deactivateConfirm') : undefined}
              errorFallback={t('common.unexpected')}
            />
          ) : null}
        </>
      }
    >
      <section className="card" aria-labelledby="h-info">
        <div className="card__header">
          <h2 className="card__title" id="h-info">
            {t('inv.parts.title')}
          </h2>
        </div>
        <dl className="inv-facts">
          <div>
            <dt>{t('inv.parts.brand')}</dt>
            <dd>{part.brand || '—'}</dd>
          </div>
          <div>
            <dt>{t('inv.parts.group')}</dt>
            <dd>{t(`inv.group.${part.group}`)}</dd>
          </div>
          <div>
            <dt>{t('inv.parts.unitCol')}</dt>
            <dd>{t(`inv.unit.${part.unit}`)}</dd>
          </div>
          <div>
            <dt>{t('inv.parts.barcode')}</dt>
            <dd>{part.barcode ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('inv.parts.compat')}</dt>
            <dd>{part.compat.join(', ') || '—'}</dd>
          </div>
        </dl>
      </section>

      {stock ? (
        <section className="stack" aria-labelledby="h-stock">
          <h2 className="card__title" id="h-stock">
            {t('inv.detail.stockTitle')}
          </h2>
          {stock.length === 0 ? (
            <EmptyState title={t('inv.detail.stockEmpty')} />
          ) : (
            <DataTable
              caption={t('inv.detail.stockTitle')}
              rows={stock}
              rowKey={(b) => b.id}
              columns={[
                {
                  key: 'wh',
                  header: t('inv.detail.warehouse'),
                  render: (b) => whName(b.warehouseId),
                },
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
                {
                  key: 'max',
                  header: t('inv.detail.max'),
                  numeric: true,
                  render: (b) => num(b.maxQty),
                },
                {
                  key: 'st',
                  header: t('inv.stock.status'),
                  render: (b) => <StockStatusBadge status={b.status} />,
                },
                ...(showCost
                  ? [
                      {
                        key: 'uc',
                        header: t('inv.detail.unitCost'),
                        numeric: true,
                        render: (b: { unitCostVnd: number | null }) =>
                          b.unitCostVnd === null ? '—' : formatVnd(b.unitCostVnd),
                      },
                      {
                        key: 'val',
                        header: t('inv.detail.value'),
                        numeric: true,
                        render: (b: { valueVnd: number | null }) =>
                          b.valueVnd === null ? '—' : formatVnd(b.valueVnd),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </section>
      ) : avail ? (
        <section className="card">
          <div className="card__body">
            <strong>{t('inv.detail.available')}:</strong> {num(avail.available)}
          </div>
        </section>
      ) : null}

      {stock && can('stock-level:update') && stock.length > 0 ? (
        <section className="card" aria-labelledby="h-levels">
          <div className="card__header">
            <h2 className="card__title" id="h-levels">
              {t('inv.detail.levelsTitle')}
            </h2>
          </div>
          <div className="card__body">
            <p className="text-secondary">{t('inv.detail.levelsLead')}</p>
            <ResourceForm
              testId="levels-form"
              endpoint="/api/v1/inv/stock/levels"
              method="PUT"
              extra={{ partId: part.id }}
              labels={formLabels(t, 'inv.detail.levelsSave', false)}
              fields={[
                {
                  name: 'warehouseId',
                  label: t('inv.detail.warehouse'),
                  type: 'select',
                  required: true,
                  defaultValue: stock[0]!.warehouseId,
                  options: stock.map((b) => ({
                    value: b.warehouseId,
                    label: whName(b.warehouseId),
                  })),
                },
                {
                  name: 'minQty',
                  label: t('inv.detail.min'),
                  type: 'number',
                  emptyAs: 'null',
                  defaultValue: stock[0]!.minQty?.toString() ?? '',
                },
                {
                  name: 'maxQty',
                  label: t('inv.detail.max'),
                  type: 'number',
                  emptyAs: 'null',
                  defaultValue: stock[0]!.maxQty?.toString() ?? '',
                },
              ]}
            />
          </div>
        </section>
      ) : null}

      <section className="stack" aria-labelledby="h-prices">
        <h2 className="card__title" id="h-prices">
          {t('inv.detail.pricesTitle')}
        </h2>
        <DataTable
          caption={t('inv.detail.pricesTitle')}
          rows={prices}
          rowKey={(p) => p.priceListId}
          columns={[
            {
              key: 'pl',
              header: t('inv.detail.priceList'),
              render: (p) => `${p.priceListCode} · ${p.priceListName}`,
            },
            {
              key: 'lp',
              header: t('inv.detail.listPrice'),
              numeric: true,
              render: (p) =>
                p.listPriceVnd === null ? t('inv.detail.noPrice') : formatVnd(p.listPriceVnd),
            },
            ...(showCost
              ? [
                  {
                    key: 'cs',
                    header: t('inv.detail.costStd'),
                    numeric: true,
                    render: (p: { costVnd: number | null }) =>
                      p.costVnd === null ? '—' : formatVnd(p.costVnd),
                  },
                ]
              : []),
            {
              key: 'ef',
              header: t('inv.detail.effectiveFrom'),
              render: (p) => p.effectiveFrom ?? '—',
            },
          ]}
        />
      </section>

      {holds.length > 0 || can('stock-reservation:view') ? (
        <section className="stack" aria-labelledby="h-holds">
          <h2 className="card__title" id="h-holds">
            {t('inv.detail.holdsTitle')}
          </h2>
          {holds.length === 0 ? (
            <EmptyState title={t('inv.detail.holdsEmpty')} />
          ) : (
            <DataTable
              caption={t('inv.detail.holdsTitle')}
              rows={holds}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: 'src',
                  header: t('inv.detail.source'),
                  render: (r) =>
                    `${r.sourceType === 'quote' ? t('inv.detail.quoteSource') : t('inv.detail.orderSource')} ${r.sourceId}`,
                },
                {
                  key: 'wh',
                  header: t('inv.detail.warehouse'),
                  render: (r) => whName(r.warehouseId),
                },
                {
                  key: 'need',
                  header: t('inv.detail.needed'),
                  numeric: true,
                  render: (r) => num(r.qty),
                },
                {
                  key: 'held',
                  header: t('inv.detail.held'),
                  numeric: true,
                  render: (r) => num(r.heldQty),
                },
                {
                  key: 'iss',
                  header: t('inv.detail.issued'),
                  numeric: true,
                  render: (r) => num(r.issuedQty),
                },
              ]}
            />
          )}
        </section>
      ) : null}

      {card ? (
        <section className="stack" aria-labelledby="h-card">
          <div className="row row--between">
            <div>
              <h2 className="card__title" id="h-card">
                {t('inv.detail.cardTitle')}
              </h2>
              <p className="text-secondary">{t('inv.detail.cardLead')}</p>
            </div>
            {stock && stock.length > 1 ? (
              <form method="get" className="filter-bar__actions">
                <label className="field__label" htmlFor="wh">
                  {t('inv.detail.cardWarehouse')}
                </label>
                <select id="wh" name="wh" className="select" defaultValue={wh}>
                  {stock.map((b) => (
                    <option key={b.warehouseId} value={b.warehouseId}>
                      {whName(b.warehouseId)}
                    </option>
                  ))}
                </select>
                <button className="btn btn--secondary" type="submit">
                  {t('inv.apply')}
                </button>
              </form>
            ) : null}
          </div>
          {card.items.length === 0 ? (
            <EmptyState title={t('inv.detail.cardEmpty')} />
          ) : (
            <DataTable
              caption={t('inv.detail.cardTitle')}
              rows={card.items}
              rowKey={(m) => m.id}
              columns={[
                {
                  key: 'at',
                  header: t('inv.detail.when'),
                  render: (m) => formatDateTime(new Date(m.at)),
                },
                {
                  key: 'doc',
                  header: t('inv.detail.doc'),
                  render: (m) =>
                    m.documentId ? (
                      <Link
                        className="code"
                        href={`/inv/documents/${encodeURIComponent(m.documentId)}`}
                      >
                        {m.documentNo ?? m.documentId}
                      </Link>
                    ) : (
                      <span className="text-secondary">
                        {m.sourceType ? `${m.sourceType} ${m.sourceId ?? ''}` : '—'}
                      </span>
                    ),
                },
                {
                  key: 'kind',
                  header: t('inv.detail.kind'),
                  render: (m) => t(`inv.movement.${m.kind}`),
                },
                {
                  key: 'chg',
                  header: t('inv.detail.change'),
                  numeric: true,
                  render: (m) =>
                    m.onHandDelta > 0 ? `+${num(m.onHandDelta)}` : num(m.onHandDelta),
                },
                {
                  key: 'rch',
                  header: t('inv.detail.reserved'),
                  numeric: true,
                  render: (m) =>
                    m.reservedDelta > 0 ? `+${num(m.reservedDelta)}` : num(m.reservedDelta),
                },
                {
                  key: 'aft',
                  header: t('inv.detail.afterOnHand'),
                  numeric: true,
                  render: (m) => num(m.onHandAfter),
                },
                {
                  key: 'avl',
                  header: t('inv.detail.afterAvail'),
                  numeric: true,
                  render: (m) => num(m.availableAfter),
                },
              ]}
            />
          )}
          <Pager
            base={`/inv/parts/${encodeURIComponent(part.id)}`}
            query={wh ? { wh } : {}}
            {...(first(sp.cursor) ? { cursor: first(sp.cursor)! } : {})}
            next={card.nextCursor}
            labels={{ prev: t('inv.prev'), next: t('inv.next'), aria: t('common.pagination') }}
          />
        </section>
      ) : null}
    </InvPage>
  );
}

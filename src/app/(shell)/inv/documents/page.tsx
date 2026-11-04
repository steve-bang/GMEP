import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDate } from '@/platform/format/date';
import { formatVnd } from '@/platform/format/vnd';
import { hasPermission } from '@/platform/rbac/rbac';
import { DOC_TYPES, listDocuments } from '@/modules/inv';
import { listWarehouses } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { Button } from '@/ui/components/Button';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar } from '@/ui/components/FilterBar';
import { ErrorFor, first, Pager, ScopeLine, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { InvPage } from '../InvPage';

export const dynamic = 'force-dynamic';

/** G3-INV-08 / FR-INV-021: stock documents of the working scope, newest first. */
export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const type = first(sp.type);
  const status = first(sp.status);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const { inv, sys } = getContainer();
  const canCreate = hasPermission(actor, 'stock-doc:create');
  const head = {
    title: t('inv.docs.title'),
    desc: t('inv.docs.lead'),
    actions: canCreate ? (
      <>
        <Link className="btn btn--primary" href="/inv/documents/new?type=GRN">
          {t('inv.docs.newGrn')}
        </Link>
        <Link className="btn btn--secondary" href="/inv/documents/new?type=GIN">
          {t('inv.docs.newGin')}
        </Link>
        <Link className="btn btn--secondary" href="/inv/documents/new?type=ADJ">
          {t('inv.docs.newAdj')}
        </Link>
      </>
    ) : undefined,
  };
  const res = await load(async () => {
    const page = await listDocuments(inv, actor, {
      limit: 25,
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const warehouses = hasPermission(actor, 'warehouse:view')
      ? (await listWarehouses(sys, actor, { limit: 50 } as never)).items
      : [];
    const ids = [...new Set(page.items.map((d) => d.createdBy))];
    const users = await Promise.all(ids.map((id) => sys.users.getById(id)));
    return {
      page,
      warehouses,
      names: new Map(ids.map((id, i) => [id, users[i]?.displayName ?? id] as const)),
    };
  });
  if (res.error)
    return (
      <InvPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  const { page, warehouses, names } = res.data;
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;
  const tone = { draft: 'neutral', posted: 'success', cancelled: 'danger' } as const;
  return (
    <InvPage {...head}>
      <ScopeLine
        text={t('inv.scopeLine', { scope: warehouses.map((w) => w.name).join(', ') || '—' })}
      />
      <FilterBar
        action="/inv/documents"
        actions={
          <>
            <Link className="btn btn--ghost" href="/inv/documents">
              {t('inv.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('inv.apply')}
            </Button>
          </>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor="type">
            {t('inv.docs.type')}
          </label>
          <select id="type" name="type" className="select" defaultValue={type ?? ''}>
            <option value="">{t('inv.docs.allTypes')}</option>
            {DOC_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`inv.docs.type_${x}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="status">
            {t('inv.docs.statusF')}
          </label>
          <select id="status" name="status" className="select" defaultValue={status ?? ''}>
            <option value="">{t('inv.docs.allStatus')}</option>
            {(['draft', 'posted', 'cancelled'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`inv.docs.status_${x}`)}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState title={t('inv.docs.emptyTitle')} text={t('inv.docs.emptyText')} />
      ) : (
        <DataTable
          caption={t('inv.docs.title')}
          rows={page.items}
          rowKey={(d) => d.id}
          columns={[
            {
              key: 'no',
              header: t('inv.docs.no'),
              render: (d) => (
                <Link
                  className="code"
                  href={`/inv/documents/${encodeURIComponent(d.id)}`}
                  data-testid="doc-no"
                >
                  {d.displayNo}
                </Link>
              ),
            },
            {
              key: 'type',
              header: t('inv.docs.type'),
              render: (d) => t(`inv.docs.type_${d.type}`),
            },
            {
              key: 'src',
              header: t('inv.docs.source'),
              render: (d) =>
                `${t(`inv.docs.source_${d.source.type}`)}${d.source.id ? ` ${d.source.id}` : ''}`,
            },
            { key: 'wh', header: t('inv.docs.warehouse'), render: (d) => whName(d.warehouseId) },
            {
              key: 'ln',
              header: t('inv.docs.lines'),
              numeric: true,
              render: (d) => d.lines.length,
            },
            {
              key: 'st',
              header: t('inv.docs.statusF'),
              render: (d) => (
                <>
                  <StatusBadge tone={tone[d.status]}>
                    {t(`inv.docs.status_${d.status}`)}
                  </StatusBadge>
                  {d.reversedBy ? (
                    <>
                      {' '}
                      <StatusBadge tone="warning">{t('inv.docs.reversed')}</StatusBadge>
                    </>
                  ) : null}
                </>
              ),
            },
            {
              key: 'by',
              header: t('inv.docs.createdBy'),
              render: (d) => names.get(d.createdBy) ?? d.createdBy,
            },
            {
              key: 'date',
              header: t('inv.docs.date'),
              render: (d) => formatDate(new Date(d.postedAt ?? d.createdAt)),
            },
            {
              key: 'tot',
              header: t('inv.docs.total'),
              numeric: true,
              render: (d) => (d.totalValueVnd === null ? '—' : formatVnd(d.totalValueVnd)),
            },
          ]}
        />
      )}
      <Pager
        base="/inv/documents"
        query={{ ...(type ? { type } : {}), ...(status ? { status } : {}) }}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('inv.prev'), next: t('inv.next'), aria: t('common.pagination') }}
      />
    </InvPage>
  );
}

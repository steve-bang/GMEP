import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { getAvailability, listParts, PART_GROUPS } from '@/modules/inv';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { Button } from '@/ui/components/Button';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { ErrorFor, first, Pager, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { InvPage } from '../InvPage';
import { num } from '../StockNumbers';

export const dynamic = 'force-dynamic';

/** G3-INV-01 / FR-INV-001: catalogue, search by code, name, barcode or vehicle line. */
export default async function PartsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const by = first(sp.by) ?? 'auto';
  const group = first(sp.group);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const inv = getContainer().inv;
  const canCreate = hasPermission(actor, 'part:create');
  const head = {
    title: t('inv.parts.title'),
    desc: t('inv.parts.lead'),
    actions: canCreate ? (
      <Link className="btn btn--primary" href="/inv/parts/new">
        {t('inv.parts.create')}
      </Link>
    ) : undefined,
  };
  const res = await load(async () => {
    const page = await listParts(inv, actor, {
      limit: 25,
      by,
      ...(q ? { q } : {}),
      ...(group ? { group } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const avail = new Map<string, number>();
    if (hasPermission(actor, 'stock-availability:view') && page.items.length > 0)
      for (const a of await getAvailability(inv, actor, { partIds: page.items.map((p) => p.id) }))
        avail.set(a.partId, a.available);
    return { page, avail };
  });
  if (res.error)
    return (
      <InvPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  const { page, avail } = res.data;
  const query = {
    ...(q ? { q } : {}),
    ...(by !== 'auto' ? { by } : {}),
    ...(group ? { group } : {}),
  };
  return (
    <InvPage {...head}>
      <FilterBar
        action="/inv/parts"
        actions={
          <>
            <Link className="btn btn--ghost" href="/inv/parts">
              {t('inv.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('inv.apply')}
            </Button>
          </>
        }
      >
        <SearchField
          id="q"
          name="q"
          label={t('inv.parts.search')}
          placeholder={t('inv.parts.searchPlaceholder')}
          defaultValue={q}
        />
        <div className="field">
          <label className="field__label" htmlFor="by">
            {t('inv.parts.by')}
          </label>
          <select id="by" name="by" className="select" defaultValue={by}>
            {(['auto', 'code', 'name', 'barcode', 'model'] as const).map((b) => (
              <option key={b} value={b}>
                {t(`inv.parts.by${b[0]!.toUpperCase()}${b.slice(1)}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="group">
            {t('inv.parts.group')}
          </label>
          <select id="group" name="group" className="select" defaultValue={group ?? ''}>
            <option value="">{t('inv.parts.allGroups')}</option>
            {PART_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(`inv.group.${g}`)}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState
          title={q || group ? t('inv.parts.filteredTitle') : t('inv.parts.emptyTitle')}
          text={q || group ? t('inv.parts.filteredText') : t('inv.parts.emptyText')}
        />
      ) : (
        <DataTable
          caption={t('inv.parts.title')}
          rows={page.items}
          rowKey={(p) => p.id}
          columns={[
            {
              key: 'code',
              header: t('inv.parts.code'),
              render: (p) => (
                <Link
                  className="code"
                  href={`/inv/parts/${encodeURIComponent(p.id)}`}
                  data-testid="part-code"
                >
                  {p.code}
                </Link>
              ),
            },
            {
              key: 'name',
              header: t('inv.parts.name'),
              render: (p) => (
                <>
                  {p.name}
                  {p.status === 'inactive' ? (
                    <>
                      {' '}
                      <StatusBadge tone="neutral">{t('inv.parts.inactiveBadge')}</StatusBadge>
                    </>
                  ) : null}
                  <div className="cell-sub">{p.compat.join(', ')}</div>
                </>
              ),
            },
            { key: 'brand', header: t('inv.parts.brand'), render: (p) => p.brand || '—' },
            {
              key: 'group',
              header: t('inv.parts.group'),
              render: (p) => t(`inv.group.${p.group}`),
            },
            { key: 'unit', header: t('inv.parts.unitCol'), render: (p) => t(`inv.unit.${p.unit}`) },
            ...(avail.size > 0 || hasPermission(actor, 'stock-availability:view')
              ? [
                  {
                    key: 'avail',
                    header: t('inv.parts.available'),
                    numeric: true,
                    render: (p: { id: string }) => num(avail.get(p.id) ?? 0),
                  },
                ]
              : []),
          ]}
        />
      )}
      <Pager
        base="/inv/parts"
        query={query}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('inv.prev'), next: t('inv.next'), aria: t('common.pagination') }}
      />
    </InvPage>
  );
}

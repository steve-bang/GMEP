import { getTranslations } from 'next-intl/server';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { listPriceLists } from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, PageHeader } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

/**
 * Price lists: cost, list price and actual price are separate (CLAUDE.md). The header lives here;
 * item prices are effective-dated `price-item` config versions (cost visible to few roles).
 */
export default async function PriceListsPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const res = await load(() => listPriceLists(getContainer().sys, actor, { limit: 100 }));
  const header = <PageHeader title={t('priceLists.title')} lead={t('priceLists.lead')} />;
  if (res.error)
    return (
      <>
        {header}
        <ErrorFor error={res.error} t={t} />
      </>
    );
  const canCreate =
    hasPermission(actor, 'price-list:create') &&
    resolveScope(actor, 'price-list:create').kind === 'all';
  return (
    <>
      {header}
      {res.data.items.length === 0 ? (
        <EmptyState title={t('priceLists.emptyTitle')} text={t('priceLists.emptyText')} />
      ) : (
        <DataTable
          caption={t('priceLists.title')}
          rows={res.data.items}
          rowKey={(p) => p.id}
          columns={[
            { key: 'code', header: t('warehouses.colCode'), render: (p) => p.code },
            { key: 'name', header: t('warehouses.colName'), render: (p) => p.name },
            {
              key: 'status',
              header: t('warehouses.colStatus'),
              render: (p) => (
                <StatusBadge tone={p.status === 'active' ? 'success' : 'neutral'}>
                  {t(`warehouses.${p.status}`)}
                </StatusBadge>
              ),
            },
          ]}
        />
      )}
      {canCreate ? (
        <section aria-labelledby="new-h" className="g1-auth-card g1-auth-card--wide">
          <h2 id="new-h">{t('priceLists.create')}</h2>
          <ResourceForm
            testId="pricelist-form"
            endpoint="/api/v1/sys/price-lists"
            labels={formLabels(t, 'warehouses.save', false)}
            fields={[
              { name: 'code', label: t('warehouses.colCode'), required: true, maxLength: 30 },
              { name: 'name', label: t('warehouses.colName'), required: true, maxLength: 120 },
            ]}
          />
        </section>
      ) : null}
    </>
  );
}

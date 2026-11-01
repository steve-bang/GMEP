import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { getWarehouse } from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ActionButton, ResourceForm } from '@/ui/components/ResourceForm';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { ErrorFor, PageHeader } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const res = await load(() => getWarehouse(getContainer().sys, actor, decodeURIComponent(id)));
  if (res.error)
    return (
      <>
        <PageHeader title={t('warehouses.title')} />
        <ErrorFor error={res.error} t={t} />
      </>
    );
  const w = res.data;
  const canEdit = hasPermission(actor, 'warehouse:update');
  const canArchive = hasPermission(actor, 'warehouse:archive');
  return (
    <>
      <PageHeader
        title={`${w.code} · ${w.name}`}
        lead={t('warehouses.detailLead')}
        actions={
          <Link className="btn btn--ghost" href="/sys/warehouses">
            {t('common.back')}
          </Link>
        }
      />
      <p>
        <StatusBadge tone={w.status === 'active' ? 'success' : 'neutral'}>
          {t(`warehouses.${w.status}`)}
        </StatusBadge>
      </p>
      {canEdit ? (
        <div className="g1-auth-card g1-auth-card--wide">
          <ResourceForm
            testId="warehouse-edit"
            endpoint={`/api/v1/sys/warehouses/${encodeURIComponent(w.id)}`}
            method="PATCH"
            extra={{ version: w.version }}
            labels={formLabels(t, 'common.save', false)}
            fields={[
              {
                name: 'name',
                label: t('warehouses.colName'),
                required: true,
                defaultValue: w.name,
                maxLength: 120,
              },
              {
                name: 'note',
                label: t('warehouses.note'),
                type: 'textarea',
                defaultValue: w.note ?? '',
                maxLength: 300,
              },
            ]}
          />
        </div>
      ) : null}
      {canArchive ? (
        <ActionButton
          testId="wh-status"
          endpoint={`/api/v1/sys/warehouses/${encodeURIComponent(w.id)}/status`}
          body={{ status: w.status === 'active' ? 'inactive' : 'active', version: w.version }}
          label={w.status === 'active' ? t('warehouses.deactivate') : t('warehouses.reactivate')}
          variant={w.status === 'active' ? 'danger' : 'secondary'}
          confirm={w.status === 'active' ? t('warehouses.deactivateConfirm') : undefined}
          errorFallback={t('common.unexpected')}
        />
      ) : null}
    </>
  );
}

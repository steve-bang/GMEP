import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDate, isoToVi } from '@/platform/format/date';
import { formatVnd } from '@/platform/format/vnd';
import { hasPermission } from '@/platform/rbac/rbac';
import { getVehicle, listVehicleHistory, listVehicleOwnerships } from '@/modules/crm';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor } from '@/ui/components/PageParts';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { EmptyState } from '@/ui/components/States';
import { CrmPage } from '../../CrmPage';
import { pickerLabels } from '../../pickerLabels';

export const dynamic = 'force-dynamic';

/**
 * G2-CRM-06/07 / FR-CRM-004, 014: vehicle profile, ownership history, repair history of all branches
 * (white-listed projection) and the owner / plate change forms.
 */
export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const crm = getContainer().crm;
  const crumbs = [{ label: t('crm.vehicles.title'), href: '/crm/vehicles' }];
  const canEdit = hasPermission(actor, 'vehicle:update');
  const res = await load(async () => {
    const vehicle = await getVehicle(crm, actor, id);
    const owners = await listVehicleOwnerships(crm, actor, id);
    const history = hasPermission(actor, 'vehicle-history:view')
      ? await listVehicleHistory(crm, actor, id, { limit: 50 })
      : null;
    return { vehicle, owners, history };
  });
  if (res.error)
    return (
      <CrmPage title={t('crm.vehicles.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  const { vehicle: v, owners, history } = res.data;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <CrmPage
      title={v.plate}
      desc={`${v.make} ${v.model} ${v.year}`}
      crumbs={crumbs}
      actions={
        v.owner ? (
          <Link
            className="btn btn--secondary"
            href={`/crm/customers/${encodeURIComponent(v.owner.id)}`}
          >
            {v.owner.name}
          </Link>
        ) : undefined
      }
    >
      <section className="card" style={{ padding: 'var(--space-6)' }} aria-labelledby="veh-h">
        <h2 id="veh-h">{t('crm.vehicles.profile')}</h2>
        <dl className="vehicle-card__meta" data-testid="vehicle-profile">
          <dt>{t('crm.vehicles.vin')}</dt>
          <dd>{v.vin ?? '—'}</dd>
          <dt>{t('crm.vehicles.engineNo')}</dt>
          <dd>{v.engineNo ?? '—'}</dd>
          <dt>{t('crm.vehicles.commercial')}</dt>
          <dd>{v.isCommercial ? t('crm.yes') : t('crm.no')}</dd>
          <dt>{t('crm.vehicles.lastKm')}</dt>
          <dd>{v.lastKm !== null ? v.lastKm.toLocaleString('vi-VN') : '—'}</dd>
          {v.previousPlates.length > 0 ? (
            <>
              <dt>{t('crm.vehicles.previousPlates')}</dt>
              <dd>{v.previousPlates.map((p) => `${p.plate} (${isoToVi(p.until)})`).join(', ')}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="card" style={{ padding: 'var(--space-6)' }} aria-labelledby="own-h">
        <h2 id="own-h">{t('crm.ownership.title')}</h2>
        <DataTable
          caption={t('crm.ownership.title')}
          rows={owners}
          rowKey={(o) => o.id}
          columns={[
            {
              key: 'owner',
              header: t('crm.ownership.owner'),
              render: (o) =>
                o.customer ? (
                  <Link href={`/crm/customers/${encodeURIComponent(o.customerId)}`}>
                    {o.customer.name}
                  </Link>
                ) : (
                  t('crm.ownership.otherBranch')
                ),
            },
            { key: 'from', header: t('crm.ownership.from'), render: (o) => isoToVi(o.from) },
            {
              key: 'to',
              header: t('crm.ownership.to'),
              render: (o) => (o.to ? isoToVi(o.to) : t('crm.ownership.current')),
            },
          ]}
        />
      </section>

      {history ? (
        <section className="card" style={{ padding: 'var(--space-6)' }} aria-labelledby="his-h">
          <h2 id="his-h">{t('crm.history.title')}</h2>
          <p className="text-secondary">{t('crm.history.lead')}</p>
          {history.items.length === 0 ? (
            <EmptyState title={t('crm.history.emptyTitle')} text={t('crm.history.emptyText')} />
          ) : (
            <DataTable
              caption={t('crm.history.title')}
              rows={history.items}
              rowKey={(h) => h.id}
              columns={[
                { key: 'date', header: t('crm.history.date'), render: (h) => isoToVi(h.date) },
                { key: 'branch', header: t('crm.history.branch'), render: (h) => h.branchName },
                { key: 'order', header: t('crm.history.order'), render: (h) => h.orderCode },
                { key: 'items', header: t('crm.history.items'), render: (h) => h.items.join(', ') },
                {
                  key: 'parts',
                  header: t('crm.history.parts'),
                  render: (h) => h.parts.map((p) => `${p.name} ×${p.qty}`).join(', '),
                },
                {
                  key: 'km',
                  header: t('crm.history.km'),
                  numeric: true,
                  render: (h) => (h.km !== null ? h.km.toLocaleString('vi-VN') : '—'),
                },
                ...(history.items.some((h) => h.totalVnd !== null)
                  ? [
                      {
                        key: 'total',
                        header: t('crm.history.total'),
                        numeric: true,
                        render: (h: { totalVnd: number | null }) =>
                          h.totalVnd !== null ? formatVnd(h.totalVnd) : '—',
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </section>
      ) : null}

      {canEdit ? (
        <section
          className="card stack"
          style={{ padding: 'var(--space-6)' }}
          aria-labelledby="chg-h"
        >
          <h2 id="chg-h">{t('crm.ownership.changeTitle')}</h2>
          <p className="text-secondary">{t('crm.ownership.changeLead')}</p>
          <ResourceForm
            testId="owner-form"
            endpoint={`/api/v1/crm/vehicles/${encodeURIComponent(v.id)}/owner`}
            extra={{ version: v.version }}
            labels={formLabels(t, 'crm.ownership.changeSubmit', false)}
            fields={[
              {
                name: 'newCustomerId',
                label: t('crm.ownership.newOwner'),
                type: 'customer',
                required: true,
                picker: {
                  labels: pickerLabels(t),
                  ...(v.owner ? { excludeId: v.owner.id } : {}),
                  canLookup:
                    hasPermission(actor, 'customer-lookup-customer:view') &&
                    hasPermission(actor, 'customer:update'),
                },
              },
              {
                name: 'effectiveDate',
                label: t('crm.ownership.effectiveDate'),
                type: 'date',
                required: true,
                defaultValue: today,
              },
              { name: 'note', label: t('crm.ownership.note'), maxLength: 200 },
            ]}
          />
          <h2>{t('crm.vehicles.plateChangeTitle')}</h2>
          <ResourceForm
            testId="plate-form"
            endpoint={`/api/v1/crm/vehicles/${encodeURIComponent(v.id)}/plate`}
            extra={{ version: v.version }}
            labels={formLabels(t, 'crm.vehicles.plateChangeSubmit', false)}
            fields={[
              { name: 'plate', label: t('crm.vehicles.newPlate'), required: true, maxLength: 20 },
              {
                name: 'reason',
                label: t('crm.vehicles.plateReason'),
                required: true,
                maxLength: 200,
                hint: t('crm.vehicles.plateReasonHint'),
              },
            ]}
          />
        </section>
      ) : null}
      <p className="text-secondary">
        {t('crm.createdAt', { date: formatDate(new Date(v.createdAt)) })}
      </p>
    </CrmPage>
  );
}

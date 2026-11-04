import { getTranslations } from 'next-intl/server';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { getCustomer } from '@/modules/crm';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { CustomerPicker } from '@/ui/components/CustomerPicker';
import { Button } from '@/ui/components/Button';
import { CrmPage } from '../../CrmPage';
import { pickerLabels } from '../../pickerLabels';

export const dynamic = 'force-dynamic';

/** G2-CRM-05 / FR-CRM-002, 014: a vehicle is created for a customer (its first owner). */
export default async function NewVehiclePage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const customerId = first((await searchParams).customerId);
  const { actor, sessionId } = await requireSession();
  const crm = getContainer().crm;
  const crumbs = [{ label: t('crm.vehicles.title'), href: '/crm/vehicles' }];
  const title = t('crm.vehicles.create');
  if (!customerId)
    return (
      <CrmPage title={title} crumbs={crumbs}>
        <p className="text-secondary">{t('crm.vehicles.needCustomerText')}</p>
        <form
          method="get"
          action="/crm/vehicles/new"
          className="stack"
          data-testid="vehicle-owner-form"
        >
          <div className="field">
            <label className="field__label" htmlFor="owner-q">
              {t('crm.vehicles.ownerSearch')}
            </label>
            <CustomerPicker
              name="customerId"
              inputId="owner-q"
              labels={pickerLabels(t)}
              required
              canLookup={
                hasPermission(actor, 'customer-lookup-customer:view') &&
                hasPermission(actor, 'customer:update')
              }
            />
          </div>
          <Button type="submit" variant="primary">
            {t('crm.vehicles.continue')}
          </Button>
        </form>
      </CrmPage>
    );
  const res = await load(async () => {
    resolveScope(actor, 'vehicle:create');
    return getCustomer(crm, actor, customerId, { requestId: 'page', sessionId });
  });
  if (res.error)
    return (
      <CrmPage title={title} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  const c = res.data;
  return (
    <CrmPage
      title={title}
      desc={t('crm.vehicles.createFor', { name: c.name, code: c.code })}
      crumbs={crumbs}
    >
      <div className="g1-auth-card g1-auth-card--wide">
        <ResourceForm
          testId="vehicle-form"
          endpoint="/api/v1/crm/vehicles"
          redirectTo={`/crm/customers/${encodeURIComponent(c.id)}`}
          cancelHref={`/crm/customers/${encodeURIComponent(c.id)}`}
          extra={{ customerId: c.id }}
          labels={formLabels(t, 'crm.vehicles.save')}
          fields={[
            {
              name: 'plate',
              label: t('crm.vehicles.plate'),
              required: true,
              maxLength: 20,
              hint: t('crm.vehicles.plateHint'),
            },
            { name: 'make', label: t('crm.vehicles.make'), required: true, maxLength: 60 },
            { name: 'model', label: t('crm.vehicles.modelField'), required: true, maxLength: 60 },
            { name: 'year', label: t('crm.vehicles.year'), type: 'number', required: true },
            {
              name: 'vin',
              label: t('crm.vehicles.vin'),
              maxLength: 20,
              hint: t('crm.vehicles.vinHint'),
            },
            { name: 'engineNo', label: t('crm.vehicles.engineNo'), maxLength: 40 },
            { name: 'lastKm', label: t('crm.vehicles.lastKm'), type: 'number' },
            {
              name: 'isCommercial',
              label: t('crm.vehicles.commercial'),
              type: 'checkbox',
              hint: t('crm.vehicles.commercialHint'),
            },
          ]}
        />
      </div>
    </CrmPage>
  );
}

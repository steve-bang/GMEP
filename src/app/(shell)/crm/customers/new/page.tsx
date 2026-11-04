import { getTranslations } from 'next-intl/server';
import { resolveScope } from '@/platform/rbac/rbac';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { ErrorFor } from '@/ui/components/PageParts';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { CrmPage } from '../../CrmPage';

export const dynamic = 'force-dynamic';

/** G2-CRM-02 / FR-CRM-001: individual or business customer. */
export default async function NewCustomerPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const crumbs = [{ label: t('crm.customers.title'), href: '/crm/customers' }];
  const res = await load(async () => resolveScope(actor, 'customer:create'));
  if (res.error)
    return (
      <CrmPage title={t('crm.customers.create')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  return (
    <CrmPage title={t('crm.customers.create')} desc={t('crm.customers.createLead')} crumbs={crumbs}>
      <div className="g1-auth-card g1-auth-card--wide">
        <ResourceForm
          testId="customer-form"
          endpoint="/api/v1/crm/customers"
          redirectTo="/crm/customers"
          cancelHref="/crm/customers"
          labels={formLabels(t, 'crm.customers.save')}
          fields={[
            {
              name: 'type',
              label: t('crm.customers.type'),
              type: 'select',
              required: true,
              defaultValue: 'individual',
              options: [
                { value: 'individual', label: t('crm.type.individual') },
                { value: 'business', label: t('crm.type.business') },
              ],
            },
            {
              name: 'name',
              label: t('crm.customers.nameField'),
              required: true,
              maxLength: 120,
              hint: t('crm.customers.nameHint'),
            },
            {
              name: 'phone',
              label: t('crm.customers.phone'),
              maxLength: 20,
              hint: t('crm.customers.phoneHint'),
            },
            { name: 'email', label: t('crm.customers.email'), type: 'email', maxLength: 120 },
            {
              name: 'address',
              label: t('crm.customers.address'),
              type: 'textarea',
              maxLength: 300,
            },
            {
              name: 'taxCode',
              label: t('crm.customers.taxCode'),
              maxLength: 14,
              hint: t('crm.customers.taxCodeHint'),
            },
            { name: 'contactName', label: t('crm.customers.contactName'), maxLength: 120 },
          ]}
        />
      </div>
    </CrmPage>
  );
}

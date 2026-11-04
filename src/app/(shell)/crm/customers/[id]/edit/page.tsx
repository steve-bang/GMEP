import { getTranslations } from 'next-intl/server';
import { resolveScope } from '@/platform/rbac/rbac';
import { getCustomer } from '@/modules/crm';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { ResourceForm, type FieldDef } from '@/ui/components/ResourceForm';
import { CrmPage } from '../../../CrmPage';

export const dynamic = 'force-dynamic';

/**
 * G2-CRM-02 (edit) / FR-CRM-001. Contact fields are offered only when the role sees them in full:
 * a masked value must never be saved back over the real one (NFR-SEC-03).
 */
export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor, sessionId } = await requireSession();
  const crm = getContainer().crm;
  const res = await load(async () => {
    resolveScope(actor, 'customer:update');
    return getCustomer(crm, actor, id, { requestId: 'page', sessionId });
  });
  const crumbs = [{ label: t('crm.customers.title'), href: '/crm/customers' }];
  if (res.error)
    return (
      <CrmPage title={t('crm.customers.edit')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  const c = res.data;
  const full = (p: { masked: boolean }) => !p.masked;
  const fields: FieldDef[] = [
    {
      name: 'name',
      label: t('crm.customers.nameField'),
      required: true,
      maxLength: 120,
      defaultValue: c.name,
    },
    ...(full(c.phone)
      ? [
          {
            name: 'phone',
            label: t('crm.customers.phone'),
            maxLength: 20,
            defaultValue: c.phone.value ?? '',
          },
        ]
      : []),
    ...(full(c.email)
      ? [
          {
            name: 'email',
            label: t('crm.customers.email'),
            type: 'email' as const,
            maxLength: 120,
            defaultValue: c.email.value ?? '',
          },
        ]
      : []),
    ...(full(c.address)
      ? [
          {
            name: 'address',
            label: t('crm.customers.address'),
            type: 'textarea' as const,
            maxLength: 300,
            defaultValue: c.address.value ?? '',
          },
        ]
      : []),
    ...(c.type === 'business'
      ? [
          {
            name: 'taxCode',
            label: t('crm.customers.taxCode'),
            maxLength: 14,
            hint: t('crm.customers.taxCodeHint'),
            defaultValue: c.taxCode ?? '',
          },
          {
            name: 'contactName',
            label: t('crm.customers.contactName'),
            maxLength: 120,
            defaultValue: c.contactName ?? '',
          },
        ]
      : []),
  ];
  return (
    <CrmPage
      title={t('crm.customers.edit')}
      desc={`${c.code} · ${c.name}`}
      crumbs={[...crumbs, { label: c.name, href: `/crm/customers/${encodeURIComponent(c.id)}` }]}
    >
      <div className="g1-auth-card g1-auth-card--wide">
        <ResourceForm
          testId="customer-form"
          method="PATCH"
          endpoint={`/api/v1/crm/customers/${encodeURIComponent(c.id)}`}
          redirectTo={`/crm/customers/${encodeURIComponent(c.id)}`}
          cancelHref={`/crm/customers/${encodeURIComponent(c.id)}`}
          extra={{ version: c.version }}
          labels={formLabels(t, 'crm.customers.save')}
          fields={fields}
        />
      </div>
    </CrmPage>
  );
}

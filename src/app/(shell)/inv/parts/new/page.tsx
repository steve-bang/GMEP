import { getTranslations } from 'next-intl/server';
import { resolveScope } from '@/platform/rbac/rbac';
import { getPartCatalogs } from '@/modules/inv';
import { getContainer } from '@/composition/container';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { ErrorFor } from '@/ui/components/PageParts';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { InvPage } from '../../InvPage';
import { catalogOptions } from '../../catalogLabels';

export const dynamic = 'force-dynamic';

/** G3-INV-02 / FR-INV-001, 002: create a part. There is deliberately no quantity field (FR-INV-021). */
export default async function NewPartPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const crumbs = [{ label: t('inv.parts.title'), href: '/inv/parts' }];
  const res = await load(async () => {
    resolveScope(actor, 'part:create');
    return getPartCatalogs(getContainer().inv, actor);
  });
  if (res.error)
    return (
      <InvPage title={t('inv.parts.create')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  return (
    <InvPage title={t('inv.parts.create')} desc={t('inv.parts.createLead')} crumbs={crumbs}>
      <div className="g1-auth-card g1-auth-card--wide">
        <ResourceForm
          testId="part-form"
          endpoint="/api/v1/inv/parts"
          redirectTo="/inv/parts"
          cancelHref="/inv/parts"
          labels={formLabels(t, 'inv.parts.save')}
          fields={[
            {
              name: 'code',
              label: t('inv.parts.code'),
              required: true,
              maxLength: 40,
              hint: t('inv.parts.codeHint'),
            },
            { name: 'name', label: t('inv.parts.name'), required: true, maxLength: 120 },
            { name: 'brand', label: t('inv.parts.brand'), maxLength: 60 },
            {
              name: 'unit',
              label: t('inv.parts.unitCol'),
              type: 'select',
              required: true,
              options: catalogOptions(res.data.units),
            },
            {
              name: 'group',
              label: t('inv.parts.group'),
              type: 'select',
              required: true,
              options: catalogOptions(res.data.groups),
            },
            {
              name: 'quantityScale',
              label: t('inv.parts.quantityScale'),
              type: 'select',
              required: true,
              defaultValue: '1',
              options: [1, 10, 100, 1000].map((n) => ({
                value: String(n),
                label: t(`inv.parts.scale.${n}`),
              })),
              hint: t('inv.parts.quantityScaleHint'),
            },
            {
              name: 'barcode',
              label: t('inv.parts.barcode'),
              maxLength: 40,
              hint: t('inv.parts.barcodeHint'),
            },
            {
              name: 'compat',
              label: t('inv.parts.compat'),
              type: 'textarea',
              parse: 'pairs',
              hint: t('inv.parts.compatHint'),
            },
          ]}
        />
      </div>
    </InvPage>
  );
}

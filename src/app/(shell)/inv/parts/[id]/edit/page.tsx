import { getTranslations } from 'next-intl/server';
import { getPart, getPartCatalogs } from '@/modules/inv';
import { resolveScope } from '@/platform/rbac/rbac';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { InvPage } from '../../../InvPage';
import { catalogOptions } from '../../../catalogLabels';

export const dynamic = 'force-dynamic';

/** G3-INV-02: edit catalogue fields. The code is fixed; quantities are not editable here. */
export default async function EditPartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const { actor } = await requireSession();
  const crumbs = [{ label: t('inv.parts.title'), href: '/inv/parts' }];
  const res = await load(async () => {
    resolveScope(actor, 'part:update');
    const inv = getContainer().inv;
    return { part: await getPart(inv, actor, id), cats: await getPartCatalogs(inv, actor) };
  });
  if (res.error)
    return (
      <InvPage title={t('inv.parts.edit')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  const { part: p, cats } = res.data;
  return (
    <InvPage
      title={`${t('inv.parts.edit')} ${p.code}`}
      desc={t('inv.parts.createLead')}
      crumbs={[...crumbs, { label: p.code, href: `/inv/parts/${encodeURIComponent(p.id)}` }]}
    >
      <div className="g1-auth-card g1-auth-card--wide">
        <ResourceForm
          testId="part-form"
          endpoint={`/api/v1/inv/parts/${encodeURIComponent(p.id)}`}
          method="PATCH"
          extra={{ version: p.version }}
          redirectTo={`/inv/parts/${encodeURIComponent(p.id)}`}
          cancelHref={`/inv/parts/${encodeURIComponent(p.id)}`}
          labels={formLabels(t, 'inv.parts.save')}
          fields={[
            {
              name: 'name',
              label: t('inv.parts.name'),
              required: true,
              maxLength: 120,
              defaultValue: p.name,
            },
            { name: 'brand', label: t('inv.parts.brand'), maxLength: 60, defaultValue: p.brand },
            {
              name: 'unit',
              label: t('inv.parts.unitCol'),
              type: 'select',
              required: true,
              defaultValue: p.unit,
              options: catalogOptions(cats.units, p.unit),
            },
            {
              name: 'group',
              label: t('inv.parts.group'),
              type: 'select',
              required: true,
              defaultValue: p.group,
              options: catalogOptions(cats.groups, p.group),
            },
            {
              name: 'quantityScale',
              label: t('inv.parts.quantityScale'),
              type: 'select',
              required: true,
              defaultValue: String(p.quantityScale),
              options: [1, 10, 100, 1000].map((n) => ({
                value: String(n),
                label: t(`inv.parts.scale.${n}`),
              })),
              hint: t('inv.parts.quantityScaleLockedHint'),
            },
            {
              name: 'barcode',
              label: t('inv.parts.barcode'),
              maxLength: 40,
              emptyAs: 'null',
              defaultValue: p.barcode ?? '',
              hint: t('inv.parts.barcodeHint'),
            },
            {
              name: 'compat',
              label: t('inv.parts.compat'),
              type: 'textarea',
              parse: 'pairs',
              defaultValue: p.compat.join('\n'),
              hint: t('inv.parts.compatHint'),
            },
          ]}
        />
      </div>
    </InvPage>
  );
}

import { getTranslations } from 'next-intl/server';
import { getDocument } from '@/modules/inv';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { InvPage } from '../../../InvPage';
import { DocumentForm } from '../../DocumentForm';
import { documentFormData } from '../../new/formData';

export const dynamic = 'force-dynamic';

/** Edit a draft (a posted document is never edited, RULE-010). */
export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const { actor } = await requireSession();
  const res = await load(async () => {
    const doc = await getDocument(getContainer().inv, actor, id);
    return { doc, data: await documentFormData(actor, doc.type) };
  });
  const crumbs = [{ label: t('inv.docs.title'), href: '/inv/documents' }];
  if (res.error)
    return (
      <InvPage title={t('inv.docs.edit')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  const { doc, data } = res.data;
  if (doc.status !== 'draft')
    return (
      <InvPage title={t('inv.docs.edit')} crumbs={crumbs}>
        <EmptyState title={t('inv.docs.postedBanner')} />
      </InvPage>
    );
  return (
    <InvPage
      title={`${t('inv.docs.edit')} ${doc.displayNo}`}
      desc={t(`inv.docs.formLead_${doc.type}`)}
      crumbs={[
        ...crumbs,
        { label: doc.displayNo, href: `/inv/documents/${encodeURIComponent(doc.id)}` },
      ]}
    >
      <div className="inv-form">
        <DocumentForm
          type={doc.type}
          warehouses={data.warehouses}
          sourceTypes={data.sourceTypes}
          receivers={data.receivers}
          labels={data.labels}
          cancelHref={`/inv/documents/${encodeURIComponent(doc.id)}`}
          edit={{
            id: doc.id,
            version: doc.version,
            warehouseId: doc.warehouseId,
            sourceType: doc.source.type,
            sourceId: doc.source.id ?? '',
            reason: doc.reason ?? '',
            receiverUserId: doc.receiverUserId ?? '',
            lines: doc.lines.map((l) => ({
              code: l.partCode,
              partId: l.partId,
              name: l.partName,
              qty: String(l.qty),
              unitCost: l.unitCostVnd === null ? '' : String(l.unitCostVnd),
              expectedQty: l.expectedQty === undefined ? '' : String(l.expectedQty),
              expectedCost:
                l.expectedUnitCostVnd === undefined ? '' : String(l.expectedUnitCostVnd),
              ...(l.originalLineNo !== undefined ? { originalLineNo: l.originalLineNo } : {}),
            })),
          }}
        />
      </div>
    </InvPage>
  );
}

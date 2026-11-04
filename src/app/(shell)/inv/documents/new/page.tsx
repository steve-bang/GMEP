import { getTranslations } from 'next-intl/server';
import { DOC_TYPES, getDocument, type StockDocType } from '@/modules/inv';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { InvPage } from '../../InvPage';
import { DocumentForm } from '../DocumentForm';
import { documentFormData } from './formData';

export const dynamic = 'force-dynamic';

/** G3-INV-07, 09, 10 and the adjustment form: a DRAFT is saved first, posting is a separate confirmed step. */
export default async function NewDocumentPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const raw = first(sp.type);
  const type: StockDocType = (DOC_TYPES as readonly string[]).includes(raw ?? '')
    ? (raw as StockDocType)
    : 'GRN';
  const originalId = first(sp.original);
  const { actor } = await requireSession();
  const res = await load(async () => {
    const data = await documentFormData(actor, type);
    const original =
      type === 'RTN' && originalId
        ? await getDocument(getContainer().inv, actor, originalId)
        : null;
    return { data, original };
  });
  const t = await getTranslations();
  const crumbs = [{ label: t('inv.docs.title'), href: '/inv/documents' }];
  if (res.error)
    return (
      <InvPage title={t(`inv.docs.formTitle${type}`)} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  const { data, original } = res.data;
  if (type === 'RTN' && !original)
    return (
      <InvPage title={t('inv.docs.formTitleRTN')} crumbs={crumbs}>
        <EmptyState
          title={t('inv.docs.rtnNeedsOriginalTitle')}
          text={t('inv.docs.rtnNeedsOriginal')}
        />
      </InvPage>
    );
  return (
    <InvPage
      title={t(`inv.docs.formTitle${type}`)}
      desc={t(`inv.docs.formLead_${type}`)}
      crumbs={crumbs}
    >
      <div className="inv-form">
        <DocumentForm
          type={type}
          warehouses={data.warehouses}
          sourceTypes={data.sourceTypes}
          receivers={data.receivers}
          labels={data.labels}
          cancelHref="/inv/documents"
          {...(original
            ? {
                original: {
                  id: original.id,
                  no: original.displayNo,
                  sourceId: original.source.id ?? '',
                  warehouseId: original.warehouseId,
                  lines: original.lines.map((l) => ({
                    code: l.partCode,
                    partId: l.partId,
                    name: l.partName,
                    qty: '',
                    unitCost: '',
                    expectedQty: '',
                    expectedCost: '',
                    originalLineNo: l.lineNo,
                    issued: l.qty,
                  })),
                },
              }
            : {})}
        />
      </div>
    </InvPage>
  );
}

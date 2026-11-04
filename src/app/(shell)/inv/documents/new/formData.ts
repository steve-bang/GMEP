import { getTranslations } from 'next-intl/server';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { SOURCES_BY_TYPE, type StockDocType } from '@/modules/inv';
import { listWarehouses } from '@/modules/sys';
import { getContainer } from '@/composition/container';
import type { DocFormLabels } from '../DocumentForm';

/** Everything a document form needs from the server: warehouses, source types, receivers and plain-string labels. */
export async function documentFormData(actor: Actor, type: StockDocType) {
  const t = await getTranslations();
  const { sys } = getContainer();
  const scope = resolveScope(actor, 'stock-doc:create');
  const warehouses = (await listWarehouses(sys, actor, { limit: 50 } as never)).items.filter(
    (w) => w.status === 'active',
  );
  const users =
    type === 'GIN'
      ? await sys.users.list(scope, { sort: 'name', direction: 'asc', limit: 100 })
      : null;
  const labels: DocFormLabels = {
    warehouse: t('inv.docs.wh'),
    sourceType: t('inv.docs.sourceType'),
    sourceId: t('inv.docs.sourceId'),
    sourceIdHint: t('inv.docs.sourceIdHint'),
    reason: t('inv.docs.reasonField'),
    receiver: t('inv.docs.receiverField'),
    lines: t('inv.docs.detailLines'),
    partCode: t('inv.docs.partCode'),
    partHint: t('inv.docs.partHint'),
    qty: type === 'ADJ' ? t('inv.docs.qtyAdj') : t('inv.docs.qty'),
    unitCost: t('inv.docs.unitCost'),
    expectedQty: t('inv.docs.expectedQty'),
    expectedCost: t('inv.docs.expectedCost'),
    addLine: t('inv.docs.addLine'),
    removeLine: t('inv.docs.removeLine'),
    save: t('inv.docs.saveDraft'),
    cancel: t('common.cancel'),
    unknownPart: t('inv.docs.unknownPart'),
    noLines: t('inv.docs.noLines'),
    original: t('inv.docs.original'),
    issued: t('inv.docs.issued'),
    errorSummary: t('common.errorSummary', { count: '{count}' }),
    unexpected: t('common.unexpected'),
    versionConflict: t('common.versionConflict'),
  };
  return {
    t,
    labels,
    warehouses: warehouses.map((w) => ({ value: w.id, label: w.name })),
    sourceTypes: SOURCES_BY_TYPE[type].map((s) => ({ value: s, label: t(`inv.docs.source_${s}`) })),
    receivers: (users?.items ?? []).map((u) => ({ value: u.id, label: u.displayName })),
  };
}

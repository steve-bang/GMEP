import { getTranslations } from 'next-intl/server';
import { getWarehouse } from '@/modules/rpt';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { ReportTools } from '../RptActions';
import { dmy, Kpi, Kpis, money, Note, RptPage, rptLabels } from '../rptUi';

export const dynamic = 'force-dynamic';

/**
 * FR-RPT-005: stock value, lines at or below the reorder level judged on AVAILABLE (RULE-008) and recent goods issues
 * of one branch. Value only with stock-cost:view; quantities are shown as stored by INV.
 */
export default async function WarehouseReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const branchId = first(sp.branchId);
  const warehouseId = first(sp.warehouseId);
  const l = rptLabels('rep');
  const res = await load(() =>
    getWarehouse(getContainer().rpt, actor, {
      ...(branchId ? { branchId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    }),
  );
  const head = {
    title: l.warehouseTitle!,
    desc: l.warehouseLead!,
    crumbs: [{ label: t('shell.nav.reports'), href: '/rpt' }],
  };
  if (res.error)
    return (
      <RptPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RptPage>
    );
  const d = res.data;
  const r = d.report;
  return (
    <RptPage {...head}>
      {d.truncated ? <Note tone="warning">{l.warehouseTruncated}</Note> : null}
      {d.showValue ? null : <Note>{l.valueHidden}</Note>}
      <Kpis>
        {d.showValue ? (
          <Kpi
            label={l.kValue!}
            value={money(r.totalValueVnd)}
            formula={l.fValue!}
            testId="w-value"
          />
        ) : null}
        <Kpi label={l.kLines!} value={String(r.lineCount)} testId="w-lines" />
        <Kpi
          label={l.kBelow!}
          value={String(r.below.length)}
          formula={l.fBelow!}
          testId="w-below"
          tone={r.below.length ? 'warning' : undefined}
        />
      </Kpis>
      <DataTable<(typeof r.summary)[number]>
        caption={l.perWarehouse!}
        toolbar={l.perWarehouse!}
        rows={r.summary}
        rowKey={(x) => x.warehouseId}
        columns={[
          {
            key: 'w',
            header: l.colWarehouse!,
            render: (x) => d.warehouses[x.warehouseId] ?? x.warehouseId,
          },
          { key: 'l', header: l.colLines!, numeric: true, render: (x) => x.lines },
          { key: 'b', header: l.kBelow!, numeric: true, render: (x) => x.below },
          { key: 'o', header: l.colOut!, numeric: true, render: (x) => x.out },
          ...(d.showValue
            ? [
                {
                  key: 'v',
                  header: l.colValueVnd!,
                  numeric: true,
                  render: (x: (typeof r.summary)[number]) => money(x.valueVnd),
                },
              ]
            : []),
        ]}
      />
      {r.below.length === 0 ? (
        <EmptyState title={l.belowTitle!} text={l.belowEmpty} />
      ) : (
        <DataTable<(typeof r.below)[number]>
          caption={l.belowTitle!}
          toolbar={l.belowTitle!}
          rows={r.below}
          rowKey={(x) => `${x.warehouseId}__${x.partId}`}
          columns={[
            { key: 'p', header: l.colPart!, render: (x) => `${x.partCode} · ${x.partName}` },
            {
              key: 'w',
              header: l.colWarehouse!,
              render: (x) => d.warehouses[x.warehouseId] ?? x.warehouseId,
            },
            { key: 'oh', header: l.colOnHand!, numeric: true, render: (x) => x.onHand },
            { key: 'rs', header: l.colReserved!, numeric: true, render: (x) => x.reserved },
            { key: 'it', header: l.colInTransit!, numeric: true, render: (x) => x.inTransit },
            { key: 'av', header: l.colAvailable!, numeric: true, render: (x) => x.available },
            { key: 'mn', header: l.colMin!, numeric: true, render: (x) => x.minQty },
            { key: 'sg', header: l.colSuggest!, numeric: true, render: (x) => x.suggestQty ?? '—' },
          ]}
        />
      )}
      <DataTable<(typeof d.issues)[number]>
        caption={l.issuesTitle!}
        toolbar={l.issuesTitle!}
        rows={d.issues}
        rowKey={(x) => x.date}
        columns={[
          { key: 'd', header: l.colDate!, render: (x) => dmy(x.date) },
          { key: 'n', header: l.colGin!, numeric: true, render: (x) => x.documents },
          { key: 's', header: l.colNoSource!, numeric: true, render: (x) => x.withoutSource },
        ]}
      />
      <ReportTools
        body={{ kind: 'warehouse', branchId: d.branchId }}
        labels={l}
        mayExport={d.mayExport}
      />
    </RptPage>
  );
}

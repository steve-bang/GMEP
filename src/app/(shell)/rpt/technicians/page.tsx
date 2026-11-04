import { getTranslations } from 'next-intl/server';
import { getTechnicians } from '@/modules/rpt';
import { listServiceTypes } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { ReportTools } from '../RptActions';
import { Field, FilterForm, hoursOf, Kpi, Kpis, Note, pctOf, RptPage, rptLabels } from '../rptUi';

export const dynamic = 'force-dynamic';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * FR-RPT-006 / 014: hours and finished jobs per technician for orders completed in the period, filterable by service type.
 * Standard hours and worked hours only: the system supplies data, payroll and commission are out of scope.
 */
export default async function TechniciansReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const sp = await searchParams;
  const from = first(sp.from);
  const to = first(sp.to);
  const branchId = first(sp.branchId);
  const serviceType = first(sp.serviceType);
  const l = rptLabels('rep');
  const container = getContainer();
  const res = await load(async () => ({
    report: await getTechnicians(container.rpt, actor, {
      ...(from && ISO.test(from) ? { from } : {}),
      ...(to && ISO.test(to) ? { to } : {}),
      ...(branchId ? { branchId } : {}),
      ...(serviceType ? { serviceType } : {}),
    }),
    types: await listServiceTypes(container.rec, actor).catch(() => []),
  }));
  const head = {
    title: l.techTitle!,
    desc: l.techLead!,
    crumbs: [{ label: t('shell.nav.reports'), href: '/rpt' }],
  };
  if (res.error)
    return (
      <RptPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RptPage>
    );
  const d = res.data.report;
  const r = d.report;
  return (
    <RptPage {...head}>
      <FilterForm
        action="/rpt/technicians"
        branchId={d.branchId}
        applyLabel={rptLabels('common').apply!}
      >
        <Field id="tc-from" label={l.from!}>
          <input className="input" id="tc-from" name="from" type="date" defaultValue={d.from} />
        </Field>
        <Field id="tc-to" label={l.to!}>
          <input className="input" id="tc-to" name="to" type="date" defaultValue={d.to} />
        </Field>
        <Field id="tc-svc" label={l.serviceType!}>
          <select
            className="select"
            id="tc-svc"
            name="serviceType"
            defaultValue={d.serviceType ?? ''}
          >
            <option value="">{l.allServiceTypes}</option>
            {res.data.types.map((x) => (
              <option key={x.code} value={x.code}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <span data-testid="tech-branch">{d.branchName}</span>
      </FilterForm>
      {d.truncated ? <Note tone="warning">{l.techTruncated}</Note> : null}
      <Kpis>
        <Kpi label={l.colJobs!} value={String(r.totals.jobs)} testId="t-jobs" />
        <Kpi
          label={l.colWorked!}
          value={hoursOf(r.totals.workedMinutes)}
          formula={l.fHours!}
          testId="t-worked"
        />
        <Kpi label={l.colStandard!} value={hoursOf(r.totals.standardMinutes)} />
        <Kpi
          label={l.colEfficiency!}
          value={pctOf(r.totals.efficiencyBp)}
          formula={l.fEfficiency!}
          testId="t-eff"
        />
      </Kpis>
      <DataTable<(typeof r.rows)[number]>
        caption={l.techTitle!}
        toolbar={l.techTitle!}
        rows={r.rows}
        rowKey={(x) => x.technicianId ?? 'none'}
        columns={[
          { key: 't', header: l.colTech!, render: (x) => x.technicianName ?? l.unassigned },
          { key: 'j', header: l.colJobs!, numeric: true, render: (x) => x.jobs },
          { key: 'o', header: l.colOrders!, numeric: true, render: (x) => x.orders },
          {
            key: 'w',
            header: l.colWorked!,
            numeric: true,
            render: (x) => hoursOf(x.workedMinutes),
          },
          {
            key: 's',
            header: l.colStandard!,
            numeric: true,
            render: (x) => hoursOf(x.standardMinutes),
          },
          {
            key: 'e',
            header: l.colEfficiency!,
            numeric: true,
            render: (x) => pctOf(x.efficiencyBp),
          },
        ]}
      />
      <DataTable<(typeof r.byServiceType)[number]>
        caption={l.bySvc!}
        toolbar={l.bySvc!}
        rows={r.byServiceType}
        rowKey={(x) => x.serviceType ?? 'none'}
        columns={[
          {
            key: 'n',
            header: l.serviceType!,
            render: (x) =>
              res.data.types.find((s) => s.code === x.serviceType)?.name ?? x.serviceType ?? '—',
          },
          { key: 'j', header: l.colJobs!, numeric: true, render: (x) => x.jobs },
          {
            key: 'w',
            header: l.colWorked!,
            numeric: true,
            render: (x) => hoursOf(x.workedMinutes),
          },
        ]}
      />
      <ReportTools
        body={{
          kind: 'technicians',
          from: d.from,
          to: d.to,
          branchId: d.branchId,
          ...(d.serviceType ? { serviceType: d.serviceType } : {}),
        }}
        labels={l}
        mayExport={d.mayExport}
      />
    </RptPage>
  );
}

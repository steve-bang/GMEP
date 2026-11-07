import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { businessDate, formatDateTime } from '@/platform/format/date';
import { listLaborLines } from '@/modules/hrm';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { money } from '../../rec/format';
import { HrmPage, LINE_TONE, hoursText, hrmLabels } from '../hrmUi';

export const dynamic = 'force-dynamic';

/**
 * G3-HRM-07 / FR-HRM-020: labor lines of the working branch in a date window, by order and item: standard hours, actual
 * hours, converted hours and the labor amount. A technician only sees their own lines (cut on the server). Lines are
 * appended; a cancel or a correction is a new line, never an edit (RULE-010). Commission is not here (slice 2.6b).
 */
export default async function LaborPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const l = hrmLabels('labor');
  const c = hrmLabels('common');
  const today = businessDate(new Date());
  const to = first(sp.to) ?? today;
  const from = first(sp.from);
  const res = await load(() =>
    listLaborLines(getContainer().hrm, actor, { ...(from ? { from } : {}), to }),
  );
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <HrmPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </HrmPage>
    );
  const page = res.data;
  return (
    <HrmPage {...head}>
      <div className="alert alert--warning" role="note">
        <div className="alert__body">{l.sampleNote}</div>
      </div>
      {page.truncated ? (
        <div className="alert alert--warning" role="note">
          <div className="alert__body">{l.truncated}</div>
        </div>
      ) : null}
      <div className="acc-kpis">
        {[
          { label: l.kpiAmount!, value: money(page.totals.amountVnd), id: 'kpi-labor-amount' },
          {
            label: l.kpiAwaiting!,
            value: money(page.totals.awaitingPaymentVnd),
            id: 'kpi-labor-awaiting',
          },
          { label: l.kpiConverted!, value: hoursText(page.totals.convertedMinutes) },
          { label: l.kpiActual!, value: hoursText(page.totals.actualMinutes) },
          { label: l.kpiStandard!, value: hoursText(page.totals.standardMinutes) },
        ].map((k) => (
          <div className="card kpi" key={k.label}>
            <span className="kpi__label">{k.label}</span>
            <span className="kpi__value" data-testid={k.id}>
              {k.value}
            </span>
          </div>
        ))}
      </div>
      <section className="card">
        <div className="card__body">
          <DateFilter
            base="/hrm/labor"
            fields={[
              { name: 'from', label: c.from!, iso: page.from },
              { name: 'to', label: c.to!, iso: page.to },
            ]}
            applyLabel={c.apply!}
            resetLabel={c.reset!}
          />
        </div>
      </section>
      {page.items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable
          caption={l.title!}
          rows={page.items}
          rowKey={(x) => x.id}
          toolbar={l.count!.replace('{n}', String(page.items.length))}
          columns={[
            {
              key: 'o',
              header: l.colOrder!,
              render: (x) => (
                <Link className="code" href={`/rec/orders/${encodeURIComponent(x.orderId)}`}>
                  {x.orderNumber}
                </Link>
              ),
            },
            { key: 'i', header: l.colItem!, render: (x) => x.itemName },
            { key: 't', header: l.colTechnician!, render: (x) => x.technicianName ?? '–' },
            {
              key: 'sh',
              header: l.colStandard!,
              numeric: true,
              render: (x) => hoursText(x.standardMinutes),
            },
            {
              key: 'ah',
              header: l.colActual!,
              numeric: true,
              render: (x) => hoursText(x.actualMinutes),
            },
            {
              key: 'ch',
              header: l.colConverted!,
              numeric: true,
              render: (x) => (x.convertedMinutes === null ? '–' : hoursText(x.convertedMinutes)),
            },
            { key: 'am', header: l.colAmount!, numeric: true, render: (x) => money(x.amountVnd) },
            {
              key: 's',
              header: l.colStatus!,
              render: (x) => (
                <span className="rec-chips">
                  <StatusBadge tone={LINE_TONE[x.status] ?? 'neutral'}>
                    {l[`status_${x.status}`]}
                  </StatusBadge>
                  {x.kind === 'adjustment' ? (
                    <span className="tag">{l.kind_adjustment}</span>
                  ) : null}
                  {x.kind === 'reversal' ? <span className="tag">{l.kind_reversal}</span> : null}
                  {x.warnings.map((w) => (
                    <span className="tag tag--warning" key={w}>
                      {l[`warning_${w}`]}
                    </span>
                  ))}
                </span>
              ),
            },
            {
              key: 'w',
              header: l.colWhen!,
              render: (x) => formatDateTime(new Date(x.at)),
            },
          ]}
        />
      )}
    </HrmPage>
  );
}

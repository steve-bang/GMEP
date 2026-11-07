import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { isoToVi } from '@/platform/format/date';
import { getEmployee, type EmployeePiiField } from '@/modules/hrm';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EMPLOYEE_TONE, HrmPage, hrmLabels } from '../../hrmUi';
import { RevealEmployeeField } from '../RevealEmployeeField';

export const dynamic = 'force-dynamic';

const FIELDS: EmployeePiiField[] = ['phone', 'nationalId', 'address', 'birthDate'];

/** G3-HRM-02 / FR-HRM-001: one staff record, read only here. Opening it is written to the access log when it shows personal data. */
export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const l = hrmLabels('employees');
  const d = hrmLabels('detail');
  const requestId = (await headers()).get('x-request-id') ?? 'page';
  const res = await load(() => getEmployee(getContainer().hrm, actor, id, { requestId }));
  if (res.error)
    return (
      <HrmPage title={d.title!} crumbs={[{ label: l.title!, href: '/hrm/employees' }]}>
        <ErrorFor error={res.error} t={t} />
      </HrmPage>
    );
  const e = res.data;
  return (
    <HrmPage
      title={e.fullName}
      desc={`${e.code} · ${e.positionCode}`}
      crumbs={[{ label: l.title!, href: '/hrm/employees' }]}
      actions={
        <StatusBadge tone={EMPLOYEE_TONE[e.status] ?? 'neutral'}>
          {l[`status_${e.status}`]}
        </StatusBadge>
      }
    >
      <section className="card">
        <div className="card__body stack">
          <h2>{d.personal}</h2>
          <p className="text-secondary">{d.personalNote}</p>
          <dl className="stack-2">
            {FIELDS.map((f) => {
              const p = e.pii[f];
              if (!p) return null;
              return (
                <div key={f}>
                  <dt className="text-secondary">{d[`field_${f}`]}</dt>
                  <dd>
                    {p.value === undefined ? (
                      <span>{d.hidden}</span>
                    ) : (
                      <RevealEmployeeField
                        employeeId={e.id}
                        field={f}
                        value={p.value}
                        reveal={p.reveal}
                        labels={{ show: d.reveal!, hide: d.hide!, failed: d.revealFailed! }}
                      />
                    )}
                  </dd>
                </div>
              );
            })}
            <div>
              <dt className="text-secondary">{d.joined}</dt>
              <dd>{isoToVi(e.joinedOn)}</dd>
            </div>
            {e.leftOn ? (
              <div>
                <dt className="text-secondary">{d.left}</dt>
                <dd>{isoToVi(e.leftOn)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-secondary">{d.account}</dt>
              <dd>{e.userLinked ? l.linked : l.notLinked}</dd>
            </div>
          </dl>
        </div>
      </section>
      <DataTable
        caption={d.history!}
        rows={e.positions}
        rowKey={(p) => `${p.positionCode}-${p.from}`}
        toolbar={<strong>{d.history}</strong>}
        footer={<span className="table-meta">{d.historyNote}</span>}
        columns={[
          { key: 'p', header: l.colPosition!, render: (p) => p.positionCode },
          { key: 'f', header: d.from!, numeric: true, render: (p) => isoToVi(p.from) },
          {
            key: 't',
            header: d.to!,
            numeric: true,
            render: (p) => (p.to ? isoToVi(p.to) : d.current),
          },
        ]}
      />
      {e.certificates.length > 0 ? (
        <DataTable
          caption={d.certificates!}
          rows={e.certificates}
          rowKey={(c) => c.name}
          toolbar={<strong>{d.certificates}</strong>}
          columns={[
            { key: 'n', header: d.certName!, render: (c) => c.name },
            { key: 'i', header: d.certIssuer!, render: (c) => c.issuer ?? '–' },
            {
              key: 'x',
              header: d.certExpires!,
              numeric: true,
              render: (c) => isoToVi(c.expiresOn) || '–',
            },
          ]}
        />
      ) : null}
    </HrmPage>
  );
}

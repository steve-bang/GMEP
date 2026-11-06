import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { isoToVi } from '@/platform/format/date';
import { listEmployees } from '@/modules/hrm';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EMPLOYEE_TONE, HrmPage, hrmLabels } from '../hrmUi';

export const dynamic = 'force-dynamic';

/**
 * G3-HRM-01 / FR-HRM-001: staff of the working branch. The record serves assigning work and recording hours; it holds
 * no salary, bank or insurance data. Personal data is already cut on the server by role (ba-answers-04 Phụ lục D).
 */
export default async function EmployeesPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const l = hrmLabels('employees');
  const res = await load(() => listEmployees(getContainer().hrm, actor));
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <HrmPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </HrmPage>
    );
  const { items, truncated } = res.data;
  return (
    <HrmPage {...head}>
      {truncated ? (
        <div className="alert alert--warning" role="note">
          <div className="alert__body">{l.truncated}</div>
        </div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable
          caption={l.title!}
          rows={items}
          rowKey={(e) => e.id}
          toolbar={l.count!.replace('{n}', String(items.length))}
          columns={[
            { key: 'c', header: l.colCode!, render: (e) => <span className="code">{e.code}</span> },
            {
              key: 'n',
              header: l.colName!,
              render: (e) => (
                <Link href={`/hrm/employees/${encodeURIComponent(e.id)}`}>{e.fullName}</Link>
              ),
            },
            { key: 'p', header: l.colPosition!, render: (e) => e.positionCode },
            {
              key: 's',
              header: l.colStatus!,
              render: (e) => (
                <StatusBadge tone={EMPLOYEE_TONE[e.status] ?? 'neutral'}>
                  {l[`status_${e.status}`]}
                </StatusBadge>
              ),
            },
            { key: 'j', header: l.colJoined!, numeric: true, render: (e) => isoToVi(e.joinedOn) },
            {
              key: 'ph',
              header: l.colPhone!,
              render: (e) => (e.pii.phone?.value !== undefined ? e.pii.phone.value : '–'),
            },
            {
              key: 'a',
              header: l.colAccount!,
              render: (e) => (e.userLinked ? l.linked : l.notLinked),
            },
          ]}
        />
      )}
    </HrmPage>
  );
}

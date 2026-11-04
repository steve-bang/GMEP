import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { isClosed, getDataRequest, type RequestStatus } from '@/modules/crm';
import { listUsers } from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { CrmPage } from '../../CrmPage';

export const dynamic = 'force-dynamic';

/** FR-CRM-011: one request; assign (received -> in progress) and close with a result. */
export default async function DataRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const crm = getContainer().crm;
  const crumbs = [{ label: t('crm.requests.title'), href: '/crm/data-requests' }];
  const canUpdate = hasPermission(actor, 'data-request:update');
  const res = await load(async () => {
    resolveScope(actor, 'data-request:view');
    const r = await getDataRequest(crm, actor, id);
    let assignees: { id: string; name: string }[] = [{ id: actor.userId, name: actor.displayName }];
    if (canUpdate && hasPermission(actor, 'user:view')) {
      const users = await listUsers(crm.sys, actor, { limit: 100 }).catch(() => null);
      if (users)
        assignees = users.items
          .filter((u) => u.status === 'active')
          .map((u) => ({ id: u.id, name: `${u.displayName} · ${u.employeeCode}` }));
    }
    return { r, assignees };
  });
  if (res.error)
    return (
      <CrmPage title={t('crm.requests.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  const { r, assignees } = res.data;
  const closed = isClosed(r.status as RequestStatus);
  return (
    <CrmPage title={r.code} desc={t(`crm.requests.types.${r.type}`)} crumbs={crumbs}>
      <section className="card" style={{ padding: 'var(--space-6)' }} aria-labelledby="req-h">
        <h2 id="req-h">{t('crm.requests.detail')}</h2>
        <dl className="stack-2" data-testid="request-detail">
          <div>
            <dt className="text-secondary">{t('crm.requests.colStatus')}</dt>
            <dd>
              <StatusBadge
                tone={
                  r.status === 'completed'
                    ? 'success'
                    : r.status === 'rejected'
                      ? 'neutral'
                      : 'info'
                }
              >
                {t(`crm.requests.statuses.${r.status}`)}
              </StatusBadge>
              {r.overdue ? (
                <StatusBadge tone="danger">{t('crm.requests.overdue')}</StatusBadge>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-secondary">{t('crm.requests.colCustomer')}</dt>
            <dd>
              <Link href={`/crm/customers/${encodeURIComponent(r.customerId)}`}>
                {r.customerName ?? r.customerId}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-secondary">{t('crm.requests.received')}</dt>
            <dd>{formatDateTime(new Date(r.receivedAt))}</dd>
          </div>
          <div>
            <dt className="text-secondary">{t('crm.requests.colDue')}</dt>
            <dd>{formatDateTime(new Date(r.internalDueAt))}</dd>
          </div>
          <div>
            <dt className="text-secondary">{t('crm.requests.colLegalDue')}</dt>
            <dd>
              {r.legalDueAt
                ? formatDateTime(new Date(r.legalDueAt))
                : t('crm.requests.legalDueBlank')}
              {r.legallyOverdue ? (
                <StatusBadge tone="danger">{t('crm.requests.legallyOverdue')}</StatusBadge>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-secondary">{t('crm.requests.colAssignee')}</dt>
            <dd>{r.assigneeName ?? '—'}</dd>
          </div>
          {r.note ? (
            <div>
              <dt className="text-secondary">{t('crm.requests.note')}</dt>
              <dd>{r.note}</dd>
            </div>
          ) : null}
          {r.resultNote ? (
            <div>
              <dt className="text-secondary">{t('crm.requests.result')}</dt>
              <dd>{r.resultNote}</dd>
            </div>
          ) : null}
          {r.anonymizedAt ? (
            <div>
              <dt className="text-secondary">{t('crm.requests.anonymized')}</dt>
              <dd>{formatDateTime(new Date(r.anonymizedAt))}</dd>
            </div>
          ) : null}
        </dl>
      </section>
      {canUpdate && !closed ? (
        <section
          className="card stack"
          style={{ padding: 'var(--space-6)' }}
          aria-labelledby="act-h"
        >
          <h2 id="act-h">{t('crm.requests.actions')}</h2>
          <ResourceForm
            testId="assign-form"
            endpoint={`/api/v1/crm/data-requests/${encodeURIComponent(r.id)}/assign`}
            extra={{ version: r.version }}
            labels={formLabels(t, 'crm.requests.assign', false)}
            fields={[
              {
                name: 'assigneeId',
                label: t('crm.requests.colAssignee'),
                type: 'select',
                required: true,
                defaultValue: r.assigneeId ?? actor.userId,
                options: assignees.map((a) => ({ value: a.id, label: a.name })),
              },
            ]}
          />
          <ResourceForm
            testId="close-form"
            endpoint={`/api/v1/crm/data-requests/${encodeURIComponent(r.id)}/close`}
            extra={{ version: r.version }}
            labels={formLabels(t, 'crm.requests.close', false)}
            fields={[
              {
                name: 'outcome',
                label: t('crm.requests.outcome'),
                type: 'select',
                required: true,
                defaultValue: 'completed',
                options: [
                  { value: 'completed', label: t('crm.requests.statuses.completed') },
                  { value: 'rejected', label: t('crm.requests.statuses.rejected') },
                ],
              },
              {
                name: 'resultNote',
                label: t('crm.requests.result'),
                type: 'textarea',
                required: true,
                maxLength: 500,
                hint: t('crm.requests.resultHint'),
              },
            ]}
          />
        </section>
      ) : null}
    </CrmPage>
  );
}

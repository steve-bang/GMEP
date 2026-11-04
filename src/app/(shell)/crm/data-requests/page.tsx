import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDate } from '@/platform/format/date';
import { hasPermission, resolveWorkingScope } from '@/platform/rbac/rbac';
import { getCustomer, listCustomers, listDataRequests } from '@/modules/crm';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, Pager, ScopeLine, type SearchParams } from '@/ui/components/PageParts';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { CrmPage } from '../CrmPage';

export const dynamic = 'force-dynamic';

const TONE = {
  received: 'info',
  in_progress: 'warning',
  completed: 'success',
  rejected: 'neutral',
} as const;

/** G2-CRM-11 / FR-CRM-011: data-subject requests with assignee, deadline and result. */
export default async function DataRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const status = first(sp.status);
  const customerId = first(sp.customerId);
  const cursor = first(sp.cursor);
  const { actor, sessionId } = await requireSession();
  const crm = getContainer().crm;
  const head = { title: t('crm.requests.title'), desc: t('crm.requests.lead') };
  const canCreate = hasPermission(actor, 'data-request:create');
  const res = await load(async () => {
    const scope = resolveWorkingScope(actor, 'data-request:view');
    const page = await listDataRequests(crm, actor, {
      limit: 25,
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const branches = await crm.sys.branches.list(scope);
    const customers = canCreate
      ? customerId
        ? [await getCustomer(crm, actor, customerId, { requestId: 'page', sessionId })]
        : (await listCustomers(crm, actor, { limit: 100 })).items.filter(
            (c) => c.status === 'active',
          )
      : [];
    return { page, branches, scope, customers };
  });
  if (res.error)
    return (
      <CrmPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  const { page, branches, scope, customers } = res.data;
  return (
    <CrmPage {...head}>
      <ScopeLine
        text={t('crm.scopeLine', {
          scope:
            scope.kind === 'all' ? t('shell.scopeAll') : branches.map((b) => b.name).join(', '),
        })}
      />
      <form method="get" role="search" className="filter-bar" action="/crm/data-requests">
        <div className="field">
          <label className="field__label" htmlFor="status">
            {t('crm.requests.colStatus')}
          </label>
          <select className="select" id="status" name="status" defaultValue={status ?? ''}>
            <option value="">{t('common.all')}</option>
            {['received', 'in_progress', 'completed', 'rejected'].map((s) => (
              <option key={s} value={s}>
                {t(`crm.requests.statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-bar__actions">
          <button type="submit" className="btn btn--primary">
            {t('crm.apply')}
          </button>
        </div>
      </form>
      {page.items.length === 0 ? (
        <EmptyState title={t('crm.requests.emptyTitle')} text={t('crm.requests.emptyText')} />
      ) : (
        <DataTable
          caption={t('crm.requests.title')}
          rows={page.items}
          rowKey={(r) => r.id}
          columns={[
            {
              key: 'code',
              header: t('crm.requests.colCode'),
              render: (r) => (
                <Link
                  href={`/crm/data-requests/${encodeURIComponent(r.id)}`}
                  data-testid="request-code"
                >
                  {r.code}
                </Link>
              ),
            },
            {
              key: 'customer',
              header: t('crm.requests.colCustomer'),
              render: (r) => r.customerName ?? '—',
            },
            {
              key: 'type',
              header: t('crm.requests.colType'),
              render: (r) => t(`crm.requests.types.${r.type}`),
            },
            {
              key: 'status',
              header: t('crm.requests.colStatus'),
              render: (r) => (
                <StatusBadge tone={TONE[r.status as keyof typeof TONE]}>
                  {t(`crm.requests.statuses.${r.status}`)}
                </StatusBadge>
              ),
            },
            {
              key: 'due',
              header: t('crm.requests.colDue'),
              render: (r) => (
                <span>
                  {formatDate(new Date(r.dueAt))}
                  {r.overdue ? (
                    <StatusBadge tone="danger">{t('crm.requests.overdue')}</StatusBadge>
                  ) : null}
                </span>
              ),
            },
            {
              key: 'assignee',
              header: t('crm.requests.colAssignee'),
              render: (r) => r.assigneeName ?? '—',
            },
          ]}
        />
      )}
      <Pager
        base="/crm/data-requests"
        query={{ ...(status ? { status } : {}), ...(customerId ? { customerId } : {}) }}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('crm.prev'), next: t('crm.next'), aria: t('common.pagination') }}
      />
      {canCreate ? (
        <section
          id="new"
          className="card stack"
          style={{ padding: 'var(--space-6)' }}
          aria-labelledby="new-h"
        >
          <h2 id="new-h">{t('crm.requests.create')}</h2>
          <p className="text-secondary">{t('crm.requests.createLead')}</p>
          <ResourceForm
            testId="request-form"
            endpoint="/api/v1/crm/data-requests"
            labels={formLabels(t, 'crm.requests.save', false)}
            fields={[
              {
                name: 'customerId',
                label: t('crm.requests.colCustomer'),
                type: 'select',
                required: true,
                ...(customerId ? { defaultValue: customerId } : {}),
                options: customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.code}` })),
              },
              {
                name: 'type',
                label: t('crm.requests.colType'),
                type: 'select',
                required: true,
                defaultValue: 'view',
                options: ['view', 'correct', 'delete'].map((x) => ({
                  value: x,
                  label: t(`crm.requests.types.${x}`),
                })),
              },
              {
                name: 'receivedVia',
                label: t('crm.requests.via'),
                type: 'select',
                required: true,
                defaultValue: 'in_person',
                options: ['in_person', 'phone', 'email', 'web'].map((x) => ({
                  value: x,
                  label: t(`crm.requests.vias.${x}`),
                })),
              },
              {
                name: 'note',
                label: t('crm.requests.note'),
                type: 'textarea',
                maxLength: 300,
                hint: t('crm.requests.noteHint'),
              },
            ]}
          />
        </section>
      ) : null}
    </CrmPage>
  );
}

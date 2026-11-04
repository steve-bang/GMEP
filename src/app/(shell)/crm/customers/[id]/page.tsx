import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDate, formatDateTime } from '@/platform/format/date';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import {
  getCustomer,
  listConsents,
  listCustomerVehicles,
  listDataRequests,
  type CustomerDto,
} from '@/modules/crm';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { RevealField } from '@/ui/components/RevealField';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { CrmPage } from '../../CrmPage';
import { revealLabels } from '../../revealLabels';
import { ConsentPanel } from './ConsentPanel';

export const dynamic = 'force-dynamic';

const TABS = ['vehicles', 'consent', 'requests'] as const;

/** G2-CRM-03 / FR-CRM-001, 010, 011, 014: customer profile; contact data is masked per role with "Hiện". */
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const t = await getTranslations();
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(first(sp.tab) ?? '')
    ? (first(sp.tab) as (typeof TABS)[number])
    : 'vehicles';
  const { actor, sessionId } = await requireSession();
  const crm = getContainer().crm;
  const crumbs = [{ label: t('crm.customers.title'), href: '/crm/customers' }];

  const res = await load(async () => {
    const customer = await getCustomer(crm, actor, id, { requestId: 'page', sessionId });
    const can = (p: `${string}:view`) => hasPermission(actor, p);
    const [vehicles, consents, requests] = await Promise.all([
      can('vehicle:view') ? listCustomerVehicles(crm, actor, id) : Promise.resolve([]),
      can('consent:view') ? listConsents(crm, actor, id) : Promise.resolve([]),
      can('data-request:view')
        ? listDataRequests(crm, actor, { customerId: id, limit: 25 }).then((p) => p.items)
        : Promise.resolve([]),
    ]);
    const branches = await crm.sys.branches.list(resolveScope(actor, 'customer:view'));
    return { customer, vehicles, consents, requests, branches };
  });
  if (res.error)
    return (
      <CrmPage title={t('crm.customers.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  const { customer: c, vehicles, consents, requests } = res.data;
  const anonymized = c.status === 'anonymized';
  const tabLink = (k: (typeof TABS)[number], label: string, count?: number) => (
    <Link
      key={k}
      className="tab"
      href={{ pathname: `/crm/customers/${encodeURIComponent(id)}`, query: { tab: k } }}
      aria-current={tab === k ? 'page' : undefined}
    >
      {label}
      {count !== undefined ? <span className="count-pill">{count}</span> : null}
    </Link>
  );
  const pii = (field: 'phone' | 'email' | 'address', p: CustomerDto['phone']) =>
    p.value === undefined ? (
      <span className="text-secondary">{p.masked ? t('crm.customers.hidden') : '—'}</span>
    ) : (
      <RevealField
        entityType="customer"
        entityId={c.id}
        field={field}
        value={p.value}
        reveal={p.reveal}
        labels={revealLabels(t)}
      />
    );

  return (
    <CrmPage
      title={c.name}
      desc={`${c.code} · ${t(`crm.type.${c.type}`)}${c.taxCode ? ` · ${t('crm.customers.taxCode')} ${c.taxCode}` : ''}`}
      crumbs={crumbs}
      actions={
        <>
          {!anonymized && hasPermission(actor, 'vehicle:create') ? (
            <Link
              className="btn btn--secondary"
              href={`/crm/vehicles/new?customerId=${encodeURIComponent(c.id)}`}
            >
              {t('crm.vehicles.create')}
            </Link>
          ) : null}
          {!anonymized && hasPermission(actor, 'customer:update') ? (
            <Link
              className="btn btn--primary"
              href={`/crm/customers/${encodeURIComponent(c.id)}/edit`}
            >
              {t('crm.customers.edit')}
            </Link>
          ) : null}
        </>
      }
    >
      <p>
        <StatusBadge tone={anonymized ? 'neutral' : 'success'}>
          {t(`crm.customerStatus.${c.status}`)}
        </StatusBadge>{' '}
        {c.labels.map((l) => (
          <span key={l} className="tag">
            {t(`crm.labels.${l}`)}
          </span>
        ))}
      </p>
      <section className="card" aria-labelledby="contact-h" style={{ padding: 'var(--space-6)' }}>
        <h2 id="contact-h">{t('crm.customers.contact')}</h2>
        <dl className="stack-2" data-testid="customer-contact">
          <div>
            <dt className="text-secondary">{t('crm.customers.phone')}</dt>
            <dd>{pii('phone', c.phone)}</dd>
          </div>
          <div>
            <dt className="text-secondary">{t('crm.customers.email')}</dt>
            <dd>{pii('email', c.email)}</dd>
          </div>
          <div>
            <dt className="text-secondary">{t('crm.customers.address')}</dt>
            <dd>{pii('address', c.address)}</dd>
          </div>
          {c.contactName ? (
            <div>
              <dt className="text-secondary">{t('crm.customers.contactName')}</dt>
              <dd>{c.contactName}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="card" aria-label={t('crm.customers.tabs')}>
        <nav
          className="tabs"
          aria-label={t('crm.customers.tabs')}
          style={{ padding: '0 var(--space-6)' }}
        >
          {tabLink('vehicles', t('crm.customers.tabVehicles'), vehicles.length)}
          {hasPermission(actor, 'consent:view')
            ? tabLink('consent', t('crm.customers.tabConsent'), consents.length)
            : null}
          {hasPermission(actor, 'data-request:view')
            ? tabLink('requests', t('crm.customers.tabRequests'), requests.length)
            : null}
        </nav>
        <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
          {tab === 'vehicles' ? (
            vehicles.length === 0 ? (
              <EmptyState
                title={t('crm.customers.noVehiclesTitle')}
                text={t('crm.customers.noVehiclesText')}
              />
            ) : (
              <>
                <div className="g2w-two" data-testid="customer-vehicles">
                  {vehicles.map((v) => (
                    <div className="card vehicle-card" key={v.id}>
                      <div className="vehicle-card__icon">
                        <svg className="icon" aria-hidden="true">
                          <use href="/icons.svg#car-front" />
                        </svg>
                      </div>
                      <div>
                        <Link
                          className="plate-tag"
                          href={`/crm/vehicles/${encodeURIComponent(v.id)}`}
                        >
                          {v.plate}
                        </Link>
                        <div className="vehicle-card__title">
                          {v.make} {v.model} {v.year}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-secondary">{t('crm.customers.vehiclesNote')}</p>
              </>
            )
          ) : null}
          {tab === 'consent' ? (
            <ConsentPanel
              customerId={c.id}
              canWrite={!anonymized && hasPermission(actor, 'consent:create')}
              canWithdraw={hasPermission(actor, 'consent:update')}
              rows={consents.map((x) => ({
                ...x,
                grantedLabel: formatDateTime(new Date(x.grantedAt)),
                withdrawnLabel: x.withdrawnAt ? formatDateTime(new Date(x.withdrawnAt)) : null,
                purposeLabel: t(`crm.consent.purposes.${x.purpose}`),
                channelLabel: t(`crm.consent.channels.${x.channel}`),
                basisLabel: t(`crm.consent.bases.${x.basis}`),
                statusLabel: t(`crm.consent.status.${x.status}`),
              }))}
              purposes={['service', 'reminder', 'marketing', 'sharing'].map((p) => ({
                value: p,
                label: t(`crm.consent.purposes.${p}`),
              }))}
              channels={['in_person', 'zalo', 'sms', 'email', 'phone', 'web'].map((p) => ({
                value: p,
                label: t(`crm.consent.channels.${p}`),
              }))}
              bases={['consent', 'contract', 'legal_obligation', 'legitimate_interest'].map(
                (p) => ({ value: p, label: t(`crm.consent.bases.${p}`) }),
              )}
              labels={{
                title: t('crm.consent.title'),
                empty: t('crm.consent.empty'),
                purpose: t('crm.consent.purpose'),
                channel: t('crm.consent.channel'),
                basis: t('crm.consent.basis'),
                evidence: t('crm.consent.evidence'),
                evidenceHint: t('crm.consent.evidenceHint'),
                granted: t('crm.consent.granted'),
                statusCol: t('crm.consent.statusCol'),
                withdraw: t('crm.consent.withdraw'),
                withdrawConfirm: t('crm.consent.withdrawConfirm'),
                withdrawn: t('crm.consent.withdrawnAt'),
                record: t('crm.consent.record'),
                marketingNote: t('crm.consent.marketingNote'),
                error: t('common.unexpected'),
                formLabels: {
                  submit: t('crm.consent.record'),
                  offline: t('common.offlineAction'),
                  errorSummary: t('common.errorSummary', { count: '{count}' }),
                  rateLimited: t('common.rateLimited', { time: '{time}' }),
                  versionConflict: t('common.versionConflict'),
                  unexpected: t('common.unexpected'),
                },
              }}
            />
          ) : null}
          {tab === 'requests' ? (
            <>
              {hasPermission(actor, 'data-request:create') && !anonymized ? (
                <p>
                  <Link
                    className="btn btn--secondary"
                    href={`/crm/data-requests?customerId=${encodeURIComponent(c.id)}#new`}
                  >
                    {t('crm.requests.create')}
                  </Link>
                </p>
              ) : null}
              {requests.length === 0 ? (
                <EmptyState
                  title={t('crm.requests.emptyTitle')}
                  text={t('crm.requests.emptyText')}
                />
              ) : (
                <DataTable
                  caption={t('crm.requests.title')}
                  rows={requests}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      key: 'code',
                      header: t('crm.requests.colCode'),
                      render: (r) => (
                        <Link href={`/crm/data-requests/${encodeURIComponent(r.id)}`}>
                          {r.code}
                        </Link>
                      ),
                    },
                    {
                      key: 'type',
                      header: t('crm.requests.colType'),
                      render: (r) => t(`crm.requests.types.${r.type}`),
                    },
                    {
                      key: 'status',
                      header: t('crm.requests.colStatus'),
                      render: (r) => t(`crm.requests.statuses.${r.status}`),
                    },
                    {
                      key: 'due',
                      header: t('crm.requests.colDue'),
                      render: (r) => formatDate(new Date(r.dueAt)),
                    },
                  ]}
                />
              )}
            </>
          ) : null}
        </div>
      </section>
    </CrmPage>
  );
}

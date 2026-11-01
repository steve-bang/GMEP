import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasPermission } from '@/platform/rbac/rbac';
import { businessDateOf } from '@/platform/effective/effective';
import { CONFIG_TYPES, listConfigVersions } from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, PageHeader, Pager, type SearchParams } from '@/ui/components/PageParts';
import { ProposeConfigForm } from './ProposeConfigForm';
import { DecideButtons } from './DecideButtons';

export const dynamic = 'force-dynamic';

const TONE = { pending: 'warning', approved: 'success', rejected: 'danger' } as const;

/** Per-type payload fields shown in the propose form (the server validates with the type's zod schema). */
const PAYLOAD_FIELDS: Record<
  string,
  { name: string; kind: 'text' | 'int' | 'select'; options?: string[] }[]
> = {
  'tax-rate': [
    { name: 'name', kind: 'text' },
    { name: 'rateBp', kind: 'int' },
  ],
  'labor-rate': [{ name: 'hourlyRateVnd', kind: 'int' }],
  'standard-hours': [{ name: 'standardMinutes', kind: 'int' }],
  'discount-limit': [
    { name: 'role', kind: 'text' },
    { name: 'maxBp', kind: 'int' },
  ],
  'price-item': [
    { name: 'name', kind: 'text' },
    { name: 'costVnd', kind: 'int' },
    { name: 'listPriceVnd', kind: 'int' },
  ],
  'doc-template': [
    { name: 'name', kind: 'text' },
    {
      name: 'kind',
      kind: 'select',
      options: [
        'quote',
        'repair-order',
        'receipt',
        'stock-doc',
        'handover',
        'notification',
        'other',
      ],
    },
    { name: 'paper', kind: 'select', options: ['A4', 'A5', 'thermal80', 'thermal58'] },
  ],
  'numbering-series': [
    { name: 'prefix', kind: 'text' },
    { name: 'group', kind: 'select', options: ['A', 'B'] },
    { name: 'gapPolicy', kind: 'select', options: ['strict', 'relaxed'] },
    { name: 'scope', kind: 'select', options: ['branch', 'legalEntity'] },
    { name: 'period', kind: 'select', options: ['month', 'year', 'none'] },
    { name: 'seqWidth', kind: 'int' },
  ],
};

export default async function ConfigTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: SearchParams;
}) {
  const t = await getTranslations();
  const { type } = await params;
  if (!(type in CONFIG_TYPES)) notFound();
  const cursor = first((await searchParams).cursor);
  const { actor } = await requireSession();
  const deps = getContainer().sys;
  const res = await load(() =>
    listConfigVersions(deps, actor, type, { limit: 25, ...(cursor ? { cursor } : {}) }),
  );
  const header = (
    <PageHeader
      title={t(`config.types.${type}.title`)}
      lead={t(`config.types.${type}.lead`)}
      actions={
        <Link className="btn btn--ghost" href="/sys/config">
          {t('common.back')}
        </Link>
      }
    />
  );
  if (res.error)
    return (
      <>
        {header}
        <ErrorFor error={res.error} t={t} />
      </>
    );
  const resource = CONFIG_TYPES[type]!.resource;
  const canPropose = hasPermission(actor, `${resource}:update` as 'x:update');
  const canDecide = hasPermission(actor, `${resource}:approve` as 'x:approve');
  const today = businessDateOf(deps.clock.now());
  return (
    <>
      {header}
      <p className="text-secondary">{t('config.sampleWarning')}</p>
      {res.data.items.length === 0 ? (
        <EmptyState title={t('config.emptyTitle')} text={t('config.emptyText')} />
      ) : (
        <DataTable
          caption={t(`config.types.${type}.title`)}
          rows={res.data.items}
          rowKey={(v) => v.id}
          columns={[
            {
              key: 'scope',
              header: t('config.colScope'),
              render: (v) => <span data-testid="cfg-scope">{v.scopeKey}</span>,
            },
            {
              key: 'from',
              header: t('config.colFrom'),
              render: (v) => v.effectiveFrom.split('-').reverse().join('/'),
            },
            {
              key: 'payload',
              header: t('config.colValue'),
              render: (v) => <code>{JSON.stringify(v.payload)}</code>,
            },
            {
              key: 'status',
              header: t('config.colStatus'),
              render: (v) => (
                <StatusBadge tone={TONE[v.status as keyof typeof TONE]}>
                  {t(`config.status.${v.status}`)}
                </StatusBadge>
              ),
            },
            {
              key: 'act',
              header: '',
              render: (v) =>
                v.status === 'pending' && canDecide ? (
                  <DecideButtons
                    type={type}
                    id={v.id}
                    own={v.proposedBy === actor.userId}
                    labels={{
                      approve: t('config.approve'),
                      reject: t('config.reject'),
                      password: t('config.reauthPassword'),
                      unexpected: t('common.unexpected'),
                    }}
                  />
                ) : null,
            },
          ]}
        />
      )}
      <Pager
        base={`/sys/config/${type}`}
        query={{}}
        {...(cursor ? { cursor } : {})}
        next={res.data.nextCursor}
        labels={{
          prev: t('warehouses.prev'),
          next: t('warehouses.next'),
          aria: t('common.pagination'),
        }}
      />
      {canPropose ? (
        <section aria-labelledby="prop-h" className="g1-auth-card g1-auth-card--wide">
          <h2 id="prop-h">{t('config.propose')}</h2>
          <ProposeConfigForm
            type={type}
            today={today}
            fields={PAYLOAD_FIELDS[type] ?? []}
            labels={formLabels(t, 'config.submit', false)}
            text={{
              scopeKey: t('config.colScope'),
              effectiveFrom: t('config.colFrom'),
              dateHint: t('common.dateFormat'),
              dateInvalid: t('common.dateInvalid'),
              reason: t('config.reason'),
              scopeHint: t(`config.types.${type}.scopeHint`),
              fields: Object.fromEntries(
                (PAYLOAD_FIELDS[type] ?? []).map((f) => [f.name, t(`config.fields.${f.name}`)]),
              ),
            }}
          />
        </section>
      ) : null}
    </>
  );
}

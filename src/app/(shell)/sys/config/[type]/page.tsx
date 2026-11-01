import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { businessDateOf } from '@/platform/effective/effective';
import { isoToVi } from '@/platform/format/date';
import {
  CONFIG_TYPES,
  ROLE_CODES,
  ROLE_NAMES,
  listConfigVersions,
  listServices,
} from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { Icon } from '@/ui/components/Icon';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor } from '@/ui/components/PageParts';
import { SettingsPage } from '../../SettingsPage';
import { PAYLOAD_FIELDS, STATUS_TONE, describeValue, viewStatuses } from '../configView';
import { ProposeConfigForm, type F } from './ProposeConfigForm';
import { DecideButtons } from './DecideButtons';

export const dynamic = 'force-dynamic';

/** FR-SYS-004 / G4-SYS-07, 09, 10, 12: versions of one effective-dated configuration type. */
export default async function ConfigTypePage({ params }: { params: Promise<{ type: string }> }) {
  const t = await getTranslations();
  const { type } = await params;
  if (!(type in CONFIG_TYPES)) notFound();
  const { actor } = await requireSession();
  const deps = getContainer().sys;
  const def = CONFIG_TYPES[type]!;
  const res = await load(async () => {
    const versions = await listConfigVersions(deps, actor, type, { limit: 100 });
    const branches = def.branchOverride
      ? await deps.branches.list(resolveScope(actor, `${def.resource}:view` as 'x:view'))
      : [];
    const services =
      type === 'standard-hours' ? (await listServices(deps, actor, { limit: 100 })).items : [];
    return { versions, branches, services };
  });
  const code = t.has(`config.codes.${type}`) ? t(`config.codes.${type}`) : undefined;
  const head = {
    current: `config:${type}`,
    ...(code ? { code } : {}),
    title: t(`config.types.${type}.title`),
    desc: t(`config.types.${type}.lead`),
    scopeText: t('settings.scopeCompany'),
  };
  if (res.error)
    return (
      <SettingsPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  const { versions, branches, services } = res.data;
  const items = versions.items;
  const canPropose = hasPermission(actor, `${def.resource}:update` as 'x:update');
  const canDecide = hasPermission(actor, `${def.resource}:approve` as 'x:approve');
  const today = businessDateOf(deps.clock.now());
  const status = viewStatuses(items, today);
  const scopeName = (key: string) => {
    if (key === 'company') return t('config.scopeCompany');
    const b = /^branch:(.+)$/.exec(key);
    if (b)
      return t('config.scopeBranch', { name: branches.find((x) => x.id === b[1])?.name ?? b[1]! });
    const s = /^service:(.+)$/.exec(key);
    if (s)
      return t('config.scopeService', {
        name: services.find((x) => x.code === s[1])?.name ?? s[1]!,
      });
    return key;
  };
  const enumOptions = (name: string, values: string[]) =>
    values.map((v) => ({ value: v, label: t(`config.enums.${name}.${v}`) }));
  const fields: F[] = (PAYLOAD_FIELDS[type] ?? []).map((f) => ({
    name: f.name,
    kind: f.kind,
    ...(f.name === 'role'
      ? { options: ROLE_CODES.map((r) => ({ value: r, label: ROLE_NAMES[r] })) }
      : f.options
        ? { options: enumOptions(f.name, f.options) }
        : {}),
  }));
  const scopeOptions =
    type === 'labor-rate' || type === 'discount-limit'
      ? [
          { value: 'company', label: t('config.scopeCompany') },
          ...branches.map((b) => ({
            value: `branch:${b.id}`,
            label: t('config.scopeBranch', { name: b.name }),
          })),
        ]
      : type === 'standard-hours'
        ? services.map((s) => ({ value: `service:${s.code}`, label: `${s.code} · ${s.name}` }))
        : undefined;
  return (
    <SettingsPage {...head}>
      <div className="alert alert--warning" role="note">
        <Icon name="alert-triangle" />
        <div className="alert__body">
          <div className="alert__title">{t('config.sampleTitle')}</div>
          {t('config.sampleText')}
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState title={t('config.emptyTitle')} text={t('config.emptyText')} />
      ) : (
        <DataTable
          caption={t(`config.types.${type}.title`)}
          rows={items}
          rowKey={(v) => v.id}
          toolbar={
            <>
              <strong>{t('config.tableTitle')}</strong>
              <span className="table-meta" style={{ marginLeft: 'auto' }}>
                {t('config.versions', { count: items.length })}
              </span>
            </>
          }
          footer={<span className="table-meta">{t('config.tableMeta')}</span>}
          columns={[
            {
              key: 'scope',
              header: t('config.colScope'),
              render: (v) => (
                <span data-testid="cfg-scope" title={v.scopeKey}>
                  {scopeName(v.scopeKey)}
                </span>
              ),
            },
            {
              key: 'value',
              header: t('config.colValue'),
              render: (v) => (
                <span data-testid="cfg-value">{describeValue(t, type, v.payload)}</span>
              ),
            },
            {
              key: 'from',
              header: t('config.colFrom'),
              render: (v) => <span className="num">{isoToVi(v.effectiveFrom)}</span>,
            },
            {
              key: 'status',
              header: t('config.colStatus'),
              render: (v) => {
                const s = status.get(v.id)!;
                return (
                  <StatusBadge tone={STATUS_TONE[s]}>{t(`config.viewStatus.${s}`)}</StatusBadge>
                );
              },
            },
            {
              key: 'reason',
              header: t('config.colReason'),
              render: (v) => v.reason,
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
      {canPropose ? (
        <section aria-labelledby="prop-h" className="card" style={{ padding: 'var(--space-6)' }}>
          <h2 id="prop-h" className="t-h3">
            {t('config.propose')}
          </h2>
          <p className="text-secondary">{t('config.proposeLead')}</p>
          <ProposeConfigForm
            type={type}
            fields={fields}
            {...(scopeOptions ? { scopeOptions } : {})}
            labels={formLabels(t, 'config.submit', false)}
            text={{
              scopeKey: t('config.colScope'),
              effectiveFrom: t('config.colFrom'),
              reason: t('config.reason'),
              scopeHint: t(`config.types.${type}.scopeHint`),
              dateHint: t('common.dateFormat'),
              dateInvalid: t('common.dateInvalid'),
              percentInvalid: t('config.percentInvalid'),
              numberInvalid: t('config.numberInvalid'),
              percentHint: t('config.percentHint'),
              pick: t('config.pickScope'),
              fields: Object.fromEntries(fields.map((f) => [f.name, t(`config.fields.${f.name}`)])),
            }}
          />
        </section>
      ) : null}
    </SettingsPage>
  );
}

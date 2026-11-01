import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { AUDIT_PAGE_SIZES, listAudit } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar } from '@/ui/components/FilterBar';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, PageHeader, Pager, type SearchParams } from '@/ui/components/PageParts';
import { AuditExport } from './AuditExport';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'medium',
});

/** FR-SYS-003 / G4-SYS-19: read-only audit viewer. Page size 25 or 100; scope enforced in the query. */
export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = Object.fromEntries(
    (['entityType', 'entityId', 'from', 'to', 'limit'] as const).flatMap((k) =>
      first(sp[k]) ? [[k, first(sp[k])!]] : [],
    ),
  );
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const res = await load(() =>
    listAudit(getContainer().sys, actor, { ...q, ...(cursor ? { cursor } : {}) }),
  );
  const header = <PageHeader title={t('audit.title')} lead={t('audit.lead')} />;
  if (res.error)
    return (
      <>
        {header}
        <ErrorFor error={res.error} t={t} />
      </>
    );
  const page = res.data;
  const canExport = hasPermission(actor, 'audit-log:export');
  return (
    <>
      {header}
      <FilterBar
        action="/sys/audit"
        actions={
          <>
            <Link className="btn btn--ghost" href="/sys/audit">
              {t('warehouses.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('warehouses.apply')}
            </Button>
          </>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor="entityType">
            {t('audit.entityType')}
          </label>
          <input
            className="input"
            id="entityType"
            name="entityType"
            defaultValue={q.entityType}
            placeholder="warehouse"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="from">
            {t('audit.from')}
          </label>
          <input className="input" id="from" name="from" type="date" defaultValue={q.from} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="to">
            {t('audit.to')}
          </label>
          <input className="input" id="to" name="to" type="date" defaultValue={q.to} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="limit">
            {t('audit.pageSize')}
          </label>
          <select className="select" id="limit" name="limit" defaultValue={q.limit ?? '25'}>
            {AUDIT_PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState title={t('audit.emptyTitle')} text={t('audit.emptyText')} />
      ) : (
        <DataTable
          caption={t('audit.title')}
          rows={page.items}
          rowKey={(e) => e.id}
          columns={[
            { key: 'at', header: t('audit.colAt'), render: (e) => fmt.format(new Date(e.at)) },
            { key: 'actor', header: t('audit.colActor'), render: (e) => e.actorName ?? e.actorId },
            {
              key: 'action',
              header: t('audit.colAction'),
              render: (e) => <span data-testid="audit-action">{e.action}</span>,
            },
            {
              key: 'entity',
              header: t('audit.colEntity'),
              render: (e) => `${e.entityType} · ${e.entityId}`,
            },
            { key: 'reason', header: t('audit.colReason'), render: (e) => e.reason ?? '' },
          ]}
        />
      )}
      <Pager
        base="/sys/audit"
        query={q}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{
          prev: t('warehouses.prev'),
          next: t('warehouses.next'),
          aria: t('common.pagination'),
        }}
      />
      {canExport ? (
        <AuditExport
          filter={q}
          labels={{
            title: t('audit.exportTitle'),
            reason: t('audit.exportReason'),
            submit: t('audit.exportSubmit'),
            failed: t('common.unexpected'),
            hint: t('audit.exportHint'),
          }}
        />
      ) : null}
    </>
  );
}

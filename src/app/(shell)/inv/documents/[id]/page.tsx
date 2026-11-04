import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDate, formatDateTime } from '@/platform/format/date';
import { formatVnd } from '@/platform/format/vnd';
import { hasPermission } from '@/platform/rbac/rbac';
import { getDocument } from '@/modules/inv';
import { listWarehouses } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ActionButton } from '@/ui/components/ResourceForm';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Icon } from '@/ui/components/Icon';
import { InvPage } from '../../InvPage';
import { num } from '../../StockNumbers';
import { ReasonAction } from '../DocActions';

export const dynamic = 'force-dynamic';

/** G3-INV-07/09/10 detail: lines, approval notice, and the actions allowed for this document and actor. */
export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const { actor } = await requireSession();
  const { inv, sys } = getContainer();
  const crumbs = [{ label: t('inv.docs.title'), href: '/inv/documents' }];
  const res = await load(async () => {
    const doc = await getDocument(inv, actor, id);
    const warehouses = hasPermission(actor, 'warehouse:view')
      ? (await listWarehouses(sys, actor, { limit: 50 } as never)).items
      : [];
    const ids = [
      ...new Set([doc.createdBy, doc.postedBy, doc.receiverUserId].flatMap((x) => (x ? [x] : []))),
    ];
    const users = await Promise.all(ids.map((u) => sys.users.getById(u)));
    return {
      doc,
      warehouses,
      names: new Map(ids.map((u, i) => [u, users[i]?.displayName ?? u] as const)),
    };
  });
  if (res.error)
    return (
      <InvPage title={t('inv.docs.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </InvPage>
    );
  const { doc, warehouses, names } = res.data;
  const tone = { draft: 'neutral', posted: 'success', cancelled: 'danger' } as const;
  const wh = warehouses.find((w) => w.id === doc.warehouseId)?.name ?? doc.warehouseId;
  const canCreate = hasPermission(actor, 'stock-doc:update');
  const canApprove = hasPermission(actor, 'stock-doc:approve');
  const showUnit = doc.lines.some((l) => l.unitCostVnd !== null);
  const reversible = doc.status === 'posted' && !doc.reversalOf && !doc.reversedBy && canApprove;
  return (
    <InvPage
      title={`${t(`inv.docs.type_${doc.type}`)} ${doc.displayNo}`}
      crumbs={crumbs}
      actions={
        <>
          <StatusBadge tone={tone[doc.status]}>{t(`inv.docs.status_${doc.status}`)}</StatusBadge>
          {doc.reversedBy ? (
            <StatusBadge tone="warning">{t('inv.docs.reversed')}</StatusBadge>
          ) : null}
        </>
      }
    >
      {doc.status === 'draft' ? (
        <div className="alert alert--info" role="status">
          <Icon name="info" />
          <div className="alert__body">{t('inv.docs.draftBanner')}</div>
        </div>
      ) : doc.status === 'posted' ? (
        <div className="alert alert--neutral" role="status">
          <Icon name="lock" />
          <div className="alert__body">{t('inv.docs.postedBanner')}</div>
        </div>
      ) : null}
      {doc.status === 'draft' && doc.needsApproval ? (
        <div className="alert alert--warning" role="alert">
          <Icon name="alert-triangle" />
          <div className="alert__body">
            <span className="alert__title">{t('inv.docs.needsApprovalTitle')}</span>
            <span>
              {t('inv.docs.needsApprovalText', {
                reasons: doc.approvalReasons.map((r) => t(`inv.docs.reason_${r}`)).join(', '),
              })}
            </span>
          </div>
        </div>
      ) : null}
      <section className="card" aria-labelledby="h-doc">
        <div className="card__header">
          <h2 className="card__title" id="h-doc">
            {doc.displayNo}
          </h2>
        </div>
        <dl className="inv-facts">
          <div>
            <dt>{t('inv.docs.warehouse')}</dt>
            <dd>{wh}</dd>
          </div>
          <div>
            <dt>{t('inv.docs.source')}</dt>
            <dd>
              {t(`inv.docs.source_${doc.source.type}`)}
              {doc.source.id ? ` ${doc.source.id}` : ''}
            </dd>
          </div>
          {doc.businessDate ? (
            <div>
              <dt>{t('inv.docs.businessDate')}</dt>
              <dd>{formatDate(new Date(`${doc.businessDate}T00:00:00+07:00`))}</dd>
            </div>
          ) : null}
          {doc.reason ? (
            <div>
              <dt>{t('inv.docs.reasonLabel')}</dt>
              <dd>{doc.reason}</dd>
            </div>
          ) : null}
          {doc.receiverUserId ? (
            <div>
              <dt>{t('inv.docs.receiver')}</dt>
              <dd>{names.get(doc.receiverUserId)}</dd>
            </div>
          ) : null}
          {doc.originalDocumentId ? (
            <div>
              <dt>{t('inv.docs.original')}</dt>
              <dd>
                <Link
                  className="code"
                  href={`/inv/documents/${encodeURIComponent(doc.originalDocumentId)}`}
                >
                  {doc.originalDocumentId}
                </Link>
              </dd>
            </div>
          ) : null}
          {doc.reversalOf ? (
            <div>
              <dt>{t('inv.docs.reverse')}</dt>
              <dd>
                <Link
                  className="code"
                  href={`/inv/documents/${encodeURIComponent(doc.reversalOf)}`}
                >
                  {t('inv.docs.reversalOf', { no: doc.reversalOf })}
                </Link>
              </dd>
            </div>
          ) : null}
          {doc.reversedBy ? (
            <div>
              <dt>{t('inv.docs.reversed')}</dt>
              <dd>
                <Link
                  className="code"
                  href={`/inv/documents/${encodeURIComponent(doc.reversedBy)}`}
                >
                  {doc.reversedBy}
                </Link>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>{t('inv.docs.createdAt')}</dt>
            <dd>
              {names.get(doc.createdBy)} · {formatDateTime(new Date(doc.createdAt))}
            </dd>
          </div>
          {doc.postedAt ? (
            <div>
              <dt>{t('inv.docs.postedAt')}</dt>
              <dd>
                {doc.postedBy ? names.get(doc.postedBy) : ''} ·{' '}
                {formatDateTime(new Date(doc.postedAt))}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="stack" aria-labelledby="h-lines">
        <h2 className="card__title" id="h-lines">
          {t('inv.docs.detailLines')}
        </h2>
        <DataTable
          caption={t('inv.docs.detailLines')}
          rows={doc.lines}
          rowKey={(l) => String(l.lineNo)}
          columns={[
            {
              key: 'p',
              header: t('inv.docs.part'),
              render: (l) => (
                <>
                  <Link className="code" href={`/inv/parts/${encodeURIComponent(l.partId)}`}>
                    {l.partCode}
                  </Link>{' '}
                  {l.partName}
                </>
              ),
            },
            { key: 'q', header: t('inv.docs.qty'), numeric: true, render: (l) => num(l.qty) },
            ...(doc.type === 'GRN'
              ? [
                  {
                    key: 'e',
                    header: t('inv.docs.expected'),
                    numeric: true,
                    render: (l: { expectedQty?: number; expectedUnitCostVnd?: number }) =>
                      l.expectedQty === undefined
                        ? '—'
                        : `${num(l.expectedQty)} × ${l.expectedUnitCostVnd === undefined ? '—' : formatVnd(l.expectedUnitCostVnd)}`,
                  },
                ]
              : []),
            ...(showUnit
              ? [
                  {
                    key: 'u',
                    header: t('inv.docs.unitCost'),
                    numeric: true,
                    render: (l: { unitCostVnd: number | null }) =>
                      l.unitCostVnd === null ? '—' : formatVnd(l.unitCostVnd),
                  },
                  {
                    key: 'v',
                    header: t('inv.docs.lineValue'),
                    numeric: true,
                    render: (l: { valueVnd: number | null }) =>
                      l.valueVnd === null ? '—' : formatVnd(Math.abs(l.valueVnd)),
                  },
                ]
              : []),
          ]}
          footer={
            doc.totalValueVnd !== null ? (
              <span className="table-meta">
                {t('inv.docs.total')}: <strong>{formatVnd(doc.totalValueVnd)}</strong>
              </span>
            ) : !showUnit ? (
              <span className="table-meta">{t('inv.docs.hiddenCost')}</span>
            ) : undefined
          }
        />
      </section>

      <div className="inv-actions">
        {doc.status === 'draft' && canCreate ? (
          <Link
            className="btn btn--secondary"
            href={`/inv/documents/${encodeURIComponent(doc.id)}/edit`}
          >
            {t('inv.docs.edit')}
          </Link>
        ) : null}
        {doc.status === 'draft' && doc.canPost ? (
          <ActionButton
            testId="doc-post"
            endpoint={`/api/v1/inv/documents/${encodeURIComponent(doc.id)}/post`}
            body={{ version: doc.version }}
            label={t('inv.docs.post')}
            variant="primary"
            confirm={t('inv.docs.postConfirm')}
            errorFallback={t('common.unexpected')}
          />
        ) : null}
        {doc.status === 'draft' && canCreate ? (
          <ReasonAction
            testId="doc-cancel"
            endpoint={`/api/v1/inv/documents/${encodeURIComponent(doc.id)}/cancel`}
            body={{ version: doc.version }}
            open={t('inv.docs.cancel')}
            reasonLabel={t('inv.docs.cancelReason')}
            submit={t('inv.docs.cancelSubmit')}
            cancel={t('common.cancel')}
            unexpected={t('common.unexpected')}
          />
        ) : null}
        {doc.type === 'GIN' &&
        doc.status === 'posted' &&
        !doc.reversedBy &&
        hasPermission(actor, 'stock-doc:create') &&
        doc.source.type === 'repair-order' ? (
          <Link
            className="btn btn--secondary"
            href={`/inv/documents/new?type=RTN&original=${encodeURIComponent(doc.id)}`}
          >
            {t('inv.docs.makeReturn')}
          </Link>
        ) : null}
        {reversible ? (
          <ReasonAction
            testId="doc-reverse"
            endpoint={`/api/v1/inv/documents/${encodeURIComponent(doc.id)}/reverse`}
            body={{ version: doc.version }}
            open={t('inv.docs.reverse')}
            reasonLabel={t('inv.docs.reverseReason')}
            submit={t('inv.docs.reverseSubmit')}
            cancel={t('common.cancel')}
            unexpected={t('common.unexpected')}
            variant="danger"
          />
        ) : null}
      </div>
    </InvPage>
  );
}

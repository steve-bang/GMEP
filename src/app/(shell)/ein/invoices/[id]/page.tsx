import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatBp } from '@/platform/format/percent';
import { formatDateTime, isoToVi } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { getInvoice, type InvoiceDetailDto } from '@/modules/ein';
import { findActiveApprovalFor, type ApprovalDto } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EinPage, einLabels, fill, money, Note, STATUS_TONE, SYNC_TONE } from '../../einUi';
import { InvoiceActions } from './InvoiceActions';

export const dynamic = 'force-dynamic';

/** G4-EIN-03 / FR-EIN-005..008: one invoice, its versions, the buyer by role, files, history and what may be done next. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const c = einLabels('common');
  const l = einLabels('detail');
  const crumbs = [{ label: t('shell.nav.invoices'), href: '/ein' }];
  const res = await load(async () => {
    const container = getContainer();
    const inv = await getInvoice(container.ein, actor, id, { requestId: 'page' });
    // a correction waiting for a decision, or approved and not yet run (the requester runs it)
    const approvals: ApprovalDto[] = [];
    if (hasPermission(actor, 'approval:view'))
      for (const kind of ['invoice_adjust', 'invoice_replace', 'invoice_cancel'] as const) {
        const a = await findActiveApprovalFor(container.sys, actor, {
          kind,
          subjectId: `${inv.id}:${kind.replace('invoice_', '')}`,
          branchId: actor.workingBranchId ?? '',
        }).catch(() => null);
        if (a) approvals.push(a);
      }
    return { inv, approvals };
  });
  if (res.error)
    return (
      <EinPage title={l.title!} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </EinPage>
    );
  const { inv, approvals } = res.data;
  const replacement = inv.versions.find((v) => v.id === inv.replacedBy);
  return (
    <EinPage
      title={`${l.title} · ${inv.number ? `${inv.symbol}-${inv.number}` : inv.requestNumber}`}
      desc={l.lead}
      crumbs={crumbs}
      actions={
        <Link
          className="btn btn--secondary"
          href={`/rec/orders/${encodeURIComponent(inv.orderId)}`}
        >
          {c.openOrder}
        </Link>
      }
    >
      <div className="ein-no-print">
        <Banners inv={inv} approvals={approvals} replacementNumber={replacement?.number ?? null} />
      </div>
      <InvoiceActions
        invoice={{ id: inv.id, orderId: inv.orderId, status: inv.status, number: inv.number }}
        actions={inv.actions}
        approvals={approvals.map((a) => ({
          id: a.id,
          number: a.number,
          kind: a.kind,
          status: a.status,
          consumed: a.consumed,
        }))}
        canRequestPassword
        labels={l}
        common={c}
      />
      <section className="card ein-no-print" aria-label={l.title}>
        <dl className="detail-list" data-testid="inv-summary">
          <div>
            <dt>{l.number}</dt>
            <dd>
              <span className="code" data-testid="inv-number">
                {inv.number ?? c.noNumber}
              </span>{' '}
              · {l.symbol} {inv.symbol}
            </dd>
          </div>
          <div>
            <dt>{c.status_issued}</dt>
            <dd>
              <StatusBadge tone={STATUS_TONE[inv.displayStatus] ?? 'neutral'}>
                {c[`status_${inv.displayStatus}`]}
              </StatusBadge>{' '}
              <StatusBadge tone={SYNC_TONE[inv.sync] ?? 'neutral'}>
                {c[`sync_${inv.sync}`]}
              </StatusBadge>{' '}
              <span className="tag tag--neutral">{c[`docType_${inv.docType}`]}</span>
            </dd>
          </div>
          <div>
            <dt>{l.issuedAt}</dt>
            <dd>{inv.issuedAt ? isoToVi(inv.issuedAt.slice(0, 10)) : '—'}</dd>
          </div>
          <div>
            <dt>{l.taxAuthority}</dt>
            <dd className="code">{inv.taxAuthorityCode ?? '—'}</dd>
          </div>
          <div>
            <dt>{l.environment}</dt>
            <dd>{l[`env_${inv.issuer.environment}`]}</dd>
          </div>
        </dl>
      </section>
      <section className="card" aria-labelledby="inv-doc-h">
        <div className="card__header">
          <h2 className="card__title" id="inv-doc-h">
            {l.print}
          </h2>
        </div>
        <div className="card__body stack print-area" data-testid="inv-document">
          <div className="acc-grid-2">
            <div>
              <strong>{l.seller}</strong>
              <div>{inv.issuer.sellerName}</div>
              <div className="text-secondary">
                {l.taxCodeLabel} {inv.issuer.sellerTaxCode}
              </div>
            </div>
            <div>
              <strong>{l.buyer}</strong>
              <div data-testid="inv-buyer">{inv.buyerName}</div>
              {inv.buyerTaxCode ? (
                <div className="text-secondary">
                  {l.taxCodeLabel} {inv.buyerTaxCode}
                </div>
              ) : (
                <div className="text-secondary">{c.kind_retail}</div>
              )}
              {inv.buyerAddress.value ? (
                <div className="text-secondary" data-testid="inv-address">
                  {l.addressLabel}: {inv.buyerAddress.value}
                  {inv.buyerAddress.masked ? ` (${l.masked})` : ''}
                </div>
              ) : null}
              {inv.buyerEmail.value ? (
                <div className="text-secondary">
                  {l.emailLabel}: {inv.buyerEmail.value}
                  {inv.buyerEmail.masked ? ` (${l.masked})` : ''}
                </div>
              ) : null}
            </div>
          </div>
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="table">
                <caption className="sr-only">{l.title}</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">{t('ein.issue.colDesc')}</th>
                    <th scope="col">{t('ein.issue.colRate')}</th>
                    <th scope="col" className="num">
                      {t('ein.issue.colNet')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((x) => (
                    <tr key={x.no}>
                      <td>{x.no}</td>
                      <td>{x.description}</td>
                      <td>{formatBp(x.rateBp)}</td>
                      <td className="num">{money(x.netVnd)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {inv.taxSummary.map((r) => (
                    <tr key={r.rateBp}>
                      <th scope="row" colSpan={3}>
                        {t('ein.issue.tax')} {formatBp(r.rateBp)}
                      </th>
                      <td className="num">{money(r.taxVnd)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" colSpan={3}>
                      {t('ein.issue.total')}
                    </th>
                    <td className="num" data-testid="inv-total">
                      <strong>{money(inv.totalVnd)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </section>
      <section className="card ein-no-print" aria-labelledby="inv-ver-h">
        <div className="card__header">
          <div>
            <h2 className="card__title" id="inv-ver-h">
              {l.versions}
            </h2>
            <p className="text-secondary">{l.versionsLead}</p>
          </div>
        </div>
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="table" data-testid="inv-versions">
              <caption className="sr-only">{l.versions}</caption>
              <thead>
                <tr>
                  <th scope="col">{l.number}</th>
                  <th scope="col">{t('ein.list.colStatus')}</th>
                  <th scope="col">{t('ein.list.colTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {inv.versions.map((v) => (
                  <tr key={v.id} aria-current={v.id === inv.id ? 'true' : undefined}>
                    <td>
                      <Link className="code" href={`/ein/invoices/${encodeURIComponent(v.id)}`}>
                        {v.number ? `${v.symbol}-${v.number}` : v.requestNumber}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge tone={STATUS_TONE[v.displayStatus] ?? 'neutral'}>
                        {c[`status_${v.displayStatus}`]}
                      </StatusBadge>{' '}
                      <span className="tag tag--neutral">{c[`docType_${v.docType}`]}</span>
                      {v.replacedBy ? (
                        <span className="tag tag--warning">{t('ein.list.replacedBy')}</span>
                      ) : null}
                      {v.adjustedBy.length ? (
                        <span className="tag tag--info">{t('ein.list.adjustedBy')}</span>
                      ) : null}
                    </td>
                    <td className="num">{money(v.totalVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="card ein-no-print" aria-labelledby="inv-hist-h">
        <div className="card__header">
          <h2 className="card__title" id="inv-hist-h">
            {l.history}
          </h2>
        </div>
        <ul className="card__body stack-2" data-testid="inv-history">
          {[...inv.history].reverse().map((h, i) => (
            <li key={`${h.at}-${i}`}>
              {formatDateTime(new Date(h.at))} ·{' '}
              {t.has(`ein.history.${h.event}`) ? t(`ein.history.${h.event}`) : h.event}
              {h.note ? ` · ${h.note}` : ''}
            </li>
          ))}
        </ul>
      </section>
      {inv.request?.idempotencyKey ? (
        <section className="card ein-no-print" aria-labelledby="inv-tech-h">
          <div className="card__header">
            <h2 className="card__title" id="inv-tech-h">
              {l.technical}
            </h2>
          </div>
          <div className="card__body stack-2" data-testid="inv-technical">
            <div>
              {l.idem}: <span className="code">{inv.request.idempotencyKey}</span>
            </div>
            <div>
              {c.purpose_issue}: <span className="code">{inv.request.number}</span> ·{' '}
              {c[`req_${inv.request.status}`]}
            </div>
            <ul>
              {inv.request.attempts.map((a) => (
                <li key={a.n}>
                  {fill(l.attemptRow!, { n: a.n, phase: a.phase, outcome: a.outcome })}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </EinPage>
  );
}

function Banners(props: {
  inv: InvoiceDetailDto;
  approvals: ApprovalDto[];
  replacementNumber: string | null;
}) {
  const l = einLabels('detail');
  const { inv } = props;
  return (
    <>
      {inv.sync === 'failed' && inv.status === 'not_issued' ? (
        <Note tone="danger" testId="banner-failed">
          <strong>{l.banner_failed}</strong> {inv.syncError?.message ?? ''}{' '}
          <Link href="/ein/queue">{einLabels('list').queue}</Link>
        </Note>
      ) : null}
      {inv.sync === 'waiting_query' ? (
        <Note tone="warning" testId="banner-waiting">
          <strong>{l.banner_waiting}</strong> {l.banner_waitingText}
        </Note>
      ) : null}
      {inv.replacedBy ? (
        <Note tone="warning" testId="banner-replaced">
          <strong>{fill(l.banner_replaced!, { number: props.replacementNumber ?? '' })}</strong>{' '}
          {l.banner_replacedText}
        </Note>
      ) : null}
      {inv.status === 'cancelled' ? (
        <Note tone="info" testId="banner-cancelled">
          <strong>{l.banner_cancelled}</strong> {inv.cancelReason ?? ''}
        </Note>
      ) : null}
      {props.approvals
        .filter((a) => a.status === 'pending')
        .map((a) => (
          <Note key={a.id} tone="info" testId="banner-pending-approval">
            <strong>{l.banner_pendingApproval}</strong>{' '}
            {fill(l.banner_pendingApprovalText!, { number: a.number })}
          </Note>
        ))}
    </>
  );
}

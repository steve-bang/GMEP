import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { getConnection } from '@/modules/ein';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EinPage, einLabels, Note } from '../einUi';

export const dynamic = 'force-dynamic';

/** G4-EIN-07 / FR-EIN-004: is the issuing unit configured and its provider usable. No buyer data here (AD may open it). */
export default async function ConnectionPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const l = einLabels('connection');
  const d = einLabels('detail');
  const crumbs = [{ label: t('shell.nav.invoices'), href: '/ein' }];
  const res = await load(() => getConnection(getContainer().ein, actor));
  const head = { title: l.title!, desc: l.lead!, crumbs };
  if (res.error)
    return (
      <EinPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </EinPage>
    );
  const c = res.data;
  return (
    <EinPage
      {...head}
      actions={
        hasPermission(actor, 'einvoice-config:view') ? (
          <Link className="btn btn--secondary" href="/sys/config/einvoice-issuer">
            {l.openConfig}
          </Link>
        ) : null
      }
    >
      <section className="card">
        <dl className="detail-list" data-testid="connection">
          <div>
            <dt>{l.state}</dt>
            <dd>
              <StatusBadge tone={c.activated ? 'success' : 'warning'}>
                {c.activated ? l.active : l.inactive}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{l.provider}</dt>
            <dd>{c.providerCode ?? '—'}</dd>
          </div>
          <div>
            <dt>{l.environment}</dt>
            <dd>{c.environment ? d[`env_${c.environment}`] : '—'}</dd>
          </div>
          <div>
            <dt>{l.symbol}</dt>
            <dd>{c.symbol ?? '—'}</dd>
          </div>
          <div>
            <dt>{l.known}</dt>
            <dd>{c.knownProviders.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt>{l.queueOpen}</dt>
            <dd>{c.queueOpen}</dd>
          </div>
        </dl>
      </section>
      {!c.activated ? <Note tone="warning">{l.inactiveText}</Note> : null}
      {c.environment === 'test' ? <Note tone="info">{l.testNote}</Note> : null}
    </EinPage>
  );
}

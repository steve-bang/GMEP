import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { EmptyState, ErrorState, NoPermissionState } from './States';

export function PageHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        <h1>{title}</h1>
        {lead ? <p className="text-secondary">{lead}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}

export function ScopeLine({ text }: { text: string }) {
  return (
    <div className="scope-line">
      <Icon name="map-pin" size="sm" />
      <span>{text}</span>
    </div>
  );
}

/** Renders the state for an expected application error (state-copy §1): 403 / 404 / 409 scope / other. */
export function ErrorFor({
  error,
  t,
}: {
  error: { status: number; code: string; title: string; detail: string };
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (error.status === 403)
    return (
      <NoPermissionState
        title={t('states.noPermissionTitle')}
        text={t('states.noPermissionText')}
      />
    );
  if (error.status === 404)
    return <EmptyState title={t('states.notFoundTitle')} text={t('states.notFoundText')} />;
  if (error.status === 409 && error.code === 'scope_required')
    return (
      <EmptyState title={t('states.scopeRequiredTitle')} text={t('states.scopeRequiredText')} />
    );
  return (
    <ErrorState
      title={error.title}
      text={error.detail}
      actions={
        <Link className="btn btn--secondary" href="/">
          {t('states.home')}
        </Link>
      }
    />
  );
}

export function Pager({
  base,
  query,
  cursor,
  next,
  labels,
}: {
  base: string;
  query: Record<string, string>;
  cursor?: string;
  next: string | null;
  labels: { prev: string; next: string; aria: string };
}) {
  if (!cursor && !next) return null;
  return (
    <nav className="pagination" aria-label={labels.aria}>
      {cursor ? (
        <Link className="pagination__item" href={{ pathname: base, query }}>
          {labels.prev}
        </Link>
      ) : null}
      {next ? (
        <Link
          className="pagination__item"
          rel="next"
          href={{ pathname: base, query: { ...query, cursor: next } }}
        >
          {labels.next}
        </Link>
      ) : null}
    </nav>
  );
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Numbered pagination (prev / "Trang x / y" / next) for lists that are filtered in memory. */
export function PageNav({
  base,
  query,
  page,
  pageCount,
  labels,
}: {
  base: string;
  query: Record<string, string>;
  page: number;
  pageCount: number;
  labels: { prev: string; next: string; aria: string; of: string };
}) {
  if (pageCount <= 1) return null;
  const to = (n: number) => ({ pathname: base, query: { ...query, page: String(n) } });
  return (
    <nav className="pagination" aria-label={labels.aria}>
      {page > 1 ? (
        <Link className="pagination__item" rel="prev" href={to(page - 1)}>
          {labels.prev}
        </Link>
      ) : null}
      <span className="pagination__item" aria-current="page">
        {labels.of}
      </span>
      {page < pageCount ? (
        <Link className="pagination__item" rel="next" href={to(page + 1)}>
          {labels.next}
        </Link>
      ) : null}
    </nav>
  );
}

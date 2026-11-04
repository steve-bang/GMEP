import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/ui/components/Icon';

/** Shared page chrome of the REC screens (G2-REC-01, G2-QUO-*): breadcrumb, title, description, actions. */
export async function RecPage(props: {
  title: string;
  desc?: string;
  crumbs?: { label: string; href: string }[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div className="stack">
      <nav className="breadcrumb" aria-label={t('settings.breadcrumb')}>
        <Link href="/">{t('app.name')}</Link>
        {(props.crumbs ?? []).map((c) => (
          <span key={c.href} style={{ display: 'contents' }}>
            <Icon name="chevron-right" />
            <Link href={c.href}>{c.label}</Link>
          </span>
        ))}
        <Icon name="chevron-right" />
        <span aria-current="page">{props.title}</span>
      </nav>
      <div className="page-header">
        <div className="page-header__text">
          <h1>{props.title}</h1>
          {props.desc ? <p className="text-secondary">{props.desc}</p> : null}
        </div>
        {props.actions ? <div className="page-header__actions">{props.actions}</div> : null}
      </div>
      {props.children}
    </div>
  );
}

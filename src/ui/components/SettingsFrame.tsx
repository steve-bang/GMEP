'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface SettingsNavItem {
  key: string;
  href: string;
  label: string;
}
export interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

/** Left menu of the settings pages (design G4-SYS `.g4r-subnav`); below 1024px it is a select. */
export function SettingsNav({
  groups,
  current,
  labels,
}: {
  groups: SettingsNavGroup[];
  current: string;
  labels: { aria: string; pick: string };
}) {
  const router = useRouter();
  const all = groups.flatMap((g) => g.items);
  return (
    <div>
      <nav className="g4r-subnav" aria-label={labels.aria}>
        {groups.map((g) => (
          <div key={g.label}>
            <div className="g4r-subnav__group">{g.label}</div>
            {g.items.map((i) => (
              <Link key={i.key} href={i.href} aria-current={i.key === current ? 'page' : undefined}>
                <span>{i.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <label className="field g4r-subnav__pick">
        <span className="field__label">{labels.pick}</span>
        <select
          className="select"
          value={all.find((i) => i.key === current)?.href ?? ''}
          onChange={(e) => router.push(e.target.value)}
        >
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((i) => (
                <option key={i.key} value={i.href}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );
}

/** "Làm mới": re-renders the server page (fresh data) and shows progress while it runs. */
export function RefreshButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      style={{ marginLeft: 'auto' }}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      <Icon name="refresh" size="sm" />
      {label}
    </button>
  );
}

export interface SettingsFrameProps {
  crumbs: { label: string; href?: string }[];
  /** screen code from the design pack, e.g. G4-SYS-10 */
  code?: string;
  title: string;
  desc?: string;
  actions?: ReactNode;
  scope: { caption: string; text: string; asOf: string; refresh: string };
  nav: ReactNode;
  children: ReactNode;
  labels: { breadcrumb: string };
}

/** Page chrome of every settings screen: breadcrumb, title block, scope bar, side menu + body. */
export function SettingsFrame(p: SettingsFrameProps) {
  return (
    <>
      <nav className="breadcrumb" aria-label={p.labels.breadcrumb}>
        {p.crumbs.map((c, i) => (
          <span key={c.label} style={{ display: 'contents' }}>
            {i > 0 ? <Icon name="chevron-right" /> : null}
            {i === p.crumbs.length - 1 || !c.href ? (
              <span aria-current={i === p.crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>
            ) : (
              <Link href={c.href}>{c.label}</Link>
            )}
          </span>
        ))}
      </nav>
      <div className="page-header">
        <div className="page-header__text">
          {p.code ? <div className="g4r-code">{p.code}</div> : null}
          <h1>{p.title}</h1>
          {p.desc ? <p className="page-header__desc">{p.desc}</p> : null}
        </div>
        {p.actions ? <div className="page-header__actions">{p.actions}</div> : null}
      </div>
      <div className="scope-banner" role="status">
        <Icon name="map-pin" size="sm" />
        <span>
          <strong>{p.scope.caption}:</strong> {p.scope.text}
        </span>
        <span>· {p.scope.asOf}</span>
        <RefreshButton label={p.scope.refresh} />
      </div>
      <div className="g4r-settings">
        {p.nav}
        <div className="g4r-settings__body">{p.children}</div>
      </div>
    </>
  );
}

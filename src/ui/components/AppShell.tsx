'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: string;
  match: 'exact' | 'prefix';
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface AppShellProps {
  nav: NavGroup[];
  brand: string;
  labels: {
    skip: string;
    navLabel: string;
    openMenu: string;
    closeMenu: string;
    scopeCaption: string;
    userMenu: string;
    logout: string;
  };
  /** scope picker / static chip (a client component rendered by the layout) */
  scopeSlot: ReactNode;
  bell: { href: string; label: string; count: number };
  banner?: ReactNode;
  user: { name: string; initials: string };
  children: ReactNode;
}

/**
 * Sidebar + topbar from design/foundation/shell.html (same DOM and classes).
 * Branch scope is always visible in the top bar (design: "Phạm vi dữ liệu"): the layout passes
 * either the static chip (one branch) or the ScopePicker.
 */
export function AppShell({
  nav,
  brand,
  labels,
  scopeSlot,
  bell,
  banner,
  user,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setMenuOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  async function logout() {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
    } finally {
      // Full navigation on purpose: the session cookie changed, so the server layout must re-render.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    }
  }

  return (
    <div className={`app${navOpen ? ' is-nav-open' : ''}`} id="app">
      <a className="skip-link" href="#main">
        {labels.skip}
      </a>
      <aside className="sidebar" aria-label={labels.navLabel}>
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            <Icon name="wrench" />
          </span>
          <span className="sidebar__brand-name">{brand}</span>
          <button
            type="button"
            className="btn-icon menu-btn"
            style={{ marginLeft: 'auto' }}
            aria-label={labels.closeMenu}
            onClick={() => setNavOpen(false)}
          >
            <Icon name="x" />
          </button>
        </div>
        <nav className="sidebar__nav">
          {nav.map((g) => (
            <div key={g.label}>
              <div className="sidebar__group">{g.label}</div>
              {g.items.map((i) => (
                <Link
                  key={i.key}
                  className="nav-item"
                  href={i.href}
                  title={i.label}
                  aria-current={
                    (i.match === 'exact' ? pathname === i.href : pathname.startsWith(i.href))
                      ? 'page'
                      : undefined
                  }
                  onClick={() => setNavOpen(false)}
                >
                  <Icon name={i.icon} />
                  <span className="nav-item__label">{i.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="drawer-nav-backdrop" onClick={() => setNavOpen(false)} />

      <header className="topbar">
        <button
          type="button"
          className="btn-icon menu-btn"
          aria-label={labels.openMenu}
          onClick={() => setNavOpen(true)}
        >
          <Icon name="menu" />
        </button>
        {scopeSlot}
        <div className="topbar__spacer" />
        <Link className="btn-icon bell" href={bell.href} aria-label={bell.label} data-testid="bell">
          <Icon name="bell" />
          {bell.count > 0 ? (
            <span className="bell__count" aria-hidden="true">
              {bell.count > 99 ? '99+' : bell.count}
            </span>
          ) : null}
        </Link>
        <div className={`dropdown${menuOpen ? ' is-open' : ''}`} ref={menuRef}>
          <button
            type="button"
            className="user-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={labels.userMenu}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="avatar avatar--sm" aria-hidden="true">
              {user.initials}
            </span>
            <span className="user-btn__text">
              <strong className="t-body-sm" style={{ lineHeight: '16px' }}>
                {user.name}
              </strong>
            </span>
            <Icon name="chevron-down" size="sm" />
          </button>
          <div
            className="dropdown__menu dropdown__menu--right"
            role="menu"
            style={{ minWidth: 220 }}
          >
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={logout}
              data-testid="logout"
            >
              <Icon name="log-out" />
              {labels.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="main" id="main">
        {banner}
        <div className="main__inner">{children}</div>
      </main>
    </div>
  );
}

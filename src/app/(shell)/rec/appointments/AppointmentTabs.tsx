'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';

export interface TabDef {
  id: string;
  label: string;
  /** "12", "500+", or "–" when the counter could not be read */
  count: string;
  warn: boolean;
  /** the screen address of the tab (tab, view and day live in the URL) */
  href: string;
  /** screen reader text of the counter, e.g. "12 lịch" */
  countLabel: string;
}

/**
 * G2-APT-01 five tabs (FR-REC-044): `role=tablist` with roving tabindex, ArrowLeft/Right, Home and End move AND open the
 * tab (automatic activation). The selected tab is announced by `aria-selected`, not only by colour; on a phone the strip
 * scrolls inside its own frame. The panel (`id=pnl-<tab>`) is the server-rendered list under it.
 */
export function AppointmentTabs(props: { label: string; active: string; tabs: TabDef[] }) {
  const router = useRouter();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const go = (i: number) => {
    const t = props.tabs[(i + props.tabs.length) % props.tabs.length]!;
    refs.current.get(t.id)?.focus();
    router.push(t.href);
  };
  return (
    <div className="tabs" role="tablist" aria-label={props.label} data-testid="apt-tabs">
      {props.tabs.map((t) => {
        const on = t.id === props.active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              if (el) refs.current.set(t.id, el);
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            className="tab"
            aria-selected={on}
            aria-controls={on ? `pnl-${t.id}` : undefined}
            tabIndex={on ? 0 : -1}
            data-testid={`apt-tab-${t.id}`}
            onClick={() => {
              if (!on) router.push(t.href);
            }}
            onKeyDown={(e) => {
              const cur = props.tabs.findIndex((x) => x.id === props.active);
              if (e.key === 'ArrowRight') go(cur + 1);
              else if (e.key === 'ArrowLeft') go(cur - 1);
              else if (e.key === 'Home') go(0);
              else if (e.key === 'End') go(props.tabs.length - 1);
              else return;
              e.preventDefault();
            }}
          >
            {t.label}{' '}
            <span
              className={`count-pill${t.warn ? ' count-pill--warning' : ''}`}
              data-testid={`apt-count-${t.id}`}
            >
              <span aria-hidden="true">{t.count}</span>
              <span className="sr-only"> {t.countLabel}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

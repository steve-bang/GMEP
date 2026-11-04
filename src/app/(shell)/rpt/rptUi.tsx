import type { ReactNode } from 'react';
import Link from 'next/link';
import { messages } from '@/platform/i18n/messages';
import { isoToVi } from '@/platform/format/date';
import type { DocRef } from '@/modules/rpt';
import { RecPage } from '../rec/RecPage';
import { money } from '../rec/format';

export { money };
export const RptPage = RecPage;

type Dict = Record<string, string>;
const m = messages as unknown as { rpt: Record<string, Dict> };
/** Plain string maps for client components (the strings are the vi.json resources). */
export const rptLabels = (ns: string): Dict => m.rpt[ns]!;

export const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

export const dmy = (iso: string) => isoToVi(iso);

export function Note(props: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className={`alert alert--${props.tone ?? 'info'}`} role="note" data-testid={props.testId}>
      <div className="alert__body">{props.children}</div>
    </div>
  );
}

/** Official (day closed in ACC) or provisional figures, always text and colour (FR-RPT-010 [Cần xác nhận]). */
export function StateTag({ official, l }: { official: boolean; l: Dict }) {
  return (
    <span className={`tag tag--${official ? 'success' : 'warning'}`} data-testid="day-state">
      {official ? l.official : l.provisional}
    </span>
  );
}

export function Kpi(props: {
  label: string;
  value: string;
  meta?: ReactNode;
  testId?: string;
  href?: string;
  tone?: 'warning' | 'danger';
  formula?: string;
}) {
  const body = (
    <>
      <span className="kpi__label">
        {props.label}
        {props.formula ? <span className="rpt-formula">{props.formula}</span> : null}
      </span>
      <span className="kpi__value" data-testid={props.testId}>
        {props.value}
      </span>
      {props.meta ? <span className="kpi__meta">{props.meta}</span> : null}
    </>
  );
  const cls = `card kpi${props.tone ? ` kpi--${props.tone}` : ''}`;
  return props.href ? (
    <Link className={cls} href={props.href} style={{ textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export const Kpis = ({ children }: { children: ReactNode }) => (
  <section className="rpt-kpis" aria-label="KPI">
    {children}
  </section>
);

/** Where a reference lands: the source document in its own module (FR-RPT-011, every number reaches a document). */
export function hrefOf(r: DocRef): string {
  const id = encodeURIComponent(r.id);
  switch (r.kind) {
    case 'order':
      return `/rec/orders/${id}`;
    case 'payment':
      return `/acc/payments/${id}`;
    case 'invoice':
      return `/ein/invoices/${id}`;
    case 'debt':
      return `/acc/orders/${id}`;
    case 'stock-doc':
      return `/inv/documents/${id}`;
    case 'shift':
      return '/acc/cashbook';
  }
}

export const drillHref = (date: string, metric: string, branchId: string) =>
  `/rpt/daily/drill?date=${date}&metric=${metric}&branchId=${encodeURIComponent(branchId)}`;

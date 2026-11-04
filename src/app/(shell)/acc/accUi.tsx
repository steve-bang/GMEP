import type { ReactNode } from 'react';
import { messages } from '@/platform/i18n/messages';
import { RecPage } from '../rec/RecPage';
import { money } from '../rec/format';
import type { BadgeTone } from '@/ui/components/StatusBadge';

export { money };
export const AccPage = RecPage;

type Dict = Record<string, string>;
const m = messages as unknown as { acc: Record<string, Dict>; approvals: Dict };
/** Plain string maps for client components (the strings are the vi.json resources; nothing is hard-coded in the component). */
export const accLabels = (ns: keyof (typeof m)['acc']): Dict => m.acc[ns]!;
export const approvalLabels = (): Dict => m.approvals;

export const METHODS = ['cash', 'transfer', 'card', 'qr'] as const;

export const KIND_TONE: Record<string, BadgeTone> = {
  receipt: 'success',
  deposit: 'info',
  expense: 'warning',
  reversal: 'danger',
};

/** Four KPI cards of a money page (design `.kpi`). */
export function KpiRow(props: {
  items: { label: string; value: string; meta?: string; testId?: string }[];
}) {
  return (
    <div className="acc-kpis">
      {props.items.map((k) => (
        <div className="card kpi" key={k.label}>
          <span className="kpi__label">{k.label}</span>
          <span className="kpi__value" data-testid={k.testId}>
            {k.value}
          </span>
          {k.meta ? <span className="kpi__meta">{k.meta}</span> : null}
        </div>
      ))}
    </div>
  );
}

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

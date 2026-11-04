import type { ReactNode } from 'react';
import { messages } from '@/platform/i18n/messages';
import type { BadgeTone } from '@/ui/components/StatusBadge';
import { RecPage } from '../rec/RecPage';
import { money } from '../rec/format';

export { money };
export const EinPage = RecPage;

type Dict = Record<string, string>;
const m = messages as unknown as { ein: Record<string, Dict> };
/** Plain string maps for client components (the strings are the vi.json resources). */
export const einLabels = (ns: string): Dict => m.ein[ns]!;

export const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/** The five invoice states of the design (G4-EIN-01) plus the stopped request. */
export const STATUS_TONE: Record<string, BadgeTone> = {
  not_issued: 'warning',
  issued: 'success',
  adjustment: 'info',
  replacement: 'purple',
  cancelled: 'danger',
  abandoned: 'neutral',
};

export const SYNC_TONE: Record<string, BadgeTone> = {
  queued: 'neutral',
  sending: 'info',
  waiting_query: 'warning',
  failed: 'danger',
  synced: 'success',
};

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

export function Kpis(props: {
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

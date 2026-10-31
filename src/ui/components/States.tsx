import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Empty / error / no-permission use `.state` (design foundation). Loading uses `.skeleton`. */
function State({
  icon,
  tone,
  title,
  text,
  actions,
  reference,
}: {
  icon: string;
  tone?: 'brand' | 'danger' | 'warning';
  title: string;
  text?: string;
  actions?: ReactNode;
  reference?: string;
}) {
  return (
    <div className="state">
      <div className={`state__icon${tone ? ` state__icon--${tone}` : ''}`}>
        <Icon name={icon} size="lg" />
      </div>
      <div className="state__title">{title}</div>
      {text ? <p className="state__text">{text}</p> : null}
      {actions ? <div className="state__actions">{actions}</div> : null}
      {reference ? <div className="state__ref">{reference}</div> : null}
    </div>
  );
}

export const EmptyState = (p: { title: string; text?: string; actions?: ReactNode }) => (
  <div className="table-wrap">
    <State icon="clipboard-list" tone="brand" {...p} />
  </div>
);

export const ErrorState = (p: {
  title: string;
  text?: string;
  actions?: ReactNode;
  reference?: string;
}) => (
  <div role="alert">
    <State icon="alert-triangle" tone="danger" {...p} />
  </div>
);

export const NoPermissionState = (p: { title: string; text?: string; actions?: ReactNode }) => (
  <div role="status">
    <State icon="lock" tone="warning" {...p} />
  </div>
);

/** Table skeleton: aria-busy region with a visible-to-AT label. */
export function LoadingState({
  label,
  rows = 5,
  cols = 4,
}: {
  label: string;
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="table-wrap" aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      <div className="table-scroll">
        <table className="table" aria-hidden="true">
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r} className="skeleton-row">
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c}>
                    <span className="skeleton skeleton--text" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

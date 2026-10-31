export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

/** `.badge`: status is always text + colour, never colour alone (design-system accessibility rule). */
export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

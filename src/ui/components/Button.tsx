import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'lg' | 'xl';
  block?: boolean;
  loading?: boolean;
  icon?: string;
  children: ReactNode;
}

/** `.btn` from components.css. While loading the button is disabled so double submits are blocked in the UI (the server stays authoritative). */
export function Button({
  variant = 'secondary',
  size,
  block,
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    loading ? 'is-loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...rest}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
      {loading ? (
        <span className="btn__spinner" aria-hidden="true">
          <Icon name="loader" />
        </span>
      ) : null}
    </button>
  );
}

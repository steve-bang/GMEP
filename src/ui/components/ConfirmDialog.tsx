'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

/** `.dialog` confirmation (design/foundation dialogs): focus lands on the safe button, Escape cancels, the confirm button shows the busy state. */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  tone?: 'primary' | 'danger';
  /** wider dialog (`dialog--md`) for forms */
  size?: 'md';
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}) {
  const id = useId();
  const { open } = props;
  // inline callbacks change every render; the effect must not re-run (it would steal focus while typing)
  const onCancelRef = useRef(props.onCancel);
  useEffect(() => {
    onCancelRef.current = props.onCancel;
  });
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    // WCAG 2.4.3 / 2.1.2: remember the opener, move focus inside, keep Tab inside, give focus back on close
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onCancelRef.current();
      if (e.key !== 'Tab' || !dialog.current) return;
      const items = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
        ),
      ];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!dialog.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  return (
    <div className={`overlay${open ? ' is-open' : ''}`} role="presentation" hidden={!open}>
      <div
        ref={dialog}
        className={`dialog${props.size === 'md' ? ' dialog--md' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        data-testid={props.testId}
      >
        <div className="dialog__header">
          <span className="dialog__icon dialog__icon--warning" aria-hidden="true">
            <Icon name="info" />
          </span>
          <h2 className="dialog__title" id={`${id}-t`}>
            {props.title}
          </h2>
        </div>
        <div className="dialog__body">{props.children}</div>
        <div className="dialog__footer">
          <Button ref={cancel} variant="secondary" onClick={props.onCancel}>
            {props.cancelLabel}
          </Button>
          <Button
            variant={props.tone ?? 'primary'}
            loading={props.busy}
            disabled={props.confirmDisabled}
            onClick={props.onConfirm}
            data-testid={props.testId ? `${props.testId}-go` : undefined}
          >
            {props.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

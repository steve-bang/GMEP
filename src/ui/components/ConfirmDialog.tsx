'use client';

import { useEffect, useId, type ReactNode } from 'react';
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
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}) {
  const id = useId();
  const { open, onCancel } = props;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  return (
    <div className={`overlay${open ? ' is-open' : ''}`} role="presentation" hidden={!open}>
      <div
        className="dialog"
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
          <Button variant="secondary" autoFocus={open} onClick={props.onCancel}>
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

'use client';

import { useEffect } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

/**
 * Confirms leaving unsaved work (G5-SCP-01 "Đang soạn báo giá": changing scope must not lose a
 * draft; connection loss keeps drafts only, full offline is out of scope). Pages mark a form with
 * `data-gm-draft="true"` while it has unsaved changes; `hasUnsavedDraft()` reads that marker.
 */
export function hasUnsavedDraft(): boolean {
  return (
    typeof document !== 'undefined' && document.querySelector('[data-gm-draft="true"]') !== null
  );
}

export function UnsavedDraftDialog(props: {
  open: boolean;
  title: string;
  text: string;
  stayLabel: string;
  leaveLabel: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onStay();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props.open, props]);
  return (
    <div
      className={`overlay${props.open ? ' is-open' : ''}`}
      role="presentation"
      hidden={!props.open}
    >
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="draft-title"
        aria-describedby="draft-text"
      >
        <div className="dialog__header">
          <span className="dialog__icon dialog__icon--warning" aria-hidden="true">
            <Icon name="alert-triangle" />
          </span>
          <h2 className="dialog__title" id="draft-title">
            {props.title}
          </h2>
        </div>
        <div className="dialog__body">
          <p id="draft-text">{props.text}</p>
        </div>
        <div className="dialog__footer">
          <Button variant="secondary" autoFocus onClick={props.onStay}>
            {props.stayLabel}
          </Button>
          <Button variant="danger" onClick={props.onLeave}>
            {props.leaveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useRef } from 'react';
import { Icon } from './Icon';

/**
 * Calendar button for a dd/MM/yyyy text field: opens the browser's date picker (a visually hidden native
 * `type=date`, so the field itself keeps showing dd/MM/yyyy whatever the OS language is) and hands back the picked ISO date.
 */
export function DatePickerButton(props: {
  label: string;
  /** current value as yyyy-MM-dd ('' when the field holds no valid date) */
  valueIso: string;
  min?: string;
  max?: string;
  onPick: (iso: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm date-field__btn"
        aria-label={props.label}
        title={props.label}
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          el.value = props.valueIso;
          if (typeof el.showPicker === 'function') el.showPicker();
          else el.click();
        }}
      >
        <Icon name="calendar" />
      </button>
      <input
        ref={ref}
        type="date"
        className="date-field__native"
        tabIndex={-1}
        aria-hidden="true"
        {...(props.min ? { min: props.min } : {})}
        {...(props.max ? { max: props.max } : {})}
        onChange={(e) => {
          if (e.target.value) props.onPick(e.target.value);
        }}
      />
    </>
  );
}

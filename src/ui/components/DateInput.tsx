'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { maskViDate } from '../dateMask';

/**
 * Date field that always shows and accepts dd/MM/yyyy, independent of the browser locale (a native
 * `type=date` follows the OS language and showed mm/dd/yyyy). The submitted value is the typed
 * text; the server page / form handler converts it with `viToIso` (platform/format/date).
 */
export function DateInput({
  defaultValue,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue'> & {
  defaultValue?: string;
}) {
  const [v, setV] = useState(defaultValue ?? '');
  return (
    <input
      {...rest}
      className={`input${rest.className ? ` ${rest.className}` : ''}`}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={rest.placeholder ?? 'dd/MM/yyyy'}
      maxLength={10}
      value={v}
      onChange={(e) => {
        setV(maskViDate(e.target.value));
        onChange?.(e);
      }}
    />
  );
}

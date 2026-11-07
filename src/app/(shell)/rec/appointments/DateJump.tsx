'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { viToIso } from '@/platform/format/date';
import { DateInput } from '@/ui/components/DateInput';
import { Icon } from '@/ui/components/Icon';

/**
 * FR-REC-047: the date field of the date bar. Shows and accepts dd/MM/yyyy only; a date that does not exist (31/02/2026)
 * is refused in words and the screen keeps its day. The URL carries the machine form yyyy-MM-dd, never shown to people.
 */
export function DateJump(props: {
  /** dd/MM/yyyy of the day in view */
  value: string;
  /** address with `0000-00-00` where the chosen day goes */
  hrefTemplate: string;
  label: string;
  invalid: string;
}) {
  const router = useRouter();
  const [err, setErr] = useState(false);
  const apply = (text: string) => {
    const iso = viToIso(text);
    if (!iso) {
      setErr(true);
      return;
    }
    setErr(false);
    if (text.trim() !== props.value) router.push(props.hrefTemplate.replace('0000-00-00', iso));
  };
  return (
    <div className="field" style={{ flex: '0 1 168px', minWidth: 130 }}>
      <DateInput
        key={props.value}
        defaultValue={props.value}
        aria-label={props.label}
        aria-describedby="d-err"
        aria-invalid={err ? true : undefined}
        data-testid="apt-date-input"
        onBlur={(e) => apply(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply((e.target as HTMLInputElement).value);
          }
        }}
      />
      {err ? (
        <span className="field__error" id="d-err" role="alert" data-testid="apt-date-error">
          <Icon name="alert-triangle" size="sm" />
          {props.invalid}
        </span>
      ) : (
        <span id="d-err" />
      )}
    </div>
  );
}

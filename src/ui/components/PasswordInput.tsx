'use client';

import { useState, type ComponentProps } from 'react';
import { Icon } from './Icon';

type InputProps = Omit<ComponentProps<'input'>, 'type' | 'className'>;

/**
 * Password input with show/hide toggle and Caps Lock hint (G1/G5 auth forms). `show` can be
 * controlled so two fields (password + confirm) toggle together.
 */
export function PasswordInput({
  showLabel,
  capsLockText,
  show: showProp,
  onShowChange,
  onKeyUp,
  ...input
}: InputProps & {
  showLabel: string;
  capsLockText: string;
  show?: boolean;
  onShowChange?: (show: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const [caps, setCaps] = useState(false);
  const show = showProp ?? inner;
  return (
    <>
      <div className="g1-pw">
        <input
          {...input}
          className="input"
          type={show ? 'text' : 'password'}
          onKeyUp={(e) => {
            setCaps(e.getModifierState('CapsLock'));
            onKeyUp?.(e);
          }}
        />
        <button
          type="button"
          className="btn-icon g1-pw__toggle"
          aria-label={showLabel}
          aria-pressed={show}
          onClick={() => (onShowChange ?? setInner)(!show)}
        >
          <Icon name={show ? 'eye-off' : 'eye'} />
        </button>
      </div>
      {caps ? <span className="field__hint">{capsLockText}</span> : null}
    </>
  );
}

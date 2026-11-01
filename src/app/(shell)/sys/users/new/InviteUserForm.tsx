'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { postJson, newKey, type FormLabels } from '@/ui/components/ResourceForm';

/** Client form: one initial (role, branch) assignment is nested, so it builds the body itself. */
export function InviteUserForm(props: {
  branches: { value: string; label: string }[];
  roles: { value: string; label: string }[];
  labels: FormLabels;
  text: Record<'code' | 'name' | 'email' | 'phone' | 'role' | 'branch' | 'codeHint', string>;
}) {
  const router = useRouter();
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (n: string) => String(f.get(n) ?? '').trim();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const r = await postJson(
      '/api/v1/sys/users',
      'POST',
      {
        email: v('email'),
        employeeCode: v('employeeCode'),
        displayName: v('displayName'),
        ...(v('phone') ? { phone: v('phone') } : {}),
        assignments: [{ roleCode: v('roleCode'), branchId: v('branchId') }],
      },
      key,
    );
    setBusy(false);
    if (r.ok) {
      router.push('/sys/users');
      router.refresh();
      return;
    }
    const fe: Record<string, string> = {};
    for (const x of r.problem?.errors ?? []) fe[x.field.split('.').pop() ?? x.field] ??= x.message;
    setFieldErrors(fe);
    setError(r.problem?.detail ?? props.labels.unexpected);
  }

  const input = (
    name: string,
    label: string,
    opts: { type?: string; hint?: string; required?: boolean } = {},
  ) => (
    <div className="field">
      <label className="field__label" htmlFor={name}>
        {label}
        {opts.required !== false ? (
          <span className="field__req" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <input
        className="input"
        id={name}
        name={name}
        type={opts.type ?? 'text'}
        autoComplete="off"
        aria-required={opts.required !== false}
        aria-invalid={fieldErrors[name] ? true : undefined}
        aria-describedby={fieldErrors[name] ? `${name}-err` : undefined}
      />
      {opts.hint && !fieldErrors[name] ? <span className="field__hint">{opts.hint}</span> : null}
      {fieldErrors[name] ? (
        <span className="field__error" id={`${name}-err`}>
          {fieldErrors[name]}
        </span>
      ) : null}
    </div>
  );
  const select = (name: string, label: string, options: { value: string; label: string }[]) => (
    <div className="field">
      <label className="field__label" htmlFor={name}>
        {label}
        <span className="field__req" aria-hidden="true">
          *
        </span>
      </label>
      <select
        className="select"
        id={name}
        name={name}
        aria-required="true"
        defaultValue={options[0]?.value}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <form className="g1-form" onSubmit={onSubmit} noValidate data-testid="invite-form">
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={busy}>
        {input('employeeCode', props.text.code, { hint: props.text.codeHint })}
        {input('displayName', props.text.name)}
        {input('email', props.text.email, { type: 'email' })}
        {input('phone', props.text.phone, { required: false })}
        {select('roleCode', props.text.role, props.roles)}
        {select('branchId', props.text.branch, props.branches)}
      </fieldset>
      <Button type="submit" variant="primary" loading={busy}>
        {props.labels.submit}
      </Button>
    </form>
  );
}

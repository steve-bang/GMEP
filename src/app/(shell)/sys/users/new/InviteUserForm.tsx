'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { PasswordInput } from '@/ui/components/PasswordInput';
import { postJson, newKey, type FormLabels } from '@/ui/components/ResourceForm';

/**
 * Client form: one initial (role, branch) assignment is nested, so it builds the body itself. P2-C: "Nhân viên không
 * có email" switches to a staff member who signs in with company code + employee code and the temporary password set
 * here (branch roles only); the password stays in the form and is sent to our API only.
 */
export function InviteUserForm(props: {
  branches: { value: string; label: string }[];
  roles: { value: string; label: string }[];
  /** roles allowed for an account without email (branch roles) */
  noEmailRoles: { value: string; label: string }[];
  labels: FormLabels;
  noEmailLabels: FormLabels;
  /** the tenant's six-digit "Mã công ty" to hand over with the employee code (null before it was assigned) */
  companyCode: string | null;
  text: Record<
    | 'code'
    | 'name'
    | 'email'
    | 'phone'
    | 'role'
    | 'branch'
    | 'codeHint'
    | 'noEmail'
    | 'noEmailHint'
    | 'companyCode'
    | 'companyCodeHint'
    | 'tempPassword'
    | 'tempPasswordHint'
    | 'created'
    | 'show'
    | 'capsLock',
    string
  >;
}) {
  const router = useRouter();
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [noEmail, setNoEmail] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const v = (n: string) => String(f.get(n) ?? '').trim();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const common = {
      employeeCode: v('employeeCode'),
      displayName: v('displayName'),
      ...(v('phone') ? { phone: v('phone') } : {}),
      assignments: [{ roleCode: v('roleCode'), branchId: v('branchId') }],
    };
    const r = await postJson(
      '/api/v1/sys/users',
      'POST',
      noEmail
        ? {
            loginKind: 'employee_code',
            ...common,
            temporaryPassword: String(f.get('temporaryPassword') ?? ''),
          }
        : { email: v('email'), ...common },
      key,
    );
    setBusy(false);
    if (r.ok && noEmail) {
      // the manager must read the company code and employee code to hand them over; the password is not shown again
      const body = r.data as { companyCode?: string; employeeCode?: string } | undefined;
      setCreated(
        props.text.created
          .replace('{company}', body?.companyCode ?? '')
          .replace('{code}', body?.employeeCode ?? ''),
      );
      formEl.reset();
      setKey(newKey());
      router.refresh();
      return;
    }
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
        key={options.map((o) => o.value).join()}
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
      {created ? (
        <div className="alert alert--success" role="status" data-testid="worker-created">
          <Icon name="check" />
          <div className="alert__body">{created}</div>
        </div>
      ) : null}
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={busy}>
        <label className="check">
          <input
            type="checkbox"
            name="noEmail"
            checked={noEmail}
            onChange={(ev) => {
              setNoEmail(ev.target.checked);
              setFieldErrors({});
              setError(null);
              setCreated(null);
            }}
            aria-describedby="noEmail-hint"
            data-testid="invite-no-email"
          />
          <span className="check__box" aria-hidden="true">
            <Icon name="check" />
          </span>
          <span>{props.text.noEmail}</span>
        </label>
        <span className="field__hint" id="noEmail-hint">
          {props.text.noEmailHint}
        </span>
        {noEmail && props.companyCode ? (
          <p data-testid="invite-company-code">
            {props.text.companyCode}: <strong>{props.companyCode}</strong>
            <br />
            <span className="field__hint">{props.text.companyCodeHint}</span>
          </p>
        ) : null}
        {input('employeeCode', props.text.code, { hint: props.text.codeHint })}
        {input('displayName', props.text.name)}
        {noEmail ? (
          <div className="field">
            <label className="field__label" htmlFor="temporaryPassword">
              {props.text.tempPassword}
              <span className="field__req" aria-hidden="true">
                *
              </span>
            </label>
            <PasswordInput
              id="temporaryPassword"
              name="temporaryPassword"
              autoComplete="new-password"
              showLabel={props.text.show}
              capsLockText={props.text.capsLock}
              aria-required="true"
              aria-invalid={fieldErrors.temporaryPassword ? true : undefined}
              aria-describedby={
                fieldErrors.temporaryPassword ? 'temporaryPassword-err' : 'temporaryPassword-hint'
              }
            />
            {fieldErrors.temporaryPassword ? (
              <span className="field__error" id="temporaryPassword-err">
                {fieldErrors.temporaryPassword}
              </span>
            ) : (
              <span className="field__hint" id="temporaryPassword-hint">
                {props.text.tempPasswordHint}
              </span>
            )}
          </div>
        ) : (
          input('email', props.text.email, { type: 'email' })
        )}
        {input('phone', props.text.phone, { required: false })}
        {select('roleCode', props.text.role, noEmail ? props.noEmailRoles : props.roles)}
        {select('branchId', props.text.branch, props.branches)}
      </fieldset>
      <Button type="submit" variant="primary" loading={busy}>
        {noEmail ? props.noEmailLabels.submit : props.labels.submit}
      </Button>
    </form>
  );
}

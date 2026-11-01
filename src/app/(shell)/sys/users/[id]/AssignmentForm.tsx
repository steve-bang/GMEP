'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { postJson, newKey, type FormLabels } from '@/ui/components/ResourceForm';

/** FR-SYS-012: add one (role, branch) assignment. The server decides who may assign which role. */
export function AssignmentForm(props: {
  userId: string;
  roles: { value: string; label: string }[];
  branches: { value: string; label: string }[];
  labels: FormLabels;
  text: { role: string; branch: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await postJson(
      `/api/v1/sys/users/${props.userId}/assignments`,
      'POST',
      { roleCode: f.get('roleCode'), branchId: f.get('branchId') },
      newKey(),
    );
    setBusy(false);
    if (r.ok) return router.refresh();
    setError(r.problem?.detail ?? props.labels.unexpected);
  }
  return (
    <form className="filter-bar" onSubmit={onSubmit} data-testid="assignment-form">
      <div className="field">
        <label className="field__label" htmlFor="a-role">
          {props.text.role}
        </label>
        <select className="select" id="a-role" name="roleCode">
          {props.roles.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="a-branch">
          {props.text.branch}
        </label>
        <select className="select" id="a-branch" name="branchId">
          {props.branches.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" loading={busy}>
        {props.labels.submit}
      </Button>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}

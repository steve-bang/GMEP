'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface Choice {
  tenantId: string;
  tenantName: string;
}

/** One button per company the person belongs to; choosing creates a new session bound to that company (RULE-026). */
export function TenantPicker({ choices, next }: { choices: Choice[]; next: string }) {
  const t = useTranslations('login.tenant');
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function pick(tenantId: string) {
    setBusy(tenantId);
    setFailed(false);
    try {
      const res = await fetch('/api/v1/auth/tenant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      if (res.ok) {
        window.location.assign(next); // full navigation: the session cookie changed
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(null);
  }

  return (
    <div className="g1-form">
      {failed ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">
            <span>{t('failed')}</span>
          </div>
        </div>
      ) : null}
      <ul
        className="g1-tenant-list"
        style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}
      >
        {choices.map((c) => (
          <li key={c.tenantId}>
            <button
              type="button"
              className="btn btn--primary btn--block"
              data-testid="tenant-choice"
              disabled={busy !== null}
              onClick={() => pick(c.tenantId)}
            >
              {c.tenantName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

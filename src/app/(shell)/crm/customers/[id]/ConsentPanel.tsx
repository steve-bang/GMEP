'use client';

import { ActionButton, ResourceForm, type FormLabels } from '@/ui/components/ResourceForm';

interface Row {
  id: string;
  version: number;
  status: string;
  grantedLabel: string;
  withdrawnLabel: string | null;
  purposeLabel: string;
  channelLabel: string;
  basisLabel: string;
  statusLabel: string;
  evidence: string | null;
}
type Opt = { value: string; label: string };

/** G2-CRM-03 "Đồng ý dữ liệu" / FR-CRM-010: consent history, new record, withdrawal (history is kept). */
export function ConsentPanel(props: {
  customerId: string;
  canWrite: boolean;
  canWithdraw: boolean;
  rows: Row[];
  purposes: Opt[];
  channels: Opt[];
  bases: Opt[];
  /** C23: the catalogue of evidence kinds; the reference label says what number to enter for the kind */
  evidenceKinds: (Opt & { referenceLabel: string | null })[];
  labels: {
    title: string;
    empty: string;
    purpose: string;
    channel: string;
    basis: string;
    evidenceKind: string;
    evidenceRef: string;
    evidence: string;
    evidenceHint: string;
    granted: string;
    statusCol: string;
    withdraw: string;
    withdrawConfirm: string;
    withdrawn: string;
    record: string;
    marketingNote: string;
    error: string;
    formLabels: FormLabels;
  };
}) {
  const l = props.labels;
  return (
    <div className="stack">
      {props.rows.length === 0 ? (
        <p className="text-secondary">{l.empty}</p>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll" tabIndex={0} role="region" aria-label={l.title}>
            <table className="table table--compact" data-testid="consent-table">
              <caption className="sr-only">{l.title}</caption>
              <thead>
                <tr>
                  <th scope="col">{l.purpose}</th>
                  <th scope="col">{l.channel}</th>
                  <th scope="col">{l.basis}</th>
                  <th scope="col">{l.granted}</th>
                  <th scope="col">{l.statusCol}</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.purposeLabel}</td>
                    <td>{r.channelLabel}</td>
                    <td>{r.basisLabel}</td>
                    <td>{r.grantedLabel}</td>
                    <td>
                      <span data-testid="consent-status">{r.statusLabel}</span>
                      {r.withdrawnLabel ? (
                        <span className="text-secondary">
                          {' '}
                          · {l.withdrawn} {r.withdrawnLabel}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {props.canWithdraw && r.status === 'granted' ? (
                        <ActionButton
                          endpoint={`/api/v1/crm/consents/${encodeURIComponent(r.id)}/withdraw`}
                          body={{ version: r.version }}
                          label={l.withdraw}
                          variant="ghost"
                          confirm={l.withdrawConfirm}
                          errorFallback={l.error}
                          testId="consent-withdraw"
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {props.canWrite ? (
        <div className="stack-2">
          <h3>{l.record}</h3>
          <p className="text-secondary">{l.marketingNote}</p>
          <ResourceForm
            testId="consent-form"
            endpoint={`/api/v1/crm/customers/${encodeURIComponent(props.customerId)}/consents`}
            labels={l.formLabels}
            fields={[
              {
                name: 'purpose',
                label: l.purpose,
                type: 'select',
                required: true,
                options: props.purposes,
                defaultValue: 'marketing',
              },
              {
                name: 'channel',
                label: l.channel,
                type: 'select',
                required: true,
                options: props.channels,
                defaultValue: 'zalo',
              },
              {
                name: 'basis',
                label: l.basis,
                type: 'select',
                required: true,
                options: props.bases,
                defaultValue: 'consent',
              },
              ...(props.evidenceKinds.length
                ? [
                    {
                      name: 'evidenceKind',
                      label: l.evidenceKind,
                      type: 'select' as const,
                      required: true,
                      options: props.evidenceKinds,
                    },
                    { name: 'evidenceRef', label: l.evidenceRef, maxLength: 40 },
                  ]
                : []),
              { name: 'evidence', label: l.evidence, hint: l.evidenceHint, maxLength: 200 },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

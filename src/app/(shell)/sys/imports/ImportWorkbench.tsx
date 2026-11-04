'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ImportDto, ImportIssuePage } from '@/modules/sys';
import { Button } from '@/ui/components/Button';
import { DataTable } from '@/ui/components/DataTable';
import { StatusBadge, type BadgeTone } from '@/ui/components/StatusBadge';
import { newKey } from '@/ui/components/postJson';
import { useAction } from '@/ui/components/useAction';

interface KindInfo {
  kind: string;
  label: string;
  needsWarehouse: boolean;
  columns: { field: string; label: string; required: boolean }[];
}
type HistoryRow = ImportDto & { createdAtText: string };

const TONE: Record<string, BadgeTone> = {
  validated: 'info',
  rejected: 'danger',
  discarded: 'neutral',
  committing: 'warning',
  committed: 'success',
  failed: 'danger',
  undone: 'neutral',
};

// a fetched page of errors is valid only for this exact state of the batch (commit, undo, a new dry run, a refresh)
const stampOf = (b: ImportDto) => `${b.id}:${b.status}:${b.issueCount}:${b.version}`;

/**
 * FR-SYS-007 screen (G4-SYS-20/21): choose kind, upload, map columns, dry run with row errors, confirm, write, undo.
 * The server is authoritative for every rule; this component only shows what the API answered.
 */
export function ImportWorkbench(props: {
  kinds: KindInfo[];
  warehouses: { id: string; name: string }[];
  history: HistoryRow[];
  canUndo: boolean;
  limits: { mb: number; rows: number };
}) {
  const t = useTranslations('import');
  const router = useRouter();
  const [kind, setKind] = useState(props.kinds[0]?.kind ?? '');
  const [warehouseId, setWarehouseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null> | null>(null);
  const [batch, setBatch] = useState<ImportDto | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // FR-SYS-007: the batch carries the first page of errors; later pages come from /issues (cursor = offset)
  const [issuePage, setIssuePage] = useState<{ stamp: string; page: ImportIssuePage } | null>(null);
  const uploadKey = useRef<string | null>(null);
  const action = useAction(t('unexpected'));

  const info = props.kinds.find((k) => k.kind === kind);
  const label = (f: string) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f);

  async function dryRun(withMapping: boolean) {
    if (!file || !info) return;
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', file);
    if (info.needsWarehouse) form.set('warehouseId', warehouseId);
    if (withMapping && mapping) form.set('mapping', JSON.stringify(mapping));
    // a new intent (other file or mapping) gets a new key; a network retry of the same intent reuses it
    uploadKey.current ??= newKey();
    setBusy('dry');
    setError(null);
    try {
      const res = await fetch('/api/v1/sys/imports', {
        method: 'POST',
        headers: { 'idempotency-key': uploadKey.current },
        body: form,
      });
      const data = await res.json().catch(() => null);
      uploadKey.current = null;
      if (!res.ok) {
        setError(data?.errors?.[0]?.message ?? data?.detail ?? t('unexpected'));
        return;
      }
      setBatch(data as ImportDto);
      setMapping((data as ImportDto).mapping);
      setConfirmed(false);
      router.refresh();
    } catch {
      setError(t('unexpected'));
    } finally {
      setBusy(null);
    }
  }

  async function loadIssues(cursor: string | null) {
    if (!batch) return;
    setBusy('issues');
    try {
      const res = await fetch(
        `/api/v1/sys/imports/${batch.id}/issues?limit=${Math.max(batch.issues.length, 1)}${cursor ? `&cursor=${cursor}` : ''}`,
      );
      if (!res.ok) {
        setError(t('unexpected'));
        return;
      }
      setIssuePage({ stamp: stampOf(batch), page: (await res.json()) as ImportIssuePage });
    } catch {
      setError(t('unexpected'));
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!batch) return;
    const r = await action.run<ImportDto>('commit', `/api/v1/sys/imports/${batch.id}/commit`, {});
    if (r) setBatch(r);
  }
  async function undo() {
    if (!batch) return;
    const r = await action.run<ImportDto>('undo', `/api/v1/sys/imports/${batch.id}/undo`, {
      reason,
    });
    if (r) {
      setBatch(r);
      setReason('');
    }
  }

  if (props.kinds.length === 0)
    return (
      <div className="alert alert--neutral" role="note">
        <div className="alert__body">{t('noKinds')}</div>
      </div>
    );

  const created = batch
    ? Object.entries(batch.created)
        .map(([k, n]) => `${n} ${t.has(`created.${k}`) ? t(`created.${k}`) : k}`)
        .join(', ')
    : '';
  const pageHere = batch && issuePage?.stamp === stampOf(batch) ? issuePage.page : null;
  const shownIssues = pageHere?.items ?? batch?.issues ?? [];
  const nextCursor = pageHere
    ? pageHere.nextCursor
    : batch && batch.issueCount > batch.issues.length && batch.issues.length > 0
      ? String(batch.issues.length)
      : null;
  const prevCursor = pageHere?.prevCursor ?? null;
  // the server says when the file had more errors than the batch keeps; then the count is a lower bound label
  const truncated = pageHere ? pageHere.truncated : (batch?.issuesTruncated ?? false);
  const needWh = info?.needsWarehouse && !warehouseId;

  return (
    <div className="stack">
      {error || action.error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error ?? action.error}</div>
        </div>
      ) : null}

      <section className="card" aria-labelledby="imp-s1">
        <div className="card__body stack">
          <h2 className="t-heading-md" id="imp-s1" style={{ margin: 0 }}>
            {t('step1')}
          </h2>
          <fieldset className="stack-2" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">{t('step1')}</legend>
            {props.kinds.map((k) => (
              <label className="radio" key={k.kind}>
                <input
                  type="radio"
                  name="kind"
                  value={k.kind}
                  checked={kind === k.kind}
                  onChange={() => {
                    setKind(k.kind);
                    setBatch(null);
                    setMapping(null);
                  }}
                />
                <span className="radio__box" />
                <span>
                  <strong>{t.has(`kinds.${k.kind}`) ? t(`kinds.${k.kind}`) : k.label}</strong>
                </span>
              </label>
            ))}
          </fieldset>
          {info?.needsWarehouse ? (
            <>
              <div className="field">
                <label className="field__label" htmlFor="imp-wh">
                  {t('warehouse')}
                  <span className="field__req">*</span>
                </label>
                <select
                  className="select"
                  id="imp-wh"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  <option value="">{t('warehousePick')}</option>
                  {props.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="alert alert--info" role="note">
                <div className="alert__body">
                  {t('stockNote')} {t('partsFirst')}
                </div>
              </div>
            </>
          ) : null}
          <div>
            <a
              className="btn btn--secondary"
              href={`/api/v1/sys/imports/template?kind=${encodeURIComponent(kind)}`}
              download
            >
              {t('template')}
            </a>{' '}
            <a
              className="btn btn--secondary"
              href={`/api/v1/sys/imports/template?kind=${encodeURIComponent(kind)}&format=xlsx`}
              download
              data-testid="template-xlsx"
            >
              {t('templateXlsx')}
            </a>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="imp-s2">
        <div className="card__body stack">
          <h2 className="t-heading-md" id="imp-s2" style={{ margin: 0 }}>
            {t('step2')}
          </h2>
          <div className="field">
            <label className="field__label" htmlFor="imp-file">
              {t('file')}
            </label>
            <input
              className="input"
              id="imp-file"
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setBatch(null);
                setMapping(null);
                uploadKey.current = null;
              }}
            />
            <span className="field__hint">
              {t('fileHint', { mb: props.limits.mb, rows: props.limits.rows })}
            </span>
          </div>
          <p className="text-secondary">{t('dryRunNote')}</p>
          <div>
            <Button
              variant="primary"
              disabled={!file || !!needWh}
              loading={busy === 'dry'}
              onClick={() => void dryRun(false)}
            >
              {t('dryRun')}
            </Button>
          </div>

          {batch && mapping ? (
            <div className="table-wrap">
              <div className="table-toolbar">
                <strong>{t('mapping')}</strong>
                <span className="table-meta" style={{ marginLeft: 'auto' }}>
                  {t('mappingHelp')}
                </span>
              </div>
              <div className="table-scroll">
                <table className="table table--compact">
                  <caption className="sr-only">{t('mapping')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('colField')}</th>
                      <th scope="col">{t('colFile')}</th>
                      <th scope="col">{t('required')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.columns.map((c) => (
                      <tr key={c.field}>
                        <th scope="row">{label(c.field)}</th>
                        <td>
                          <label className="sr-only" htmlFor={`map-${c.field}`}>
                            {label(c.field)}
                          </label>
                          <select
                            className="select"
                            id={`map-${c.field}`}
                            value={mapping[c.field] ?? ''}
                            onChange={(e) =>
                              setMapping({
                                ...mapping,
                                [c.field]: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                          >
                            <option value="">{t('notMapped')}</option>
                            {batch.headers.map((h, i) => (
                              <option key={i} value={i}>
                                {h || `#${i + 1}`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{c.required ? t('required') : t('optional')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <Button
                  variant="secondary"
                  loading={busy === 'dry'}
                  onClick={() => {
                    uploadKey.current = newKey();
                    void dryRun(true);
                  }}
                >
                  {t('dryRunAgain')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {batch ? (
        <section className="card" aria-labelledby="imp-s3">
          <div className="card__body stack">
            <h2 className="t-heading-md" id="imp-s3" style={{ margin: 0 }}>
              {t('step3')}{' '}
              <StatusBadge tone={TONE[batch.status] ?? 'neutral'}>
                {t(`status.${batch.status}`)}
              </StatusBadge>
            </h2>
            <div className="grid grid--3">
              <div className="card kpi">
                <span className="kpi__label">{t('rows')}</span>
                <span className="kpi__value">{batch.rowCount}</span>
              </div>
              <div className="card kpi">
                <span className="kpi__label">{t('units')}</span>
                <span className="kpi__value">{batch.unitCount}</span>
              </div>
              <div className="card kpi">
                <span className="kpi__label">{t('errors')}</span>
                <span className="kpi__value">{batch.issueCount}</span>
              </div>
            </div>
            {batch.status === 'rejected' ? (
              <div className="alert alert--danger" role="alert">
                <div className="alert__body">{t('rejected', { count: batch.issueCount })}</div>
              </div>
            ) : null}
            {batch.status === 'validated' ? (
              <div className="alert alert--success" role="status">
                <div className="alert__body">{t('validated')}</div>
              </div>
            ) : null}
            {batch.status === 'committed' ? (
              <div className="alert alert--success" role="status">
                <div className="alert__body">{t('committed', { summary: created })}</div>
              </div>
            ) : null}
            {batch.status === 'failed' ? (
              <div className="alert alert--danger" role="alert">
                <div className="alert__body">{t('failed', { code: batch.failure ?? '' })}</div>
              </div>
            ) : null}
            {batch.status === 'undone' ? (
              <div className="alert alert--neutral" role="status">
                <div className="alert__body">{t('undone')}</div>
              </div>
            ) : null}
            {batch.issues.length > 0 ? (
              <DataTable
                caption={t('issuesTitle')}
                rows={shownIssues}
                rowKey={(i) => `${i.row}-${i.field ?? ''}-${i.message}`}
                toolbar={
                  <span className="table-meta">
                    {t(truncated ? 'issuesShownAtLeast' : 'issuesShown', {
                      shown: shownIssues.length,
                      total: batch.issueCount,
                    })}
                  </span>
                }
                footer={
                  prevCursor !== null || nextCursor !== null ? (
                    <div className="row" role="navigation" aria-label={t('issuesPager')}>
                      <Button
                        variant="secondary"
                        disabled={prevCursor === null || busy === 'issues'}
                        onClick={() => void loadIssues(prevCursor)}
                      >
                        {t('issuesPrev')}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={nextCursor === null || busy === 'issues'}
                        onClick={() => void loadIssues(nextCursor)}
                      >
                        {t('issuesNext')}
                      </Button>
                    </div>
                  ) : undefined
                }
                columns={[
                  {
                    key: 'row',
                    header: t('colRow'),
                    render: (i) => (i.row === 0 ? t('wholeFile') : i.row),
                  },
                  {
                    key: 'field',
                    header: t('colColumn'),
                    render: (i) => (i.field ? label(i.field) : ''),
                  },
                  { key: 'message', header: t('colMessage'), render: (i) => i.message },
                ]}
              />
            ) : null}
            {batch.warnings.length > 0 ? (
              <DataTable
                caption={t('warningsTitle')}
                rows={batch.warnings}
                rowKey={(i) => `${i.row}-${i.field ?? ''}-${i.message}`}
                columns={[
                  { key: 'row', header: t('colRow'), render: (i) => i.row },
                  {
                    key: 'field',
                    header: t('colColumn'),
                    render: (i) => (i.field ? label(i.field) : ''),
                  },
                  { key: 'message', header: t('colMessage'), render: (i) => i.message },
                ]}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {batch && (batch.status === 'validated' || batch.status === 'failed') ? (
        <section className="card" aria-labelledby="imp-s4">
          <div className="card__body stack">
            <h2 className="t-heading-md" id="imp-s4" style={{ margin: 0 }}>
              {t('step4')}
            </h2>
            <p className="text-secondary" data-testid="import-slow-note">
              {t('slowNote', { rows: batch.rowCount })}
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span className="check__box" />
              <span>{t('confirm')}</span>
            </label>
            <div>
              <Button
                variant="primary"
                disabled={!confirmed}
                loading={action.busy === 'commit'}
                onClick={() => void commit()}
              >
                {batch.status === 'failed' ? t('resume') : t('commit')}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {batch && props.canUndo && (batch.status === 'committed' || batch.status === 'failed') ? (
        <section className="card" aria-labelledby="imp-undo">
          <div className="card__body stack">
            <h2 className="t-heading-md" id="imp-undo" style={{ margin: 0 }}>
              {t('undoTitle')}
            </h2>
            <p className="text-secondary">{t('undoHelp')}</p>
            <div className="field">
              <label className="field__label" htmlFor="imp-reason">
                {t('undoReason')}
              </label>
              <input
                className="input"
                id="imp-reason"
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div>
              <Button
                variant="secondary"
                disabled={reason.trim().length < 5}
                loading={action.busy === 'undo'}
                onClick={() => void undo()}
              >
                {t('undo')}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="imp-hist" className="stack-2">
        <h2 className="t-heading-md" id="imp-hist" style={{ margin: 0 }}>
          {t('history')}
        </h2>
        {props.history.length === 0 ? (
          <p className="text-secondary">{t('historyEmpty')}</p>
        ) : (
          <DataTable
            caption={t('history')}
            rows={props.history}
            rowKey={(b) => b.id}
            columns={[
              {
                key: 'at',
                header: t('colAt'),
                render: (b) => <span className="num">{b.createdAtText}</span>,
              },
              {
                key: 'kind',
                header: t('colKind'),
                render: (b) => (t.has(`kinds.${b.kind}`) ? t(`kinds.${b.kind}`) : b.kindLabel),
              },
              { key: 'file', header: t('colFile2'), render: (b) => b.fileName },
              { key: 'rows', header: t('colRows'), render: (b) => b.rowCount },
              {
                key: 'status',
                header: t('colStatus'),
                render: (b) => (
                  <StatusBadge tone={TONE[b.status] ?? 'neutral'}>
                    {t(`status.${b.status}`)}
                  </StatusBadge>
                ),
              },
              {
                key: 'open',
                header: '',
                render: (b) => (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const r = await fetch(`/api/v1/sys/imports/${b.id}`);
                      if (r.ok) {
                        setBatch((await r.json()) as ImportDto);
                        setMapping(null);
                      }
                    }}
                  >
                    {t('open')}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { newKey, postJson } from '@/ui/components/ResourceForm';

export interface DocFormLabels {
  warehouse: string;
  sourceType: string;
  sourceId: string;
  sourceIdHint: string;
  reason: string;
  receiver: string;
  lines: string;
  partCode: string;
  partHint: string;
  qty: string;
  unitCost: string;
  expectedQty: string;
  expectedCost: string;
  addLine: string;
  removeLine: string;
  save: string;
  cancel: string;
  unknownPart: string;
  noLines: string;
  original: string;
  issued: string;
  errorSummary: string;
  unexpected: string;
  versionConflict: string;
}

interface Line {
  uid: number;
  code: string;
  partId: string;
  name: string;
  qty: string;
  unitCost: string;
  expectedQty: string;
  expectedCost: string;
  originalLineNo?: number;
  issued?: number;
}

type Opt = { value: string; label: string };
interface PartHit {
  id: string;
  code: string;
  name: string;
}

/**
 * Create / edit a stock document draft (G3-INV-07, 09, 10 and the adjustment form). The part is
 * chosen by typing its code and picking a suggestion from the catalogue search; quantities and
 * prices are whole numbers (VND). Nothing here changes stock: posting is a separate, confirmed action.
 */
export function DocumentForm(props: {
  type: 'GRN' | 'GIN' | 'RTN' | 'ADJ';
  warehouses: Opt[];
  sourceTypes: Opt[];
  receivers: Opt[];
  labels: DocFormLabels;
  cancelHref: string;
  /** edit mode */
  edit?: {
    id: string;
    version: number;
    warehouseId: string;
    sourceType: string;
    sourceId: string;
    reason: string;
    receiverUserId: string;
    lines: Omit<Line, 'uid'>[];
  };
  /** RTN: the issue the parts come back from */
  original?: {
    id: string;
    no: string;
    sourceId: string;
    warehouseId: string;
    lines: Omit<Line, 'uid'>[];
  };
}) {
  const router = useRouter();
  const uid = useId();
  const [key] = useState(newKey);
  // line ids are plain numbers derived from the current lines (no render-time counter): stable on server and client
  const blank = (uidN: number, l?: Partial<Line>): Line => ({
    uid: uidN,
    code: '',
    partId: '',
    name: '',
    qty: '',
    unitCost: '',
    expectedQty: '',
    expectedCost: '',
    ...l,
  });
  const [lines, setLines] = useState<Line[]>(() =>
    props.edit
      ? props.edit.lines.map((l, i) => blank(i + 1, l))
      : props.original
        ? props.original.lines.map((l, i) => blank(i + 1, { ...l, qty: '' }))
        : [blank(1)],
  );
  const [hits, setHits] = useState<Record<number, PartHit[]>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const t = props.type;
  const fixedOriginal = t === 'RTN' && props.original;

  function edit(uidN: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.uid === uidN ? { ...l, ...patch } : l)));
  }

  function onCode(l: Line, value: string) {
    const match = (hits[l.uid] ?? []).find(
      (h) => h.code.toLowerCase() === value.trim().toLowerCase(),
    );
    edit(l.uid, { code: value, partId: match?.id ?? '', name: match?.name ?? '' });
    clearTimeout(timers.current[l.uid]);
    if (value.trim().length < 2 || match) return;
    timers.current[l.uid] = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/inv/parts?limit=8&status=active&q=${encodeURIComponent(value.trim())}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: PartHit[] };
        setHits((h) => ({ ...h, [l.uid]: data.items }));
        const exact = data.items.find((x) => x.code.toLowerCase() === value.trim().toLowerCase());
        if (exact) edit(l.uid, { partId: exact.id, name: exact.name });
      } catch {
        /* offline: the user keeps typing, the server validates on save */
      }
    }, 250);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (n: string) => String(f.get(n) ?? '').trim();
    const used = lines.filter((l) => l.qty !== '' && l.qty !== '0');
    if (used.length === 0) return setBanner(props.labels.noLines);
    if (used.some((l) => !l.partId)) return setBanner(props.labels.unknownPart);
    const int = (s: string) => (s === '' ? undefined : Number(s));
    const body: Record<string, unknown> = {
      source: { type: v('sourceType'), ...(v('sourceId') ? { id: v('sourceId') } : {}) },
      ...(v('reason') ? { reason: v('reason') } : {}),
      ...(v('receiverUserId') ? { receiverUserId: v('receiverUserId') } : {}),
      lines: used.map((l) => ({
        partId: l.partId,
        qty: int(l.qty),
        ...(int(l.unitCost) !== undefined ? { unitCostVnd: int(l.unitCost) } : {}),
        ...(int(l.expectedQty) !== undefined ? { expectedQty: int(l.expectedQty) } : {}),
        ...(int(l.expectedCost) !== undefined ? { expectedUnitCostVnd: int(l.expectedCost) } : {}),
        ...(l.originalLineNo !== undefined ? { originalLineNo: l.originalLineNo } : {}),
      })),
    };
    if (props.edit) body.version = props.edit.version;
    else {
      body.type = t;
      body.warehouseId = v('warehouseId');
      if (props.original) body.originalDocumentId = props.original.id;
    }
    setBusy(true);
    setBanner(null);
    setErrors({});
    const r = await postJson(
      props.edit
        ? `/api/v1/inv/documents/${encodeURIComponent(props.edit.id)}`
        : '/api/v1/inv/documents',
      props.edit ? 'PATCH' : 'POST',
      body,
      key,
    );
    setBusy(false);
    if (r.ok) {
      const id = (r.data as { id: string }).id;
      router.push(`/inv/documents/${encodeURIComponent(id)}`);
      router.refresh();
      return;
    }
    if (r.status === 0) return setBanner(props.labels.unexpected);
    if (r.problem?.code === 'version_conflict') return setBanner(props.labels.versionConflict);
    const fe: Record<string, string> = {};
    for (const x of r.problem?.errors ?? []) fe[x.field] ??= x.message;
    setErrors(fe);
    setBanner(
      Object.keys(fe).length
        ? props.labels.errorSummary.replace('{count}', String(Object.keys(fe).length))
        : (r.problem?.detail ?? props.labels.unexpected),
    );
  }

  const L = props.labels;
  const err = (n: string) =>
    errors[n] ? (
      <span className="field__error" id={`${uid}-${n}-err`}>
        {errors[n]}
      </span>
    ) : null;
  const showCost = t === 'GRN' || t === 'ADJ';

  return (
    <form className="g1-form" onSubmit={onSubmit} noValidate data-testid="doc-form">
      {banner ? (
        <div className="alert alert--danger" role="alert">
          <Icon name="alert-triangle" />
          <div className="alert__body">{banner}</div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={busy}>
        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-wh`}>
              {L.warehouse}
              <span className="field__req" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id={`${uid}-wh`}
              name="warehouseId"
              className="select"
              defaultValue={props.edit?.warehouseId ?? props.original?.warehouseId}
              disabled={!!props.edit || !!props.original}
            >
              {props.warehouses.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
            {props.edit || props.original ? (
              <input
                type="hidden"
                name="warehouseId"
                value={props.edit?.warehouseId ?? props.original!.warehouseId}
              />
            ) : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-st`}>
              {L.sourceType}
              <span className="field__req" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id={`${uid}-st`}
              name="sourceType"
              className="select"
              defaultValue={props.edit?.sourceType ?? props.sourceTypes[0]?.value}
              disabled={!!fixedOriginal}
            >
              {props.sourceTypes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {fixedOriginal ? <input type="hidden" name="sourceType" value="repair-order" /> : null}
            {err('source.type')}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-sid`}>
              {L.sourceId}
            </label>
            <input
              id={`${uid}-sid`}
              name="sourceId"
              className="input"
              maxLength={64}
              defaultValue={props.edit?.sourceId ?? props.original?.sourceId ?? ''}
              readOnly={!!fixedOriginal}
              aria-describedby={`${uid}-sid-hint`}
              aria-invalid={errors['source.id'] || errors['source'] ? true : undefined}
            />
            <span className="field__hint" id={`${uid}-sid-hint`}>
              {L.sourceIdHint}
            </span>
            {err('source.id')}
            {err('source')}
          </div>
          {t === 'GIN' ? (
            <div className="field">
              <label className="field__label" htmlFor={`${uid}-rc`}>
                {L.receiver}
              </label>
              <select
                id={`${uid}-rc`}
                name="receiverUserId"
                className="select"
                defaultValue={props.edit?.receiverUserId ?? ''}
              >
                <option value="">—</option>
                {props.receivers.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {err('receiverUserId')}
            </div>
          ) : null}
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-rs`}>
              {L.reason}
            </label>
            <textarea
              id={`${uid}-rs`}
              name="reason"
              className="textarea"
              rows={2}
              maxLength={300}
              defaultValue={props.edit?.reason ?? ''}
            />
            {err('reason')}
          </div>
        </div>

        <section className="stack" aria-labelledby={`${uid}-lines`}>
          <h2 className="card__title" id={`${uid}-lines`}>
            {L.lines}
          </h2>
          <div className="table-wrap">
            <div className="table-scroll" tabIndex={0} role="region" aria-label={L.lines}>
              <table className="table inv-lines">
                <thead>
                  <tr>
                    <th scope="col">{L.partCode}</th>
                    {fixedOriginal ? (
                      <th scope="col" className="col-num">
                        {L.issued}
                      </th>
                    ) : null}
                    <th scope="col" className="col-num">
                      {L.qty}
                    </th>
                    {showCost ? (
                      <th scope="col" className="col-num">
                        {L.unitCost}
                      </th>
                    ) : null}
                    {t === 'GRN' ? (
                      <>
                        <th scope="col" className="col-num">
                          {L.expectedQty}
                        </th>
                        <th scope="col" className="col-num">
                          {L.expectedCost}
                        </th>
                      </>
                    ) : null}
                    {!fixedOriginal ? (
                      <th scope="col">
                        <span className="sr-only">{L.removeLine}</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.uid}>
                      <td>
                        {fixedOriginal ? (
                          <>
                            <span className="code">{l.code}</span> {l.name}
                          </>
                        ) : (
                          <>
                            <input
                              className="input"
                              list={`${uid}-dl-${l.uid}`}
                              aria-label={`${L.partCode} ${i + 1}`}
                              value={l.code}
                              onChange={(e) => onCode(l, e.target.value)}
                              autoComplete="off"
                              maxLength={40}
                              data-testid="line-code"
                            />
                            <datalist id={`${uid}-dl-${l.uid}`}>
                              {(hits[l.uid] ?? []).map((h) => (
                                <option key={h.id} value={h.code}>
                                  {h.name}
                                </option>
                              ))}
                            </datalist>
                            <div className="cell-sub">{l.name || L.partHint}</div>
                          </>
                        )}
                      </td>
                      {fixedOriginal ? <td className="col-num">{l.issued}</td> : null}
                      <td className="col-num">
                        <input
                          className="input input--num"
                          type="number"
                          inputMode="numeric"
                          step={1}
                          aria-label={`${L.qty} ${i + 1}`}
                          value={l.qty}
                          onChange={(e) => edit(l.uid, { qty: e.target.value })}
                          data-testid="line-qty"
                        />
                      </td>
                      {showCost ? (
                        <td className="col-num">
                          <input
                            className="input input--num"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            aria-label={`${L.unitCost} ${i + 1}`}
                            value={l.unitCost}
                            onChange={(e) => edit(l.uid, { unitCost: e.target.value })}
                            data-testid="line-cost"
                          />
                        </td>
                      ) : null}
                      {t === 'GRN' ? (
                        <>
                          <td className="col-num">
                            <input
                              className="input input--num"
                              type="number"
                              min={1}
                              step={1}
                              aria-label={`${L.expectedQty} ${i + 1}`}
                              value={l.expectedQty}
                              onChange={(e) => edit(l.uid, { expectedQty: e.target.value })}
                            />
                          </td>
                          <td className="col-num">
                            <input
                              className="input input--num"
                              type="number"
                              min={0}
                              step={1}
                              aria-label={`${L.expectedCost} ${i + 1}`}
                              value={l.expectedCost}
                              onChange={(e) => edit(l.uid, { expectedCost: e.target.value })}
                            />
                          </td>
                        </>
                      ) : null}
                      {!fixedOriginal ? (
                        <td>
                          <button
                            type="button"
                            className="btn-icon"
                            aria-label={`${L.removeLine} ${i + 1}`}
                            disabled={lines.length === 1}
                            onClick={() => setLines((ls) => ls.filter((x) => x.uid !== l.uid))}
                          >
                            <Icon name="trash" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {err('lines')}
          {!fixedOriginal ? (
            <div>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() =>
                  setLines((ls) => [...ls, blank(Math.max(0, ...ls.map((x) => x.uid)) + 1)])
                }
              >
                <Icon name="plus" size="sm" />
                {L.addLine}
              </button>
            </div>
          ) : null}
        </section>
      </fieldset>
      <div className="g5-actions">
        <Button type="submit" variant="primary" loading={busy} data-testid="doc-save">
          {L.save}
        </Button>
        <a className="btn btn--ghost" href={props.cancelHref}>
          {L.cancel}
        </a>
      </div>
    </form>
  );
}

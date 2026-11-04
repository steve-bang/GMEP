'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/postJson';
import { useOnline } from '@/ui/useOnline';
import { formatMinutes, money } from '../../format';

export interface EditLine {
  uid: string;
  kind: 'labor' | 'part';
  serviceId?: string;
  partId?: string;
  code: string;
  name: string;
  /** labor: minutes; part: quantity */
  amount: number;
  standardMinutes?: number | null;
  qtyScale?: number;
  listUnitVnd: number;
  /** actual price typed by the advisor; '' = the list price */
  unit: string;
  amountVnd: number;
  discountBp: number;
  available: number | null;
}
export interface EditItem {
  uid: string;
  name: string;
  necessity: 'required' | 'optional';
  customerRequested: boolean;
  lines: EditLine[];
}

interface ServicePick {
  id: string;
  code: string;
  name: string;
  standardMinutes: number | null;
  hourlyRateVnd: number | null;
}
interface PartPick {
  id: string;
  code: string;
  name: string;
  quantityScale: number;
  listPriceVnd: number | null;
  available: number | null;
}

let counter = 0;
const uid = () => `u${++counter}`;
export const newItem = (name = ''): EditItem => ({
  uid: uid(),
  name,
  necessity: 'required',
  customerRequested: false,
  lines: [],
});

/** Search box with a result list (combobox pattern: arrow keys are not needed, results are buttons in tab order). */
function Picker<T extends { id: string; code: string; name: string }>(props: {
  url: string;
  label: string;
  placeholder: string;
  empty: string;
  render: (r: T) => string;
  onPick: (r: T) => void;
  testId: string;
}) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<T[] | null>(null);
  const seq = useRef(0);
  const id = useId();
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      seq.current += 1;
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const res = await fetch(`${props.url}?q=${encodeURIComponent(q)}`);
      const body = (await res.json().catch(() => null)) as { items?: T[] } | null;
      if (mine === seq.current) setRows(res.ok ? (body?.items ?? []) : []);
    }, 250);
    return () => clearTimeout(timer);
  }, [text, props.url]);
  const shown = text.trim().length >= 2 ? rows : null;
  return (
    <div className="field rec-picker">
      <label className="field__label" htmlFor={id}>
        {props.label}
      </label>
      <input
        id={id}
        className="input"
        type="search"
        autoComplete="off"
        value={text}
        placeholder={props.placeholder}
        onChange={(e) => setText(e.target.value)}
        data-testid={props.testId}
      />
      {shown ? (
        <ul className="rec-picker__list" role="listbox" aria-label={props.label}>
          {shown.length === 0 ? <li className="text-secondary">{props.empty}</li> : null}
          {shown.map((r) => (
            <li key={r.id} role="option" aria-selected="false">
              <button
                type="button"
                className="rec-picker__opt"
                onClick={() => {
                  props.onPick(r);
                  setText('');
                  setRows(null);
                }}
              >
                {props.render(r)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * G2-QUO-02: lines are chosen by WHAT (service, part, quantity, optional actual price); the server
 * reads hours, hourly rate, list price, discount limit and tax from the effective-dated config and
 * returns every amount (FR-REC-004/005). Totals refresh after Lưu. Editing a sent version saves as the
 * next version (ba-answers-03 Câu 1).
 */
export function QuoteEditor(props: {
  quoteId: string;
  version: number;
  nextVersionN: number | null;
  initial: EditItem[];
  labels: Record<string, string>;
}) {
  const l = props.labels;
  const router = useRouter();
  const online = useOnline();
  const [items, setItems] = useState<EditItem[]>(props.initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const edit = (fn: (draft: EditItem[]) => EditItem[]) => {
    setItems((cur) => fn(cur));
    setDirty(true);
  };
  const setLine = (iu: string, lu: string, patch: Partial<EditLine>) =>
    edit((cur) =>
      cur.map((it) =>
        it.uid === iu
          ? { ...it, lines: it.lines.map((ln) => (ln.uid === lu ? { ...ln, ...patch } : ln)) }
          : it,
      ),
    );

  async function save() {
    setBusy(true);
    setBanner(null);
    setErrors({});
    const payload = {
      version: props.version,
      items: items.map((it) => ({
        name: it.name.trim() || l.itemDefault,
        necessity: it.necessity,
        customerRequested: it.necessity === 'optional' && it.customerRequested,
        lines: it.lines.map((ln) =>
          ln.kind === 'labor'
            ? {
                kind: 'labor',
                serviceId: ln.serviceId,
                minutes: ln.amount,
                ...(ln.unit.trim() !== '' ? { unitVnd: Number(ln.unit.replace(/\D/g, '')) } : {}),
              }
            : {
                kind: 'part',
                partId: ln.partId,
                qty: ln.amount,
                ...(ln.unit.trim() !== '' ? { unitVnd: Number(ln.unit.replace(/\D/g, '')) } : {}),
              },
        ),
      })),
    };
    const r = await postJson(`/api/v1/rec/quotes/${props.quoteId}`, 'PATCH', payload, newKey());
    setBusy(false);
    if (r.ok) {
      setDirty(false);
      router.refresh();
      return;
    }
    if (r.status === 409 && r.problem?.code === 'version_conflict') setBanner(l.conflict!);
    else if (r.problem?.errors?.length)
      setErrors(Object.fromEntries(r.problem.errors.map((x) => [x.field, x.message])));
    else setBanner(r.problem?.detail ?? l.unexpected!);
  }

  return (
    <section className="card" data-gm-draft={dirty ? 'true' : undefined} data-testid="quote-editor">
      <div className="card__header">
        <div>
          <h2 className="card__title">{l.lines}</h2>
          <div className="card__subtitle">{l.linesLead}</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => edit((c) => [...c, newItem(`${l.itemDefault} ${c.length + 1}`)])}
          data-testid="add-item"
        >
          {l.addItem}
        </Button>
      </div>
      <div className="card__body stack">
        {props.nextVersionN ? (
          <div className="alert alert--info" role="status">
            <div className="alert__body">
              <span>{l.reviseNote!.replace('{n}', String(props.nextVersionN))}</span>
            </div>
          </div>
        ) : null}
        {banner ? (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">
              <span>{banner}</span>
            </div>
          </div>
        ) : null}
        {!online ? (
          <div className="alert alert--warning" role="status">
            <div className="alert__body">
              <span>{l.offline}</span>
            </div>
          </div>
        ) : null}
        {items.length === 0 ? <p className="text-secondary">{l.noItems}</p> : null}
        {items.map((it, ii) => (
          <fieldset key={it.uid} className="rec-item" data-testid="quote-item">
            <legend className="sr-only">{it.name || l.itemDefault}</legend>
            <div className="rec-item__head">
              <div className="field">
                <label className="field__label" htmlFor={`n-${it.uid}`}>
                  {l.itemName}
                </label>
                <input
                  id={`n-${it.uid}`}
                  className="input"
                  maxLength={160}
                  value={it.name}
                  onChange={(e) =>
                    edit((c) =>
                      c.map((x) => (x.uid === it.uid ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`nc-${it.uid}`}>
                  {l.necessity}
                </label>
                <select
                  id={`nc-${it.uid}`}
                  className="select"
                  value={it.necessity}
                  onChange={(e) =>
                    edit((c) =>
                      c.map((x) =>
                        x.uid === it.uid
                          ? { ...x, necessity: e.target.value as 'required' | 'optional' }
                          : x,
                      ),
                    )
                  }
                >
                  <option value="required">{l.required}</option>
                  <option value="optional">{l.optional}</option>
                </select>
              </div>
              {it.necessity === 'optional' ? (
                <label className="check rec-item__req">
                  <input
                    type="checkbox"
                    checked={it.customerRequested}
                    onChange={(e) =>
                      edit((c) =>
                        c.map((x) =>
                          x.uid === it.uid ? { ...x, customerRequested: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  <span className="check__box" />
                  <span>{l.customerRequested}</span>
                </label>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => edit((c) => c.filter((x) => x.uid !== it.uid))}
              >
                {l.removeItem}
              </Button>
            </div>
            {it.lines.length > 0 ? (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label={it.name || l.itemDefault}
              >
                <table className="table table--compact rec-lines">
                  <thead>
                    <tr>
                      <th scope="col">{l.line}</th>
                      <th scope="col" className="col-num">
                        {l.qtyOrMinutes}
                      </th>
                      <th scope="col" className="col-num">
                        {l.listPrice}
                      </th>
                      <th scope="col" className="col-num">
                        {l.actualPrice}
                      </th>
                      <th scope="col" className="col-num">
                        {l.amount}
                      </th>
                      <th scope="col">
                        <span className="sr-only">{l.removeLine}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {it.lines.map((ln, li) => {
                      const field = `items.${ii}.lines.${li}`;
                      const msg = errors[field] ?? errors[`${field}.unitVnd`];
                      return (
                        <tr key={ln.uid}>
                          <td>
                            <span className="cell-primary">{ln.name}</span>
                            <span className="cell-sub num">{ln.code}</span>
                            {ln.kind === 'labor' && ln.standardMinutes ? (
                              <span className="cell-sub">
                                {l.standard}: {formatMinutes(ln.standardMinutes)}
                              </span>
                            ) : null}
                            {ln.kind === 'part' && ln.available !== null ? (
                              <span
                                className={`cell-sub${ln.available < ln.amount ? ' rec-short' : ''}`}
                                data-testid="available"
                              >
                                {ln.available < ln.amount
                                  ? l.short!.replace('{n}', String(ln.available))
                                  : l.available!.replace('{n}', String(ln.available))}
                              </span>
                            ) : null}
                            {msg ? (
                              <span className="field__error" role="alert">
                                {msg}
                              </span>
                            ) : null}
                          </td>
                          <td className="col-num">
                            <input
                              className="input input--num"
                              inputMode="numeric"
                              aria-label={`${ln.kind === 'labor' ? l.minutes : l.qty} ${ln.name}`}
                              value={ln.amount}
                              onChange={(e) =>
                                setLine(it.uid, ln.uid, {
                                  amount: Math.max(
                                    1,
                                    Number(e.target.value.replace(/\D/g, '')) || 1,
                                  ),
                                })
                              }
                            />
                          </td>
                          <td className="col-num num">{money(ln.listUnitVnd)}</td>
                          <td className="col-num">
                            <input
                              className="input input--num"
                              inputMode="numeric"
                              aria-label={`${l.actualPrice} ${ln.name}`}
                              placeholder={String(ln.listUnitVnd)}
                              value={ln.unit}
                              onChange={(e) =>
                                setLine(it.uid, ln.uid, { unit: e.target.value.replace(/\D/g, '') })
                              }
                            />
                            {ln.discountBp > 0 ? (
                              <span className="cell-sub">
                                {l.discount!.replace(
                                  '{pct}',
                                  String(ln.discountBp / 100).replace('.', ','),
                                )}
                              </span>
                            ) : null}
                          </td>
                          <td className="col-num num">{money(ln.amountVnd)}</td>
                          <td className="col-actions">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`${l.removeLine} ${ln.name}`}
                              onClick={() =>
                                edit((c) =>
                                  c.map((x) =>
                                    x.uid === it.uid
                                      ? { ...x, lines: x.lines.filter((y) => y.uid !== ln.uid) }
                                      : x,
                                  ),
                                )
                              }
                            >
                              {l.removeLine}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="rec-item__add">
              <Picker<ServicePick>
                url="/api/v1/rec/pickers/services"
                label={l.addLabor!}
                placeholder={l.laborPlaceholder!}
                empty={l.none!}
                testId={`pick-service-${ii}`}
                render={(s) =>
                  `${s.code} · ${s.name}${s.standardMinutes ? ` · ${formatMinutes(s.standardMinutes)}` : ''}${s.hourlyRateVnd ? ` · ${money(s.hourlyRateVnd)}/${l.hourUnit}` : ''}`
                }
                onPick={(s) =>
                  edit((c) =>
                    c.map((x) =>
                      x.uid === it.uid
                        ? {
                            ...x,
                            lines: [
                              ...x.lines,
                              {
                                uid: uid(),
                                kind: 'labor',
                                serviceId: s.id,
                                code: s.code,
                                name: s.name,
                                amount: s.standardMinutes ?? 60,
                                standardMinutes: s.standardMinutes,
                                listUnitVnd: s.hourlyRateVnd ?? 0,
                                unit: '',
                                amountVnd: 0,
                                discountBp: 0,
                                available: null,
                              },
                            ],
                          }
                        : x,
                    ),
                  )
                }
              />
              <Picker<PartPick>
                url="/api/v1/rec/pickers/parts"
                label={l.addPart!}
                placeholder={l.partPlaceholder!}
                empty={l.none!}
                testId={`pick-part-${ii}`}
                render={(p) =>
                  `${p.code} · ${p.name}${p.listPriceVnd !== null ? ` · ${money(p.listPriceVnd)}` : ` · ${l.noPrice}`}${p.available !== null ? ` · ${l.available!.replace('{n}', String(p.available))}` : ''}`
                }
                onPick={(p) =>
                  edit((c) =>
                    c.map((x) =>
                      x.uid === it.uid
                        ? {
                            ...x,
                            lines: [
                              ...x.lines,
                              {
                                uid: uid(),
                                kind: 'part',
                                partId: p.id,
                                code: p.code,
                                name: p.name,
                                amount: 1,
                                qtyScale: p.quantityScale,
                                listUnitVnd: p.listPriceVnd ?? 0,
                                unit: '',
                                amountVnd: 0,
                                discountBp: 0,
                                available: p.available,
                              },
                            ],
                          }
                        : x,
                    ),
                  )
                }
              />
            </div>
          </fieldset>
        ))}
        <div className="rec-actions">
          <Button
            variant="primary"
            loading={busy}
            disabled={!online || !dirty}
            onClick={() => void save()}
            data-testid="quote-save"
          >
            {props.nextVersionN ? l.saveNew!.replace('{n}', String(props.nextVersionN)) : l.save}
          </Button>
          <span className="text-secondary" role="status">
            {dirty ? l.unsaved : ''}
          </span>
        </div>
      </div>
    </section>
  );
}

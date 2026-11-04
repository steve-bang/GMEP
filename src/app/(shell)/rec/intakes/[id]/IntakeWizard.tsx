'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isoToVi, viToIso } from '@/platform/format/date';
import { Button } from '@/ui/components/Button';
import { DateInput } from '@/ui/components/DateInput';
import { newKey, postJson, type Problem } from '@/ui/components/postJson';
import { maskViDate } from '@/ui/dateMask';
import { useOnline } from '@/ui/useOnline';
import { formatKm } from '../../format';

interface IntakeData {
  id: string;
  number: string;
  plate: string;
  vehicleLabel: string;
  customerName: string;
  step: number;
  km: number | null;
  kmReason: string | null;
  kmNote: string | null;
  fuel: string | null;
  customerRequest: string | null;
  condition: string | null;
  belongings: string[];
  belongingsOther: string | null;
  serviceType: string | null;
  promisedDate: string | null;
  promisedTime: string | null;
  customerParts: { name: string; qty: number; condition: string }[];
  internalNote: string | null;
  version: number;
  updatedAt: string;
}

const FUELS = ['empty', 'quarter', 'half', 'three_quarters', 'full'] as const;
const REASONS = ['typo', 'odometer_replaced', 'other'] as const;
const clock = (iso: string) => iso.slice(11, 16);

/**
 * G2-REC-01 wizard (5 steps). The draft is saved after every step (FR-REC-001); the odometer and the
 * customer's own words are required (FR-REC-002); a reading below the last one asks for a reason
 * (FR-REC-003). The server repeats every check, the client messages only save a round trip.
 */
export function IntakeWizard(props: {
  intake: IntakeData;
  lastKm: number | null;
  labels: Record<string, string>;
  belongingLabels: Record<string, string>;
  /** R7: the active entries of the company service-type catalogue (plus the stored one if it was retired) */
  serviceTypes: { code: string; name: string }[];
  advisorName: string;
}) {
  const l = props.labels;
  const router = useRouter();
  const online = useOnline();
  const [i, setI] = useState(props.intake);
  const [step, setStep] = useState(Math.min(Math.max(props.intake.step, 2), 5));
  const [km, setKm] = useState(props.intake.km === null ? '' : String(props.intake.km));
  const [kmReason, setKmReason] = useState(props.intake.kmReason ?? '');
  const [kmNote, setKmNote] = useState(props.intake.kmNote ?? '');
  const [fuel, setFuel] = useState(props.intake.fuel ?? '');
  const [request, setRequest] = useState(props.intake.customerRequest ?? '');
  const [condition, setCondition] = useState(props.intake.condition ?? '');
  const [belongings, setBelongings] = useState<string[]>(props.intake.belongings);
  const [other, setOther] = useState(props.intake.belongingsOther ?? '');
  const [serviceType, setServiceType] = useState(props.intake.serviceType ?? '');
  const [date, setDate] = useState(isoToVi(props.intake.promisedDate));
  const [time, setTime] = useState(props.intake.promisedTime ?? '');
  const [parts, setParts] = useState(props.intake.customerParts);
  const [note, setNote] = useState(props.intake.internalNote ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [keys] = useState(() => ({ complete: newKey(), cancel: newKey() }));

  const kmNum = km.trim() === '' ? null : Number(km.replace(/\./g, ''));
  const below = kmNum !== null && props.lastKm !== null && kmNum < props.lastKm;
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
    };

  function body(forStep: number) {
    return {
      version: i.version,
      step: forStep,
      ...(kmNum !== null && Number.isInteger(kmNum) ? { km: kmNum } : {}),
      kmReason: below ? kmReason || null : null,
      kmNote: below && kmReason === 'other' ? kmNote : null,
      fuel: fuel || null,
      customerRequest: request,
      condition,
      belongings,
      belongingsOther: other,
      serviceType: serviceType || null,
      promisedDate: date ? viToIso(date) : null,
      promisedTime: time || null,
      customerParts: parts.filter((p) => p.name.trim()),
      internalNote: note,
    };
  }

  /** client-side checks of the current step (the same rules the server enforces) */
  function validate(forStep: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (forStep >= 2) {
      if (kmNum === null || !Number.isInteger(kmNum) || kmNum < 0) e.km = l.kmRequired!;
      if (!request.trim()) e.customerRequest = l.requestRequired!;
      if (below && !kmReason) e.kmReason = l.kmWarnText!;
      if (below && kmReason === 'other' && kmNote.trim().length < 5) e.kmNote = l.kmNote!;
    }
    if (forStep >= 4) {
      if (!serviceType) e.serviceType = l.serviceType!;
      if (!date || !viToIso(date)) e.promisedDate = l.promisedDateRequired!;
    }
    return e;
  }

  async function save(forStep: number): Promise<IntakeData | null> {
    setBusy(true);
    setBanner(null);
    const r = await postJson(`/api/v1/rec/intakes/${i.id}`, 'PATCH', body(forStep), newKey());
    setBusy(false);
    if (r.ok) {
      const next = r.data as IntakeData;
      setI(next);
      setSavedAt(clock(next.updatedAt));
      setDirty(false);
      return next;
    }
    reportProblem(r.problem, r.status);
    return null;
  }

  function reportProblem(p: Problem | null, status: number) {
    if (status === 409 && p?.code === 'version_conflict') setBanner(l.conflict!);
    else if (p?.errors?.length)
      setErrors(Object.fromEntries(p.errors.map((x) => [x.field, x.message])));
    else setBanner(p?.detail ?? l.unexpected!);
  }

  async function go(to: number) {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!(await save(to))) return;
    setStep(to);
  }

  async function finish() {
    const e = validate(5);
    setErrors(e);
    if (Object.keys(e).length) {
      setStep(e.km || e.customerRequest || e.kmReason || e.kmNote ? 2 : 4);
      return;
    }
    const saved = await save(5);
    if (!saved) return;
    setBusy(true);
    const r = await postJson(
      `/api/v1/rec/intakes/${i.id}/complete`,
      'POST',
      { version: saved.version },
      keys.complete,
    );
    if (r.ok) {
      router.push(`/rec/intakes/${encodeURIComponent(i.id)}`);
      router.refresh();
      return;
    }
    setBusy(false);
    reportProblem(r.problem, r.status);
  }

  async function cancel() {
    setBusy(true);
    const r = await postJson(
      `/api/v1/rec/intakes/${i.id}/cancel`,
      'POST',
      { version: i.version, reason },
      keys.cancel,
    );
    if (r.ok) {
      router.push('/rec/intakes');
      return;
    }
    setBusy(false);
    setErrors({ cancel: r.problem?.errors?.[0]?.message ?? r.problem?.detail ?? l.unexpected! });
  }

  const err = (f: string) =>
    errors[f] ? (
      <span className="field__error" id={`${f}-e`} role="alert">
        {errors[f]}
      </span>
    ) : null;
  const names = [l.step1, l.step2, l.step3, l.step4, l.step5];

  return (
    <div className="stack" data-gm-draft={dirty ? 'true' : undefined} data-testid="intake-wizard">
      <section className="card rec-flow" aria-label={l.stepOf!.replace('{step}', String(step))}>
        <ol className="stepper">
          {names.map((n, idx) => (
            <li
              key={n}
              className={`stepper__step${idx + 1 < step ? ' is-done' : ''}${idx + 1 === step ? ' is-current' : ''}`}
              aria-current={idx + 1 === step ? 'step' : undefined}
            >
              <div className="stepper__bar" />
              <div className="stepper__label">
                <span className="stepper__num">{idx + 1}</span>
                <span className="stepper__text">{n}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-secondary" data-testid="step-title">
          {l.stepOf!.replace('{step}', String(step))}
        </p>
      </section>

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

      <section className="card" aria-labelledby="wiz-h">
        <div className="card__header">
          <h2 className="card__title" id="wiz-h">
            {names[step - 1]}
          </h2>
        </div>
        <div className="card__body stack">
          {step === 2 ? (
            <>
              <div className="rec-vehicle" data-testid="intake-vehicle">
                <span className="plate-tag">{i.plate}</span> <strong>{i.vehicleLabel}</strong>
                <span className="text-secondary">
                  {' '}
                  · {l.owner}: {i.customerName}
                </span>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="km">
                    {l.km}
                    <span className="field__req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div className="input-group input-group--suffix">
                    <input
                      id="km"
                      className="input input--num"
                      inputMode="numeric"
                      value={km}
                      onChange={(e) => touch(setKm)(e.target.value.replace(/[^\d.]/g, ''))}
                      aria-invalid={errors.km ? true : undefined}
                      aria-describedby="km-h km-e"
                    />
                    <span className="input-group__suffix">{l.kmUnit}</span>
                  </div>
                  <span className="field__hint" id="km-h">
                    {props.lastKm === null
                      ? '—'
                      : l.lastKm!.replace('{km}', formatKm(props.lastKm))}
                  </span>
                  {err('km')}
                </div>
                <div className="field">
                  <span className="field__label" id="fuel-l">
                    {l.fuel}
                  </span>
                  <div className="rec-chips" role="group" aria-labelledby="fuel-l">
                    {FUELS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="chip-filter"
                        aria-pressed={fuel === f}
                        onClick={() => touch(setFuel)(fuel === f ? '' : f)}
                      >
                        {l[`fuel_${f}`]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {below ? (
                <div className="alert alert--warning" role="alert" data-testid="km-warning">
                  <div className="alert__body">
                    <span className="alert__title">
                      {l.kmWarnTitle!.replace('{km}', formatKm(props.lastKm!))}
                    </span>
                    <span>{l.kmWarnText}</span>
                    <div className="field">
                      <label className="field__label" htmlFor="km-reason">
                        {l.kmReason}
                        <span className="field__req" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <select
                        id="km-reason"
                        className="select"
                        value={kmReason}
                        onChange={(e) => touch(setKmReason)(e.target.value)}
                        aria-describedby="kmReason-e"
                      >
                        <option value="">—</option>
                        {REASONS.map((r) => (
                          <option key={r} value={r}>
                            {l[`kmReason_${r}`]}
                          </option>
                        ))}
                      </select>
                      {err('kmReason')}
                    </div>
                    {kmReason === 'other' ? (
                      <div className="field">
                        <label className="field__label" htmlFor="km-note">
                          {l.kmNote}
                        </label>
                        <input
                          id="km-note"
                          className="input"
                          maxLength={200}
                          value={kmNote}
                          onChange={(e) => touch(setKmNote)(e.target.value)}
                          aria-describedby="kmNote-e"
                        />
                        {err('kmNote')}
                      </div>
                    ) : null}
                    <span className="text-secondary">{l.abnormalNote}</span>
                  </div>
                </div>
              ) : null}
              <div className="field">
                <label className="field__label" htmlFor="request">
                  {l.request}
                  <span className="field__req" aria-hidden="true">
                    *
                  </span>
                </label>
                <textarea
                  id="request"
                  className="textarea"
                  maxLength={1000}
                  value={request}
                  onChange={(e) => touch(setRequest)(e.target.value)}
                  placeholder={l.requestHint}
                  aria-describedby="customerRequest-e"
                  aria-invalid={errors.customerRequest ? true : undefined}
                />
                {err('customerRequest')}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="condition">
                  {l.condition}
                </label>
                <textarea
                  id="condition"
                  className="textarea"
                  maxLength={1000}
                  value={condition}
                  onChange={(e) => touch(setCondition)(e.target.value)}
                />
                <span className="field__hint">{l.photosNote}</span>
              </div>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <fieldset className="rec-fieldset">
                <legend className="field__label">{l.belongings}</legend>
                <div className="rec-checks">
                  {Object.entries(props.belongingLabels).map(([k, label]) => (
                    <label key={k} className="check">
                      <input
                        type="checkbox"
                        checked={belongings.includes(k)}
                        onChange={(e) =>
                          touch(setBelongings)(
                            e.target.checked
                              ? [...belongings, k]
                              : belongings.filter((b) => b !== k),
                          )
                        }
                      />
                      <span className="check__box" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label className="field__label" htmlFor="other">
                  {l.belongingsOther}
                </label>
                <input
                  id="other"
                  className="input"
                  maxLength={200}
                  value={other}
                  onChange={(e) => touch(setOther)(e.target.value)}
                />
                <span className="field__hint">{l.belongingsHint}</span>
              </div>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="svc">
                    {l.serviceType}
                    <span className="field__req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <select
                    id="svc"
                    className="select"
                    value={serviceType}
                    onChange={(e) => touch(setServiceType)(e.target.value)}
                    aria-describedby="serviceType-e"
                  >
                    <option value="">—</option>
                    {props.serviceTypes.map((x) => (
                      <option key={x.code} value={x.code}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  {err('serviceType')}
                </div>
                <div className="field">
                  <span className="field__label">{l.advisor}</span>
                  <span>{props.advisorName}</span>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="pd">
                    {l.promisedDate}
                    <span className="field__req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <DateInput
                    id="pd"
                    defaultValue={date}
                    onChange={(e) => touch(setDate)(maskViDate(e.target.value))}
                    aria-describedby="promisedDate-e"
                  />
                  {err('promisedDate')}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="pt">
                    {l.promisedTime}
                  </label>
                  <input
                    id="pt"
                    className="input input--num"
                    inputMode="numeric"
                    placeholder="HH:mm"
                    maxLength={5}
                    value={time}
                    onChange={(e) => touch(setTime)(e.target.value)}
                    aria-describedby="promisedTime-e"
                  />
                  {err('promisedTime')}
                </div>
              </div>
              <fieldset className="rec-fieldset">
                <legend className="field__label">{l.customerParts}</legend>
                {parts.map((p, idx) => (
                  <div className="rec-partrow" key={idx}>
                    <input
                      className="input"
                      aria-label={l.partName}
                      value={p.name}
                      maxLength={120}
                      onChange={(e) =>
                        touch(setParts)(
                          parts.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                    <input
                      className="input input--num"
                      aria-label={l.partQty}
                      inputMode="numeric"
                      value={p.qty}
                      onChange={(e) =>
                        touch(setParts)(
                          parts.map((x, j) =>
                            j === idx ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x,
                          ),
                        )
                      }
                    />
                    <input
                      className="input"
                      aria-label={l.partCondition}
                      value={p.condition}
                      maxLength={120}
                      onChange={(e) =>
                        touch(setParts)(
                          parts.map((x, j) =>
                            j === idx ? { ...x, condition: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => touch(setParts)(parts.filter((_, j) => j !== idx))}
                    >
                      {l.removePart}
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => touch(setParts)([...parts, { name: '', qty: 1, condition: '' }])}
                  >
                    {l.addPart}
                  </Button>
                </div>
                <span className="field__hint">{l.customerPartsHint}</span>
              </fieldset>
              <div className="field">
                <label className="field__label" htmlFor="note">
                  {l.internalNote}
                </label>
                <textarea
                  id="note"
                  className="textarea"
                  maxLength={500}
                  value={note}
                  onChange={(e) => touch(setNote)(e.target.value)}
                />
              </div>
            </>
          ) : null}
          {step === 5 ? (
            <dl className="inv-facts" data-testid="intake-review">
              <div>
                <dt>{l.vehicle}</dt>
                <dd>
                  <span className="plate">{i.plate}</span> {i.vehicleLabel}
                </dd>
              </div>
              <div>
                <dt>{l.owner}</dt>
                <dd>{i.customerName}</dd>
              </div>
              <div>
                <dt>{l.km}</dt>
                <dd className="num">{kmNum === null ? '—' : formatKm(kmNum)}</dd>
              </div>
              <div>
                <dt>{l.request}</dt>
                <dd>{request || '—'}</dd>
              </div>
              <div>
                <dt>{l.belongings}</dt>
                <dd>
                  {[...belongings.map((b) => props.belongingLabels[b]), other]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt>{l.serviceType}</dt>
                <dd>
                  {props.serviceTypes.find((x) => x.code === serviceType)?.name ??
                    (serviceType || '—')}
                </dd>
              </div>
              <div>
                <dt>{l.promisedDate}</dt>
                <dd className="num">
                  {date || '—'} {time}
                </dd>
              </div>
              <div>
                <dt>{l.advisor}</dt>
                <dd>{props.advisorName}</dd>
              </div>
            </dl>
          ) : null}
          {step === 5 ? <p className="text-secondary">{l.noQuote}</p> : null}
        </div>
      </section>

      {cancelling ? (
        <section className="card" aria-label={l.cancelIntake}>
          <div className="card__body stack">
            <div className="field">
              <label className="field__label" htmlFor="cancel-reason">
                {l.cancelReason}
              </label>
              <textarea
                id="cancel-reason"
                className="textarea"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {err('cancel')}
            </div>
            <div className="rec-actions">
              <Button variant="danger" loading={busy} onClick={() => void cancel()}>
                {l.cancelConfirm}
              </Button>
              <Button variant="ghost" onClick={() => setCancelling(false)}>
                {l.keep}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="rec-foot" role="group" aria-label={l.stepOf!.replace('{step}', String(step))}>
        <span className="rec-foot__draft" role="status">
          {savedAt ? l.savedAt!.replace('{time}', savedAt) : ''}
        </span>
        <Button variant="ghost" onClick={() => setCancelling(true)}>
          {l.cancelIntake}
        </Button>
        <Button
          variant="secondary"
          loading={busy}
          disabled={!online}
          onClick={() => void save(step)}
          data-testid="save-draft"
        >
          {l.saveDraft}
        </Button>
        {step > 2 ? (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            {l.prev}
          </Button>
        ) : null}
        {step < 5 ? (
          <Button
            variant="primary"
            loading={busy}
            disabled={!online}
            onClick={() => void go(step + 1)}
            data-testid="wizard-next"
          >
            {l.next}
          </Button>
        ) : (
          <Button
            variant="primary"
            loading={busy}
            disabled={!online}
            onClick={() => void finish()}
            data-testid="wizard-finish"
          >
            {l.finish}
          </Button>
        )}
      </div>
    </div>
  );
}

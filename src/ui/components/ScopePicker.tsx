'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { useOnline } from '../useOnline';
import { hasUnsavedDraft, UnsavedDraftDialog } from './UnsavedDraftDialog';

export interface ScopeOptionView {
  branchId: string;
  name: string;
  status: 'active' | 'closing' | 'locked';
  roles: string[];
}
export interface ScopeView {
  mode: 'static' | 'picker' | 'none';
  /** branch id, 'all' or null when nothing is chosen yet */
  current: string | null;
  canConsolidate: boolean;
  mustChoose: boolean;
  options: ScopeOptionView[];
}

/**
 * Scope picker (G5-SCP-01/02, BA §4). ASSUMPTIONS from the designer, kept as the prototype shows:
 * one branch -> static chip, no button, no Tab stop; several branches -> a dropdown panel with
 * "Một chi nhánh | Hợp nhất" (merged only for CH/QV), a list of assigned branches with the user's
 * roles, and an explicit "Áp dụng phạm vi". The choice is stored server-side in the session
 * (PUT /api/v1/sys/scope); the page reloads so every server component re-reads the new scope.
 */
export function ScopePicker({
  scope,
  roleNames,
}: {
  scope: ScopeView;
  roleNames: Record<string, string>;
}) {
  const t = useTranslations('scope');
  const uid = useId();
  const [open, setOpen] = useState(scope.mustChoose);
  const [mode, setMode] = useState<'one' | 'merged'>(scope.current === 'all' ? 'merged' : 'one');
  const [pick, setPick] = useState<string | null>(
    scope.current && scope.current !== 'all' ? scope.current : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const offline = !useOnline();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !scope.mustChoose && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!scope.mustChoose && root.current && !root.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, scope.mustChoose]);

  if (scope.mode === 'none')
    return (
      <span className="branch-static" data-testid="branch-scope">
        <Icon name="map-pin" />
        <span className="branch-static__text">
          <span className="branch-btn__caption">{t('caption')}</span>
          <span className="branch-btn__name">{t('none')}</span>
        </span>
      </span>
    );

  if (scope.mode === 'static') {
    const only = scope.options[0];
    return (
      <span className="branch-static" data-testid="branch-scope">
        <Icon name="map-pin" />
        <span className="branch-static__text">
          <span className="branch-btn__caption">{t('own')}</span>
          <span className="branch-btn__name" title={only?.name}>
            {only?.name}
          </span>
        </span>
      </span>
    );
  }

  const currentName =
    scope.current === 'all'
      ? t('all', { count: scope.options.length })
      : (scope.options.find((o) => o.branchId === scope.current)?.name ?? t('choose'));
  const selectedName =
    mode === 'merged'
      ? t('all', { count: scope.options.length })
      : scope.options.find((o) => o.branchId === pick)?.name;
  const changed =
    mode === 'merged' ? scope.current !== 'all' : pick !== null && pick !== scope.current;

  async function apply() {
    if (offline) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/sys/scope', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ branchId: mode === 'merged' ? 'all' : pick }),
      });
      if (!res.ok) {
        setError(t('failed'));
        return;
      }
      window.location.reload();
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="g5-scope" ref={root} data-testid="branch-scope">
      <button
        type="button"
        className={`branch-btn${scope.current === 'all' ? ' is-all' : ''}`}
        id={`${uid}-trigger`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="map-pin" />
        <span className="branch-btn__text">
          <span className="branch-btn__caption">{t('caption')}</span>
          <span className="branch-btn__name">{currentName}</span>
        </span>
        <Icon name="chevron-down" size="sm" />
      </button>
      {open ? (
        <>
          <div className="g5-backdrop" onClick={() => !scope.mustChoose && setOpen(false)} />
          <div
            className="g5-panel"
            id={`${uid}-panel`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`${uid}-t`}
          >
            <span className="g5-panel__grab" aria-hidden="true" />
            <div className="g5-panel__head">
              <h2 className="g5-panel__title" id={`${uid}-t`}>
                {t('title')}
              </h2>
              <p className="t-body-sm text-secondary" style={{ margin: 0 }}>
                {scope.mustChoose ? t('mustChoose') : t('hint', { count: scope.options.length })}
              </p>
            </div>
            <div className="g5-panel__body">
              <div className="segmented g5-mode" role="radiogroup" aria-label={t('mode')}>
                <button
                  type="button"
                  className="segmented__item"
                  role="radio"
                  aria-checked={mode === 'one'}
                  onClick={() => setMode('one')}
                >
                  {t('modeOne')}
                </button>
                <button
                  type="button"
                  className="segmented__item"
                  role="radio"
                  aria-checked={mode === 'merged'}
                  aria-disabled={!scope.canConsolidate}
                  aria-describedby={`${uid}-why`}
                  onClick={() => scope.canConsolidate && setMode('merged')}
                >
                  {t('modeMerged')}
                </button>
              </div>
              {!scope.canConsolidate ? (
                <p className="g5-why" id={`${uid}-why`}>
                  <Icon name="lock" size="sm" />
                  <span>{t('mergedNotAllowed')}</span>
                </p>
              ) : null}
              {mode === 'one' ? (
                <div className="g5-list" role="radiogroup" aria-label={t('listLabel')}>
                  {scope.options.map((o) => (
                    <button
                      key={o.branchId}
                      type="button"
                      className="g5-opt"
                      role="radio"
                      aria-checked={pick === o.branchId}
                      onClick={() => setPick(o.branchId)}
                    >
                      <span className="g5-opt__dot" aria-hidden="true" />
                      <span className="g5-opt__main">
                        <span className="g5-opt__name">{o.name}</span>
                        <span className="g5-opt__sub">
                          {t('roles', { roles: o.roles.map((r) => roleNames[r] ?? r).join(', ') })}
                        </span>
                      </span>
                      {o.status !== 'active' ? (
                        <span className="tag">{t(`status.${o.status}`)}</span>
                      ) : null}
                      {scope.current === o.branchId ? (
                        <span className="tag">{t('inUse')}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="g5-spec__note">{t('mergedNote')}</p>
              )}
              {error ? (
                <div className="alert alert--danger" role="alert">
                  <Icon name="alert-triangle" />
                  <div className="alert__body">{error}</div>
                </div>
              ) : null}
            </div>
            <div className="g5-panel__foot">
              <p className="g5-panel__sum" aria-live="polite">
                {offline
                  ? t('offline')
                  : changed
                    ? t('willView', { name: selectedName ?? '' })
                    : t('unchanged')}
              </p>
              {!scope.mustChoose ? (
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  {t('cancel')}
                </Button>
              ) : null}
              <Button
                variant="primary"
                loading={busy}
                aria-disabled={!changed || offline}
                disabled={!changed || offline}
                onClick={() => (hasUnsavedDraft() ? setConfirm(true) : void apply())}
              >
                {t('apply')}
              </Button>
            </div>
          </div>
        </>
      ) : null}
      <UnsavedDraftDialog
        open={confirm}
        title={t('draftTitle')}
        text={t('draftText')}
        stayLabel={t('draftStay')}
        leaveLabel={t('draftLeave')}
        onStay={() => setConfirm(false)}
        onLeave={() => {
          setConfirm(false);
          void apply();
        }}
      />
    </div>
  );
}

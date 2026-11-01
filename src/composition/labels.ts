import type { FormLabels } from '@/ui/components/ResourceForm';

type T = (key: string, values?: Record<string, string | number>) => string;

/** Plain-string labels for ResourceForm (templates keep {count}/{time} for the client to fill). */
export function formLabels(t: T, submitKey: string, cancel = true): FormLabels {
  return {
    submit: t(submitKey),
    ...(cancel ? { cancel: t('common.cancel') } : {}),
    offline: t('common.offlineAction'),
    errorSummary: t('common.errorSummary', { count: '{count}' }),
    rateLimited: t('common.rateLimited', { time: '{time}' }),
    versionConflict: t('common.versionConflict'),
    unexpected: t('common.unexpected'),
  };
}

type Tx = T & { has: (key: string) => boolean };
const dotless = (code: string) => code.replace(/\./g, '_');

/** Vietnamese label of an audit action code such as `auth.login`; the raw code only if unmapped. */
export function auditActionLabel(t: Tx, code: string): string {
  const key = `audit.actions.${dotless(code)}`;
  return t.has(key) ? t(key) : code;
}

/** Vietnamese label of an audit entity type such as `config.tax-rate` or `warehouse`. */
export function auditEntityLabel(t: Tx, code: string): string {
  const key = `audit.entityTypes.${dotless(code)}`;
  return t.has(key) ? t(key) : code;
}

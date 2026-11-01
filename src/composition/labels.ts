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

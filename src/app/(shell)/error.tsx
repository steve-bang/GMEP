'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/ui/components/Button';
import { ErrorState } from '@/ui/components/States';

export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('states');
  return (
    <ErrorState
      title={t('errorTitle')}
      text={t('errorText')}
      reference={error.digest ? t('traceRef', { id: error.digest }) : undefined}
      actions={<Button onClick={reset}>{t('retry')}</Button>}
    />
  );
}

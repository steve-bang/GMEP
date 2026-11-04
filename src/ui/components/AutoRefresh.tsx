'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** FR-REC-022: the board and the technician's list pick up changes of other people without a manual reload (only while visible). */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}

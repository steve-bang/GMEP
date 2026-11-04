'use client';

import { Button } from '@/ui/components/Button';

/** Opens the browser print dialog; the sheet itself is print-first HTML/CSS (A4). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      variant="primary"
      icon="printer"
      onClick={() => window.print()}
      data-testid="quote-print"
    >
      {label}
    </Button>
  );
}

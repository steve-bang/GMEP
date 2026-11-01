'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/ui/components/Button';

export function MarkRead({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        await fetch(`/api/v1/sys/notifications/${encodeURIComponent(id)}/read`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}

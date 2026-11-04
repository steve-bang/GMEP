'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/ui/components/Button';
import { useAction } from '@/ui/components/useAction';

/** R37 fallback: "Đã duyệt, chưa có lệnh". Calls the same idempotent path the approval uses, so pressing twice is safe. */
export function CreateOrderButton(props: { quoteId: string; label: string; failed: string }) {
  const router = useRouter();
  const { run, busy, error } = useAction(props.failed);
  return (
    <div className="stack">
      <Button
        variant="primary"
        loading={busy === 'create'}
        onClick={async () => {
          const r = await run<{ orderId: string }>(
            'create',
            `/api/v1/rec/quotes/${props.quoteId}/create-order`,
            {},
            { refresh: false },
          );
          if (r?.orderId) router.push(`/rec/orders/${r.orderId}`);
        }}
        data-testid="quote-create-order"
      >
        {props.label}
      </Button>
      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}

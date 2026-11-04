'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { newKey, postJson } from './postJson';

/**
 * One server action per user intent: a fresh Idempotency-Key per intent, kept while the network fails (a retry is
 * safe) and dropped after any answer from the server. The server stays authoritative (409 -> refresh).
 */
export function useAction(unexpected: string, offline?: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  async function run<T = unknown>(
    intent: string,
    url: string,
    body: unknown,
    opts: { method?: string; refresh?: boolean } = {},
  ): Promise<T | null> {
    const key = keys.current.get(intent) ?? newKey();
    keys.current.set(intent, key);
    setBusy(intent);
    setError(null);
    const r = await postJson(url, opts.method ?? 'POST', body, key);
    setBusy(null);
    if (r.status === 0) {
      setError(offline ?? unexpected);
      return null;
    }
    keys.current.delete(intent);
    if (r.ok) {
      if (opts.refresh !== false) router.refresh();
      return r.data as T;
    }
    setError(r.problem?.errors?.[0]?.message ?? r.problem?.detail ?? unexpected);
    if (r.status === 409) router.refresh();
    return null;
  }
  return { run, busy, error, setError };
}

export interface Problem {
  title?: string;
  detail?: string;
  code?: string;
  traceId?: string;
  errors?: { field: string; message: string }[];
  retryAfterSeconds?: number;
}

/** Shared by forms and action buttons: posts JSON with an Idempotency-Key and understands RFC 9457 problems. */
export async function postJson(
  url: string,
  method: string,
  body: unknown,
  key: string,
): Promise<{ ok: boolean; status: number; data: unknown; problem: Problem | null }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => null);
    return {
      ok: res.ok,
      status: res.status,
      data,
      problem: res.ok ? null : (data as Problem | null),
    };
  } catch {
    return { ok: false, status: 0, data: null, problem: null };
  }
}

export const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random();

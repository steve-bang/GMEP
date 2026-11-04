import { AppError } from '../errors/errors';

/**
 * Reads a multipart body while counting bytes, so a chunked request without (or lying about) Content-Length cannot make
 * the server buffer more than `maxBytes` (413 `payload_too_large` as soon as the cap is crossed). Returns null when the
 * body is not valid multipart.
 */
export async function readFormLimited(req: Request, maxBytes: number): Promise<FormData | null> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new AppError('payload_too_large', 413);
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new AppError('payload_too_large', 413);
    }
    chunks.push(value);
  }
  const type = req.headers.get('content-type');
  return new Response(Buffer.concat(chunks), type ? { headers: { 'content-type': type } } : {})
    .formData()
    .catch(() => null);
}

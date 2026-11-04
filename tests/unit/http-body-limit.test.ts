import { describe, expect, it } from 'vitest';
import { readFormLimited } from '@/platform/http/body';

const streamOf = (parts: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(p);
      c.close();
    },
  });

describe('readFormLimited (size cap while reading, FR-SYS-007 / FR-REC-003)', () => {
  it('rejects a chunked oversized body with 413 although no Content-Length is sent', async () => {
    const big = new Uint8Array(1024);
    const req = new Request('http://x.test/', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
      body: streamOf([big, big, big]),
      duplex: 'half',
    } as RequestInit);
    await expect(readFormLimited(req, 2048)).rejects.toMatchObject({
      status: 413,
      code: 'payload_too_large',
    });
  });

  it('rejects a declared oversized body before reading it', async () => {
    const req = new Request('http://x.test/', {
      method: 'POST',
      headers: { 'content-length': '999999' },
      body: 'x',
    });
    await expect(readFormLimited(req, 100)).rejects.toMatchObject({ status: 413 });
  });

  it('parses a small multipart body', async () => {
    const fd = new FormData();
    fd.set('kind', 'parts');
    const src = new Response(fd);
    const req = new Request('http://x.test/', {
      method: 'POST',
      headers: { 'content-type': src.headers.get('content-type')! },
      body: await src.arrayBuffer(),
    });
    const form = await readFormLimited(req, 10_000);
    expect(form?.get('kind')).toBe('parts');
  });
});

/** A PDF download response (FR-REC-008): never cached (it carries business data), file name restricted to ASCII. */
export function pdfResponse(bytes: Uint8Array, fileName: string): Response {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  return new Response(bytes as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${safe}.pdf"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

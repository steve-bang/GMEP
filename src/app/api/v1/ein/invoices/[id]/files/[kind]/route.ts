import { AppError } from '@/platform/errors/errors';
import { authed } from '@/composition/api';
import { readInvoiceFile } from '@/modules/ein';

export const runtime = 'nodejs';

/** FR-EIN-006: the stored XML or PDF, served after a Scope check (the browser never talks to storage). */
export const GET = authed(async ({ ein, session, params, requestId }) => {
  const kind = params.kind === 'xml' ? 'xml' : params.kind === 'pdf' ? 'pdf' : null;
  if (!kind) throw new AppError('not_found', 404);
  const f = await readInvoiceFile(ein, session.actor, params.id ?? '', kind, { requestId });
  return new Response(Buffer.from(f.bytes), {
    status: 200,
    headers: {
      'content-type': f.contentType,
      'content-disposition': `attachment; filename="${f.filename}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});

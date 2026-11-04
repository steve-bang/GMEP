import { AppError } from '@/platform/errors/errors';
import { readFormLimited } from '@/platform/http/body';
import { json } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { listImports, previewImport } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-007: batch history of the working branch (permission data-import:view). */
export const GET = authed(async ({ sys, session }) => json(await listImports(sys, session.actor)));

/**
 * FR-SYS-007 dry run: multipart `file` (.xlsx or .csv) + `kind` [+ `warehouseId`, `mapping` JSON]. Validates every row and
 * stores the report; writes no business data. Idempotency-Key required.
 */
export const POST = authed(
  async ({ req, sys, session, requestId, idempotencyKey }) => {
    // headroom for the multipart envelope; the exact file size is checked again after parsing
    const form = await readFormLimited(req, sys.config.importMaxBytes + 64 * 1024);
    const file = form?.get('file');
    if (!form || !(file instanceof File)) throw new AppError('import_file_invalid', 422);
    let mapping: unknown;
    const rawMapping = form.get('mapping');
    if (typeof rawMapping === 'string' && rawMapping) {
      try {
        mapping = JSON.parse(rawMapping);
      } catch {
        throw new AppError('import_file_invalid', 422);
      }
    }
    const warehouseId = form.get('warehouseId');
    const r = await previewImport(
      sys,
      session.actor,
      {
        kind: form.get('kind'),
        ...(typeof warehouseId === 'string' && warehouseId ? { warehouseId } : {}),
        ...(mapping !== undefined ? { mapping } : {}),
        fileName: file.name,
        bytes: Buffer.from(await file.arrayBuffer()),
      },
      { requestId, idempotencyKey: idempotencyKey() },
    );
    return created(r.body, r.replayed);
  },
  { multipart: true },
);

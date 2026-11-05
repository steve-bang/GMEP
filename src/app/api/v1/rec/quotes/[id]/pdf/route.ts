import { authed } from '@/composition/api';
import { getContainer } from '@/composition/container';
import { pdfResponse } from '@/platform/http/pdfResponse';
import { getQuotePrintModel } from '@/modules/rec';

export const runtime = 'nodejs';

/**
 * FR-REC-008: the A4 quote as a PDF, rendered from the SAME print model as the browser sheet. GET has no side effect
 * (the print log is `POST .../print-log`). Scope and permission as for viewing the quote (`quote:view`, NFR-ISO-01);
 * `?v=<n>` selects an older version.
 */
export const GET = authed(async ({ rec, session, params, query }) => {
  const n = Number(query().v);
  const model = await getQuotePrintModel(
    rec,
    session.actor,
    params.id ?? '',
    Number.isInteger(n) && n > 0 ? n : undefined,
  );
  return pdfResponse(await getContainer().pdf.render(model), model.fileName);
});

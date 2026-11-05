import { authed } from '@/composition/api';
import { getContainer } from '@/composition/container';
import { pdfResponse } from '@/platform/http/pdfResponse';
import { getReceiptPrintModel } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-001 / FR-REC-008: the A5 receipt as a PDF from the same print model as the browser sheet (`payment:view`). */
export const GET = authed(async ({ acc, session, params }) => {
  const model = await getReceiptPrintModel(acc, session.actor, params.id ?? '');
  return pdfResponse(await getContainer().pdf.render(model), model.fileName);
});

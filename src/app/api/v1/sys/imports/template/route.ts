import { authed } from '@/composition/api';
import { XLSX_CONTENT_TYPE } from '@/platform/files/xlsxWriter';
import { importTemplate, importTemplateXlsx } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-007: template of a kind, CSV (UTF-8 with BOM, default) or a real .xlsx with `format=xlsx`. */
export const GET = authed(async ({ sys, session, query }) => {
  const kind = query().kind ?? '';
  const name = `mau-nhap-${kind.replace(/[^a-z-]/g, '')}`;
  if (query().format === 'xlsx')
    return new Response(new Uint8Array(importTemplateXlsx(sys, session.actor, kind)), {
      headers: {
        'content-type': XLSX_CONTENT_TYPE,
        'content-disposition': `attachment; filename="${name}.xlsx"`,
        'cache-control': 'no-store',
      },
    });
  return new Response(importTemplate(sys, session.actor, kind), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}.csv"`,
      'cache-control': 'no-store',
    },
  });
});

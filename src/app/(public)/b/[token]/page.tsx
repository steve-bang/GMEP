import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { AppError } from '@/platform/errors/errors';
import { formatVnd } from '@/platform/format/vnd';
import { isoToVi } from '@/platform/format/date';
import { viewPublicQuote, type PublicQuoteDto } from '@/modules/rec';
import { clientAddressFromHeaders } from '@/composition/api';
import { getContainer } from '@/composition/container';
import { CustomerQuote } from './CustomerQuote';

export const dynamic = 'force-dynamic';

const KEYS = [
  'title',
  'noscript',
  'hello',
  'lead',
  'number',
  'validUntil',
  'items',
  'itemsLead',
  'locked',
  'required',
  'optional',
  'requested',
  'details',
  'labor',
  'tax',
  'hours',
  'total',
  'taxIn',
  'totalNote',
  'chosen',
  'approve',
  'reject',
  'none',
  'warnTitle',
  'warnText',
  'warnReason',
  'warnReasonPick',
  'warnNote',
  'warnKeep',
  'warnDrop',
  'rejectTitle',
  'rejectText',
  'rejectReason',
  'rejectConfirm',
  'rejectKeep',
  'offline',
  'retry',
  'okTitle',
  'okText',
  'okPartial',
  'errExpired',
  'errSuperseded',
  'errDecided',
  'errLocked',
  'errLimited',
  'errUnexpected',
  'otpTitle',
  'otpText',
  'otpLabel',
  'otpConfirm',
  'otpResend',
  'otpResendIn',
  'otpCancel',
  'otpSentAgain',
  'otpErrInvalid',
  'otpErrExpired',
  'otpErrLocked',
  'otpErrLinkLocked',
  'otpErrUnavailable',
  'otpErrFailed',
  'phoneNote',
  'vehicle',
  'photos',
  'photosLead',
  'photoVehicle',
  'photoProposal',
  'photoOpen',
  'photoClose',
] as const;

/**
 * G2-QUO-06: the customer's page. The token in the address is the only credential: it is hashed to find
 * the link, rate limited, and any unknown, replaced or malformed token shows the same "no longer valid"
 * page. No phone, address, cost, stock or staff data is on the page (FR-REC-008, PDPL).
 */
export default async function CustomerQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const t = await getTranslations();
  const { token } = await params;
  const address = clientAddressFromHeaders(await headers());
  let dto: PublicQuoteDto;
  try {
    dto = await viewPublicQuote(getContainer().rec, token, { address });
  } catch (e) {
    const limited = e instanceof AppError && e.status === 429;
    return (
      <main className="pub__col" id="main">
        <p className="pub__brand">{t('pub.quote.title')}</p>
        <section className="pub-sheet" role="status">
          <h1>{t(limited ? 'pub.quote.limitedTitle' : 'pub.quote.invalidTitle')}</h1>
          <p>{t(limited ? 'pub.quote.limitedText' : 'pub.quote.invalidText')}</p>
        </section>
      </main>
    );
  }
  const labels = Object.fromEntries(
    KEYS.map((k) => [
      k,
      t(`pub.quote.${k}`, {
        n: '{n}',
        total: '{total}',
        h: '{h}',
        name: '{name}',
        number: '{number}',
        date: '{date}',
        dest: '{dest}',
        s: '{s}',
      }),
    ]),
  );
  const head = (
    <>
      <p className="pub__brand">{dto.branchName}</p>
      <h1>{t('pub.quote.title')}</h1>
      <div className="pub__meta">
        <div>{t('pub.quote.number', { number: dto.number, n: dto.n })}</div>
        <div>
          <span className="plate">{dto.plate}</span> · {dto.vehicleLabel}
        </div>
      </div>
    </>
  );
  if (dto.state === 'open')
    return (
      <main className="pub__col" id="main">
        <noscript>{t('pub.quote.noscript')}</noscript>
        {head}
        <CustomerQuote token={token} dto={dto} labels={labels} />
      </main>
    );
  const titleKey = {
    approved: 'okTitle',
    rejected: 'rejectedTitle',
    expired: 'expiredTitle',
    superseded: 'supersededTitle',
  } as const;
  const textKey = {
    approved: 'okText',
    rejected: 'rejectedText',
    expired: 'expiredText',
    superseded: 'supersededText',
  } as const;
  const st = dto.state;
  return (
    <main className="pub__col" id="main">
      {head}
      <section className="pub-sheet" role="status" data-testid={`pub-state-${st}`}>
        <h2>{t(`pub.quote.${titleKey[st]}`)}</h2>
        <p>
          {st === 'approved' && dto.approved
            ? t('pub.quote.okText', {
                n: dto.approved.itemNos.length,
                total: formatVnd(dto.approved.totalVnd),
              })
            : t(`pub.quote.${textKey[st]}`)}
        </p>
        {st === 'approved' && dto.approved?.mode === 'partial' ? (
          <p>{t('pub.quote.okPartial')}</p>
        ) : null}
        {dto.validUntil && st === 'expired' ? <p>{isoToVi(dto.validUntil)}</p> : null}
      </section>
    </main>
  );
}

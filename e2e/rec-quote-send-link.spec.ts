import { expect, test } from '@playwright/test';
import { loginOk, messageOutbox } from './helpers';
import { AN_PHONE, sentQuote, setServiceConsent } from './rec-quote-helpers';

/**
 * A4 (FR-REC-008, FR-CRM-010, PDPL): the advisor sends the quote link by sms (dev outbox, nothing is sent). Odometer
 * range 3.300.000+ of veh_an. The consent is withdrawn for the first test and granted for the second.
 */
test.describe('REC quote: send the link to the customer', () => {
  test('without a service consent the send is refused with a plain text and nothing is sent', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await setServiceConsent(page.request, 'sms', false);
    const before = (await messageOutbox('quote-link', AN_PHONE)).length;
    const sent = await sentQuote(page.request, { km: 3_300_100 });
    await page.goto(`/rec/quotes/${sent.id}`);
    await expect(page.getByTestId('quote-send-sms-box')).toBeVisible();
    await page.getByTestId('quote-send-sms').click();
    await expect(page.getByRole('alert')).toContainText('đồng ý');
    await expect(page.getByTestId('quote-send-result')).toHaveCount(0);
    expect((await messageOutbox('quote-link', AN_PHONE)).length).toBe(before);
  });

  test('with the consent the panel lists the enabled channel, sends the text and updates "sent via"', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await setServiceConsent(page.request, 'sms', true);
    const before = (await messageOutbox('quote-link', AN_PHONE)).length;
    const sent = await sentQuote(page.request, { km: 3_300_200 });
    await page.goto(`/rec/quotes/${sent.id}`);
    const panel = page.getByTestId('quote-share');
    // sms is enabled (MESSAGE_DEV_CHANNELS=sms); the Zalo box is not
    await expect(panel.getByTestId('quote-send-sms-box')).toBeVisible();
    await expect(panel.getByTestId('quote-send-zalo-box')).toHaveCount(0);
    await panel.getByTestId('quote-send-sms').click();
    await expect(panel.getByTestId('quote-send-result')).toContainText('Đã gửi');
    // the text that reached the dev outbox carries the customer link
    await expect
      .poll(async () => (await messageOutbox('quote-link', AN_PHONE)).length)
      .toBe(before + 1);
    const msg = (await messageOutbox('quote-link', AN_PHONE)).at(-1)!;
    expect(msg.channel).toBe('sms');
    expect(msg.text).toMatch(/Báo giá sửa chữa xe.*\/b\//);
    // the "sent via" field of the quote now says sms
    await expect(page.getByTestId('quote-sent-via')).toContainText('SMS');
  });
});

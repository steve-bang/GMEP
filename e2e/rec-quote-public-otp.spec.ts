import { expect, test } from '@playwright/test';
import { as, hdr, post } from './acc-helpers';
import { loginOk, messageOutbox, noHorizontalOverflow, PASSWORD } from './helpers';
import {
  AN_PHONE,
  businessToday,
  makeLink,
  sentQuote,
  setServiceConsent,
} from './rec-quote-helpers';

/**
 * QUO-04/05, R27 (A4/A5): one-time code on the customer's online approval above a threshold. The code goes to the sms
 * dev outbox (MESSAGE_DEV_CHANNELS=sms in the Playwright web server), nothing is sent. Odometer range 3.100.000+ of veh_an.
 */
test.describe('REC public quote: one-time code above the threshold', () => {
  test('the page asks for a code, a wrong code shows an alert, the right code approves', async ({
    page,
    browser,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await setServiceConsent(page.request, 'sms', true);
    const sent = await sentQuote(page.request, { km: 3_100_100, expensive: true });
    const link = await makeLink(page.request, sent.id);

    // the owner turns the code on for Quận 7 with a threshold just below this quote (the cheap quotes of the other
    // specs stay below it); effective today, approved with the owner's password
    const owner = await as(browser, 'chu');
    const prop = await post(owner.page.request, '/api/v1/sys/config/quote-approval', {
      scopeKey: 'branch:br_q7',
      effectiveFrom: businessToday(),
      payload: {
        allowDeclineRequired: true,
        verbalApproval: true,
        otpMode: 'above_threshold',
        otpThresholdVnd: sent.totalVnd - 1,
      },
      reason: 'Thử mã xác nhận khi giá trị lớn (e2e)',
    });
    const r = await owner.page.request.post(
      `/api/v1/sys/config/quote-approval/${encodeURIComponent(prop.id)}/decide`,
      { data: { decision: 'approve', reauthPassword: PASSWORD }, headers: hdr() },
    );
    expect(r.ok(), await r.text()).toBe(true);
    await owner.ctx.close();

    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const cust = await ctx.newPage();
    await cust.goto(link.path);
    await cust.getByTestId('pub-approve').click();

    // the code field appears and receives focus; the code went to the customer's phone (dev outbox)
    const code = cust.getByTestId('pub-otp-code');
    await expect(cust.getByTestId('pub-otp')).toBeVisible();
    await expect(code).toBeFocused();
    await noHorizontalOverflow(cust);
    await expect
      .poll(async () => (await messageOutbox('approval-otp', AN_PHONE)).length)
      .toBeGreaterThan(0);
    const real = (await messageOutbox('approval-otp', AN_PHONE)).at(-1)!.vars.code!;
    expect(real).toMatch(/^\d{6}$/);

    // a wrong code: the error is an alert, the field is marked invalid, nothing is approved
    const wrong = real === '111111' ? '222222' : '111111';
    await code.fill(wrong);
    await cust.getByTestId('pub-otp-confirm').click();
    const alert = cust.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/chưa đúng|Kiểm tra lại mã/);
    await expect(code).toHaveAttribute('aria-invalid', 'true');
    await expect(cust.getByTestId('pub-state-approved')).toHaveCount(0);
    await noHorizontalOverflow(cust);

    // the right code approves and the page shows the approved state
    await code.fill(real);
    await cust.getByTestId('pub-otp-confirm').click();
    await expect(cust.getByTestId('pub-state-approved')).toBeVisible();
    await noHorizontalOverflow(cust);
    await cust.reload();
    await expect(cust.getByTestId('pub-state-approved')).toBeVisible();
    await ctx.close();
  });
});

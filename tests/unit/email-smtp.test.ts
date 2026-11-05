import { describe, expect, it } from 'vitest';
import { createTransport } from 'nodemailer';
import { SmtpEmailGateway } from '@/infrastructure/email/smtpEmailGateway';
import { renderEmail } from '@/infrastructure/email/templates';

const msg = {
  id: 'reset-abc',
  to: 'an@demo.gmep.test',
  template: 'password-reset' as const,
  vars: { link: 'https://app.example.vn/reset-password?token=t%20k', expiresMinutes: '30' },
};

describe('email templates', () => {
  it('renders Vietnamese subject, text and html with the link', () => {
    const r = renderEmail(msg);
    expect(r.subject).toContain('Đặt lại mật khẩu');
    expect(r.text).toContain(msg.vars.link);
    expect(r.html).toContain('30 phút');
  });
  it('escapes html and refuses non-http links', () => {
    expect(() => renderEmail({ ...msg, vars: { link: 'javascript:alert(1)' } })).toThrow(/http/);
    const r = renderEmail({
      template: 'invitation',
      vars: { link: 'https://x.vn/a?b=1&c="2"', expiresHours: '<b>72</b>' },
    });
    expect(r.html).not.toContain('<b>72</b>');
    expect(r.html).toContain('&amp;c=&quot;2&quot;');
  });
  it('renders all three templates', () => {
    for (const template of ['password-reset', 'invitation', 'security-alert'] as const)
      expect(renderEmail({ template, vars: { link: 'https://x.vn' } }).subject).toMatch(/^GMEP/);
  });
});

describe('SmtpEmailGateway', () => {
  it('sends with sender, recipient and a stable Message-ID', async () => {
    const t = createTransport({ jsonTransport: true });
    const g = new SmtpEmailGateway({ from: 'GMEP <no-reply@example.vn>' }, t);
    const sent: Array<{ messageId?: string }> = [];
    const orig = t.sendMail.bind(t);
    t.sendMail = (async (o: never) => {
      const r = await orig(o);
      sent.push(JSON.parse((r as unknown as { message: string }).message));
      return r;
    }) as typeof t.sendMail;
    await g.send(msg);
    expect(sent[0]).toMatchObject({ messageId: '<reset-abc@gmep>', subject: expect.any(String) });
  });
  it('throws when the transport fails', async () => {
    const t = createTransport({ jsonTransport: true });
    t.sendMail = (async () => {
      throw new Error('smtp down');
    }) as typeof t.sendMail;
    await expect(new SmtpEmailGateway({ from: 'a@b.vn' }, t).send(msg)).rejects.toThrow(
      'smtp down',
    );
  });
});

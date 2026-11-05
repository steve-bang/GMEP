import { createTransport, type Transporter } from 'nodemailer';
import type { EmailGateway, EmailMessage } from '@/modules/sys';
import { rootLogger } from '@/platform/logging/logger';
import { renderEmail } from './templates';

export interface SmtpConfig {
  /** smtps://user:pass@host:465 or smtp://host:587 (secret: Secret Manager) */
  url: string;
  /** "GMEP <no-reply@domain>" (the domain needs SPF/DKIM/DMARC) */
  from: string;
}

/**
 * Production adapter: plain SMTP, so any provider works (SES, SendGrid, Mailgun, Google Workspace,
 * the client's own server). Throws when delivery fails so an invitation is never reported as sent
 * when it was not; the forgot-password flow catches it to stay neutral. The id is sent as the
 * Message-ID so a retry carries the same identity. Nothing but the recipient domain is logged:
 * bodies contain single-use links.
 */
export class SmtpEmailGateway implements EmailGateway {
  private readonly transport: Transporter;
  constructor(
    private readonly config: Pick<SmtpConfig, 'from'>,
    transport: Transporter,
  ) {
    this.transport = transport;
  }

  static fromConfig(config: SmtpConfig): SmtpEmailGateway {
    return new SmtpEmailGateway(
      config,
      createTransport({ url: config.url, connectionTimeout: 10_000, socketTimeout: 15_000 }),
    );
  }

  async send(message: EmailMessage): Promise<void> {
    const { subject, text, html } = renderEmail(message);
    const domain = message.to.split('@')[1] ?? '?';
    try {
      await this.transport.sendMail({
        from: this.config.from,
        to: message.to,
        subject,
        text,
        html,
        messageId: `<${message.id}@gmep>`,
      });
    } catch (e) {
      rootLogger.error(
        { template: message.template, domain, err: e instanceof Error ? e.message : 'unknown' },
        'email delivery failed',
      );
      throw e;
    }
  }
}

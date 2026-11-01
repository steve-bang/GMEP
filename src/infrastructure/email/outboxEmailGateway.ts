import { AlreadyExistsError, type DocStore } from '@/platform/store/docStore';
import type { EmailGateway, EmailMessage } from '@/modules/sys';
import { COL } from '../repos/queries';

/**
 * DEV adapter: stores the message in the `emailOutbox` collection and sends NOTHING (no provider
 * is chosen yet, ADR §13). The body variables contain the single-use link, so this collection must
 * never be exposed; a production adapter replaces this class behind the same port. Retries with the
 * same message id are no-ops.
 */
export class OutboxEmailGateway implements EmailGateway {
  constructor(
    private readonly store: DocStore,
    private readonly now: () => Date,
  ) {}
  async send(message: EmailMessage): Promise<void> {
    try {
      await this.store.createNow(COL.emailOutbox, message.id, {
        to: message.to,
        template: message.template,
        vars: message.vars,
        status: 'queued',
        createdAt: this.now(),
        // TTL: queued dev mail is disposable
        expiresAt: new Date(this.now().getTime() + 7 * 24 * 3_600_000),
      });
    } catch (e) {
      if (!(e instanceof AlreadyExistsError)) throw e;
    }
  }
}

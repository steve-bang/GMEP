import { AlreadyExistsError, type DocStore } from '@/platform/store/docStore';
import {
  MESSAGE_CHANNELS,
  MessageDeliveryError,
  type EmailGateway,
  type MessageChannel,
  type MessageGateway,
  type OutboundMessage,
} from '@/modules/sys';
import { COL } from '../repos/queries';
import { renderShortText } from './templates';

/** One channel's delivery. Throws `MessageDeliveryError` when the provider did not accept the message. */
export interface ChannelAdapter {
  send(message: OutboundMessage): Promise<void>;
  /** true when the adapter only writes to a dev outbox and sends nothing */
  readonly simulated?: boolean;
}

/**
 * Routes a message to the adapter configured for its channel. A channel without an adapter is not available
 * (the staff screen shows it as "Chưa kích hoạt"); a real SMS or Zalo provider is one more `ChannelAdapter`.
 */
export class ChannelMessageGateway implements MessageGateway {
  constructor(private readonly adapters: Partial<Record<MessageChannel, ChannelAdapter>>) {}
  availableChannels(): readonly MessageChannel[] {
    return MESSAGE_CHANNELS.filter((c) => !!this.adapters[c]);
  }
  isSimulated(channel: MessageChannel): boolean {
    return this.adapters[channel]?.simulated === true;
  }
  async send(message: OutboundMessage): Promise<void> {
    const adapter = this.adapters[message.channel];
    if (!adapter) throw new Error(`message channel ${message.channel} is not configured`);
    await adapter.send(message);
  }
}

/** Email channel: reuses the existing email adapters (SMTP in production, the dev outbox otherwise). */
export class EmailChannelAdapter implements ChannelAdapter {
  /** `simulated` = the wrapped gateway is the dev outbox (no SMTP configured) */
  constructor(
    private readonly email: EmailGateway,
    readonly simulated = false,
  ) {}
  async send(m: OutboundMessage): Promise<void> {
    try {
      await this.email.send({ id: m.id, to: m.to, template: m.template, vars: m.vars });
    } catch (e) {
      throw new MessageDeliveryError('email', e);
    }
  }
}

/**
 * DEV adapter for sms and zalo: writes the message to the `messageOutbox` collection and sends NOTHING (no
 * provider is chosen yet). The body holds links and one-time codes in clear text, so it is enabled only outside
 * production (`MESSAGE_DEV_CHANNELS`) and the collection must never be exposed. A repeat with the same id is a no-op.
 */
export class OutboxChannelAdapter implements ChannelAdapter {
  readonly simulated = true;
  constructor(
    private readonly channel: Exclude<MessageChannel, 'email'>,
    private readonly store: DocStore,
    private readonly now: () => Date,
  ) {}
  async send(m: OutboundMessage): Promise<void> {
    try {
      await this.store.createNow(COL.messageOutbox, m.id, {
        channel: this.channel,
        to: m.to,
        template: m.template,
        vars: m.vars,
        text: renderShortText(m.template, m.vars),
        status: 'queued',
        createdAt: this.now(),
        // TTL: dev messages are disposable
        expiresAt: new Date(this.now().getTime() + 7 * 24 * 3_600_000),
      });
    } catch (e) {
      if (e instanceof AlreadyExistsError) return;
      throw new MessageDeliveryError(this.channel, e);
    }
  }
}

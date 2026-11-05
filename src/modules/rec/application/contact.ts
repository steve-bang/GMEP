import { maskEmail, maskPhone } from '@/platform/pii/pii';
import { canSendServiceMessage, isPlausiblePhone, normalizePhone } from '@/modules/crm';
import type { MessageChannel } from '@/modules/sys';
import type { RecDeps } from '../ports/deps';
import { AppError } from './support';

/** Where a customer message goes: the real value (never logged, never stored) and its masked form (logs, audit, UI). */
export interface MessageTarget {
  channel: MessageChannel;
  to: string;
  masked: string;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/**
 * The customer's contact for a channel, from the CRM contact record only (never from anything typed by the person
 * on the public page). Phone for sms and zalo, e-mail for email. Null when missing or not plausible (an anonymised
 * customer has no contact left).
 */
export async function contactOf(
  deps: RecDeps,
  q: { companyId: string; customerId: string },
  channel: MessageChannel,
): Promise<MessageTarget | null> {
  const pii = await deps.crm.customers.getPii(q.companyId, q.customerId);
  if (!pii) return null;
  if (channel === 'email') {
    const email = pii.email?.trim();
    return email && EMAIL.test(email) ? { channel, to: email, masked: maskEmail(email) } : null;
  }
  const phone = pii.phoneNorm || (pii.phone ? normalizePhone(pii.phone) : '');
  return phone && isPlausiblePhone(phone) ? { channel, to: phone, masked: maskPhone(phone) } : null;
}

/**
 * A4 / FR-CRM-010: a quote link is a SERVICE message and needs an active `service` consent for that channel (purpose
 * x channel, ba-answers C10). No consent: refused with `message_no_consent`; no usable contact: `message_no_contact`.
 */
export async function serviceTargetOf(
  deps: RecDeps,
  q: { companyId: string; customerId: string },
  channel: MessageChannel,
): Promise<MessageTarget> {
  const consents = await deps.crm.consents.listByCustomer(q.companyId, q.customerId);
  if (!canSendServiceMessage(consents, channel)) throw new AppError('message_no_consent', 409);
  const t = await contactOf(deps, q, channel);
  if (!t) throw new AppError('message_no_contact', 409);
  return t;
}

/** Preferred order for the one-time code: the phone first (sms, then zalo), e-mail last. */
const OTP_ORDER: readonly MessageChannel[] = ['sms', 'zalo', 'email'];

/** First available channel that has a usable contact on file; null when the customer cannot be reached. */
export async function otpTargetOf(
  deps: RecDeps,
  q: { companyId: string; customerId: string },
): Promise<MessageTarget | null> {
  const available = deps.sys.messages.availableChannels();
  for (const c of OTP_ORDER) {
    if (!available.includes(c)) continue;
    const t = await contactOf(deps, q, c);
    if (t) return t;
  }
  return null;
}

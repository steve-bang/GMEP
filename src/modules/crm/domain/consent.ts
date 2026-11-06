/**
 * Personal-data processing bases and consent (FR-CRM-010, FR-CRM-013, BR-CRM-05; PDPL 2025).
 * Purposes, channels and bases are the proposed lists [Đề xuất BA - chờ xác nhận: Luật sư khách].
 */
export const CONSENT_PURPOSES = [
  'service', // dịch vụ sửa chữa, bảo hành (hợp đồng)
  'reminder', // nhắc bảo dưỡng, đăng kiểm, bảo hiểm
  'marketing', // quảng cáo, khuyến mại
  'sharing', // chia sẻ với bên thứ ba (bảo hiểm, đối tác)
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_CHANNELS = ['in_person', 'zalo', 'sms', 'email', 'phone', 'web'] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

/** Channels a campaign can be sent through (a subset of how consent may be collected). */
export const CONTACT_CHANNELS = ['zalo', 'sms', 'email', 'phone'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONSENT_BASES = [
  'consent',
  'contract',
  'legal_obligation',
  'legitimate_interest',
] as const;
export type ConsentBasis = (typeof CONSENT_BASES)[number];

export interface Consent {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  purpose: ConsentPurpose;
  /**
   * channel the consent covers (marketing/reminder) or was collected through. For `service` it is NOT a
   * per-channel permission: a granted one from any channel allows service messages, and a withdrawn one
   * stops that channel only (see `canSendServiceMessage`) [Cần xác nhận: Luật sư khách]
   */
  channel: ConsentChannel;
  basis: ConsentBasis;
  status: 'granted' | 'withdrawn';
  grantedAt: Date;
  /** C23: code of an entry of the company `evidence-kind` catalogue (paper slip, web tick, reply message...) */
  evidenceKind?: string;
  /** C23: optional reference of the proof (paper slip no., message id); screened like `evidence`, no personal data */
  evidenceRef?: string;
  /** short free note on the proof; no personal data */
  evidence?: string;
  /** version of the notice shown to the customer */
  policyVersion?: string;
  withdrawnAt?: Date;
  withdrawnBy?: string;
  withdrawnReason?: string;
  createdBy: string;
  version: number;
}

/**
 * FR-CRM-013: advertising needs an explicit, still-active consent for that channel. Another legal
 * basis (contract, legitimate interest) never authorises marketing.
 */
export function marketingChannelsOf(consents: readonly Consent[]): ContactChannel[] {
  const out = new Set<ContactChannel>();
  for (const c of consents)
    if (
      c.purpose === 'marketing' &&
      c.basis === 'consent' &&
      c.status === 'granted' &&
      (CONTACT_CHANNELS as readonly string[]).includes(c.channel)
    )
      out.add(c.channel as ContactChannel);
  return [...out].sort();
}

export interface AudienceDecision {
  eligible: string[];
  excluded: { customerId: string; reason: 'no_consent' | 'anonymized' | 'not_found' }[];
}

/** Pure marketing filter over a customer snapshot (`marketing` = active advertising channels). */
export function filterMarketingAudience(
  customerIds: readonly string[],
  snapshots: ReadonlyMap<string, { status: 'active' | 'anonymized'; marketing: readonly string[] }>,
  channel: ContactChannel,
): AudienceDecision {
  const eligible: string[] = [];
  const excluded: AudienceDecision['excluded'] = [];
  for (const id of new Set(customerIds)) {
    const c = snapshots.get(id);
    if (!c) excluded.push({ customerId: id, reason: 'not_found' });
    else if (c.status === 'anonymized') excluded.push({ customerId: id, reason: 'anonymized' });
    else if (!c.marketing.includes(channel))
      excluded.push({ customerId: id, reason: 'no_consent' });
    else eligible.push(id);
  }
  return { eligible, excluded };
}

/**
 * C4: consent records are kept as evidence after a customer is anonymised, so they must not hold a
 * phone number or email (they carry only the customer id, purpose, channel, basis, policy version,
 * time and recorder). Free text (evidence, withdrawal reason) is checked for these two patterns; a
 * name cannot be detected, so the UI says so.
 */
export function looksLikePersonalContact(text: string): boolean {
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return true;
  return /(?:\+?84|0)(?:[\s.-]?\d){8,10}/.test(text);
}

/**
 * A4: may the garage send a SERVICE message (a quote link) to the customer over this channel? For the contract-based
 * `service` purpose, `channel` is only where the consent was collected (usually `in_person` at the counter), not a
 * per-channel permission (ba-answers C10 "purpose x channel" was written for reminders, FR-CRM-006). Default:
 * allowed = at least one granted `service` consent (any channel) AND no `service` consent withdrawn specifically for
 * the sending channel without a later granted one for that channel. Withdrawn consents never count as grants
 * (FR-CRM-010: withdrawal is immediate). The legal basis is not checked here; contract is the expected one.
 * [Cần xác nhận: Luật sư khách] (docs/dev/open-questions-for-ba.md).
 */
export function canSendServiceMessage(
  consents: readonly Consent[],
  channel: ConsentChannel,
): boolean {
  const service = consents.filter((c) => c.purpose === 'service');
  if (!service.some((c) => c.status === 'granted')) return false;
  const blocked = service.some(
    (w) =>
      w.status === 'withdrawn' &&
      w.channel === channel &&
      !service.some(
        (g) =>
          g.status === 'granted' &&
          g.channel === channel &&
          (!w.withdrawnAt || g.grantedAt.getTime() >= w.withdrawnAt.getTime()),
      ),
  );
  return !blocked;
}

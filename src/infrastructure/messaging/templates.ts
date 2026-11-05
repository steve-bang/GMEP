import type { MessageTemplate } from '@/modules/sys';

/**
 * Vietnamese bodies of the short-message channels (SMS, Zalo). Pure, unit tested. Email has its own HTML templates
 * in `infrastructure/email/templates.ts`. A real provider may need pre-approved template ids (Zalo ZNS): that
 * mapping belongs to its adapter [Cần xác nhận: nhà cung cấp Zalo/SMS chưa chọn].
 */
export function renderShortText(template: MessageTemplate, vars: Record<string, string>): string {
  switch (template) {
    case 'quote-link': {
      const link = vars.link ?? '';
      if (!/^https?:\/\//i.test(link)) throw new Error('message template: link must be http(s)');
      return `GMEP: Báo giá sửa chữa xe của bạn, bấm để xem và xác nhận: ${link}`;
    }
    case 'approval-otp': {
      const code = vars.code ?? '';
      if (!/^\d{4,8}$/.test(code)) throw new Error('message template: code must be digits');
      return `GMEP: Mã xác nhận duyệt báo giá là ${code}, hiệu lực ${vars.expiresMinutes ?? '5'} phút. Không chia sẻ mã này cho ai.`;
    }
  }
}

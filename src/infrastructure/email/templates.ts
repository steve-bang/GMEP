import type { EmailMessage } from '@/modules/sys';

/**
 * Vietnamese email bodies for the three SYS templates. Pure functions: no I/O, so they are unit tested.
 * Variables are HTML-escaped; the link must be http(s) (a `javascript:` value is refused).
 */
export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function safeLink(vars: Record<string, string>): string {
  const link = vars.link ?? '';
  if (!/^https?:\/\//i.test(link)) throw new Error('email template: link must be http(s)');
  return link;
}

function layout(title: string, paragraphs: string[], link: string, button: string): RenderedEmail {
  const text = [...paragraphs, '', `${button}: ${link}`, '', 'GMEP - Quản lý garage'].join('\n');
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937;max-width:560px">` +
    `<h2 style="margin:0 0 16px">${esc(title)}</h2>` +
    paragraphs.map((p) => `<p>${esc(p)}</p>`).join('') +
    `<p><a href="${esc(link)}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;` +
    `text-decoration:none;border-radius:6px">${esc(button)}</a></p>` +
    `<p style="font-size:13px;color:#6b7280">Nếu nút không bấm được, hãy sao chép đường dẫn sau vào trình duyệt:<br>${esc(link)}</p>` +
    `<p style="font-size:13px;color:#6b7280">GMEP - Quản lý garage</p></div>`;
  return { subject: title, text, html };
}

function codeLayout(title: string, paragraphs: string[], code: string): RenderedEmail {
  if (!/^\d{4,8}$/.test(code)) throw new Error('email template: code must be digits');
  const text = [...paragraphs, '', `Mã xác nhận: ${code}`, '', 'GMEP - Quản lý garage'].join('\n');
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937;max-width:560px">` +
    `<h2 style="margin:0 0 16px">${esc(title)}</h2>` +
    paragraphs.map((p) => `<p>${esc(p)}</p>`).join('') +
    `<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${esc(code)}</p>` +
    `<p style="font-size:13px;color:#6b7280">GMEP - Quản lý garage</p></div>`;
  return { subject: title, text, html };
}

export function renderEmail(message: Pick<EmailMessage, 'template' | 'vars'>): RenderedEmail {
  const { template, vars } = message;
  // A4: the OTP mail carries a code, not a link
  if (template === 'approval-otp')
    return codeLayout(
      'GMEP - Mã xác nhận duyệt báo giá',
      [
        `Mã xác nhận của bạn có hiệu lực trong ${vars.expiresMinutes ?? '5'} phút.`,
        'Không chia sẻ mã này cho bất kỳ ai. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
      ],
      vars.code ?? '',
    );
  const link = safeLink(vars);
  switch (template) {
    case 'quote-link':
      return layout(
        'GMEP - Báo giá sửa chữa xe của bạn',
        [
          'Garage gửi bạn báo giá sửa chữa để xem và xác nhận.',
          'Đường dẫn dành riêng cho bạn, vui lòng không chuyển tiếp cho người khác.',
        ],
        link,
        'Xem và duyệt báo giá',
      );
    case 'password-reset':
      return layout(
        'GMEP - Đặt lại mật khẩu',
        [
          'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
          `Đường dẫn có hiệu lực trong ${vars.expiresMinutes ?? '30'} phút và chỉ dùng được một lần.`,
          'Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại vẫn giữ nguyên.',
        ],
        link,
        'Đặt lại mật khẩu',
      );
    case 'invitation':
      return layout(
        'GMEP - Lời mời kích hoạt tài khoản',
        [
          'Bạn được mời sử dụng hệ thống quản lý garage GMEP.',
          `Đường dẫn kích hoạt có hiệu lực trong ${vars.expiresHours ?? '72'} giờ và chỉ dùng được một lần.`,
        ],
        link,
        'Kích hoạt tài khoản',
      );
    case 'security-alert':
      return layout(
        'GMEP - Cảnh báo bảo mật',
        [
          'Có hoạt động bất thường liên quan đến tài khoản của bạn.',
          'Nếu đó không phải bạn, hãy đổi mật khẩu ngay và báo quản trị viên.',
        ],
        link,
        'Xem tài khoản',
      );
  }
}

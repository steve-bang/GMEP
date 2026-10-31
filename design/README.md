# Prototype HTML/CSS của GARAGE OS (`design/`)

Mở trực tiếp bằng trình duyệt (cần bật JavaScript). Mỗi gói có `index.html` riêng. Token và component chuẩn: `assets/` (không sửa `tokens.css`, `components.css`). Tài liệu: `docs/design-system.md`, `docs/ui-ux/ui-ux-flow.md`, `docs/ui-ux/STATUS.md`.

| Thư mục | Nội dung | Mục lục |
| --- | --- | --- |
| `assets/` | `tokens.css`, `base.css`, `components.css`, `icons.svg`, `app.js` | – |
| `foundation/` | Showcase token, component, khung ứng dụng | `foundation/index.html` |
| `g1-auth-dashboard/` | Đăng nhập, MFA, lỗi, dashboard theo vai trò, thông báo, hồ sơ (31 màn) | `g1-auth-dashboard/index.html` |
| `g2-workshop/` | Khách, xe, lịch hẹn, tiếp nhận, lệnh sửa chữa, kiểm tra xe số (26) | `g2-workshop/index.html` |
| `g2-quote-delivery/` | Báo giá, thợ tablet, QC và giao xe, in ấn (21) | `g2-quote-delivery/index.html` |
| `g3-inventory-hr/` | Kho, mua hàng, nhân sự (39) | `g3-inventory-hr/index.html` |
| `g4-finance/` | Tài chính, phê duyệt, hóa đơn (32) | `g4-finance/index.html` |
| `g4-reports-system/` | Báo cáo và hệ thống (35) | `g4-reports-system/index.html` |
| **`g5-scope-auth/`** | **Mới 31/10/2026 (slice 1.1/1.2):** bộ chọn phạm vi chi nhánh (G5-SCP-01/02) và luồng xác thực bổ sung: quên mật khẩu, đặt mật khẩu mới, kích hoạt theo lời mời, đăng nhập lỗi/khóa tạm/hết phiên, khe xác thực mạnh TOTP/PIN (G5-AUT-01…05) | `g5-scope-auth/index.html` |

Danh mục component hợp nhất và ánh xạ class tiền tố gói: `docs/ui-ux/component-catalog.md`. Câu chữ trạng thái hệ thống: `docs/ui-ux/state-copy.md`.

Quy ước: class tiền tố gói (`g1-`, `g2w-`, `g2q-`, `g3-`, `g4f-`, `g4r-`, `g5-`) chỉ dành cho bố cục riêng của gói hoặc công cụ prototype; thành phần dùng chung đã ánh xạ sang component chuẩn trong catalog. Gói mới chỉ thêm class vào `pack.css` của gói đó.

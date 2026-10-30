# Changelog

## [Chưa phát hành] — 2026-10-30

Thiết kế UI/UX web dashboard Garage ERP: hoàn thành ở mức prototype. Xem `docs/ui-ux/STATUS.md` (tiến độ, việc còn lại) và `docs/ui-ux/ui-ux-flow.md` (mô tả UI/UX flow).

### Thêm
- Tài liệu nghiệp vụ trong `docs/`: BRD, FRD, User Journey & Business Workflow.
- `docs/design-system.md`: Design System & design token (nguồn chuẩn cho UI).
- Agent `ba`, `designer`, `orchestrator` và skill `dashboard-ui-ux` trong `.claude/`; giới hạn tối đa 2 agent chạy song song.
- `design/assets`, `design/foundation`: token CSS 3 lớp, thư viện component đủ trạng thái, Application Shell, menu theo 12 vai trò.
- 184 màn hình prototype trong 6 gói (`design/g1-auth-dashboard`, `g2-workshop`, `g2-quote-delivery`, `g3-inventory-hr`, `g4-finance`, `g4-reports-system`), gồm đăng nhập, quên/đặt lại mật khẩu, kích hoạt tài khoản theo lời mời, MFA, dashboard riêng cho từng vai trò.
- Tài liệu UI/UX: `docs/ui-ux/ui-ux-flow.md` (flow tổng hợp), `00-foundation.md`, `01`…`06-*.md` (từng gói), `screen-inventory.md`, `ba-decisions.md`, `ba-answers-0N.md`, `review-*`, `proposed-doc-changes.md`, `mobile-overflow-report.md`.

- `docs/ui-ux/screenshots/`: ảnh chụp toàn bộ 193 trang prototype (JPEG toàn trang) kèm mục lục `README.md`; `scripts/screenshot-all.js` để chụp lại.

### Thay đổi
- Mỗi gói đi qua 2–3 vòng review BA ↔ designer; toàn bộ finding Blocker/Major đã xử lý, cả 6 gói đạt ở vòng cuối.
- Chính sách thợ mất mạng Phase 1: chặn ghi giờ, ghi giờ lên phiếu giấy rồi "khai giờ thực" khi có mạng (quản đốc xác nhận ≤ 15 phút, quản lý chi nhánh duyệt nếu lớn hơn). Áp dụng ở các màn thợ, dashboard thợ/quản đốc/quản lý chi nhánh.
- Menu theo vai trò: thêm vai trò Mua hàng, Nhân sự; thêm chế độ "Xem và duyệt".

### Sửa
- Sidebar: chip chế độ quyền không còn tràn khỏi cột 248px.
- Mobile 390px: thanh trên cùng không còn đẩy chuông/avatar ra ngoài; nguyên nhân gốc tràn ngang ở bảng (`.sr-only` thoát khỏi khung cuộn) đã sửa; số lượt tải tràn ngang giảm từ 94 xuống 3 (chỉ còn trang showcase/mục lục).

### Chưa hoàn thành
- Chủ dự án/khách xác nhận các quyết định "BA đề xuất"; áp dụng `proposed-doc-changes.md` vào FRD/BRD/Journey/design-system.
- Font Be Vietnam Pro (WOFF2), icon Lucide chính thức, mẫu in nhiều trang/in nhiệt thật, thử trên thiết bị thật, chọn tech stack.

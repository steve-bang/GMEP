# Trạng thái công việc thiết kế UI/UX

Cập nhật: 2026-10-30. Thiết kế toàn bộ web dashboard Garage ERP (gồm đăng nhập, quên mật khẩu, kích hoạt tài khoản theo lời mời) đã hoàn thành ở mức prototype HTML/CSS và qua các vòng review BA ↔ designer. Không có agent nào đang chạy.

## Kết quả

- **184 màn hình** trong 6 gói (`design/g1-…` đến `design/g4-…`), cộng khung ứng dụng và thư viện component (`design/assets`, `design/foundation`). Danh mục: `screen-inventory.md`.
- Mô tả UI/UX flow tổng hợp: **`ui-ux-flow.md`** (sơ đồ điều hướng, luồng chính, trạng thái, mẫu giao diện, vai trò, responsive, accessibility, handoff, quyết định còn mở).
- Mỗi gói có tài liệu riêng `01`…`06-*.md` (bảng màn hình, flow, bảng "Finding → đã xử lý ở đâu") và các file `review-0N-*`, `ba-answers-0N.md`.
- Chuẩn bắt buộc: `docs/design-system.md` (token không đổi). Quyết định BA: `ba-decisions.md` (đề xuất, chờ xác nhận).

Ảnh chụp toàn bộ 193 trang: `screenshots/README.md` (chụp lại bằng `node scripts/screenshot-all.js`).

## Tiến độ review (tất cả ĐẠT: không còn Blocker/Major)

| Gói | Màn | Vòng đạt | Ghi chú |
| --- | --- | --- | --- |
| 1 Xác thực & Dashboard | 31 | vòng 3 | menu CV đã thêm Kho (chỉ xem); áp dụng chính sách mất mạng của thợ |
| 2 Khách hàng, lịch hẹn, tiếp nhận, lệnh sửa chữa, kiểm tra xe số | 26 | vòng 3 | Minor đã dọn |
| 3 Báo giá, thợ tablet, giao xe, in ấn | 21 | vòng 3 | áp dụng chính sách mất mạng; "Đã hủy" là trạng thái thứ 7 của báo giá chờ xác nhận |
| 4 Kho, mua hàng, nhân sự | 39 | vòng 3 (Major cuối đã sửa, BA nói không cần đọc lại) | hậu duyệt Mua gấp |
| 5 Tài chính, phê duyệt, hóa đơn | 33 | vòng 3 | đã gồm G4-ACC-21 |
| 6 Báo cáo & Hệ thống | 35 | vòng 3 | 4 Minor đã dọn |

## Kiểm tra tự động (Playwright/Chromium, 193 trang × 2 cỡ màn hình)

- 0 lỗi JavaScript, 0 trang trống.
- Desktop 1440px: 0 trang tràn ngang.
- Mobile 390px: tràn ngang giảm từ 94 xuống 3 lượt tải; cả 3 đều là trang showcase/mục lục (`foundation/components.html`, `foundation/index.html`, `g2-workshop/index.html`), không phải màn hình sản phẩm. Chi tiết: `mobile-overflow-report.md`.
- Chưa có kiểm tra tự động về tương phản màu, bàn phím, trình đọc màn hình.

## Còn lại / việc cho lần làm tiếp

1. **Chủ dự án/khách xác nhận** các mục "BA đề xuất — chờ xác nhận" (gom ở Phụ lục A của `ui-ux-flow.md`): đưa thu tiền, chốt ca/ngày, hóa đơn vào Phase 1; MFA cho Kế toán; "Đã hủy" là trạng thái thứ 7 của báo giá; chính sách thợ mất mạng Phase 1 (chặn ghi giờ + khai giờ thực); mục "Danh mục" trong Cài đặt cho một số vai trò; các số mẫu (hạn mức, thuế, đơn giá giờ công) là minh họa.
2. **Áp dụng đề xuất vào tài liệu nghiệp vụ** sau khi xác nhận: `proposed-doc-changes.md` (65 đề xuất cho FRD/BRD/Journey/design-system, trong đó có việc gán lại mã FR trùng).
3. **Thiết kế còn thiếu/ghi nhận**: font Be Vietnam Pro (cần 4 file WOFF2 trong `design/assets/fonts/`); icon Lucide chính thức thay bản vẽ lại; mẫu in nhiều trang (số trang, lặp tiêu đề) và in nhiệt thật; tên/màu badge của yêu cầu nhập bù giờ công cần BA đóng bảng A.2b; badge dư thừa/lệch nhỏ như chữ "Chỉ Chi nhánh…" ở dải phạm vi và nhãn "Thu gọn" lệch trục của sidebar.
4. **Dọn showcase**: 3 trang showcase/mục lục còn tràn ở 390px (không chặn).
5. **Trước khi giao dev**: thử trên thiết bị thật (tablet xưởng, điện thoại, máy in); phần che dữ liệu/phân quyền/lọc trong prototype chỉ mô phỏng — máy chủ phải làm thật (xem `ui-ux-flow.md` mục handoff).
6. Chọn tech stack, rồi chuyển prototype sang component thật (giữ tên class/token).

## Cách tiếp tục

Đọc `ui-ux-flow.md` trước, sau đó `STATUS.md` (file này), rồi tài liệu gói liên quan. Giới hạn: tối đa 2 agent chạy cùng lúc.

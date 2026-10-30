# Trạng thái công việc thiết kế UI/UX — điểm dừng để tiếp tục

Cập nhật: 2026-10-30. Công việc bị dừng theo yêu cầu của chủ dự án; mọi file đã được lưu và push.

## Mục tiêu (yêu cầu của chủ dự án)

Thiết kế toàn bộ web dashboard Garage ERP (gồm đăng nhập, quên mật khẩu, đăng ký theo lời mời) theo `docs/design-system.md`. Quy trình: `designer` làm từng gói → `ba` review → `designer` tự review và sửa finding → lặp đến khi hết finding → cập nhật changelog và mô tả UI/UX flow → push. `ba` được phép tự đề xuất đáp án khi cần chủ dự án quyết (ghi "BA đề xuất — chờ xác nhận"). Tối đa 2 agent chạy cùng lúc.

## Đã có

- Design system: `docs/design-system.md` (nguồn chuẩn, không đổi token), `design/assets/` (tokens, base, components, icons, app.js), `design/foundation/` (showcase, thư viện component, shell). Tài liệu: `docs/ui-ux/00-foundation.md`. Đã sửa 17 finding review nền tảng, đã thêm vai trò MH (Mua hàng), NS (Nhân sự).
- Danh mục 183 màn hình: `docs/ui-ux/screen-inventory.md`. Quyết định BA: `docs/ui-ux/ba-decisions.md`, `ba-answers-0N.md`.
- Brief chung cho designer: `docs/ui-ux/designer-brief.md`.
- 6 gói prototype HTML/CSS (thiết kế đủ màn hình), mỗi gói có `index.html`, `pack.css`, `pack.js` và tài liệu `docs/ui-ux/0N-*.md`:

| Gói | Thư mục | Màn hình | Tài liệu |
| --- | --- | --- | --- |
| 1 Xác thực & Dashboard | `design/g1-auth-dashboard/` | 31 | `01-auth-dashboard.md` |
| 2 Khách hàng, lịch hẹn, tiếp nhận, lệnh sửa chữa, kiểm tra xe số | `design/g2-workshop/` | 26 | `02-workshop-intake.md` |
| 3 Báo giá, thợ tablet, giao xe, in ấn | `design/g2-quote-delivery/` | 21 | `03-quote-technician-delivery.md` |
| 4 Kho, mua hàng, nhân sự | `design/g3-inventory-hr/` | 39 | `04-inventory-purchasing-hr.md` |
| 5 Tài chính, phê duyệt, hóa đơn | `design/g4-finance/` | 32 (thêm G4-ACC-21) | `05-finance-invoice.md` |
| 6 Báo cáo & Hệ thống | `design/g4-reports-system/` | 35 | `06-reports-system.md` |

## Tiến độ vòng review (BA ↔ designer)

| Gói | Review vòng 1 | Designer sửa vòng 1 | Review vòng 2 | Designer sửa vòng 2 | Review vòng 3 |
| --- | --- | --- | --- | --- | --- |
| Foundation | 17 finding | xong | — | — | — |
| 1 | 29 (2 Blocker, 12 Major, 15 Minor) | xong | **chưa làm** | — | — |
| 2 | 27 (0/10/17) | xong | CHƯA ĐẠT: 17 (0/4/13) | xong | **chưa hoàn thành** (agent bị dừng, chưa có `review-02-round3-ba.md`) |
| 3 | 36 (0/13/23) | xong | **chưa làm** | — | — |
| 4 | 31 (2/13/16) | xong | **chưa làm** | — | — |
| 5 | 22 (0/10/12) | xong | CHƯA ĐẠT: 17 (0/7/10) | **dở dang** (designer bị dừng giữa chừng, `g4-acc-04.html`, `g4-acc-11.html` đã sửa một phần; chưa có bảng "vòng 2 → đã xử lý ở đâu") | — |
| 6 | 35 (0/18/17) | xong | **chưa làm** | — | — |

Kết luận chưa gói nào đạt "không còn Blocker/Major".

## Việc cần làm tiếp (theo thứ tự)

1. Gói 5: resume designer (agent `a3d06d78694e63d7f`) xử lý nốt finding vòng 2 trong `docs/ui-ux/review-05-round2-ba.md` (7 Major, 10 Minor). Kiểm tra trạng thái `design/g4-finance/` trước vì có chỉnh sửa dở.
2. Gói 2: chạy BA review vòng 3 (`ba` → `docs/ui-ux/review-02-round3-ba.md`).
3. Gói 1, 3, 4, 6: BA review vòng 2 → designer sửa → lặp đến khi "ĐẠT — không còn Blocker/Major". Mục chỉ phụ thuộc trình duyệt/thiết bị/stack ghi vào "Chuyển cho dev", không chặn.
4. Đồng bộ chéo gói: nhóm "Không thực hiện" (phát sinh bị từ chối/hết hạn) ở G2-REC-04; `data-g2w-deny` và các `pack.js` cho vai trò MH/NS; dữ liệu mẫu giữa các gói; bảng màn hình mục 2/3 của một số tài liệu gói còn là bản cũ (gói 1, gói 4).
5. Cập nhật tài liệu: mô tả UI/UX flow tổng hợp (ghép từ 6 tài liệu gói và `screen-inventory.md` §7) và `CHANGELOG.md` cho bản hoàn chỉnh.
6. Cập nhật `docs/user-journey-business-workflow.md`, `docs/functional-requirements.md`, `docs/design-system.md` theo các đề xuất đồng bộ trong `ba-answers-0N.md` (phụ lục "tài liệu cần cập nhật") nếu chủ dự án xác nhận.
7. Commit và push.

## Hạn chế chung cần biết

- Chưa agent nào mở được trình duyệt: toàn bộ prototype chưa được kiểm tra trực quan, chưa chạy thử JS, chưa đo tương phản thực tế, chưa thử in thật. Nên mở thử `design/*/index.html` ở 1440, 768 và 390px.
- Các prototype dựng shell bằng JS (`document.write`) nên cần bật JS; đã thêm `<noscript>`. Phân quyền và che dữ liệu trong prototype chỉ mô phỏng; sản phẩm thật phải làm phía máy chủ.
- Thiếu file font Be Vietnam Pro (WOFF2): cần đặt 4 file vào `design/assets/fonts/` theo `README.md` ở đó; hiện dùng font hệ thống.
- Icon vẽ lại theo phong cách Lucide, nên thay bằng gói Lucide chính thức khi chọn stack.
- Mọi quyết định "BA đề xuất — chờ xác nhận" cần chủ dự án/khách xác nhận trước khi chốt baseline.
- Giới hạn sử dụng 5 giờ đã từng chạm trong phiên làm việc; nên giữ tối đa 2 agent chạy song song.

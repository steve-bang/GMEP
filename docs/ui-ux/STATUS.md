# Trạng thái công việc thiết kế UI/UX — điểm dừng để tiếp tục

Cập nhật: 2026-10-30 (sau đồng bộ tài liệu BA). Nguồn tiến độ: các file `review-0N-roundM-ba.md` mới nhất và `ui-ux-flow.md` Phụ lục B. Chưa commit/push các thay đổi mới.

## Mục tiêu (yêu cầu của chủ dự án)

Thiết kế toàn bộ web dashboard Garage ERP (gồm đăng nhập, quên mật khẩu, đăng ký theo lời mời) theo `docs/design-system.md`. Quy trình: `designer` làm từng gói → `ba` review → `designer` tự review và sửa finding → lặp đến khi hết Blocker/Major → cập nhật changelog và mô tả UI/UX flow → push. `ba` được phép tự đề xuất đáp án khi cần chủ dự án quyết (ghi "BA đề xuất — chờ xác nhận"). Tối đa 2 agent chạy cùng lúc.

## Đã có

- Design system: `docs/design-system.md` (nguồn chuẩn, không đổi token), `design/assets/`, `design/foundation/`. Tài liệu: `docs/ui-ux/00-foundation.md` (17 finding đã xử lý; có vai trò MH, NS).
- Danh mục **184** màn hình: `docs/ui-ux/screen-inventory.md` (v0.2). Quyết định BA: `docs/ui-ux/ba-decisions.md` (v0.2, mục E mới), `ba-answers-0N.md`. Brief designer: `designer-brief.md`.
- Mô tả UI/UX flow tổng hợp: `docs/ui-ux/ui-ux-flow.md` (v1.0, designer lập; Phụ lục B còn ghi gói 6 "chưa làm" và Phụ lục C còn các mâu thuẫn đã chốt ở `ba-decisions.md` E, cần cập nhật).
- Đề xuất thay đổi cho FRD, BRD, Journey, design-system (chưa áp dụng): `docs/ui-ux/proposed-doc-changes.md`.
- 6 gói prototype HTML/CSS (đủ màn hình), mỗi gói có `index.html`, `pack.css`, `pack.js` và tài liệu `docs/ui-ux/0N-*.md`:

| Gói | Thư mục | Màn hình | Tài liệu |
| --- | --- | --- | --- |
| 1 Xác thực & Dashboard | `design/g1-auth-dashboard/` | 31 | `01-auth-dashboard.md` |
| 2 Khách hàng, lịch hẹn, tiếp nhận, lệnh sửa chữa, kiểm tra xe số | `design/g2-workshop/` | 26 | `02-workshop-intake.md` |
| 3 Báo giá, thợ tablet, giao xe, in ấn | `design/g2-quote-delivery/` | 21 | `03-quote-technician-delivery.md` |
| 4 Kho, mua hàng, nhân sự | `design/g3-inventory-hr/` | 39 | `04-inventory-purchasing-hr.md` |
| 5 Tài chính, phê duyệt, hóa đơn | `design/g4-finance/` | 32 (có G4-ACC-21) | `05-finance-invoice.md` |
| 6 Báo cáo & Hệ thống | `design/g4-reports-system/` | 35 | `06-reports-system.md` |

Tổng 31 + 26 + 21 + 39 + 32 + 35 = 184.

## Tiến độ review (BA ↔ designer)

| Gói | Vòng 1 | Vòng 2 | Vòng 3 | Kết luận hiện tại |
| --- | --- | --- | --- | --- |
| Foundation | 17 finding, đã sửa | – | – | Đã xử lý |
| 1 | 29 (2 Blocker, 12 Major, 15 Minor) | CHƯA ĐẠT: 2 Major, đã sửa | **ĐẠT** (0 Blocker, 0 Major; 2 Minor ở `ROLE_MENU`; 7 mục chuyển dev) | **ĐẠT** |
| 2 | 27 (0/10/17) | CHƯA ĐẠT: 17 (0/4/13), đã sửa | **ĐẠT** (3 Minor F2R3-01..03 đã xử lý ở `02` §13.3) | **ĐẠT** |
| 3 | 36 (0/13/23) | CHƯA ĐẠT nhẹ: 1 Major + 8 Minor, đã sửa | **ĐẠT** (3 Minor) | **ĐẠT**, nhưng phải sửa lại mục thợ mất mạng theo `ba-decisions.md` E.1 (xem dưới) |
| 4 | 31 (2/13/16) | CHƯA ĐẠT (sửa nhỏ), đã sửa | CHƯA ĐẠT: 1 Major F4R3-01 (hậu duyệt Mua gấp) + 2 Minor | Designer **báo đã sửa xong** (`04` §13c; có "Chờ hậu duyệt" ở `g3-pur-01.html`, `g3-pur-03.html`); BA đóng F4R3-01 khi xác nhận → ĐẠT |
| 5 | 22 (0/10/12) | CHƯA ĐẠT: 17 (0/7/10), đã sửa | **ĐẠT** (3 Minor F5R3-01..03 đã xử lý ở `05` §10d) | **ĐẠT** |
| 6 | 35 (0/18/17) | CHƯA ĐẠT: 2 Major + 8 Minor, đã sửa | **ĐẠT** (0 Blocker, 0 Major, 4 Minor F6R3-01..04) | **ĐẠT**; designer đang dọn 4 Minor |

Bốn Minor của gói 6: F6R3-01 ràng buộc ô "Xuất cột cá nhân đầy đủ" với quyền che dữ liệu (`g4-sys-04.html`); F6R3-02 hộp thoại khóa chi nhánh ("còn 5 mục treo", nhãn nút theo CH/AD) (`g4-sys-05.html`); F6R3-03 chú thích RPT-04 cho QV 35/42 lệnh (`g4-rpt-04.html`); F6R3-04 đánh số lại mục 14/15 của `06-reports-system.md`.

## Quyết định BA mới nhất (30/10/2026), designer phải áp dụng

Chi tiết và danh sách tệp ở `ba-decisions.md` mục E; bảng trạng thái ở A.2 và A.2b.

1. **Thợ mất mạng, Phase 1: chặn ghi mốc giờ** (E.1), thay cho "ghi giờ cục bộ rồi đồng bộ". Sửa: `g2-tec-01.html`, `g2-tec-02.html`, `pack.js` của `g2-quote-delivery`, `g1-dsh-07.html` (thêm "Khai giờ thực"), `g1-err-04.html`, hàng chờ "Yêu cầu nhập bù" cho Quản đốc, tài liệu `01`, `03`, `ui-ux-flow.md`.
2. **Yêu cầu cấp phụ tùng 6 trạng thái, "Thiếu hàng" = Warning** (A.2b): sửa badge và bộ lọc ở `g3-inv-06.html`, kiểm tra `g1-dsh-05.html`.
3. **"Đang vận chuyển"** thống nhất; làm sạch bảng 4 ở `04` §4 (bản 0.1 còn "Đang về") và bảng màn hình bản 0.1 ở `01` §2, `04` §3.
4. Báo giá "Đã hủy" là trạng thái thứ 7 **đề xuất, chờ chủ dự án xác nhận**; không đổi prototype cho đến khi xác nhận.

## Việc còn lại (theo thứ tự)

1. Designer áp dụng mục "Quyết định BA mới nhất" ở trên và dọn 4 Minor gói 6.
2. BA xác nhận đóng F4R3-01 gói 4 (và F4R3-02, 03) rồi ghi ĐẠT vòng 3; BA kiểm lại các tệp sửa ở bước 1 (chỉ phần thay đổi, không review lại cả gói).
3. Chụp ảnh kiểm tra trực quan các màn đại diện bằng Playwright ở 1440, 768 và 390 px (ví dụ G1-SHL-01, G1-DSH-01/07, G2-REC-04, G2-QUO-06, G2-TEC-02, G3-INV-04, G4-ACC-01, G4-RPT-01, G4-SYS-04); ghi lỗi hiển thị thành finding. Đây là lần đầu có kiểm tra trên trình duyệt thật.
4. Cập nhật `ui-ux-flow.md` (Phụ lục B theo bảng trên, đóng các mục C-1 đến C-7, C-15 theo `ba-decisions.md` E; số màn 184) và viết `CHANGELOG.md` cho bản hoàn chỉnh.
5. Chủ dự án xem `proposed-doc-changes.md` và các mục "BA đề xuất — chờ xác nhận"; quyết định áp dụng vào `functional-requirements.md`, `business-requirements.md`, `user-journey-business-workflow.md`, `design-system.md` (BA sẽ áp dụng khi được yêu cầu).
6. Commit và push (chỉ khi chủ dự án yêu cầu).

## Hạn chế chung cần biết

- Chưa agent nào mở được trình duyệt: prototype chưa được kiểm tra trực quan, chưa chạy thử JS, chưa đo tương phản thực tế, chưa thử in thật (bước 3 ở trên sẽ làm một phần). Nên mở thử `design/*/index.html` ở 1440, 768 và 390px.
- Các prototype dựng shell bằng JS (`document.write`) nên cần bật JS; đã thêm `<noscript>`. Phân quyền và che dữ liệu trong prototype chỉ mô phỏng (bằng CSS và `data-*`); sản phẩm thật phải làm phía máy chủ.
- Thiếu file font Be Vietnam Pro (WOFF2): cần đặt 4 file vào `design/assets/fonts/` theo `README.md` ở đó; hiện dùng font hệ thống.
- Icon vẽ lại theo phong cách Lucide, nên thay bằng gói Lucide chính thức khi chọn stack.
- Mọi quyết định "BA đề xuất — chờ xác nhận" cần chủ dự án/khách xác nhận trước khi chốt baseline. Các mã FR đề xuất trong `ba-answers-0N.md` bị trùng nhau; dùng bảng gán lại ở `proposed-doc-changes.md` mục B.
- Giới hạn sử dụng 5 giờ đã từng chạm trong phiên làm việc; giữ tối đa 2 agent chạy song song.

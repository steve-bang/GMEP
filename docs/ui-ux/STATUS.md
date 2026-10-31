# Trạng thái công việc thiết kế UI/UX

Cập nhật: 2026-10-31 (xem mục "Bổ sung 31/10/2026" ở cuối cho gói G5 và bàn giao slice 1.1/1.2). Thiết kế toàn bộ web dashboard Garage ERP (gồm đăng nhập, quên mật khẩu, kích hoạt tài khoản theo lời mời) đã hoàn thành ở mức prototype HTML/CSS và qua các vòng review BA ↔ designer. Không có agent nào đang chạy.

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
6. Chọn tech stack, rồi chuyển prototype sang component thật (giữ tên class/token). Đề xuất tech stack và kế hoạch triển khai của dev (chờ chủ dự án duyệt): [ADR 0001](../adr/0001-tech-stack.md), [review tài liệu và thiết kế](../dev/review-docs-and-design.md) (mục 4 là việc gửi lại designer), [kế hoạch triển khai](../dev/implementation-plan.md).

## Bổ sung 31/10/2026: bàn giao cho dev slice 1.1 và 1.2 (designer)

Phản hồi các mục DS-02, DS-04 (một phần), DS-07 (một phần), DS-09 của `docs/dev/review-docs-and-design.md` và câu hỏi Q3 của `docs/dev/open-questions-for-ba.md`. Không sửa `tokens.css`, `components.css`, không sửa tài liệu nghiệp vụ.

### Đã thêm

| Hạng mục | Tệp |
| --- | --- |
| Danh mục component hợp nhất, ánh xạ toàn bộ class tiền tố gói (g1-, g2w-, g2q-, g3-, g4f-, g4r-) sang component chuẩn, danh sách "KHÔNG dựng lại" | `docs/ui-ux/component-catalog.md` |
| Câu chữ trạng thái hệ thống: 401, 403, 404 (kể cả bản ghi ngoài phạm vi), 409, 422, 429, 500, offline, các trạng thái xác thực, mã lý do khóa nút, trạng thái khối dữ liệu | `docs/ui-ux/state-copy.md` |
| Gói prototype mới `design/g5-scope-auth/` (mục lục `index.html`, `pack.css` chỉ class `g5-`, `pack.js`) | G5-SCP-01 (bộ chọn phạm vi tương tác), G5-SCP-02 (thư viện trạng thái tĩnh), G5-AUT-01 quên mật khẩu, G5-AUT-02 đặt mật khẩu mới, G5-AUT-03 kích hoạt theo lời mời (một trang), G5-AUT-04 đăng nhập lỗi/khóa tạm/hết phiên, G5-AUT-05 khe xác thực mạnh TOTP/PIN |
| Mục lục `design/README.md`, dòng gói 7 trong `ui-ux-flow.md` §2 | – |

G5-AUT-01/02/03 thay cho G1-AUT-04/05/06 (đủ trạng thái hơn: 429, 5xx, đã dùng, đang tải, không còn quyền); trang G1 giữ làm tham chiếu. Trang G5-AUT dùng lại `g1-auth-dashboard/pack.css`, `g1-auth.js` (khung thẻ, kiểm form, đếm lùi) để không chép lại; ghi rõ trong catalog.

### Bàn giao cho dev (handoff)

1. **Dựng theo thứ tự:** AuthLayout + Field + PasswordField + OtpInput (slice 1.1) → Dialog (focus trap thật, dùng `<dialog>` hoặc Radix) + ConfirmDialog + ReasonDisabled → StatusBadge API `kind/status` (bỏ `tone` tự do) → ScopePicker + UnsavedDialog (slice 1.2) → KpiCard, MoneyInput, PartsItem khi tới gói tương ứng.
2. **ScopePicker thay `.branch-static` trong `AppShell.tsx`** khi người dùng có từ 2 chi nhánh; một chi nhánh giữ chip tĩnh. API đề xuất: `GET /api/v1/me/scopes` trả `branches[{id,name,roleAtBranch,locked,lockReason}]`, `groups`, `mergedAllowed`, `mergedDeniedReason`, `current`; đổi phạm vi là `POST` có kiểm quyền ở server (UI không tự suy ra). Phạm vi hiện tại ghi vào ScopeBar và mọi KPI/bảng/tệp xuất (RULE-015).
3. **Máy chủ quyết, UI chỉ hiển thị:** `can` và `reason.code` cùng bản ghi (bảng mã ở `state-copy.md` §3); số lần thử, thời gian khóa, `Retry-After` do API trả về, không viết cứng trong chữ.
4. **Không lộ sự tồn tại:** 404 cho cả bản ghi không có và ngoài phạm vi; quên mật khẩu, đăng nhập sai, khóa tạm cùng câu chữ cho mọi tài khoản; danh sách chi nhánh chỉ gồm chi nhánh được gán.
5. **MFA/PIN:** G5-AUT-05 là khe giữ chỗ cho `StrongAuthPort` (ADR 0001 §2.1 A2). Khi chưa cấu hình cổng, bỏ qua bước này (Phase 0/1); khi vai trò yêu cầu mà cổng báo `unavailable`, đề xuất chặn đăng nhập (fail-closed) và hiện câu ở `state-copy.md` §2.9, chờ chủ dự án xác nhận.
6. **Kiểm thử gợi ý:** mỗi tên trạng thái trên thanh "Xem thử trạng thái" của G5 là một test (Playwright + axe); mỗi mã ở `state-copy.md` §1 một test e2e; bộ test cách ly chi nhánh kiểm 404 đồng nhất.
7. **Nhớ:** `fonts/` vẫn chưa có Be Vietnam Pro; icon dùng `lucide-react` giữ nguyên tên.

### Kiểm tra tự động

Môi trường làm việc lần này không có công cụ chạy lệnh (không có shell), nên **chưa chạy Playwright** cho 7 trang G5 và 5 trang đã tham chiếu. Đo tràn ngang ở 390px, lỗi JS và lỗi console cho `design/g5-scope-auth/*.html` là việc còn mở (lệnh gợi ý: `node scripts/screenshot-all.js g5-scope-auth`, cộng đo `document.documentElement.scrollWidth > innerWidth` ở 390px). Đã tự rà tĩnh: sửa ô OTP lồng trong khe MFA (6 ô cố định 328px sẽ tràn ở 390px), ẩn khoảng đệm topbar trên điện thoại. Chưa có kiểm tra tương phản tự động cho trang mới (dùng token sẵn có).

### Quyết định còn mở (chờ BA/chủ dự án; thiết kế đã theo giả định ghi ở catalog)

BA đã trả lời Q1 đến Q12 ở `docs/dev/ba-answers-for-dev.md` (đề xuất, chờ khách xác nhận); thiết kế G5 đã khớp Q3 (mục 4: người nhiều chi nhánh không phải CH/QV chọn từng chi nhánh, CH/QV mặc định hợp nhất để xem), Q4 (mục 5: ba trạng thái chi nhánh `active/closing/locked`), Q6 (khóa đăng nhập trung lập "trên thiết bị này"). Còn lại:

1. "Nhóm chi nhánh" (Nhóm Miền Nam…) có tồn tại và ai định nghĩa (FRD chỉ nhắc QV thấy nhóm được giao).
2. Bảng hành động bị chặn theo trạng thái chi nhánh (BA mục 5) là đề xuất; UI chỉ nhận `can`/`reason` từ server.
3. Chính sách mật khẩu và khóa đăng nhập vẫn chưa có số trong FR-SYS-001 (10 ký tự, 5 mật khẩu gần nhất là D-03/ADR/BA đề xuất); chặn mật khẩu thông dụng và trùng danh tính là đề xuất BA chưa vào danh sách yêu cầu hiển thị.
4. Người được mời có sửa được họ tên khi kích hoạt không (mặc định chỉ đọc, như G1-AUT-06).
5. Fail-closed hay bỏ qua khi cổng xác thực mạnh chưa sẵn sàng.
6. Nút "Gửi yêu cầu cấp quyền / gán chi nhánh" có quy trình người nhận không.

## Cách tiếp tục

Đọc `ui-ux-flow.md` trước, sau đó `STATUS.md` (file này), rồi tài liệu gói liên quan. Giới hạn: tối đa 2 agent chạy cùng lúc.

# Trạng thái công việc thiết kế UI/UX

Cập nhật: 2026-11-05 (xem mục "Bổ sung 05/11/2026" ở cuối cho gói đăng ký tenant; mục 31/10/2026 cho gói G5 và bàn giao slice 1.1/1.2; câu "không tự đăng ký" trong tài liệu cũ nay chỉ còn đúng cho nhân viên). Thiết kế toàn bộ web dashboard Garage ERP (gồm đăng nhập, quên mật khẩu, kích hoạt tài khoản theo lời mời) đã hoàn thành ở mức prototype HTML/CSS và qua các vòng review BA ↔ designer. Không có agent nào đang chạy.

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

## Bổ sung 05/11/2026: gói "Đăng ký tenant và onboarding" (multi-tenant), BA rà chéo lần 1

**Quyết định mới thay D-01 một phần:** chủ garage **tự đăng ký** tenant ở trang công khai (D2, 05/11/2026); **nhân viên vẫn không tự đăng ký**, chỉ lời mời. Các mục "không tự đăng ký / không có nút Đăng ký" ở mục 31/10 phía trên, ở `01-auth-dashboard.md` và `ui-ux-flow.md` đã được ghi chú theo (xem `ba-decisions.md` mục F). Màn đăng nhập thêm ô **Mã công ty** (TSU-14, QĐT-01).

- **Prototype:** `design/tenant-signup/` có `public/` (TSU-01..18), `onboarding/` (TSU-20..31), `account/` (TSU-40..44, 50..57), `platform-admin/` (TSU-60..68) = **52 màn** (không tính vào 184), cùng `README.md`, `measure-overflow.js`. Đo Playwright đã chạy: **tất cả trang sạch, 0 tràn ngang, 0 lỗi JS**. Chưa có kiểm tra axe, tương phản, bàn phím tự động cho gói này.
- **Đặc tả:** `tenant-signup-spec.md` v0.2: QĐT-01..20 (v0.1) và **QĐT-21..40 (BA tự quyết 05/11/2026 theo ủy quyền của người dùng, chờ khách xác nhận)**: vai trò ở wizard, mốc bắt đầu đồng hồ dùng thử, "Xem lại từ bước 1" không xóa dữ liệu, hai kiểu khóa nút, thang bốn nấc hết trial, quyền gói xuất dữ liệu, chấm dứt có xác nhận email, đếm người dùng đang hoạt động, danh mục lý do hạn chế/tạm ngưng, liên kết giữa nhóm, lưu bí mật hóa đơn, tìm email, không thu email khi đóng đăng ký, token theo dõi, quá hạn bổ sung và khiếu nại, ngày hiệu lực theo nhóm, khung TSU-18, RULE-027, so khớp họ tên trong mật khẩu, 7 mã lý do khóa nút. `[Cần xác nhận]` mới: C-23..C-28.
- **Đã cập nhật tài liệu:** `ui-ux-flow.md` (§1.4, §2 bảng gói 8 và §2.7, §3.a, §10 A.1), `state-copy.md` (§2.10, §3.1), `ba-decisions.md` (mục F), `01-auth-dashboard.md`.
- **Việc cho designer (chưa làm, BA không sửa `design/`):** danh sách sửa prototype nằm trong báo cáo bàn giao của BA ngày 05/11/2026 (khoảng 20 mục: vai trò TSU-24, "Xem lại từ bước 1" TSU-20/31, trạng thái dùng thử khi `onboarding` TSU-20/40/41, đổi mã lý do sang chữ HOA và sửa câu ở TSU-50, liên kết BAN-09/10 và TSU-14, khung TSU-18, chữ đếm người dùng TSU-41, trạng thái kết nối TSU-27/29, hint TSU-61, TSU-08 `trong ứng dụng`, TSU-09 quá hạn, TSU-01 giữ chỗ C-18, TSU-56 `chờ CH xác nhận`, V-PASS có dấu, README cập nhật).
- **Còn mở ngoài lượt này:** `screen-inventory.md` §5 (D-01), `component-catalog.md` (BotCheckSlot, PlanCard, TenantStateBanner, hai kiểu khóa nút), CLAUDE.md và ADR 0002 còn ghi multi-tenant "không build" (L-09), FRD/BRD chưa có FR-TEN/RULE-016..032 (L-18), FRD §2 chưa có MH, NS (L-13).

## Bổ sung 05/11/2026: bản tối giản đăng ký tenant (garage một chi nhánh, một kho)

Đề xuất của BA ở `tenant-signup-simplified.md` (chưa được khách xác nhận) thu **52 màn TSU xuống 18** (11 giữ mã TSU, 7 mã TSX mới; 14 màn giai đoạn A, 4 màn giai đoạn B, 6 màn hoãn có điều kiện): đăng ký một trang (7 trường), tự duyệt khi MST hợp lệ và email xác thực, tự tạo 1 chi nhánh + 1 kho, onboarding 1 màn bắt buộc + 1 màn tùy chọn, phần còn lại thành checklist "Thiết lập dần" chỉ chặn phát hành hóa đơn thật (RULE-028). Đề xuất FR-TEN-051..053, RULE-033; thay thế/sửa QĐT-05, 09, 15, 21..24, 26, 27, 30, 35, 40; `[Cần xác nhận]` mới C-S01..C-S13. **Chưa sửa** `design/tenant-signup/` (designer cần dựng lại TSX-01, 02, 03, 10, 11, 20, 30 và chỉnh TSU-14, 15, 41, 50, 53, 56), `multi-tenant-analysis.md` và spec v0.2 (giữ làm nguồn cho màn hoãn).

## Bổ sung 06/11/2026: feedback client cho bản tối giản đăng ký tenant (v0.2)

`tenant-signup-simplified.md` v0.2 mục 9 ghi **QĐT-S01..S09** theo feedback của chủ garage nhỏ (BA tự quyết, chưa được khách xác nhận): đăng nhập email + mật khẩu không mã công ty (chọn công ty chỉ sau mật khẩu đúng); liên kết xác thực một lần 72 giờ tự đăng nhập bất kể trình duyệt; kênh hỗ trợ cấu hình; ẩn hoàn toàn giá và gói (hoãn giao diện); câu hỏi "đang quản lý bằng gì" + lối vào Excel; hóa đơn điện tử nói bằng tiếng thường; câu đồng ý rút gọn; mật khẩu hiện dần, kiểm tra người thật ẩn mặc định; giữ tên "GARAGE OS" qua `brand.name`. Thay thế QĐT-01/U1, C-S03, AC-S09; `[Cần xác nhận]` mới **C-S14..C-S24** (quan trọng nhất: C-S14 mô hình định danh khi một email thuộc nhiều tenant, C-S17 rủi ro liên kết bị chuyển tiếp). **Chưa sửa** `design/tenant-signup/` và các tài liệu khác (danh sách ở mục 9.9); mô tả "ô Mã công ty" ở các mục 05/11 phía trên không còn là mặc định.

## Bổ sung 06/11/2026: hợp nhất multi-tenant vào BRD/FRD (BA)

**Đã làm:** mã BR-TEN-01..11, RULE-016..034, FR-TEN-001..055 (29 Must, 21 Should, 5 Could tại thời điểm nhập; từ 06/11/2026 là 30, 21, 4, xem mục cuối), NFR-TEN-01..09, UAT-TEN-01..22 **đã nhập vào `business-requirements.md` và `functional-requirements.md`** (bản 0.4, nhãn "đề xuất, chờ xác nhận"; khắc phục L-18). FRD §2 đã ghi MH, NS là vai trò riêng chưa có cột trong ma trận và thêm **ma trận quyền nền tảng** (L-13, một phần: hai vai trò quản trị trụ sở và kiểm tra chất lượng vẫn chưa có mã). CLAUDE.md và ADR 0002 đã ghi chú theo quyết định 05/11/2026 (L-09). `screen-inventory.md` §5 D-01 và `component-catalog.md` §2.24 (BotCheckSlot ẩn mặc định, SupportCard, CompanyPicker, TenantStateBanner 3 biến thể, OnboardingChecklist 3 trạng thái, 5 mã lý do khóa nút) đã cập nhật (L-16). `multi-tenant-analysis.md` có mục 0A "Quyết định hiện hành" (hợp nhất bản tối giản v0.2: QĐT nào bị thay thế, màn nào giữ/hoãn).

**Tài liệu mới:** `docs/multi-tenant-open-questions.md` (câu mở xếp theo mức chặn ADR / build / go-live / thu tiền, người trả lời, khuyến nghị), `docs/dev/multi-tenant-requirements-for-dev.md` (bàn giao cho dev).

**Lưu ý:** feedback 06/11 (QĐT-S01..S09) và bản tối giản vẫn là **đề xuất chưa được khách xác nhận chính thức**; mã tắt "D1..D9" của feedback không phải D1..D3 của quyết định 05/11. **Việc cho designer (chưa làm):** dựng lại TSX-01, 02, 03, 10, 11, 20, 30; chỉnh TSU-14 (email + mật khẩu, biến thể chọn công ty), 15, 41, 50, 53, 56, 66; thêm SupportCard, CompanyPicker; ghi nhãn hoãn/đã gộp cho 34 màn còn lại và cập nhật `design/tenant-signup/README.md`. **Còn mở ngoài lượt này:** `user-journey-business-workflow.md` (J1..J10, hai bộ trạng thái mới), `tenant-signup-spec.md` (ghi chú thay thế), `state-copy.md`, `ba-answers-for-dev.md`, `implementation-plan.md`, `status.md`, `index-budget.md` (xem `multi-tenant-analysis.md` mục 0A.5).

## Bổ sung 06/11/2026: quyết định của chủ dự án (CD1 đến CD4) và việc cho designer

**Đã quyết (chủ dự án):** (CD1) một email có thể thuộc nhiều tenant, một danh tính nhiều tư cách thành viên (C-S14 = hướng (a)); (CD2) **không có dùng thử**, tenant không gán gói là miễn phí hoàn toàn, không đếm ngày (Q21, Q34); (CD3) bỏ MFA cho vai trò nền tảng (Q36); (CD4) tên sản phẩm **GMEP**, bỏ GARAGE OS (C-S24). Hệ quả BA đã ghi: FR-TEN-017 nâng Must/MT-0 (TEN còn 30 Must, 21 Should, 4 Could; MT-0 15 FR, MT-3 5 FR), RULE-035 mới, FR-TEN-044 viết lại, UAT-TEN-16 viết lại. Số mã nay: RULE-016..035, R-TEN-01..15.

**Việc cho designer (chưa làm; BA không sửa `design/`):**

1. Bỏ mọi copy "Dùng thử", "Dùng thử {N} ngày", "Đăng ký dùng thử", "Tạo tài khoản dùng thử", "{N} ngày dùng thử bắt đầu khi bạn bấm Bắt đầu dùng", "Sắp hết dùng thử" ở TSX-01, 10, 30, TSU-14, 41, 50 và `design/tenant-signup/`; dùng "Đăng ký", "Tạo tài khoản". Không nêu giá, gói, hay "miễn phí vĩnh viễn" trong UI cho tới khi luật sư và chủ dự án chốt câu chữ (Q38, C-S20).
2. TSU-41: bỏ thẻ "Dùng thử" và biến thể hết hạn; BAN-A bỏ biến thể dùng thử (còn hạn chế, tạm ngưng, khóa); bỏ câu trấn an hết dùng thử.
3. Đổi "GARAGE OS" thành "GMEP" (hoặc `{brand.name}` mặc định "GMEP") trong toàn bộ prototype gói đăng ký tenant, README, email mẫu, hóa đơn thử. BA đã đếm bằng tìm kiếm: "GARAGE OS" xuất hiện **286 lần trong 154 tệp** (gồm `design/g1-auth-dashboard`, `g2-quote-delivery`, `g5-scope-auth`, `foundation/shell.html`, `shell` JS, `docs/design-system.md` và các tài liệu ui-ux), nên đây là đổi hàng loạt cả dashboard chứ không chỉ gói đăng ký; designer chốt cách làm (một hằng ở `shell`, hay thay thế hàng loạt) và nhờ BA/dev xem lại `docs/design-system.md` (token không được đổi, chỉ đổi chữ tên).
4. TSU-14 và `CompanyPicker` trở thành **bắt buộc dựng** (không còn là biến thể tùy chọn): hiện sau mật khẩu đúng khi có từ hai tư cách; một tư cách vào thẳng; lối "Đổi công ty" trong phiên; danh sách chỉ gồm tư cách của chính người đó; email đặt lại mật khẩu nêu rõ áp cho mọi công ty của email.
5. TSU-60 (đăng nhập nền tảng): không có khe MFA (CD3).
6. Chi tiết: `docs/ui-ux/tenant-signup-simplified.md` đầu tài liệu (v0.3).

**Chưa quyết, cần biết khi thiết kế:** Q37 (thứ tự MT-1 so với pilot, BA đã khuyến nghị MT-1 sau pilot ổn định) quyết thời điểm dựng lại 14 màn giai đoạn A; Q40, Q41 còn mở.

## Cách tiếp tục

Đọc `ui-ux-flow.md` trước, sau đó `STATUS.md` (file này), rồi tài liệu gói liên quan. Giới hạn: tối đa 2 agent chạy cùng lúc.

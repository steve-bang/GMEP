# Kế hoạch nâng cấp phần Cấu hình (Cài đặt)

Ngày: 12/11/2026. Người lập: dev (Claude). Trạng thái: **đề xuất, chờ chủ dự án duyệt thứ tự**. Rà trên `master` sau khi merge #20 đến #24 (chỉ đọc mã, chưa chạy giao diện trên emulator).

Phạm vi "cấu hình" ở đây: mọi thứ đổi theo luật hoặc chính sách là **cấu hình có ngày hiệu lực** (FR-SYS-004/005/006, NFR-MNT-01), cộng các màn Cài đặt đi kèm (chi nhánh, kho, danh mục, nhập Excel, nhật ký). Thiết kế đích: `design/sys-users-redesign/` và `design/sys-ops-redesign/` (prototype, chưa xác nhận).

## 1. Kết quả rà soát (có số đo)

Đo bằng script đối chiếu `src/modules/sys/domain/config.ts` (`CONFIG_TYPES`) với `src/app/(shell)/sys/config/configView.ts`.

| # | Phát hiện | Số liệu | Mức |
| --- | --- | --- | --- |
| C1 | **22 trên 39 loại cấu hình không có form trên giao diện**, chỉ đặt được bằng API: `service-package`, `quote-approval`, `public-rate-limit`, `qc-checklist`, `order-policy`, `acc-policy`, `approval-limit`, `work-hours`, `expense-category`, `einvoice-issuer`, `einvoice-policy`, `tenant-limits`, `report-policy`, `branch-groups`, `catalog-release`, `service-workflow`, `labor-method`, `labor-position`, `labor-policy`, `appointment-policy`, `warranty-term`, `warranty-policy` | `PAYLOAD_FIELDS` có 17/39 | Cao |
| C2 | **20 trên 39 loại không có mô tả giá trị đọc được**: `describeValue` trả chuỗi rỗng ở nhánh `default`, nên bảng lịch sử phiên bản hiện cột giá trị trống (cùng danh sách ở C1 trừ `quote-approval`, `service-workflow`, thêm `service-package`) | 19/39 có `case` | Cao |
| C3 | Form là **một form chung** (`ProposeConfigForm`): các trường phẳng (text, vnd, int, percent, select, bool). Loại có cấu trúc lồng (gói bảo dưỡng, checklist QC, quy trình, `labor-method`, ma trận `approval-limit`) không thể biểu diễn. Có hai chỗ vá cứng theo tên loại trong form (`discount-limit` bọc `maxDiscountBpByRole`, `numbering-series` thêm `reversalSameSeries: true`) | `ProposeConfigForm.tsx` | Trung bình |
| C4 | Không có **xem trước tác động** trước khi gửi duyệt, không có **so sánh với bản đang hiện hành**, không có **nháp** (miền dữ liệu chỉ có `pending/approved/rejected`; "Hiện hành, Sắp hiệu lực, Hết hiệu lực" suy ra từ ngày). Câu hỏi U3 của BA chưa trả lời | `configView.ts`, `open-questions` U3 | Trung bình |
| C5 | **Trang chỉ mục `/sys/config` là danh sách phẳng 39 mục**; thanh menu nhóm chỉ liệt kê một phần loại (kho, chứng từ, bằng chứng); các loại như `approval-limit`, `acc-policy`, `labor-*` chỉ vào được qua chỉ mục. Người dùng không biết loại nào tác động gì | `config/page.tsx`, `SettingsPage.tsx` | Trung bình |
| C6 | Nhiều **màn đã ghi "chưa có màn riêng"** trong `docs/dev/status.md`: chọn chi nhánh phát hành danh mục, khai nhóm chi nhánh, ô chính sách lịch hẹn, soạn phiên bản nhiều dòng của HRM-06, ma trận phê duyệt G4-APR-03 | `status.md` | Trung bình |
| C7 | Cấu hình ghi đè theo chi nhánh có ở 13 loại (`branchOverride: true`) nhưng giao diện không cho thấy **giá trị hiệu lực cuối cùng của một chi nhánh** (kế thừa hay ghi đè, từ phiên bản nào) | `CONFIG_TYPES` | Trung bình |
| C8 | Kiểm thử mỏng: 1 test tích hợp (`config-admin`), 1 test hiển thị (`config-view-appointment-reasons`), **không có e2e cho màn cấu hình**; chưa có test "mỗi loại trong `CONFIG_TYPES` đều có mô tả và (nếu cho sửa) có form" | `tests/`, `e2e/` | Trung bình |
| C9 | Ví dụ số có chữ ký kế toán (NFR-MNT-01) chưa có: `tax-rate`, `labor-method`, `cost-method`; `tests/fixtures/hrm/labor-examples.json` có `signedOffBy` rỗng. Slice HRM không đóng UAT-11 | `status.md`, N8, I5 | Chặn bàn giao |
| C10 | Luật đã có trong mã (không cần làm): ngày hiệu lực **không được ở quá khứ** (`config_effective_in_past`), người đề xuất **không tự duyệt**, id phiên bản có tiền tố tenant. Thiết kế `sys-users-redesign` từng hỏi "có đặt lùi ngày không": mã hiện chặn, nên thiết kế phải theo mã trừ khi BA đổi | `effective.ts` | Thông tin |

Chưa rà (cần chạy giao diện): bố cục thực tế trên 390px và 1440px, thứ tự Tab, tương phản. Chưa đếm lại `pnpm check:indexes` (CLAUDE.md ghi 172/200).

## 2. Nguyên tắc nâng cấp

1. **Một loại cấu hình = một "bộ mô tả" duy nhất** (descriptor) ở một chỗ: trường, kiểu, nhãn, ví dụ, mô tả giá trị, cách xem trước tác động, nhóm menu. Form, mô tả giá trị, menu và test cùng đọc từ đó. Hết cảnh thêm loại mới mà quên form hoặc mô tả (C1, C2, C8).
2. **Không nới luật miền**: giữ nguyên duyệt hai người, không ngày quá khứ, không xóa phiên bản đã dùng, số tiền nguyên VND, thuế theo điểm cơ bản (RULE-010, NFR-MNT-01). Mọi số vẫn là dữ liệu, không viết cứng trong mã.
3. **Máy chủ quyết định, giao diện chỉ hiển thị**: `can` và lý do khóa nút do API trả; xem trước tác động tính ở máy chủ (cùng hàm với lúc áp dụng), không tính lại ở trình duyệt.
4. **Không thêm chỉ mục Firestore nếu tránh được**: cấu hình đọc theo khóa; đếm và lọc trong bộ nhớ trong một tenant. Mỗi pha đo `pnpm check:indexes` trước khi merge (ngưỡng fail 195).
5. **Mỗi pha là một PR nhỏ**, có test, đi qua `pnpm check:fast`; thiết kế lấy từ prototype đã merge, không vẽ lại.

## 3. Kế hoạch theo pha (chuẩn từng phần)

Ước lượng là công của một dev, chưa tính review. Thứ tự đã tính phụ thuộc.

### Pha 0. Nền: bộ mô tả và test bảo vệ (1 PR, 2 đến 3 ngày)
- Tạo `src/modules/sys/domain/configDescriptors.ts`: mỗi loại có `fields[]` (tên, kiểu, nhãn i18n, đơn vị, ràng buộc hiển thị), `describe(payload)`, `group`, `impact?`.
- Chuyển `PAYLOAD_FIELDS` và `describeValue` sang đọc từ bộ mô tả; bỏ hai chỗ vá cứng theo tên loại trong `ProposeConfigForm` (C3).
- Test đơn vị: duyệt toàn bộ `CONFIG_TYPES`, thất bại nếu thiếu mô tả, thiếu nhãn i18n hoặc thiếu nhóm (C8). Bắt đầu với danh sách "đã biết là thiếu" rồi thu hẹp qua các pha.
- **Xong khi:** test chạy xanh, không đổi hành vi nhìn thấy, 0 chỉ mục mới.

### Pha 1. Mô tả giá trị cho 20 loại còn trống (1 PR, 2 ngày)
- Viết `describe` cho 20 loại ở C2 (bảng lịch sử không còn cột trống); dùng đơn vị tiếng Việt: VND, %, giờ phút, "N lần".
- Ví dụ test từng loại (payload mẫu → chuỗi mong đợi).
- **Xong khi:** thu hẹp danh sách "đã biết là thiếu" về 0 cho mô tả.

### Pha 2. Chỉ mục và nhóm menu theo nghiệp vụ (1 PR, 2 ngày)
Thay danh sách phẳng bằng 7 nhóm (C5), mỗi mục có một dòng "ảnh hưởng đến đâu":

| Nhóm | Loại cấu hình |
| --- | --- |
| Thuế và giá | `tax-rate`, `tax-mapping`, `price-item`, `discount-limit`, `cost-method`, `labor-rate`, `standard-hours` |
| Dịch vụ và quy trình | `service-type`, `service-package`, `service-workflow`, `qc-checklist`, `evidence-kind`, `decline-reason`, `quote-approval`, `order-policy` |
| Lịch hẹn và bảo hành | `appointment-policy`, `appointment-cancel-reason`, `appointment-reschedule-reason`, `warranty-term`, `warranty-policy` |
| Nhân công | `labor-method`, `labor-position`, `labor-policy`, `work-hours` |
| Tài chính và phê duyệt | `acc-policy`, `approval-limit`, `expense-category`, `einvoice-issuer`, `einvoice-policy` |
| Kho | `inventory-policy`, `part-group`, `part-unit` |
| Chứng từ, hệ thống | `doc-template`, `numbering-series`, `public-rate-limit`, `tenant-limits`, `report-policy`, `branch-groups`, `catalog-release` |

- Trang chỉ mục: nhóm, tìm không dấu, huy hiệu "có thay đổi chờ duyệt" và "có bản sắp hiệu lực" cho từng loại (tính từ bản đã tải, không thêm truy vấn).
- **Xong khi:** mọi loại vào được từ menu theo quyền; e2e mở từng nhóm.

### Pha 3. Form cho 22 loại còn lại, theo độ khó (3 PR, 6 đến 8 ngày)
- **3a, trường phẳng (8 loại, 2 ngày):** `public-rate-limit`, `order-policy`, `acc-policy`, `work-hours`, `report-policy`, `einvoice-policy`, `appointment-policy`, `warranty-policy`. Dùng form chung từ bộ mô tả.
- **3b, danh mục và khóa phạm vi (5 loại, 2 ngày):** `expense-category`, `warranty-term`, `labor-position`, `einvoice-issuer`, `tenant-limits` (chỉ vai trò nền tảng sửa). `einvoice-issuer`: bí mật không hiện lại (xem pha 6).
- **3c, cấu trúc lồng (9 loại, 3 đến 4 ngày):** `approval-limit` (ma trận loại × cấp, khớp G4-APR-03; thay luôn việc "chưa làm" ở status), `labor-method`, `service-package`, `qc-checklist`, `service-workflow`, `quote-approval`, `branch-groups`, `catalog-release`, `labor-policy`. Dùng bộ soạn dòng có thể thêm/xóa; thiết kế lấy từ `apr-redesign/matrix.html` và `sys-users-redesign`.
- **Xong khi:** `PAYLOAD_FIELDS` phủ 39/39 hoặc loại bị chủ ý "chỉ API" có ghi lý do trong bộ mô tả; test C8 xanh.

### Pha 4. Quy trình soạn, xem trước, so sánh (1 đến 2 PR, 4 đến 5 ngày)
- **So sánh với bản hiện hành** ngay trong form: hai cột "Hiện hành / Đề xuất", tô các trường đổi.
- **Xem trước tác động** do máy chủ tính, theo từng loại có `impact`: thuế (dòng báo giá mở), giảm giá (chứng từ chờ duyệt vượt mức mới), thời hạn duyệt, đơn giá giờ công. Tác động chỉ đọc, ghi rõ "ước tính".
- **Nháp** (U3): nếu BA đồng ý thì thêm trạng thái `draft` (một người soạn nhiều lần trước khi gửi); nếu chưa, bỏ chữ "Nháp" khỏi thiết kế. **Chặn bởi quyết định U3.**
- Hộp thoại gửi duyệt nêu: ai sẽ duyệt, từ ngày nào, lý do bắt buộc, "không thể sửa sau khi duyệt, chỉ thêm bản mới".
- **Xong khi:** e2e luồng đề xuất → duyệt → hiệu lực với ít nhất `tax-rate` và `discount-limit`.

### Pha 5. Giá trị hiệu lực theo chi nhánh (1 PR, 3 ngày)
- Với 13 loại ghi đè theo chi nhánh: bảng "chi nhánh × giá trị hiện hành", nhãn **kế thừa** hoặc **ghi đè** và bản nào đang dùng, có bản sắp hiệu lực (C7). Khớp `sys-users-redesign/discounts.html` và `branch.html`.
- Màn "Chi nhánh được phát hành danh mục" (`catalog-release`) và "Nhóm chi nhánh" (`branch-groups`) (C6).
- **Xong khi:** quản lý chi nhánh chỉ thấy và sửa chi nhánh của mình (không đọc/ghi ngoài phạm vi, 404 đồng nhất); test cô lập tenant và chi nhánh cho các màn mới.

### Pha 6. Quản trị đi kèm (2 PR, 5 đến 6 ngày)
- **Tích hợp hóa đơn và tin nhắn:** màn cấu hình theo `sys-ops-redesign` (nhà cung cấp trung lập, chỉ giả lập, "Chạy thật" bị chặn có lý do, bí mật nhập một lần). Chặn bởi chọn nhà cung cấp thật (Q78, EIN).
- **Vai trò và quyền, cơ cấu tổ chức, phiên:** theo `sys-users-redesign` phần chưa có; đối chiếu với màn đã build trước khi dựng (danh sách phiên, đăng xuất từng thiết bị).
- Nhật ký thao tác: bổ sung lọc và xem trước/sau nếu thiếu.
- **Xong khi:** mỗi màn có e2e, kiểm tra che PII và bí mật, nhật ký ghi mọi thay đổi.

### Pha 7. Chặn bàn giao: ví dụ có chữ ký kế toán (song song, do khách)
- Thu ví dụ ký cho `tax-rate` (kèm làm tròn), `labor-method`, `cost-method`; điền `signedOffBy` và `signedAt`; đóng UAT-11 và N8. Dev chỉ viết test từ ví dụ đã ký, không tự đặt số.

## 4. Quyết định cần chủ dự án hoặc BA (chặn pha tương ứng)

| Mã | Câu hỏi | Chặn |
| --- | --- | --- |
| U3 | Có cần lưu **nháp** cấu hình trước khi gửi duyệt không | Pha 4 (nháp) |
| U5 | Gộp dịch vụ, giờ chuẩn, đơn giá giờ công thành một màn 3 tab, hay giữ hai màn | Pha 3 và 5 |
| Q78 | Nhà cung cấp hóa đơn, Zalo, SMS | Pha 6 |
| Q73 | Công thức công và hoa hồng của khách | Pha 3c (`labor-method`), Pha 7 |
| I21 | Quy tắc khi ngừng một nhóm hàng đang có phụ tùng | Pha 3b |
| mới | Quyền mới của vai trò có áp ngay hay cần đăng nhập lại | Pha 6 |
| mới | Trần giảm giá theo chi nhánh quan hệ thế nào với ngưỡng tự quyết và cấp 1 của ma trận phê duyệt | Pha 3c, 5 |
| mới | Vai trò nào được đổi cấu hình nào (mới `<resource>:update/approve` theo loại; cần ma trận đã BA xác nhận) | Pha 2 đến 6 |

Mặc định dev dùng nếu chưa có trả lời, ghi rõ trong PR và README: không nháp, giữ hai màn dịch vụ/giờ chuẩn/đơn giá như hiện tại, không đổi quyền hiện có.

## 5. Tiêu chuẩn "xong" chung cho mỗi PR

- `pnpm check:fast` xanh; test mới cho mỗi nhánh nghiệp vụ; full CI xanh trên PR.
- Không firebase trong bundle trình duyệt, ghi đi qua `api`/`authed`, ghi kèm nhật ký trong cùng giao dịch, rủi ro có `Idempotency-Key`, lỗi RFC 9457.
- e2e Playwright cho luồng chính; kiểm tra tràn ngang ở 390px; axe không lỗi nghiêm trọng.
- `pnpm check:indexes` ghi số đo vào `docs/dev/index-budget.md`; không vượt 195.
- Cập nhật `docs/dev/status.md` mục SYS: cái gì xong, cái gì chưa, câu hỏi còn mở. Cặp "chưa xác nhận" của README thiết kế được chuyển thành câu hỏi BA.

## 6. Rủi ro

- Pha 3c có thể phình vì cấu trúc lồng; tách từng loại thành PR riêng nếu vượt 400 dòng đổi.
- Xem trước tác động (Pha 4) có thể cần truy vấn mới; nếu cần chỉ mục thì dừng và hỏi trước (ngân sách 172/200, còn khoảng 23 chỗ, thiết kế redesign ước thêm 25 đến 45 chỉ mục nếu dựng hết).
- Prototype chưa kiểm tra bàn phím, tương phản; việc này làm trong pha dựng, không đẩy sang sau.

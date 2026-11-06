# GMEP – Phân tích nghiệp vụ Multi-tenant (BA)

- **Trạng thái:** Nháp BA v3 (06/11/2026: thêm mục 0A "Quyết định hiện hành" và hợp nhất bản tối giản v0.2; nội dung v2 ngày 05/11/2026 giữ nguyên bên dưới). **Multi-tenant là yêu cầu thiết kế từ đầu**: phần "nền" (đợt MT-0) thuộc Phase 1; tự đăng ký, gói dịch vụ và thu tiền làm theo các đợt MT-1 đến MT-3 (mục 17). **Từ 06/11/2026 các mã BR-TEN, RULE-016 đến 034, FR-TEN-001 đến 055, NFR-TEN, UAT-TEN-01 đến 22 đã được nhập vào BRD/FRD** (bản 0.4, vẫn là đề xuất chờ xác nhận) và CLAUDE.md, ADR 0002 đã được ghi chú theo quyết định 05/11/2026; chưa build phần nào ngoài nền hiện có.
- **Đọc nhanh:** chỉ cần mục 0A (khoảng 100 dòng) để biết quyết định hiện hành, số mã, màn hình giữ/hoãn và mâu thuẫn còn lại. Các mục 1 đến 23 là chi tiết; **khi mục 0A mâu thuẫn với mục 1 đến 23 thì mục 0A thắng**.
- **Ngày:** 05/11/2026 (v2), 06/11/2026 (v3)
- **Người viết:** BA
- **Tài liệu liên quan:** [BRD](business-requirements.md) · [FRD](functional-requirements.md) · [User journey](user-journey-business-workflow.md) · [ADR 0002 (nháp kỹ thuật)](adr/0002-multi-tenant.md) · [ADR 0001](adr/0001-tech-stack.md) · [ba-answers-for-dev](dev/ba-answers-for-dev.md) · [open-questions-for-ba](dev/open-questions-for-ba.md)
- **Quy ước:** mọi điểm chưa chốt ghi `[Cần xác nhận: ai]`. Tài liệu này không chọn công nghệ và không giả định đáp án cho các điểm đó. Mã `FR-TEN-xxx`, `BR-TEN-xx`, `RULE-016` đến `RULE-032`, `NFR-TEN-xx`, `UAT-TEN-xx` là **mã đề xuất**, chưa nhập vào FRD/BRD; đã kiểm tra không trùng mã hiện có (RULE hiện đến 015, UAT đến 26, FR-SYS đến 018 trong FRD; dev đã tạm dùng FR-SYS-019 đến 032 và UAT-27 đến 31 trong `ba-answers-for-dev.md`, nên nhóm mới dùng tiền tố riêng để khỏi đụng mã).

## 0A. Quyết định hiện hành (06/11/2026)

### 0A.1 Ai đã quyết gì

Ba nhóm, **không trộn**. Mã `D1` đến `D3` là quyết định của khách ngày 05/11; mã tắt "D1 đến D9" trong `tenant-signup-simplified.md` mục 9 là feedback 06/11 (nay gọi bằng QĐT-S01 đến S09 để khỏi nhầm).

| Nhóm | Nội dung | Trạng thái |
| --- | --- | --- |
| **A. Khách quyết 05/11/2026** | D1 multi-tenant thiết kế từ đầu; D2 chủ garage khác tự đăng ký, tự triển khai (nhân viên vẫn chỉ vào bằng lời mời); D3 có gói thu tiền, làm sau theo phase. Hệ quả: Q1 = SaaS dùng chung (S1), Q11 = tự đăng ký, Q5 quyết một phần | **Đã quyết** |
| **B. Feedback 06/11/2026** (chủ garage nhỏ đi thử luồng; BA ghi thành đề xuất) | QĐT-S01 đăng nhập email + mật khẩu, không ô Mã công ty; S02 liên kết xác thực một lần 72 giờ tự đăng nhập bất kể trình duyệt; S03 kênh hỗ trợ cấu hình; S04 ẩn giá và gói (hoãn giao diện, giữ mô hình dữ liệu); S05 hỏi "đang quản lý garage bằng gì" + lối vào Excel; S06 hóa đơn điện tử nói bằng tiếng thường; S07 câu đồng ý rút gọn, DPA tách riêng; S08 mật khẩu hiện dần, kiểm tra người thật ẩn mặc định; S09 tên thương hiệu một hằng cấu hình | **Chưa được khách, luật sư, kế toán xác nhận chính thức**; số 72 giờ là số của client nhưng vẫn là tham số |
| **C. BA đề xuất, chờ xác nhận** | Bản tối giản đăng ký (garage một chi nhánh một kho, 52 màn xuống 18, tự duyệt khi hợp lệ, onboarding hai màn + checklist); FR-TEN-051 đến 055; RULE-033, 034; phân đợt MT-0 đến MT-3; toàn bộ mã BR/RULE/FR/NFR/UAT | Đề xuất; đã nhập BRD/FRD ngày 06/11 kèm nhãn "chờ xác nhận" |
| **D. Chưa quyết, BA không đoán** | Mô hình cô lập dữ liệu; định danh nhiều tenant (C-S14); cấp phát trên Firebase/GCP; nhà cung cấp thanh toán; VAT và pháp nhân hóa đơn nền tảng; thời lượng và loại dùng thử (trial hay early access); mức xác minh tenant; thứ tự MT-1 so với pilot; luật sư: DPA, click-wrap | Danh sách đầy đủ: `docs/multi-tenant-open-questions.md` |

### 0A.2 Số mã hiện hành

| Loại | Mã | Số lượng |
| --- | --- | --- |
| BR | BR-TEN-01 đến 11 | 11 (8 Must, 3 Should) |
| RULE | RULE-016 đến 034 (033, 034 mới từ bản tối giản) | 19 |
| FR | FR-TEN-001 đến 055 (051 đến 055 mới) | 55: 29 Must, 21 Should, 5 Could |
| NFR | NFR-TEN-01 đến 09 | 9 |
| UAT | UAT-TEN-01 đến 22 (20 đến 22 mới) | 22 |
| Đợt | MT-0 nền (cùng Phase 1) 14 FR · MT-1 tự phục vụ có kiểm soát 21 FR · MT-2 gói và dùng thử 14 FR · MT-3 thu tiền 6 FR | 55 |

Đã kiểm tra không trùng mã với BRD/FRD hiện có (RULE đến 015; UAT đến 26; FR-SYS đến 018) và với mã tạm của dev (FR-SYS-019 đến 032, UAT-27 đến 31). FR-TEN-054, 055 và RULE-034 trước đây chỉ có tên trong `tenant-signup-simplified.md` mục 9.9; nay có nội dung ở mục 14.2, 14.3.

### 0A.3 Hợp nhất bản tối giản (simplified v0.2) vào analysis

**Quy tắc ưu tiên:** bản tối giản thay thế đường **tự đăng ký** của spec `tenant-signup-spec.md` v0.2; kênh bán hàng có nhân sự (J1, mục 9.1) giữ nguyên như analysis. Khi bảng dưới mâu thuẫn với dòng FR ở mục 14.3 thì bảng dưới thắng.

| FR / RULE | Thay đổi theo bản tối giản | Trạng thái |
| --- | --- | --- |
| FR-TEN-004 (Must) | Tự động hóa: Company, chi nhánh, kho do hệ thống tạo; đơn vị phát hành mặc định `fake`; điều khoản và chính sách lưu trữ đã xem ở lúc đăng ký (C-S11); **kích hoạt = chủ garage bấm "Bắt đầu dùng"** ở TSX-10. Giữ nguyên: phát hành hóa đơn thật cần đạt xác minh (FR-TEN-040) và khai nhà cung cấp | Đề xuất |
| FR-TEN-016 | Đăng nhập mặc định **email + mật khẩu**, không ô Mã công ty; bước "Chọn công ty" chỉ hiện **sau mật khẩu đúng** khi email thuộc nhiều công ty; lỗi trung lập (QĐT-S01). Mã công ty còn dùng nội bộ, hỗ trợ, email chào mừng. **Trả lời một phần Q4 ở mức đề xuất** (hướng C-S14 (a)); chưa phải quyết định | Đề xuất, chờ C-S14 |
| FR-TEN-030 | Đường tự đăng ký **không còn** `onboarding` kéo dài với dữ liệu thử tách riêng: dữ liệu tạo ra là dữ liệu thật, hóa đơn `fake` tới khi qua cổng RULE-028, dữ liệu mẫu gắn cờ `sample`. Giữ FR-TEN-030 nguyên cho kênh bán hàng | Đề xuất, chờ C-S04 |
| FR-TEN-032 (Could) | Chuyển thành mục tùy chọn của checklist "Thiết lập dần" | Đề xuất |
| FR-TEN-037 | Không đổi; màn chấp nhận lại (TSU-18) và quản trị phiên bản (TSU-67) hoãn tới trước khi có điều khoản bản 2 | Đề xuất (C-S08) |
| FR-TEN-039 | Một trang; trường: tên, MST, họ tên người đại diện, email, mật khẩu, hai ô chấp nhận (một câu ngắn kèm bản đầy đủ); SĐT chuyển sang TSX-10; loại hình suy ra từ MST (C-S05); kiểm tra người thật ẩn mặc định; mật khẩu hiện dần; không chọn gói, không giá; email đã có tài khoản **không** ghi đè mật khẩu | Đề xuất |
| FR-TEN-040 | Thêm tiêu chí tự duyệt (cấu hình hiệu lực theo ngày); xác minh **không chặn dùng ứng dụng**, chỉ chặn phát hành hóa đơn thật; hiển thị hỗ trợ ở trạng thái chờ | Đề xuất |
| FR-TEN-041 | Không dựa vào kiểm tra người thật mặc định: điểm rủi ro, cờ `bot_check.always`, ngưỡng tự bật (C-S23) | Đề xuất |
| FR-TEN-042 | Thêm bước tạo 1 chi nhánh và 1 kho mặc định, cờ hiển thị đơn chi nhánh; xử lý email đã có tài khoản (thêm tư cách thành viên); thư xác thực và chào mừng đúng nội dung QĐT-S02 | Đề xuất |
| FR-TEN-043 (Should) | Viết lại: onboarding **tối đa hai màn** (TSX-10 xác nhận và kích hoạt; TSX-11 thiết lập nhanh tùy chọn: câu hỏi "đang quản lý bằng gì", dịch vụ mẫu, mời nhân viên); phần còn lại là checklist FR-TEN-052 | Đề xuất |
| FR-TEN-044, 045 | Chỉ hoãn **giao diện** gói/giá (QĐT-S04); yêu cầu dữ liệu giữ nguyên; đồng hồ dùng thử bắt đầu ở "Bắt đầu dùng"; `onboarding_max_days` giữ làm van an toàn | Đề xuất |
| **FR-TEN-051 (mới, Must)** | Tổ chức mặc định một chi nhánh một kho; UI nhiều chi nhánh/kho chỉ hiện khi có từ 2 chi nhánh (hoặc 2 kho) hoạt động | Đề xuất |
| **FR-TEN-052 (mới, Should)** | Thiết lập dần: checklist, mục chặn chỉ gồm phát hành hóa đơn thật | Đề xuất |
| **FR-TEN-053 (mới, Should, viết lại 06/11)** | Liên kết xác thực một lần, 72 giờ (tham số), tự đăng nhập bất kể trình duyệt, chỉ lần đầu, có nhật ký và email thông báo | Đề xuất (QĐT-S02) |
| **FR-TEN-054 (mới, Should)** | Kênh hỗ trợ cấu hình (`support.*`), hiển thị ở các màn nêu ở QĐT-S03 | Đề xuất (QĐT-S03) |
| **FR-TEN-055 (mới, Could)** | Tên thương hiệu cấu hình một nơi (`brand.name`), không viết cứng | Đề xuất (QĐT-S09, C-S24) |
| RULE-028 | Giữ. Làm rõ: "chạy ở chế độ thử" nghĩa là hóa đơn `fake`, không phát hành thật, không gửi tin hàng loạt; không đòi trạng thái vòng đời `onboarding` kéo dài | Đề xuất |
| **RULE-033 (mới)** | Ẩn UI chi nhánh/kho không đổi mô hình dữ liệu, Scope hay cô lập | Đề xuất |
| **RULE-034 (mới)** | Một thông tin đăng nhập có thể thuộc nhiều tenant; mọi truy cập vẫn gắn đúng một tenant theo phiên | Đề xuất, chờ C-S14 |

**QĐT của spec v0.2 (QĐT-01 đến 40) bị thay thế, sửa hoặc giữ:**

| Kết quả | QĐT |
| --- | --- |
| **Thay thế** | QĐT-01 và QĐT-U1 (đăng nhập có mã công ty) bởi QĐT-S01; QĐT-05 (form 3 bước) bởi một trang; QĐT-09 (bước wizard bắt buộc) bởi checklist và FR-TEN-004 sửa; QĐT-23 ("Xem lại từ bước 1", xóa dữ liệu thử) bỏ |
| **Sửa** | QĐT-02 (loại hình suy từ MST; phần mã công ty thay bởi S01); QĐT-04, 11, 25 (chữ gói/thuê bao, bởi S04; mô hình giữ); QĐT-13 (SĐT thu ở TSX-10, không OTP); QĐT-15 (chỉ CH kích hoạt); QĐT-21 (vai trò hiển thị đơn giản, QV/MH/NS ẩn); QĐT-22 (đồng hồ dùng thử bắt đầu ở "Bắt đầu dùng"); QĐT-24 (một quy tắc khóa nút); QĐT-26 (chỉ giữ `DA NHAN DU LIEU`); QĐT-27 (bỏ chuỗi gõ riêng ở bước gửi); QĐT-30 (BAN-10 thành BAN-C; BAN-09 hoãn); QĐT-35 (khiếu nại qua hỗ trợ + "Chuyển lại xem xét"); QĐT-40 (còn 5 mã lý do khóa nút); QĐT-17, 34 (mở rộng, giữ) |
| **Giữ** | QĐT-03, 06, 07 (vai trò đổi: nội bộ, hỗ trợ, email chào mừng), 08, 10, 12, 14, 16, 18, 19, 20, 28, 29, 31 (áp ở màn EIN), 32 đến 34, 36, 38, 39; QĐT-37 hoãn cùng TSU-18 |

QĐT-21 đến 40 là tiêu chí chấp nhận chi tiết của các FR tương ứng; chi tiết ở spec và bản tối giản, không chép lại ở đây (AC-S01 đến S41 ở bản tối giản mục 8 và 9.8).

### 0A.4 Màn hình: giữ, gộp, hoãn (52 màn xuống 18)

| Nhóm | Màn |
| --- | --- |
| **Giữ (11)** | TSU-14 (đăng nhập, sửa theo S01), 15 (quên mật khẩu, bỏ tab mã công ty), 16, 41 (chỉ thẻ "Dùng thử"), 50 (banner còn 3 loại: BAN-A, B, C), 51, 53, 55, 56, 60, 66 |
| **Mới (7)** | TSX-01 đăng ký một trang; TSX-02 kiểm tra email; TSX-03 xác thực và tiến trình; TSX-10 xác nhận garage và bắt đầu dùng; TSX-11 thiết lập nhanh (tùy chọn); TSX-20 thiết lập dần; TSX-30 hàng đợi và hồ sơ nền tảng |
| **Hoãn có điều kiện (6)** | TSU-18 chấp nhận điều khoản mới và TSU-67 quản trị điều khoản (trước khi công bố điều khoản bản 2, C-S08); TSU-42 so sánh/nâng gói, TSU-43 hạ gói, TSU-44 lịch sử gói, TSU-68 danh mục gói (billing B1, ẩn theo QĐT-S04) |
| **Chuyển thành đường khác** | TSU-11, 64 (khiếu nại) thành hỗ trợ + nút "Chuyển lại xem xét" ở TSX-30 (C-S07); TSU-26, 27, 28 (thuế/đánh số, nhà cung cấp hóa đơn, nhập Excel) thành mục checklist trỏ tới màn SYS, EIN, SYS-007 sẵn có |
| **Gộp hoặc bỏ (35)** | Phần còn lại của TSU-01 đến 13, 17, 20 đến 25, 29 đến 31, 40, 52, 54, 57, 61 đến 63, 65; bảng đối chiếu từng mã ở `tenant-signup-simplified.md` mục 5 |
| **Giai đoạn** | A (trước khi mở đăng ký, 14 màn): TSX-01, 02, 03, 10, 11, 20, 30; TSU-14, 15, 16, 41, 50, 60, 66. B (trước khi tenant đầu tiên hết dùng thử hoặc bị tạm ngưng, 4 màn): TSU-51, 53, 55, 56 |

Thiết kế giao diện chưa dựng lại (`design/tenant-signup/` vẫn là 52 màn v0.2); việc cho designer ở `docs/dev/multi-tenant-requirements-for-dev.md` mục 10 và `docs/ui-ux/STATUS.md`.

### 0A.5 Đã nhập vào tài liệu nào (06/11/2026) và mâu thuẫn còn lại

Đã nhập: BRD (mục 4, 5, 6, 7, 8, 9, 10), FRD (mục 1, 2, 10A, 11, 12, 13), CLAUDE.md (đoạn Multi-tenant và dòng liên quan), ADR 0002 (trạng thái, bối cảnh, phạm vi; phần quyết định kỹ thuật của dev giữ nguyên), `screen-inventory.md` §5 (D-01), `component-catalog.md` (§2.24), `STATUS.md`, `dev/open-questions-for-ba.md`; tạo mới `docs/multi-tenant-open-questions.md` và `docs/dev/multi-tenant-requirements-for-dev.md`. **Chưa làm:** `user-journey-business-workflow.md` (J1 đến J10, hai bộ trạng thái mới), `ba-answers-for-dev.md`, `implementation-plan.md`, `status.md`, `index-budget.md`, `tenant-signup-spec.md` (ghi chú thay thế), `state-copy.md`, `design/`.

Mâu thuẫn và điểm cần chủ dự án quyết (BA không tự gỡ):

| # | Mâu thuẫn | Gợi ý |
| --- | --- | --- |
| X1 | **Đặt tên "D1 đến D9"** của feedback 06/11 trùng mã D1 đến D3 của quyết định 05/11 | Dùng QĐT-S01 đến S09 cho feedback (đã làm ở tài liệu này) |
| X2 | QĐT-S01 (một thông tin đăng nhập, nhiều tư cách thành viên) về thực chất là U2, nhưng FR-TEN-017 (U2) xếp Could/MT-3 và mục 17.3 nói "U1 mặc định ở MT-0" | Chủ dự án quyết C-S14. Đề xuất: mô hình dữ liệu chấp nhận nhiều tư cách ngay từ MT-0 (không buộc email duy nhất), giao diện chọn công ty chỉ hiện khi email thuộc từ 2 công ty; FR-TEN-017 còn lại là "đổi công ty khi đang đăng nhập" |
| X3 | QĐT-S04 chỉ hiển thị "Dùng thử {N} ngày", tức đã ngầm chọn `trial`; Q21/Q34 (trial hay early access, bao nhiêu ngày) **còn mở** | Giữ `trial` ở UI là tham số; chốt Q21/Q34 trước khi mở đăng ký |
| X4 | Bản tối giản bỏ môi trường thử tách dữ liệu (FR-TEN-030 sửa) trong khi RULE-028 trong analysis nói "chạy `onboarding`/sandbox" | Đã làm rõ RULE-028 ở bảng 0A.3; chờ C-S04 |
| X5 | Đồng hồ dùng thử bắt đầu ở "Bắt đầu dùng" (kích hoạt), nhưng mục 5.5 và FR-TEN-044 chưa nêu mốc | FR-TEN-044 sửa ở bảng 0A.3 |
| X6 | `companyId` đang là ranh giới ngoài cùng trong mã (929 lần/127 tệp) trong khi mô hình nay là tenant → Company (M1) | Dev (DEV-3); yêu cầu nghiệp vụ RULE-018 đã đủ |
| X7 | Tên sản phẩm hiển thị: GARAGE OS (prototype) hay GMEP (dự án) | C-S24; dùng `brand.name` |
| X8 | MFA ngoài phạm vi theo quyết định owner, nhưng vai trò nền tảng quyền rất cao | Q36; owner cân nhắc ngoại lệ riêng cho vai trò nền tảng |
| X9 | Tenant số 1 (pilot) cần chấp nhận điều khoản trước dữ liệu thật (RULE-029) nhưng FR-TEN-037 thuộc MT-1 | Q38; cần trả lời trước go-live pilot |
| X10 | `user-journey-business-workflow.md` chưa có J1 đến J10 và hai bộ trạng thái mới; `screen-inventory.md` và `component-catalog.md` chỉ mới ghi chú | Việc tiếp theo của BA |

---

## 0. Quyết định mới của khách hàng (05/11/2026)

**Nguồn:** user (khách hàng/chủ dự án), 05/11/2026. Ghi nhận đúng ý, không thêm: hệ thống phải được thiết kế multi-tenant **ngay từ đầu**, để chủ garage khác có thể **tự đăng ký và tự triển khai** (self-service onboarding); trong tương lai sẽ làm **gói dịch vụ để thu tiền** (billing/subscription).

### 0.1 Quyết định

| Mã | Quyết định | Thay thế điều gì |
| --- | --- | --- |
| D1 | Multi-tenant là yêu cầu thiết kế ngay từ đầu | Dòng "Multi-tenant (future, not built, not in current scope)" trong CLAUDE.md; bản BA trước ("tính năng tương lai"); ADR 0002 đợt "MT-0 chỉ là kỷ luật" |
| D2 | Chủ garage khác tự đăng ký và tự triển khai, không cần nhân sự nền tảng cấp phát từng tenant | Q11 phương án "bán hàng trước, tự đăng ký sau"; ADR 0002 §2 "tự đăng ký ngoài mục tiêu" |
| D3 | Sẽ có gói dịch vụ để thu tiền; thu tiền làm sau, theo phase | ADR 0002 §2 "billing ngoài mục tiêu"; khuyến nghị cũ "B0 hoặc B1 cho đợt đầu" |

### 0.2 Câu hỏi đã được quyết, suy ra được, hoặc nay chặn sớm hơn

| Mã | Trạng thái | Nội dung | Căn cứ |
| --- | --- | --- | --- |
| Q1 | **ĐÃ QUYẾT** | Mô hình kinh doanh là S1: SaaS dùng chung, tự đăng ký. S2, S4 không còn là hướng chính (S4 chỉ xét lại nếu hợp đồng đòi tách vật lý, Q3); S3 loại | D1, D2 |
| Q11 | **ĐÃ QUYẾT** | Tenant mới tự đăng ký trên web. Kênh bán hàng do nhân sự cấp phát vẫn có thể tồn tại song song nhưng không còn là đường chính (chưa hỏi, ghi là giả định) | D2 |
| Q5 | **ĐÃ QUYẾT MỘT PHẦN** | Có gói dịch vụ; thu tiền sau; phase hóa B0 → B1 → B2 → B3 (mục 8.3). Còn mở: giá, chiều hạn mức (Q13), cổng thanh toán (Q27), VAT và pháp nhân phát hành hóa đơn nền tảng (Q12) | D3 |
| Q2 | **SUY RA MỘT PHẦN, còn mở** | Tự đăng ký công khai nghĩa là số tenant không còn giới hạn bởi đội bán hàng; phải thiết kế cho nhiều tenant, phần lớn là chuỗi nhỏ. Chưa có con số (số tenant sau 12 và 24 tháng, quy mô điển hình) | D2 (suy luận BA) |
| Q14 | **SUY RA MỘT PHẦN, còn mở và chặn sớm hơn** | Chủ dự án đã quyết dùng chung nền tảng, nên khách đầu tiên sẽ là một tenant của nền tảng. Chưa xác nhận: khách đầu tiên đồng ý chia sẻ nền tảng; ai sở hữu mã nguồn, dữ liệu, dự án GCP (ADR 0001 §12 mục #2 chưa trả lời) | D1 (suy luận BA) |
| Q17 | **SUY RA, chờ xác nhận** | Với tự triển khai, mã riêng theo từng tenant gần như không khả thi; chỉ cấu hình (khớp khuyến nghị cũ) | D2 (suy luận BA) |
| Q21 | **CÒN MỞ, nay liên quan trực tiếp** | Tự đăng ký cần một giai đoạn bắt đầu chưa thu tiền: dùng thử có hạn hay early access không hạn; chưa quyết | D2, D3 |
| Q3, Q4, Q8, Q12, Q26 đến Q35 | **CÒN MỞ, chặn ADR 0002 hoặc chặn mở đăng ký** | Xem Phụ lục B (xếp theo mức chặn) | Phụ lục B |

### 0.3 Xếp lại ưu tiên (tóm tắt; chi tiết mục 17)

| Đợt | Nội dung | Thuộc Phase 1 pilot? |
| --- | --- | --- |
| MT-0 Nền | `tenantId` là lớp phạm vi ngoài cùng và có mặt trong cô lập, đánh số, cấu hình, lưu trữ tệp, nhật ký, khóa chống trùng; hồ sơ và vòng đời tenant; vai trò nền tảng tách riêng; cấu hình tích hợp theo tenant; kiểm thử cách ly có trục tenant; đưa dữ liệu hiện có thành tenant số 1 (14 FR) | **Có, bắt buộc** (sửa sau khi có dữ liệu thật đắt hơn nhiều) |
| MT-1 Tự phục vụ có kiểm soát | Tự đăng ký, xác minh tenant (MST), chống lạm dụng, cấp phát tự động, wizard, điều khoản và DPA chấp nhận điện tử, hạn chế/tạm ngưng/chấm dứt/xuất/xóa, hỗ trợ có kiểm soát, khôi phục theo tenant (16 FR) | Không bắt buộc cho pilot; là **điều kiện mở đăng ký cho người ngoài** |
| MT-2 Gói và dùng thử | Danh mục gói, trial/early access, quota, bật/tắt module và feature flag, đo mức dùng, nâng/hạ gói, billing B1 (14 FR) | Không; làm sau nhưng nền không được chặn |
| MT-3 Thu tiền | Thanh toán gói, hóa đơn của nền tảng cho tenant, dunning và tạm ngưng khi nợ phí, người dùng nhiều tenant, tên miền, benchmark (6 FR) | Không; làm sau nhưng nền không được chặn |

### 0.4 Điều BA không suy ra (giữ mở, không quyết thay khách)

Mô hình cô lập dữ liệu; cách đăng nhập và định danh nhiều tenant; cách cấp phát trên Firebase/GCP; nhà cung cấp thanh toán; VAT và pháp nhân hóa đơn nền tảng; thời lượng dùng thử; mức xác minh tenant; thời điểm mở đăng ký công khai và thứ tự giữa MT-1 với Phase 1 pilot.

### 0.5 Thay đổi so với bản trước

BR-TEN 8 → 11; RULE 12 → 17 (016 đến 032); FR-TEN 38 → 50 (Must 20 → 28, Should 13 → 18, Could 5 → 4); NFR-TEN 6 → 9; UAT-TEN 12 → 19; journey J1 đến J6 → J1 đến J10; rủi ro mới R-TEN-01 đến 12 (mục 19.2); câu hỏi Q1 đến Q24 → Q1 đến Q35 (Q1, Q11 đã quyết, Q5 một phần).

---

## Mục lục

0A. [Quyết định hiện hành (06/11/2026)](#0a-quyết-định-hiện-hành-06112026)
0. [Quyết định mới của khách hàng (05/11/2026)](#0-quyết-định-mới-của-khách-hàng-05112026)
1. [Tóm tắt và kết luận chính](#1-tóm-tắt-và-kết-luận-chính)
2. [Thuật ngữ và ranh giới khái niệm](#2-thuật-ngữ-và-ranh-giới-khái-niệm)
3. [Mô hình kinh doanh và các phương án](#3-mô-hình-kinh-doanh-và-các-phương-án)
4. [Actor mới và phân tách quyền](#4-actor-mới-và-phân-tách-quyền)
5. [Vòng đời tenant (state machine)](#5-vòng-đời-tenant-state-machine)
6. [Cô lập dữ liệu](#6-cô-lập-dữ-liệu)
7. [Cấu hình theo tenant](#7-cấu-hình-theo-tenant)
8. [Gói dịch vụ, quota và billing](#8-gói-dịch-vụ-quota-và-billing)
9. [Onboarding và chuyển dữ liệu Excel theo tenant](#9-onboarding-và-chuyển-dữ-liệu-excel-theo-tenant)
10. [Người dùng và định danh](#10-người-dùng-và-định-danh)
11. [Báo cáo cấp nền tảng](#11-báo-cáo-cấp-nền-tảng)
12. [Audit, dữ liệu cá nhân, pháp lý và lưu trữ](#12-audit-dữ-liệu-cá-nhân-pháp-lý-và-lưu-trữ)
13. [Tác động lên các module hiện có](#13-tác-động-lên-các-module-hiện-có)
14. [Yêu cầu đề xuất: BR, RULE, FR, NFR](#14-yêu-cầu-đề-xuất-br-rule-fr-nfr)
15. [User journey chính](#15-user-journey-chính)
16. [Kịch bản nghiệm thu đề xuất (UAT-TEN)](#16-kịch-bản-nghiệm-thu-đề-xuất-uat-ten)
17. [Phân đợt và điều kiện bắt đầu](#17-phân-đợt-và-điều-kiện-bắt-đầu)
18. [Điểm `[Cần xác nhận]` và câu hỏi cho owner/khách](#18-điểm-cần-xác-nhận-và-câu-hỏi-cho-ownerkhách)
19. [Mâu thuẫn, khoảng trống phát hiện trong tài liệu hiện có](#19-mâu-thuẫn-khoảng-trống-phát-hiện-trong-tài-liệu-hiện-có)
20. [Danh sách chỉnh sửa đề xuất cho các tài liệu khác](#20-danh-sách-chỉnh-sửa-đề-xuất-cho-các-tài-liệu-khác)
21. [Ma trận truy vết](#21-ma-trận-truy-vết)
22. [Phụ lục A. Bộ câu hỏi khảo sát chuẩn](#phụ-lục-a-bộ-câu-hỏi-khảo-sát-chuẩn-cho-tenant-mới-tóm-tắt)
23. [Phụ lục B. Câu hỏi còn mở, ưu tiên các câu chặn ADR 0002](#phụ-lục-b-câu-hỏi-còn-mở-ưu-tiên-các-câu-chặn-adr-0002)

---

## 1. Tóm tắt và kết luận chính

1. **Multi-tenant khác "nhiều pháp nhân".** Nhiều pháp nhân (FR-SYS-018) là chuyện *trong* một chuỗi garage; tenant là một *khách hàng độc lập của nền tảng*, dữ liệu tách hoàn toàn khỏi tenant khác (đồng nhất với ADR 0002 §1).
2. **Mô hình thương mại đã được quyết (mục 0): SaaS dùng chung, tự đăng ký, có gói thu tiền sau. Câu hỏi chặn còn lại vẫn là thương mại và hợp đồng, không chỉ kỹ thuật.** Tài liệu hiện chưa nói rõ: (a) chủ dự án là ai so với khách đầu tiên, (b) khách đầu tiên có đồng ý dùng chung nền tảng với garage khác không, (c) dự án GCP/Firebase thuộc tổ chức nào (ADR 0001 §12, mục #2 "cấp dự án GCP/Firebase thuộc tổ chức của khách" vẫn **chưa trả lời**). Nếu hạ tầng thuộc tổ chức của khách đầu tiên thì việc phục vụ tenant khác trên đó cần thỏa thuận riêng. Xem Q14 (còn mở, nay chặn sớm hơn) và Q2 ở mục 18 và Phụ lục B.
3. **Chưa thể chốt mô hình cô lập từ phía BA, và nay đây là câu chặn ADR 0002 (không còn "để sau").** BA chỉ nêu yêu cầu nghiệp vụ (không rò rỉ chéo tenant, xuất/xóa/khôi phục riêng một tenant, hạn mức riêng). Phương án A/B/C của ADR 0002 §3 được chọn sau khi có số tenant, yêu cầu hợp đồng và ý kiến luật sư (Q3).
4. **Xóa dữ liệu khi chấm dứt va chạm trực tiếp với nghĩa vụ lưu trữ hóa đơn và chứng từ** (RULE-010, NFR-DAT-01, BRD mục 7) và với quyền xóa dữ liệu cá nhân (Luật 91/2025/QH15). Đề xuất quy trình hai bước: trả dữ liệu cho tenant, rồi mới xóa hoặc ẩn danh theo chính sách lưu trữ có xác nhận; mặc định không xóa (khớp ba-answers §8.1). Thời hạn và vai trò pháp lý (bên kiểm soát/bên xử lý dữ liệu) `[Cần xác nhận: Luật sư]`.
5. **Hai vai trò mới tách hẳn khỏi 10 vai trò trong tenant:** nhóm vai trò nền tảng (platform owner, super admin, hỗ trợ, vận hành billing). Nhân sự nền tảng mặc định **không** xem dữ liệu nghiệp vụ của tenant; truy cập hỗ trợ phải có lý do, thời hạn, phạm vi và hiển thị cho tenant (mở rộng nguyên tắc ghi chú FRD mục 2: "Quản trị hệ thống... không xem được dữ liệu nhạy cảm").
6. **Khái niệm `Company` đang bị dùng cho hai nghĩa** trong tài liệu và dev docs (xem mục 2 và 19). Cần chốt thuật ngữ trước khi viết FR chính thức.
7. **Đề xuất (cập nhật 05/11/2026):** 11 BR (BR-TEN-01 đến 11), 17 RULE (RULE-016 đến 032), 50 FR nhóm mới FR-TEN-001 đến 050 (28 Must, 18 Should, 4 Could), 9 NFR-TEN, 19 UAT-TEN. Phân thành 4 đợt (mục 17): **MT-0 "nền" (14 FR) làm cùng Phase 1**; MT-1 tự phục vụ có kiểm soát là điều kiện mở đăng ký cho người ngoài; MT-2 gói, dùng thử, quota; MT-3 thu tiền. Thu tiền làm sau nhưng thiết kế nền không được chặn.
8. **Thời điểm là lợi thế:** theo CLAUDE.md hệ thống mới chạy trên Emulator, chưa có dự án GCP, chưa có dữ liệu thật; đưa `tenantId` vào mọi lớp lúc này rẻ nhất. Mỗi slice mới viết theo kiểu một tenant làm tăng chi phí sửa sau (R-TEN-09).
9. **Điều đã làm được ngay (không tốn chức năng):** kỷ luật ở ADR 0002 §4 và kiểm tra ở mục 19 (bảng rà soát mã/định danh theo công ty).

## 2. Thuật ngữ và ranh giới khái niệm

| Thuật ngữ | Định nghĩa đề xuất | Nguồn / ghi chú |
| --- | --- | --- |
| Nền tảng (Platform) | Hệ thống GMEP và tổ chức vận hành nó | Mới |
| Chủ nền tảng (Platform owner) | Pháp nhân/cá nhân sở hữu và bán dịch vụ GMEP | Mới. Quan hệ với "Chủ dự án" và "Khách" hiện nay chưa rõ (Q14) |
| Tenant | Một khách hàng độc lập của nền tảng; một ranh giới dữ liệu, cấu hình, người dùng, hợp đồng | ADR 0002 §1 |
| Company (pháp nhân) | Đơn vị pháp lý trong một tenant; một tenant có từ một Company trở lên; mỗi Company có đơn vị phát hành hóa đơn riêng | FR-SYS-018, BR-EIN-04 |
| Branch / Warehouse | Đơn vị vận hành trong Company | FR-SYS-005, 011 |
| Quản trị tenant (Tenant admin) | Vai trò AD hiện có (Quản trị hệ thống) nhưng phạm vi là **một tenant** | FRD mục 2; BRD mục 5 ghi "Toàn hệ thống" cần sửa thành "toàn tenant" |
| Nhân sự nền tảng | Tài khoản thuộc tổ chức vận hành nền tảng, không thuộc tenant nào | Mới |
| Bên kiểm soát / bên xử lý dữ liệu | Vai trò theo luật bảo vệ dữ liệu cá nhân: giả thuyết tenant là bên kiểm soát, nền tảng là bên xử lý | `[Cần xác nhận: Luật sư]` (Q8) |

**Quan hệ phân cấp đề xuất:** Platform → Tenant → Company → Branch → Warehouse. Điểm cần xử lý: trong tài liệu hiện có `companyId` đang đóng vai trò "ranh giới ngoài cùng" (ví dụ mã nhân viên duy nhất theo `companyId`, ba-answers dòng 118; `CRON_COMPANY_ID` ở deploy-guide; khóa dãy số `(companyId, phạm vi, loại, kỳ)` ở ba-answers §6). Khi một tenant có nhiều pháp nhân, các khóa đó phải gắn với **tenant** hay với **Company** là quyết định thiết kế cần BA và dev làm rõ trước (xem mục 19, mâu thuẫn M1).

## 3. Mô hình kinh doanh và các phương án

Tài liệu hiện có không nêu mô hình thương mại. Các phương án để owner chọn (Q1):

| # | Mô hình | Mô tả | Hệ quả nghiệp vụ chính |
| --- | --- | --- | --- |
| S1 | SaaS thuê bao dùng chung | Nhiều chuỗi garage dùng cùng một bản chạy, cấu hình riêng | Cần quota, billing, vận hành nền tảng, SLA chung, nâng cấp đồng loạt |
| S2 | Triển khai riêng cho từng khách (managed) | Mỗi khách một bản chạy do chủ nền tảng vận hành | Ít cần cô lập trong ứng dụng nhưng chi phí vận hành tăng theo số khách; gần với hiện trạng |
| S3 | Cấp phép phần mềm và khách tự vận hành | Khách tự lo hạ tầng | Ngoài phạm vi multi-tenant; chỉ nêu để loại trừ |
| S4 | Lai (S1 cho khách nhỏ, S2 cho khách lớn hoặc yêu cầu pháp lý) | | Cần đồng thời hai mô hình vận hành |

**Đã quyết (mục 0): S1, SaaS dùng chung, tự đăng ký.** S2 và S4 không còn là hướng chính; S4 (khách lớn tách riêng) chỉ xét lại nếu hợp đồng đòi tách vật lý (Q3); S3 loại. Các FR-TEN viết cho S1 ở mức hành vi nhìn thấy được, không chọn công nghệ.

Giả thuyết cần kiểm chứng (không đưa vào FR): khách mục tiêu là chuỗi garage vừa và nhỏ tại Việt Nam, có bài toán giống khách đầu tiên (BRD mục 2). Chưa có khảo sát thị trường trong tài liệu `[Cần xác nhận: Chủ dự án]`.

## 4. Actor mới và phân tách quyền

### 4.1 Actor nền tảng (mới)

| Actor | Mô tả | Được làm | Không được làm (mặc định) |
| --- | --- | --- | --- |
| Chủ nền tảng (Platform owner) | Người chịu trách nhiệm kinh doanh nền tảng | Duyệt tenant bị cờ khi đăng ký, duyệt ngưng/chấm dứt tenant (tạo tenant bình thường là tự động, D2), xem báo cáo cấp nền tảng, duyệt cấp quyền hỗ trợ đặc biệt | Xem dữ liệu nghiệp vụ tenant |
| Quản trị nền tảng (Platform super admin) | Vận hành kỹ thuật và cấu hình nền tảng | Tạo tenant, cấp phát, đổi gói, cấu hình mặc định nền tảng, danh mục pháp lý dùng chung | Xem dữ liệu nghiệp vụ, đăng nhập thay người dùng tenant |
| Hỗ trợ nền tảng (Platform support) | Hỗ trợ tenant | Xem thông tin tenant ở mức hồ sơ và trạng thái, mở phiên hỗ trợ có kiểm soát khi tenant cho phép | Truy cập ngoài phiên hỗ trợ đã được cấp; xem dữ liệu cá nhân chưa che |
| Vận hành billing nền tảng | Lập kỳ thanh toán cho tenant | Xem gói, mức dùng, công nợ tenant | Xem dữ liệu nghiệp vụ |

Chi tiết quyền chính xác là ma trận quyền nền tảng (FR-TEN-011) `[Cần xác nhận: Chủ dự án]`.

### 4.2 Actor trong tenant (giữ nguyên, thêm ranh giới)

- 10 vai trò hiện có và 4 vai trò bổ sung bản 0.2 (FRD mục 2) giữ nguyên, nay luôn nằm **trong một tenant**.
- **Chủ garage (CH)** của tenant là người ký hợp đồng thương mại với chủ nền tảng (giả thuyết) và duyệt các thao tác nhạy cảm cấp tenant: mời quản trị tenant, đồng ý cho hỗ trợ truy cập, yêu cầu chấm dứt. `[Cần xác nhận: Chủ dự án]`.
- **Quản trị hệ thống (AD)** trở thành "quản trị tenant": cấu hình trong tenant, không thấy dữ liệu nhạy cảm (FRD mục 2), không có quyền nền tảng nào.

### 4.3 Bên ngoài (mới hoặc thay đổi so với BRD mục 5)

| Bên | Thay đổi |
| --- | --- |
| Nhà cung cấp hóa đơn điện tử | Mỗi tenant (và mỗi Company) có thể dùng nhà cung cấp, tài khoản và chứng thư khác nhau (RULE-024) |
| Nhà cung cấp SMS/Zalo | Như trên, theo tenant |
| Nhà cung cấp hạ tầng | Chịu chung nhiều tenant; ảnh hưởng đến hợp đồng bảo mật |
| Cơ quan quản lý dữ liệu cá nhân | Liên quan khi có sự cố; vai trò của nền tảng với tenant (Q8) |

## 5. Vòng đời tenant (state machine)

Đây là bộ trạng thái của một đối tượng thứ sáu, **tách biệt** với năm đối tượng hiện có (báo giá, lệnh, hạng mục, thanh toán, hóa đơn), đúng nguyên tắc "không dùng một trạng thái chung".

### 5.1 Trạng thái

| Trạng thái | Ý nghĩa | Người dùng tenant | Dữ liệu |
| --- | --- | --- | --- |
| Đăng ký chờ xác minh (`signup_pending`) | Người lạ đã gửi đăng ký tự phục vụ, chưa xác thực email hoặc chưa qua xác minh doanh nghiệp/kiểm tra lạm dụng | Chưa có | Chỉ hồ sơ đăng ký tối thiểu; **không** có dữ liệu nghiệp vụ |
| Bị từ chối (`rejected`) | Xác minh không đạt hoặc bị chặn vì lạm dụng; hết hạn xác thực | Không | Hồ sơ đăng ký giữ theo chính sách tối thiểu để chống đăng ký lại gian lận |
| Đã đề xuất (`proposed`) | Có yêu cầu hoặc hợp đồng qua kênh bán hàng (đường phụ), chưa cấp phát | Chưa có | Chỉ hồ sơ tenant |
| Đang cấp phát (`provisioning`) | Đang tạo không gian dữ liệu, cấu hình mặc định, tài khoản chủ | Chưa đăng nhập | Đang khởi tạo |
| Cấp phát lỗi (`provision_failed`) | Một bước không hoàn tất | Không | Có thể thử lại hoặc hủy |
| Đang triển khai (`onboarding`) | Đã có tenant, đang cấu hình, nhập Excel, huấn luyện; môi trường thử hóa đơn (`fake`/test) | Đăng nhập được, không phát hành hóa đơn thật | Đầy đủ |
| Hoạt động (`active`) | Dùng thật | Đầy đủ theo gói và quyền | Đầy đủ |
| Hạn chế (`restricted`) | Vi phạm hạn mức hoặc quá hạn thanh toán; chỉ chặn tạo mới theo chính sách | Làm tiếp chứng từ đang mở; không tạo mới theo cấu hình | Đầy đủ |
| Tạm ngưng (`suspended`) | Chủ nền tảng hoặc tenant tạm dừng | Mặc định chỉ đọc và tải dữ liệu; hoặc chặn hoàn toàn nếu lý do an ninh | Giữ nguyên |
| Đang chấm dứt (`terminating`) | Đã nhận yêu cầu chấm dứt; giai đoạn trả dữ liệu | Chỉ đọc và tải xuất dữ liệu | Giữ nguyên, tạo gói xuất |
| Đã chấm dứt (`terminated`) | Hết dịch vụ, chờ hết thời hạn giữ | Không đăng nhập (trừ cổng tải lưu trữ nếu có, Q7) | Khóa, chỉ giữ phần luật yêu cầu |
| Đã xóa (`purged`) | Đã xóa hoặc ẩn danh theo chính sách; còn bằng chứng xóa | Không | Chỉ còn hồ sơ tối thiểu và chứng nhận xóa |
| Đã hủy (`cancelled`) | Hủy trước khi dùng thật (từ `proposed`, `provision_failed`, `onboarding`) | Không | Xóa ngay nếu chưa có dữ liệu thật; nếu đã nhập thử thì xử lý như `terminated` rút gọn |

### 5.2 Sơ đồ (văn bản)

```
signup_pending -> (xác minh đạt) -> provisioning      signup_pending -> rejected
proposed -> provisioning -> onboarding -> active <-> restricted
                |               |          |  \          |
                v               v          v   \         v
         provision_failed   cancelled   suspended <------+
                |                          |
                +-> provisioning (thử lại) +-> active (mở lại)
active | restricted | suspended -> terminating -> terminated -> purged
```

### 5.3 Chuyển trạng thái

| Từ | Đến | Ai thực hiện | Điều kiện | Lưu ý |
| --- | --- | --- | --- | --- |
| (mới) | signup_pending | Người đăng ký | Gửi form đăng ký, chấp nhận điều khoản và DPA (FR-TEN-039, 037) | Không tạo tenant ở bước này; gửi lại cùng thông tin không tạo bản trùng |
| signup_pending | provisioning | Hệ thống (tự động); nhân sự nền tảng chỉ khi ca bị cờ | Email đã xác thực, qua kiểm tra lạm dụng và xác minh doanh nghiệp (FR-TEN-040, 041) | Không cần người trong ca không bị cờ (FR-TEN-042) |
| signup_pending | rejected | Hệ thống hoặc nhân sự nền tảng | Xác minh không đạt, bị chặn lạm dụng, hết hạn xác thực | Có lý do; người đăng ký có đường khiếu nại (Q28) |
| proposed | provisioning | Quản trị nền tảng, có duyệt của Chủ nền tảng | Hồ sơ tenant đủ, hợp đồng/đồng ý điều khoản đã ghi (FR-TEN-037) | Idempotent: cấp phát lặp lại không tạo tenant thứ hai (FR-TEN-002) |
| provisioning | onboarding | Hệ thống | Mọi bước checklist cấp phát đạt | Gửi lời mời cho chủ garage (cùng cơ chế lời mời FR-SYS-019 đề xuất) |
| provisioning | provision_failed | Hệ thống | Một bước lỗi | Giữ nhật ký bước đã xong để thử lại không trùng |
| onboarding | active | Chủ garage của tenant tự kích hoạt (đường tự phục vụ, FR-TEN-004, 043); với kênh bán hàng: Quản trị nền tảng với xác nhận của CH tenant | Checklist kích hoạt (FR-TEN-004) | Chưa khai đơn vị phát hành hóa đơn thì chạy `fake`, không phát hành thật (khớp R69) |
| active | restricted | Hệ thống hoặc Quản trị nền tảng | Vượt hạn mức cứng hoặc quá hạn thanh toán sau thời gian ân hạn | Không chặn hoàn tất chứng từ đang mở (RULE-023) |
| restricted | active | Như trên | Khắc phục điều kiện | |
| active / restricted | suspended | Chủ nền tảng; hoặc CH tenant yêu cầu | Lý do bắt buộc ghi nhật ký | Mọi phiên đang mở bị thu hồi theo cấu hình (RULE-027) |
| suspended | active | Chủ nền tảng | Hết lý do | Báo cho CH tenant |
| active / restricted / suspended | terminating | Chủ nền tảng sau yêu cầu bằng văn bản của tenant, hoặc do vi phạm hợp đồng | Bản xác nhận chấm dứt; công nợ thanh toán đã xử lý hoặc ghi nhận | Bắt đầu tạo gói xuất dữ liệu (FR-TEN-006) |
| terminating | terminated | Chủ nền tảng | Tenant xác nhận đã nhận dữ liệu, hoặc hết thời hạn trả dữ liệu theo hợp đồng | Đồng hồ thời hạn giữ bắt đầu |
| terminating | active | Chủ nền tảng | Tenant rút yêu cầu trong thời hạn cho phép | Chỉ nếu hợp đồng cho phép |
| terminated | purged | Quản trị nền tảng với duyệt của Chủ nền tảng | Hết thời hạn giữ theo luật và hợp đồng; không có yêu cầu giữ pháp lý | Có chứng nhận xóa; sao lưu hết hạn theo chu kỳ (FR-TEN-007) |

Không có đường từ `purged` quay lại. Khôi phục tenant `terminated` trong thời hạn cho phép là FR-TEN-008 (Should).

### 5.5 Thuê bao (subscription), đối tượng thứ bảy tách khỏi vòng đời tenant

Gói và thanh toán có bộ trạng thái riêng, **không** trộn vào trạng thái tenant (cùng nguyên tắc "không dùng một trạng thái chung"). Thuê bao chỉ tác động lên vòng đời tenant qua các chuyển trạng thái đã định nghĩa ở 5.3 (`restricted`, `suspended`) và qua RULE-023, RULE-030.

| Trạng thái thuê bao | Ý nghĩa | Tác động lên tenant |
| --- | --- | --- |
| `none` (early access) | Chưa có gói, chưa thu phí (giai đoạn B0) | Dùng đầy đủ theo giới hạn mặc định; ToS nêu rõ chưa thu phí |
| `trial` | Dùng thử có hạn (nếu Q21 chọn trial) | Đầy đủ hoặc giới hạn theo gói thử |
| `paid_active` | Đã trả phí kỳ hiện tại | Đầy đủ theo gói |
| `past_due` | Quá hạn thanh toán, còn trong ân hạn | Cảnh báo, chưa chặn |
| `grace_over` | Hết ân hạn | Chuyển tenant `restricted` rồi `suspended` theo thang (FR-TEN-049) |
| `cancel_scheduled` | Đã yêu cầu hủy, hiệu lực cuối kỳ | Tiếp tục đến hết kỳ rồi theo J4 |
| `expired` | Hết dùng thử hoặc hết hạn gói mà không gia hạn | Theo thang RULE-030: hạn chế, rồi chỉ đọc; không xóa dữ liệu |

Nâng gói có hiệu lực ngay; hạ gói có hiệu lực kỳ kế tiếp và bị chặn hoặc cảnh báo nếu mức dùng hiện tại vượt hạn mức gói mới (FR-TEN-045). Ở B0, chỉ cần có chỗ lưu gói và trạng thái thuê bao, chưa có thanh toán.

### 5.4 Ngoại lệ

| Tình huống | Xử lý đề xuất |
| --- | --- |
| Tenant nợ phí nhưng đang có xe nằm xưởng | `restricted` không chặn hoàn tất lệnh đang mở và giao xe; chặn tạo lệnh mới theo cấu hình (RULE-023) |
| Yêu cầu từ cơ quan nhà nước phải giữ dữ liệu | "Giữ pháp lý" chặn `purged`; có người duyệt và lý do |
| Tenant mất khả năng tự tải hóa đơn khi bị ngưng | Vẫn truy xuất và tải hóa đơn, chứng từ (RULE-021), trừ khi ngưng vì sự cố an ninh |
| Tenant bị ngưng giữa lúc có hóa đơn đang chờ nhà cung cấp phản hồi | Tác vụ đồng bộ trạng thái hóa đơn vẫn chạy để không mất trạng thái; không phát hành mới |
| Cấp phát lỗi giữa chừng | Thử lại từng bước, không tạo bản trùng (RULE-018); hoặc hủy và dọn |
| Hai tenant sáp nhập, một tenant tách | Không chuyển bản ghi giữa tenant (RULE-016); dùng xuất và nhập có duyệt, ghi vào Q22 |
| Tenant muốn thêm pháp nhân thứ hai | Thuộc cấu hình trong tenant (FR-SYS-018), không phải vòng đời tenant; có thể ảnh hưởng gói (FR-TEN-024) |

## 6. Cô lập dữ liệu

Yêu cầu nghiệp vụ nâng NFR-ISO-01 từ "chi nhánh" lên "tenant". Phạm vi áp dụng, đối chiếu từng nơi dữ liệu thoát ra (ba-answers mục 7: "mọi nơi dữ liệu thoát ra"):

| Nơi | Yêu cầu | Bao phủ bởi |
| --- | --- | --- |
| Danh sách, tìm kiếm (kể cả tìm toàn cục) | Không bao giờ trả bản ghi của tenant khác | FR-TEN-009 |
| Báo cáo, dashboard, xuất dữ liệu | Như trên; tên tệp xuất không lộ tenant khác | FR-TEN-009 |
| API ngoài (FR-SYS-017) | Khóa API gắn đúng một tenant; không có khóa dùng chung | FR-TEN-009, 021 |
| Tệp, ảnh, XML/PDF hóa đơn, URL ký (ADR 0001 §7.3) | Đường dẫn và URL ký kiểm tenant trước khi cấp | FR-TEN-009 |
| Thông báo (FR-SYS-008) | Không gửi sự kiện của tenant này cho người dùng tenant khác | FR-TEN-009 |
| Tác vụ nền, hàng đợi, đồng bộ hóa đơn, nhắc hạn | Chạy theo từng tenant; lỗi tenant này không chặn tenant khác | FR-TEN-009, 015 |
| Nhật ký, nhật ký truy cập dữ liệu cá nhân | Tách theo tenant | FR-TEN-013 |
| Sao lưu, khôi phục | Khôi phục một tenant không ảnh hưởng tenant khác | FR-TEN-034 |
| Bộ nhớ đệm, khóa chống trùng, đánh số | Khóa chứa tenant | RULE-018 |
| Dữ liệu seed, kiểm thử | Không giả định một tenant | NFR-TEN-01 |

**Ba phương án cô lập (ADR 0002 §3) nhìn từ nghiệp vụ**, để owner trao đổi với luật sư và khách (BA không chọn):

| Tiêu chí nghiệp vụ | A: dùng chung dữ liệu, có mã tenant | B: cơ sở dữ liệu riêng mỗi tenant | C: dự án hạ tầng riêng mỗi tenant |
| --- | --- | --- | --- |
| Chi phí cho tenant nhỏ | Thấp nhất | Trung bình | Cao nhất |
| Thuyết phục khách lớn hoặc hợp đồng yêu cầu tách | Khó | Dễ hơn | Dễ nhất |
| Xuất, xóa, khôi phục riêng một tenant | Khó nhất | Dễ | Dễ nhất |
| Rủi ro rò rỉ do lỗi lọc | Cao nhất | Thấp | Thấp nhất |
| Tenant lớn ảnh hưởng tenant khác | Có | Ít | Không |
| Giới hạn đã biết | Ngân sách chỉ mục 193/200 (ADR 0002) | Giới hạn số database mỗi dự án | Vận hành phức tạp |

Phương án có thể khác nhau theo cấp khách (S4, mục 3). Quyết định thuộc owner, luật sư và dev (Q3).

## 7. Cấu hình theo tenant

### 7.1 Phân tầng cấu hình

Đề xuất bốn tầng, mỗi giá trị có ngày hiệu lực (NFR-MNT-01, BR-ACC-08, FR-SYS-006):

| Tầng | Ví dụ | Ai sửa |
| --- | --- | --- |
| Nền tảng | Danh mục pháp lý: thuế suất, chu kỳ đăng kiểm, khung mẫu hóa đơn theo Phụ lục luật; mặc định vai trò, workflow mẫu | Quản trị nền tảng |
| Tenant | Chính sách mật khẩu, lưu trữ, hạn mức giảm giá mặc định, mẫu in, thương hiệu | Quản trị/chủ tenant |
| Company | Đơn vị phát hành hóa đơn, kỳ kế toán, đánh số theo pháp nhân | Kế toán/quản trị tenant |
| Branch | Giờ làm, bảng giá chi nhánh, hạn mức duyệt | Quản lý chi nhánh |

Quy tắc: thay đổi ở tầng trên **không** tự sửa chứng từ đã phát hành (RULE-019), áp dụng tương lai theo ngày hiệu lực; ghi rõ nguồn của giá trị đang dùng.

Điểm mở: danh mục pháp lý (thuế suất...) do nền tảng cập nhật chung cho mọi tenant để tránh sai lệch, hay mỗi tenant tự chịu trách nhiệm? Tenant có được ghi đè không? `[Cần xác nhận: Chủ dự án, Kế toán khách]` (Q16). Công thức thuế, giá, công, giá vốn vẫn cần ví dụ kiểm thử do kế toán xác nhận (NFR-MNT-01); với nhiều tenant, mỗi bộ cấu hình khác biệt cần bộ ví dụ riêng hay chỉ bộ mặc định, cũng thuộc Q16.

### 7.2 Các cấu hình cụ thể

| Chủ đề | Yêu cầu | Ghi chú |
| --- | --- | --- |
| Đánh số chứng từ | Dãy số thuộc tenant; hai tenant được phép trùng số; mã chi nhánh `MÃCN` duy nhất **trong tenant** (ba-answers §6 đã coi bất biến) | FR-TEN-020; sửa tiêu chí "duy nhất trên toàn hệ thống" của FR-REC-030 thành "duy nhất trong tenant" (mục 20) |
| Thuế | Thuế suất theo hiệu lực, theo Company | BR-ACC-08 |
| Mẫu in | Tenant có mẫu riêng; phần bắt buộc theo luật hóa đơn không được gỡ | FR-TEN-022; Phụ lục luật hóa đơn trong FR-EIN-003 |
| Hóa đơn điện tử | Nhà cung cấp, tài khoản, chứng thư, mẫu số, ký hiệu, môi trường thử/thật theo tenant và Company; bí mật không dùng chung | FR-TEN-021; FR-EIN-003, 004; R69 |
| Thương hiệu | Tên, logo trên giao diện và phiếu in; mức tùy biến giao diện (chỉ logo/tên, hay đổi màu) | ADR 0002 §2 đặt "tùy biến giao diện" ngoài mục tiêu; vẫn cần quyết nghiệp vụ (Q6). Design tokens bắt buộc giữ nguyên (CLAUDE.md), nên tùy biến sâu tạm là Won't |
| Tên miền | Tên miền con theo tenant, hoặc tên miền riêng | FR-TEN-023 (Could), Q6 |
| Ngôn ngữ, tiền tệ | Hiện vi, VND (FR-SYS-009). Tenant ngoài Việt Nam: chưa xét | Won't cho đợt đầu, Q15 |
| Quy trình theo loại dịch vụ | Cấu hình được (đồng sơn có luồng riêng, chưa khảo sát) | Chính sách "cấu hình, không viết riêng cho từng tenant" (Q17) |
| Chính sách lưu trữ | Theo tenant, mặc định "không xóa" (FR-SYS-031 đề xuất) | FR-TEN-018 |

## 8. Gói dịch vụ, quota và billing

Không có nội dung này trong ADR 0002 §2 (ngoài mục tiêu của ADR) và trong BRD. Owner đã quyết có làm gói dịch vụ và thu tiền sau (mục 0, D3); mục này mô tả nhu cầu nghiệp vụ và cách phase hóa, các chi tiết thương mại (giá, chiều hạn mức, cổng thanh toán, thuế) vẫn do owner quyết.

### 8.1 Chiều quota có thể có (cần owner chọn)

| Chiều | Gợi ý từ docs | Ghi chú |
| --- | --- | --- |
| Số chi nhánh | NFR-SCL-01: 8 hiện tại, 20 sau 2 năm | Thêm chi nhánh vốn là cấu hình (NFR-SCA-01) |
| Số người dùng | 80 đến 100 hiện tại, 250 đến 300 sau 2 năm | Người dùng hoạt động hay người dùng được tạo? |
| Số lệnh sửa chữa hoặc xe mỗi tháng | 120 đến 200 xe mỗi ngày | Là chỉ số tải |
| Dung lượng ảnh/video | Liên quan INS, ADR 0001 R-10 | Tốn chi phí lưu trữ |
| Số hóa đơn điện tử mỗi tháng | Nhà cung cấp thường tính theo số hóa đơn | Chi phí qua nhà cung cấp của tenant |
| Module được bật | Phân giai đoạn 1 đến 4 của BRD mục 9 | Bật theo gói (FR-TEN-026) |
| Số lần gọi API | FR-SYS-017 | |

### 8.2 Hành vi khi chạm hạn mức

Đề xuất theo nguyên tắc RULE-023: ngưỡng cảnh báo (ví dụ 80% và 100%, tham số `[Cần xác nhận]`), sau đó chặn **tạo mới** có kiểm soát, không bao giờ chặn hoàn tất, thu tiền, giao xe hoặc phát hành hóa đơn của chứng từ đang mở. Hạn mức mềm (cho vượt, ghi nhận để tính phí) hay cứng là quyết định thương mại (Q13).

### 8.3 Billing (cho tenant trả tiền nền tảng)

| Phương án | Mô tả | Nhận xét BA |
| --- | --- | --- |
| B0 | Lập hợp đồng và hóa đơn ngoài hệ thống; hệ thống chỉ giữ gói và trạng thái | Phù hợp tenant thứ hai và thứ ba; không build tính phí |
| B1 | Hệ thống ghi nhận mức dùng và xuất bảng kê để lập hóa đơn ngoài hệ thống | Cân bằng |
| B2 | Hệ thống lập kỳ thanh toán, công nợ tenant, nhắc nợ, liên kết thanh toán trực tuyến | Chi phí xây cao, phụ thuộc nhà cung cấp thanh toán |

**Cập nhật 05/11/2026 (D3):** có gói, thu tiền sau, phase hóa như bảng dưới. B0 đến B2 ở trên được giữ; thêm B3 cho phần mở rộng.

| Phase billing | Nội dung | Đợt | Điều kiện chuyển |
| --- | --- | --- | --- |
| B0 | Hồ sơ tenant có gói và trạng thái thuê bao (`none`/early access); chưa thu phí; ToS nêu rõ giai đoạn chưa thu phí | MT-0, MT-1 | Có sẵn khi tenant đầu tiên đăng ký |
| B1 | Danh mục gói, trial, quota, bật/tắt module, đo mức dùng, bảng kê; thu tiền thủ công **ngoài hệ thống** (chuyển khoản, hóa đơn lập ngoài) | MT-2 | Owner chốt giá và gói (Q13); pháp nhân và VAT (Q12) |
| B2 | Thanh toán gói trong hệ thống, hóa đơn điện tử của nền tảng cho tenant, dunning và tạm ngưng khi nợ | MT-3 | Chọn cổng thanh toán (Q27); kế toán và luật sư xác nhận thuế (Q12); nhà cung cấp hóa đơn của nền tảng |
| B3 | Mở rộng: add-on, trả trước nhiều kỳ, mã giảm giá, đại lý; hoàn tiền và credit note | Sau MT-3 (Could) | Có nhu cầu thực |

**Không được chặn (phải có chỗ ngay từ MT-0, dù chưa dùng):** hồ sơ tenant có chỗ lưu gói và trạng thái thuê bao; một điểm kiểm tra hạn mức và tính năng duy nhất, mặc định cho phép; sự kiện sử dụng đếm được theo tenant (chưa tính tiền); trạng thái `restricted` và `suspended` được thực thi ở lớp truy cập; ghi nhận phiên bản điều khoản đã chấp nhận; thông tin người mua (MST, tên, địa chỉ) của tenant đã được xác minh để sau này lập hóa đơn.

Lưu ý nghiệp vụ: hóa đơn **chủ nền tảng phát cho tenant** là hóa đơn của một pháp nhân khác, nằm ngoài hệ thống hóa đơn của tenant (RULE-025). Pháp nhân phát hành, thuế áp dụng cho dịch vụ phần mềm trực tuyến `[Cần xác nhận: Kế toán và Luật sư của chủ nền tảng]` (Q12).

## 9. Onboarding và chuyển dữ liệu Excel theo tenant

### 9.1 Quy trình đề xuất

| Bước | Nội dung | Tham chiếu |
| --- | --- | --- |
| 1 | Ký hợp đồng, ghi đồng ý điều khoản và xử lý dữ liệu cá nhân | FR-TEN-037, Q8 |
| 2 | Cấp phát tenant, chủ garage nhận lời mời kích hoạt | FR-TEN-002 |
| 3 | Khảo sát nhanh mô hình pháp lý (một hay nhiều pháp nhân), đơn vị phát hành hóa đơn, đánh số, kỳ kế toán | Câu hỏi giống Discovery của khách đầu tiên (BRD mục 10); đóng gói thành bộ câu hỏi chuẩn (Phụ lục A) |
| 4 | Cấu hình: chi nhánh, kho, vai trò, danh mục dịch vụ, bảng giá, thuế | FR-SYS-005, 006, 016 |
| 5 | Nhập Excel theo mẫu: khách, xe, phụ tùng, tồn đầu kỳ, nhân viên | FR-SYS-007, BRD mục 12; theo từng tenant (FR-TEN-029) |
| 6 | Chạy thử ở môi trường `onboarding` (hóa đơn `fake`), huấn luyện | FR-TEN-030 |
| 7 | Kiểm tra kích hoạt rồi chuyển `active` | FR-TEN-004 |
| 8 | Vận hành song song, nghiệm thu | Mẫu như pilot của khách đầu tiên |

### 9.2 Điểm riêng của nhập Excel đa tenant

- Lô nhập và hoàn tác theo lô thuộc đúng tenant; người dùng tenant này không thấy lô của tenant khác (FR-TEN-029).
- Mẫu Excel chuẩn do nền tảng cung cấp; ánh xạ cột là cấu hình theo tenant (BRD mục 12 đã nói mẫu của khách đầu tiên chưa được xem; các tenant sau sẽ có mẫu khác).
- Tồn đầu kỳ và mã phụ tùng là phần khó nhất (BRD mục 12): mỗi tenant cần người phụ trách dữ liệu và quy tắc chuẩn hóa mã riêng.
- Số năm lịch sử cần chuyển do từng tenant quyết (câu hỏi mở "số năm lịch sử sửa chữa", CLAUDE.md).

### 9.3 Tenant đầu tiên (di chuyển dữ liệu hiện có)

Dữ liệu của khách đầu tiên phải trở thành "tenant số 1" **mà không đổi số chứng từ đã cấp, không làm mất tính hợp lệ của nhật ký và hóa đơn** (FR-TEN-031). Có downtime không, nhà cung cấp hóa đơn và khóa idempotency của hóa đơn (FR-EIN-013) xử lý thế nào là nội dung kiểm tra bắt buộc `[Cần xác nhận: Dev]`. **Nay thuộc MT-0, nên làm ngay.** Theo CLAUDE.md hệ thống mới chạy trên Emulator, chưa có dự án GCP và chưa có dữ liệu thật, nên "di chuyển" hiện chủ yếu là đưa cấu trúc và dữ liệu seed vào mô hình có tenant; chi phí thấp nhất lúc này và tăng dần khi có dữ liệu thật (mục 17.3). Kịch bản giữ số chứng từ và khóa chống trùng hóa đơn vẫn phải kiểm tra lại khi có dữ liệu thật.

### 9.4 Lộ trình tự phục vụ (quyết định 05/11/2026)

Mục 9.1 là lộ trình có nhân sự nền tảng hỗ trợ (tenant đầu tiên, hoặc khách qua kênh bán hàng). Lộ trình tự phục vụ:

| Bước | Nội dung | Ai | FR |
| --- | --- | --- | --- |
| 1 | Đăng ký: thông tin pháp nhân hoặc hộ kinh doanh, MST, người đại diện, email, SĐT; chấp nhận điều khoản dịch vụ và DPA | Chủ garage | FR-TEN-039, 037 |
| 2 | Xác thực email; kiểm tra chống lạm dụng | Hệ thống | FR-TEN-041 |
| 3 | Xác minh doanh nghiệp (MST...) tự động, hoặc vào hàng chờ duyệt tay nếu bị cờ | Hệ thống; nhân sự nền tảng khi bị cờ | FR-TEN-040 |
| 4 | Cấp phát tự động; vào `onboarding` (hóa đơn `fake`, dữ liệu thử tách riêng) | Hệ thống | FR-TEN-042, 002 |
| 5 | Wizard: pháp nhân, chi nhánh, kho, mời nhân sự và vai trò, bảng giá và dịch vụ mẫu | Chủ garage | FR-TEN-043 |
| 6 | Nhập Excel theo mẫu, chạy thử | Chủ garage hoặc người được giao | FR-TEN-029, 030 |
| 7 | Khai hóa đơn điện tử thật: nhà cung cấp riêng của tenant, chứng thư số, mẫu số, ký hiệu | Kế toán tenant | FR-TEN-021 |
| 8 | Kiểm tra trước kích hoạt, tự kích hoạt `active`; thuê bao `none`/`trial` | Chủ garage | FR-TEN-004, 044 |
| 9 | Nâng gói khi cần | Chủ garage | FR-TEN-045 |

Nguyên tắc: ca không bị cờ nghi ngờ không cần nhân sự nền tảng ở bước nào; không nhập dữ liệu thật trước khi chấp nhận phiên bản điều khoản hiện hành (RULE-029); không phát hành hóa đơn thật hay gửi tin hàng loạt khi chưa đạt xác minh (RULE-028).

## 10. Người dùng và định danh

### 10.1 Bối cảnh hiện có

- Đăng nhập bằng email hoặc mã nhân viên (Q7, N10 của open-questions); mã nhân viên duy nhất theo công ty; đăng nhập bằng mã khi mơ hồ thì bị từ chối.
- Không có tự đăng ký; tài khoản do chủ hoặc AD tạo; lời mời 72 giờ (FR-SYS-019 đề xuất). **Quyết định 05/11/2026:** chủ garage của tenant mới tự đăng ký (FR-TEN-039); nhân viên trong tenant vẫn không tự đăng ký, do CH/AD mời.
- MFA nằm ngoài phạm vi do quyết định của owner (CLAUDE.md, `StrongAuthPort` là hook trống). Tài liệu này không đưa MFA vào FR-TEN.

### 10.2 Phương án cho người dùng nhiều tenant (Q4)

| Phương án | Mô tả | Hệ quả nghiệp vụ |
| --- | --- | --- |
| U1 | Một tài khoản thuộc đúng một tenant; cùng một người ở hai tenant có hai tài khoản và hai mật khẩu | Đơn giản, cách ly mạnh; bất tiện cho kế toán thuê ngoài, tư vấn |
| U2 | Một danh tính, nhiều tư cách thành viên (membership) mỗi tenant, chọn tenant khi đăng nhập hoặc đổi tenant | Tiện; cần quy tắc: phiên chỉ thuộc một tenant tại một thời điểm, quyền không cộng gộp giữa tenant, thu hồi từng tư cách |
| U3 | Như U2 chỉ cho nhóm vai trò đặc biệt (kế toán, tư vấn, hỗ trợ) | Trung gian |

Câu hỏi này quyết định cách xác định tenant khi đăng nhập (từ tên miền con, từ lựa chọn của người dùng, hay từ tài khoản) và email có duy nhất toàn nền tảng hay chỉ trong tenant. Hiện chưa có dữ liệu về nhu cầu thực. `[Cần xác nhận: Chủ dự án]`. **Với tự đăng ký, câu này chặn ADR 0002:** người lạ đăng ký cùng email ở hai tenant thì sao; người đã có tài khoản ở tenant A đăng ký lập tenant B thì sao; ai "giữ" email trước; cách xác định tenant khi đăng nhập (tên miền con, mã tenant, tra theo email). Xem Q4, Q25 ở Phụ lục B.

Yêu cầu chung bất kể phương án (FR-TEN-010, 016): mỗi phiên làm việc thuộc **đúng một** tenant; không thể suy ra việc tồn tại hay không của tài khoản ở tenant khác qua thông báo lỗi (nhất quán với thông báo trung lập của FR-SYS-019 đề xuất); thu hồi tư cách ở tenant A không ảnh hưởng tenant B.

## 11. Báo cáo cấp nền tảng

| Nhóm báo cáo | Nội dung | Có dữ liệu nghiệp vụ tenant? |
| --- | --- | --- |
| Danh mục tenant | Trạng thái, gói, ngày kích hoạt, ngày ngưng | Không |
| Sử dụng | Số chi nhánh, người dùng hoạt động, lệnh/tháng, dung lượng, số hóa đơn | Chỉ số tổng hợp, không có bản ghi |
| Sức khỏe | Lỗi tích hợp hóa đơn, hàng đợi, tốc độ phản hồi theo tenant | Không |
| Thương mại | Doanh thu thuê bao, công nợ tenant, tỷ lệ rời bỏ | Không (dữ liệu của nền tảng) |
| Phễu đăng ký và lạm dụng | Số đăng ký, tỷ lệ xác thực, xác minh đạt/từ chối, số bị cờ, thời gian từ đăng ký đến kích hoạt, tỷ lệ chuyển từ dùng thử sang trả phí | Không |
| Benchmark ngành | So sánh ẩn danh giữa tenant (doanh thu/xe, thời gian sửa) | **Có**, chỉ khi tenant đồng ý (FR-TEN-038, Q10) |

Nguyên tắc: báo cáo nền tảng theo RULE-015 vẫn nêu thời điểm và phạm vi; không cho "đào sâu" vào bản ghi tenant (RULE-017). Có cho tenant xem vị trí của mình so với benchmark không là câu hỏi thương mại (Q10).

## 12. Audit, dữ liệu cá nhân, pháp lý và lưu trữ

### 12.1 Audit

| Loại nhật ký | Nội dung | Ai xem |
| --- | --- | --- |
| Nhật ký tenant | Như FR-SYS-003, 014 và nhật ký truy cập dữ liệu cá nhân; thuộc tenant | CH, AD, QL, KT theo ba-answers §8.2 |
| Nhật ký nền tảng | Tạo/đổi trạng thái tenant, đổi gói, cấu hình mặc định, **phiên hỗ trợ**, xuất/xóa dữ liệu tenant | Chủ nền tảng; phần liên quan tenant hiển thị cho CH tenant |

Cả hai bất biến, không sửa, không xóa; ghi lý do (RULE-013, FR-TEN-013). Khi nhân sự nền tảng mở phiên hỗ trợ, mỗi lần "Hiện" dữ liệu cá nhân bị che vẫn ghi nhật ký truy cập (FR-SYS-025 đề xuất) kèm danh tính nhân sự nền tảng.

### 12.2 Dữ liệu cá nhân (Luật 91/2025/QH15, Nghị định 356/2025 theo NFR-PRI-01)

Các điểm phải chốt với luật sư của chủ nền tảng (Q8), vì tài liệu hiện chỉ viết cho trường hợp một doanh nghiệp (khách đầu tiên):

| Chủ đề | Câu hỏi |
| --- | --- |
| Vai trò | Tenant là bên kiểm soát, nền tảng là bên xử lý (giả thuyết)? Cần hợp đồng/thỏa thuận xử lý dữ liệu theo phiên bản |
| Chuyển dữ liệu ra nước ngoài | Chủ dự án đã chấp nhận dữ liệu đặt tại Singapore cho khách đầu tiên (ADR 0001 A3). Tenant mới có cần đánh giá/điều kiện riêng không? |
| Thông báo sự cố | Thời hạn và đầu mối báo cho tenant và cơ quan |
| Yêu cầu của chủ thể dữ liệu | Khách của garage gửi yêu cầu xóa: ai tiếp nhận (tenant), nền tảng hỗ trợ thế nào (FR-CRM-010, 011) |
| Nhân sự nền tảng | Truy cập dữ liệu cá nhân theo nhu cầu tối thiểu |
| Đồng ý của chủ xe | Ghi theo tenant; mục đích đồng ý thuộc tenant (FR-CRM-010) |
| Chấp nhận điều khoản và DPA khi tự đăng ký | Không có thương lượng hợp đồng; chấp nhận điện tử (click-wrap) có đủ hiệu lực không, ai là người có thẩm quyền chấp nhận cho tenant, lưu bằng chứng gì, đổi điều khoản một phía thế nào (Q30, RULE-029, FR-TEN-037) |
| Hồ sơ xác minh tenant (MST, người đại diện) | Là dữ liệu cá nhân của chủ doanh nghiệp: mục đích, thời hạn giữ, ai xem (FR-TEN-040) |

### 12.3 Lưu trữ khi chấm dứt (xung đột cần giải quyết)

| Dữ liệu | Ràng buộc đã biết | Đề xuất |
| --- | --- | --- |
| Hóa đơn (XML/PDF), chứng từ kế toán | Phải lưu đủ thời hạn luật (NFR-DAT-01, RULE-010); thời hạn chưa chốt, `[Cần xác nhận: Kế toán khách]` | Trả cho tenant dưới dạng gói lưu trữ có kiểm tra toàn vẹn; thời hạn giữ thêm tại nền tảng (nếu có) là dịch vụ ghi trong hợp đồng (Q7) |
| Hồ sơ khách, xe | Quyền xóa, trừ khách còn công nợ, bảo hành, lệnh mở (ba-answers §8.1) | Gói xuất cho tenant rồi ẩn danh/xóa theo chính sách |
| Hồ sơ nhân viên | Nghĩa vụ xóa khi nghỉ việc từ 1/1/2026 (BRD mục 7) | Như trên, theo tenant |
| Nhật ký | Đề xuất không thấp hơn thời hạn chứng từ liên quan (ba-answers §8.1) | Đưa vào gói xuất; sau đó theo chính sách |
| Sao lưu | FR-SYS-010 | Tenant đã `purged` hết khỏi sao lưu sau chu kỳ ghi rõ (FR-TEN-007) |

Mặc định hiện hành "chưa đặt thời hạn, không xóa" (ba-answers §8.1) được giữ; nền tảng chỉ xóa khi có cấu hình chính sách được người có thẩm quyền xác nhận (RULE-020).

## 13. Tác động lên các module hiện có

| Module | Tác động | FR/RULE liên quan |
| --- | --- | --- |
| SYS | Là nơi chịu tác động chính: phạm vi (Scope) thêm lớp tenant, vai trò nền tảng tách riêng, phân cấp cấu hình, đánh số theo tenant, audit tách, sao lưu theo tenant, khóa API theo tenant, lời mời và phiên theo tenant, nhập Excel theo tenant | FR-SYS-001, 002, 003, 005, 006, 007, 010, 011, 012, 017, 018; FR-SYS-028, 030, 031, 032 đề xuất |
| REC | Số lệnh duy nhất trong tenant (FR-REC-030); trạng thái và workflow không đổi; mẫu in theo tenant; nhắc/thông báo theo tenant | RULE-002 |
| INS | Ảnh/video INS là dữ liệu cá nhân (biển số, người); đường dẫn và URL ký theo tenant; quota dung lượng | ADR 0001 §7.3 |
| CRM | Khách và xe **không chia sẻ** giữa tenant (kể cả cùng biển số); phép chiếu xuyên chi nhánh (FR-CRM-004, ba-answers P3) chỉ trong tenant; đồng ý liên hệ theo tenant | RULE-017 |
| INV | Danh mục phụ tùng, bảng giá, kho theo tenant; chuyển kho chỉ trong tenant; chuyển kho giữa hai pháp nhân vẫn là câu hỏi mở của tenant 1 | RULE-008, 009 |
| PUR | Nhà cung cấp phụ tùng là dữ liệu của tenant, không dùng chung danh bạ giữa tenant | RULE-017 |
| HRM | Hồ sơ nhân viên theo tenant; mã nhân viên duy nhất trong phạm vi do thiết kế chốt (mục 19, M1); chính sách xóa khi nghỉ việc theo tenant | FR-HRM-012 |
| ACC | Kỳ kế toán, đóng sổ, hạn mức chi, phê duyệt theo tenant/Company; xuất dữ liệu cho phần mềm kế toán riêng của từng tenant | RULE-010, 011 |
| EIN | Nhà cung cấp, bí mật, chứng thư, mẫu số, ký hiệu theo tenant và Company; khóa chống phát hành trùng không hết hạn phải bền qua mọi trạng thái vòng đời (kể cả `suspended`, di chuyển tenant 1); tác vụ đồng bộ chạy theo tenant | FR-EIN-003, 004, 013; RULE-024, 025 |
| RPT | Báo cáo hợp nhất vẫn trong phạm vi tenant (và theo Company, R85); báo cáo nền tảng là nhóm mới (FR-TEN-033) | RULE-015, 017 |
| Mọi module đã build (SYS, CRM, INV, REC, ACC, EIN, RPT, nhập Excel; theo CLAUDE.md "Status") | Quyết định D1 buộc làm lại phần phạm vi: `tenantId` vào `resolveScope`, mọi repository và đăng ký truy vấn, chỉ mục, đường dẫn tệp, nhật ký, khóa đánh số, khóa chống trùng, cấu hình có hiệu lực theo ngày. Ngân sách chỉ mục (193/200, ngưỡng lỗi 195) có thể bị ảnh hưởng tùy mô hình cô lập: **dev đánh giá, không phải quyết định của BA** | FR-TEN-009, 010, 018, 020, 029, 031; NFR-TEN-01 |

## 14. Yêu cầu đề xuất: BR, RULE, FR, NFR

Cách đọc MoSCoW ở mục này (cập nhật 05/11/2026): **tương đối với chương trình multi-tenant**, kèm cột "Đợt" ở mục 17.2. Must = cần trước khi mở đăng ký tự phục vụ cho người ngoài (MT-1); trong đó nhóm "nền" MT-0 (14 FR) **thuộc Phase 1 pilot**. Should = cần trước khi thu tiền hoặc mở rộng thương mại (MT-2, MT-3); thu tiền là Should vì "thu tiền sau", nhưng thiết kế nền không được chặn (mục 8.3, 17.3). Could = khi có nhu cầu; Won't = chưa làm ở đợt này.

### 14.1 Yêu cầu nghiệp vụ đề xuất (BR-TEN)

| Mã | Yêu cầu nghiệp vụ | MoSCoW |
| --- | --- | --- |
| BR-TEN-01 | Phục vụ nhiều khách hàng độc lập trên một nền tảng mà dữ liệu của khách này không bao giờ lộ cho khách khác | Must |
| BR-TEN-02 | Có quy trình cấp phát, kích hoạt, tạm ngưng, chấm dứt và xóa dữ liệu tenant có kiểm soát và có nhật ký | Must |
| BR-TEN-03 | Mỗi tenant cấu hình riêng đánh số, thuế, mẫu in, hóa đơn điện tử, kênh thông báo mà không sửa mã nguồn | Must |
| BR-TEN-04 | Nhân sự nền tảng không truy cập dữ liệu nghiệp vụ của tenant trừ khi có lý do, thời hạn, sự đồng ý và nhật ký | Must |
| BR-TEN-05 | Tuân thủ luật bảo vệ dữ liệu cá nhân và nghĩa vụ lưu trữ hóa đơn, chứng từ của từng tenant, kể cả khi chấm dứt dịch vụ | Must |
| BR-TEN-06 | Có gói dịch vụ, hạn mức và theo dõi sử dụng để vận hành thương mại (nền có chỗ cho gói từ đầu; thu tiền làm sau) | Should |
| BR-TEN-07 | Chủ garage mới tự triển khai nhanh nhờ wizard, bộ câu hỏi chuẩn, nhập Excel và môi trường thử mà không cần nhân sự nền tảng (đổi từ Should lên Must theo D2) | Must |
| BR-TEN-08 | Chủ nền tảng thấy sức khỏe và mức sử dụng của các tenant mà không thấy dữ liệu nghiệp vụ | Should |
| BR-TEN-09 | Chủ garage bên ngoài tự đăng ký, được xác minh và tự triển khai (self-service onboarding) mà không cần nhân sự nền tảng cho ca bình thường (mới, theo D2) | Must |
| BR-TEN-10 | Thương mại hóa theo phase: gói dịch vụ, thu tiền, hóa đơn của nền tảng cho tenant, xử lý nợ phí; làm sau nhưng nền không bị chặn (mới, theo D3) | Should |
| BR-TEN-11 | Tin cậy giữa các tenant lạ nhau và bảo vệ nền tảng: chống lạm dụng đăng ký, chống mạo danh doanh nghiệp, cô lập, kiểm soát chi phí của tenant chưa trả tiền (mới, theo D2) | Must |

### 14.2 Quy tắc nghiệp vụ đề xuất (RULE)

Tiếp nối RULE-015; mọi RULE dưới đây là đề xuất, chờ xác nhận.

| Mã | Quy tắc | Truy vết FR | Ghi chú |
| --- | --- | --- | --- |
| RULE-016 | Mỗi bản ghi thuộc đúng một tenant, bất biến sau khi tạo; không chuyển bản ghi giữa tenant, chỉ xuất rồi nhập có duyệt | FR-TEN-009, 010 | Mở rộng RULE-012 |
| RULE-017 | Không có truy cập, tìm kiếm, tổng hợp chéo tenant; nền tảng chỉ cộng gộp dữ liệu nghiệp vụ của tenant khi có đồng ý và đã ẩn danh | FR-TEN-009, 033, 038 | Mở rộng NFR-ISO-01 |
| RULE-018 | Số chứng từ, mã và khóa chống trùng duy nhất trong tenant; không có bộ đếm toàn nền tảng; hai tenant được phép trùng số | FR-TEN-020 | Làm rõ FR-REC-030, FR-SYS-028 đề xuất |
| RULE-019 | Cấu hình kế thừa nền tảng, tenant, Company, Branch và có hiệu lực theo ngày; đổi cấu hình tầng trên không sửa chứng từ đã phát hành | FR-TEN-018, 019 | Mở rộng NFR-MNT-01, BR-ACC-08 |
| RULE-020 | Tạm ngưng không xóa dữ liệu; chấm dứt không xóa ngay; chỉ xóa hoặc ẩn danh sau khi trả dữ liệu, hết thời hạn giữ theo luật và hợp đồng, không có giữ pháp lý, và có người duyệt | FR-TEN-005 đến 007 | Phù hợp RULE-010 |
| RULE-021 | Trong lúc hạn chế, tạm ngưng hoặc chấm dứt (trừ sự cố an ninh) tenant vẫn truy xuất và tải được hóa đơn, chứng từ thuộc thời hạn lưu | FR-TEN-005, 006 | Bảo vệ nghĩa vụ pháp lý của tenant |
| RULE-022 | Truy cập hỗ trợ của nhân sự nền tảng cần lý do, thời hạn, phạm vi tối thiểu, sự đồng ý của tenant (trừ trường hợp khẩn cấp có duyệt và báo lại), và hiển thị cho tenant | FR-TEN-012 | Mở rộng nguyên tắc ghi chú FRD mục 2 |
| RULE-023 | Vượt hạn mức hoặc hạn chế thương mại không được chặn hoàn tất chứng từ đang mở (thu tiền, giao xe, phát hành hóa đơn); chỉ chặn tạo mới theo chính sách | FR-TEN-005, 025 | |
| RULE-024 | Tích hợp bên ngoài, bí mật, chứng thư số và khóa API là của từng tenant (và Company); không dùng chung giữa tenant | FR-TEN-021 | Mở rộng BR-EIN-04, FR-SYS-017 |
| RULE-025 | Hóa đơn của tenant phát hành dưới đơn vị phát hành của tenant; nền tảng không phát hành thay; hóa đơn nền tảng thu phí tenant nằm ngoài hệ thống hóa đơn của tenant | FR-TEN-021, 028 | |
| RULE-026 | Mỗi phiên làm việc thuộc đúng một tenant; đổi tenant là ngữ cảnh mới; tạm ngưng hoặc thu hồi tư cách thu hồi phiên theo cấu hình | FR-TEN-010, 016, 017 | |
| RULE-027 | Mọi thao tác cấp nền tảng ghi nhật ký nền tảng bất biến kèm lý do; thao tác nhạy cảm (ngưng, chấm dứt, xóa, truy cập khẩn cấp) cần hai người: người đề xuất và người duyệt | FR-TEN-003, 013 | Mở rộng RULE-013 |
| RULE-028 | Tenant tự đăng ký chưa đạt mức xác minh cấu hình được chỉ chạy `onboarding`/sandbox: không phát hành hóa đơn thật, không gửi SMS/Zalo hàng loạt, không dùng API ngoài có ghi dữ liệu | FR-TEN-004, 040, 041 | Mới (D2); mức xác minh `[Cần xác nhận]` Q28 |
| RULE-029 | Không nhập dữ liệu thật trước khi người đại diện tenant chấp nhận phiên bản hiện hành của điều khoản dịch vụ và DPA; lưu ai, khi nào, phiên bản nào, bằng chứng phiên | FR-TEN-037, 039 | Mới (D2); hiệu lực pháp lý chờ luật sư (Q8, Q30) |
| RULE-030 | Gói, thuê bao và công nợ phí **không bao giờ xóa dữ liệu**; hết dùng thử hoặc nợ phí chỉ đưa tenant qua thang: cảnh báo, ân hạn, hạn chế, chỉ đọc (thời hạn cấu hình); xóa chỉ theo RULE-020 | FR-TEN-044, 049 | Mới (D3) |
| RULE-031 | Mọi thao tác tiền giữa nền tảng và tenant (tính phí, thanh toán, hóa đơn nền tảng, hoàn tiền) idempotent, không xóa bản ghi đã ghi nhận, sửa bằng điều chỉnh; tách khỏi sổ và hóa đơn của tenant | FR-TEN-047, 048 | Mới (D3); song song RULE-010, 025 |
| RULE-032 | Một mã số thuế chỉ gắn một tenant đang hoạt động; trùng thì vào hàng chờ duyệt (chống mạo danh và đăng ký lặp) | FR-TEN-040, 041 | Mới (D2); ngoại lệ hợp pháp (nhượng quyền, nhiều thương hiệu cùng pháp nhân) `[Cần xác nhận]` Q28 |

| RULE-033 | Ẩn giao diện chi nhánh/kho (tenant một chi nhánh một kho) không làm thay đổi mô hình dữ liệu, Scope hay cô lập; cờ hiển thị chỉ điều khiển UI; mọi bản ghi vẫn mang `branch_id` | FR-TEN-051 | Mới (06/11/2026, bản tối giản); liên quan NFR-ISO-01 |
| RULE-034 | Một thông tin đăng nhập có thể thuộc nhiều tenant; mọi truy cập dữ liệu vẫn gắn đúng một tenant theo phiên | FR-TEN-009, 010, 016 | Mới (06/11/2026, QĐT-S01); **chờ C-S14** (nếu chọn mỗi tenant một tài khoản riêng thì RULE-034 bỏ) |

Ghi chú: quy tắc "tenant là bên kiểm soát, nền tảng là bên xử lý" **không** được đưa thành RULE vì chờ luật sư (Q8).

### 14.3 Yêu cầu chức năng đề xuất (FR-TEN)

Định dạng như bảng FR hiện có, thêm cột truy vết: BR, RULE, workflow (mục 5 và 15) và UAT (mục 16). **Cập nhật 05/11/2026:** cột MoSCoW đã sửa (FR-TEN-004, 015, 019, 037 lên Must; FR-TEN-028 từ Could lên Should); FR-TEN-002, 016, 021, 031, 032 sửa nội dung; thêm FR-TEN-039 đến 050 (nhóm H và I). Cột "Đợt" nằm ở mục 17.2.

**Cập nhật 06/11/2026:** các dòng FR-TEN-004, 016, 030, 032, 037, 039 đến 045 dưới đây là nội dung v2; **bảng 0A.3 ghi phần đã thay đổi theo bản tối giản và feedback 06/11 và thắng khi mâu thuẫn**. Thêm nhóm J (FR-TEN-051 đến 055) ở cuối mục này. Cột "Căn cứ" không có trong các bảng dưới; quy ước: mọi FR cụ thể hóa D1 (nền, nhóm A đến D, F, G), D2 (nhóm H), D3 (nhóm E, I) hoặc BA bổ sung theo luật và rủi ro (FR-TEN-005 đến 008, 011 đến 013, 022, 023, 033 đến 036, 038); nhóm J theo bản tối giản và feedback 06/11. Khách chỉ quyết D1 đến D3; mọi chi tiết còn lại là đề xuất BA.

#### Nhóm A. Hồ sơ và vòng đời tenant

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-001 | Hồ sơ tenant: mã tenant bất biến, tên, thông tin liên hệ, pháp nhân đại diện, tham chiếu hợp đồng, gói, trạng thái, ngày tạo; không xóa | Must | Mã không đổi được sau khi tạo; không có thao tác xóa hồ sơ; mọi thay đổi có nhật ký nền tảng | BR-TEN-02 / RULE-016, 027 / J1 / UAT-TEN-01 |
| FR-TEN-002 | Cấp phát tenant theo checklist (phần lõi dùng chung cho cấp phát thủ công và cấp phát tự động FR-TEN-042; thuộc MT-0): tạo tenant, Company đầu tiên, cấu hình mặc định nền tảng, tài khoản chủ garage (bằng lời mời, hoặc từ người đăng ký đã xác minh); chạy lại không tạo bản trùng; lỗi giữa chừng cho phép thử lại từng bước hoặc hủy | Must | Cấp phát hai lần cùng một yêu cầu cho một tenant; kết quả cấp phát lỗi giữa chừng thử lại hoàn tất mà không có dữ liệu trùng; tenant mới không thấy dữ liệu tenant khác | BR-TEN-02, 03 / RULE-018 / J1 / UAT-TEN-01 |
| FR-TEN-003 | Vòng đời trạng thái theo mục 5; mỗi chuyển trạng thái có người thực hiện, người duyệt (với bước nhạy cảm), lý do và thời điểm; chuyển trái quy tắc bị chặn | Must | Không chuyển được `purged` về `active`; ngưng/chấm dứt/xóa thiếu người duyệt hoặc lý do bị từ chối; có đủ dòng nhật ký | BR-TEN-02 / RULE-020, 027 / mục 5 / UAT-TEN-02 |
| FR-TEN-004 | Kiểm tra trước kích hoạt (nay là bước tự phục vụ do chủ garage tự chạy trong wizard FR-TEN-043): có chủ garage đã đăng nhập, có ít nhất một Company, một chi nhánh, một kho; đơn vị phát hành hóa đơn đã khai hoặc xác nhận chạy `fake`; chính sách lưu trữ đã xem; điều khoản đã chấp nhận; muốn phát hành hóa đơn thật thì đã đạt xác minh (FR-TEN-040) | Must | Thiếu mục thì không chuyển `active` và nêu mục thiếu; không phát hành hóa đơn thật khi chưa khai đơn vị phát hành | BR-TEN-02, 07 / RULE-024 / J1 / UAT-TEN-01 |
| FR-TEN-005 | Hạn chế và tạm ngưng: chế độ "chặn tạo mới", "chỉ đọc và tải dữ liệu", "chặn hoàn toàn (an ninh)"; phiên đang mở bị thu hồi theo cấu hình; thông báo cho CH tenant | Must | Ở chế độ chỉ đọc không tạo/sửa được chứng từ nhưng tải được hóa đơn và xuất dữ liệu; ở chế độ chặn tạo mới, lệnh đang mở vẫn thu tiền và giao xe được; dữ liệu giữ nguyên | BR-TEN-02, 05 / RULE-020, 021, 023, 026 / J3 / UAT-TEN-03 |
| FR-TEN-006 | Chấm dứt và gói xuất dữ liệu: tạo gói gồm dữ liệu nghiệp vụ, XML/PDF hóa đơn, tệp đính kèm, nhật ký, kèm danh mục và mã kiểm tra toàn vẹn; ghi nhận tenant đã nhận | Must | Gói mở được độc lập; số bản ghi và mã kiểm tra khớp nguồn; không chứa dữ liệu tenant khác; ghi nhận ai nhận, khi nào | BR-TEN-02, 05 / RULE-020, 021 / J4 / UAT-TEN-04 |
| FR-TEN-007 | Xóa hoặc ẩn danh sau chấm dứt theo chính sách lưu trữ: chặn khi còn thời hạn giữ hoặc có giữ pháp lý; chỉ chạy khi có người duyệt; ra chứng nhận xóa; nêu thời điểm dữ liệu hết khỏi sao lưu | Must | Chưa có cấu hình chính sách thì không xóa gì; có giữ pháp lý thì chặn; xóa xong không tra cứu được dữ liệu tenant, còn chứng nhận xóa không chứa dữ liệu cá nhân | BR-TEN-05 / RULE-020 / J4 / UAT-TEN-04 |
| FR-TEN-008 | Mở lại tenant `terminating` hoặc `terminated` trong thời hạn cho phép theo hợp đồng | Should | Trước hạn mở lại được và dữ liệu nguyên vẹn; sau hạn không mở được | BR-TEN-02 / RULE-020 / mục 5 / UAT-TEN-02 |

#### Nhóm B. Cô lập và bảo mật

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-009 | Cô lập tuyệt đối dữ liệu giữa tenant ở danh sách, tìm kiếm, báo cáo, xuất, API, tệp và URL ký, thông báo, tác vụ nền và nhật ký | Must | Tài khoản tenant A không thấy, không tìm thấy, không tải, không xuất được dữ liệu tenant B ở mọi kênh; bản ghi ngoài tenant trả "không tìm thấy" | BR-TEN-01 / RULE-016, 017 / mục 6 / UAT-TEN-05 |
| FR-TEN-010 | Mỗi yêu cầu và phiên thuộc đúng một tenant do hệ thống xác định, không do dữ liệu người dùng gửi lên tự quyết; thiếu hoặc không hợp lệ thì từ chối | Must | Sửa tham số, tiêu đề hay đường dẫn để trỏ sang tenant khác không đọc/ghi được dữ liệu tenant khác | BR-TEN-01 / RULE-016, 026 / mục 10 / UAT-TEN-05 |
| FR-TEN-011 | Vai trò nền tảng tách khỏi vai trò tenant, có ma trận quyền riêng; không vai trò nền tảng nào mặc định xem dữ liệu nghiệp vụ; không tài khoản nào vừa là nhân sự nền tảng vừa là người dùng tenant | Must | Quản trị nền tảng mở danh sách lệnh sửa chữa của tenant bị từ chối; vai trò tenant không vào được màn nền tảng | BR-TEN-04 / RULE-022 / mục 4 / UAT-TEN-06 |
| FR-TEN-012 | Phiên hỗ trợ có kiểm soát: tenant cho phép (hoặc khẩn cấp có người duyệt), có lý do, phạm vi, thời hạn tự hết, mọi thao tác ghi nhật ký, dữ liệu cá nhân vẫn che, CH tenant xem được lịch sử các phiên | Must | Không có phiên hợp lệ thì hỗ trợ không xem được dữ liệu; hết hạn tự đóng; mỗi phiên có dòng nhật ký hiển thị cho tenant | BR-TEN-04 / RULE-022 / J5 / UAT-TEN-06 |
| FR-TEN-013 | Nhật ký nền tảng bất biến, tách khỏi nhật ký tenant, ghi người, thời điểm, hành động, đối tượng tenant, lý do, giá trị trước và sau (không chứa dữ liệu cá nhân của khách tenant) | Must | Không sửa/xóa được; thao tác ngưng, chấm dứt, đổi gói, phiên hỗ trợ đều có dòng; nhật ký tenant không chứa thao tác nền tảng nhạy cảm của tenant khác | BR-TEN-02, 04 / RULE-027 / mục 12 / UAT-TEN-02 |
| FR-TEN-014 | Bộ kiểm thử cách ly có thêm trục tenant, chạy tự động; kết quả là điều kiện bắt buộc trước khi kích hoạt tenant mới hoặc phát hành bản mới | Must | Có báo cáo kiểm thử kết hợp tenant × vai trò × kênh; lỗi rò rỉ chặn phát hành | BR-TEN-01 / RULE-017 / mục 6 / UAT-TEN-05 |
| FR-TEN-015 | Hạn mức công bằng giữa tenant: giới hạn tần suất yêu cầu, nhập/xuất, tác vụ nền theo tenant; tenant dùng nặng không làm chậm tenant khác ngoài ngưỡng NFR; áp thêm mức thấp hơn cho tenant chưa xác minh hoặc chưa trả tiền để chống lạm dụng chi phí | Must | Một tenant nhập tệp lớn và gọi API dồn dập; tenant khác vẫn đạt NFR-PERF-01 | BR-TEN-01 / – / – / UAT-TEN-12 |

#### Nhóm C. Người dùng và định danh

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-016 | (Phụ thuộc Q4 và Q25, chặn ADR 0002; chưa quyết thì thiết kế không được giả định email duy nhất toàn nền tảng) Xác định tenant khi đăng nhập không mơ hồ, kể cả khi hai người lạ dùng cùng email hoặc mã nhân viên ở hai tenant; thông báo lỗi trung lập, không lộ tài khoản có tồn tại ở tenant nào; thu hồi tài khoản hoặc tư cách ở một tenant không ảnh hưởng tenant khác | Must | Cùng email/mã nhân viên ở hai tenant đăng nhập vào đúng tenant được chọn; mã nhân viên trùng giữa tenant không gây nhầm | BR-TEN-01 / RULE-026 / J6 / UAT-TEN-07 |
| FR-TEN-017 | Một người dùng thuộc nhiều tenant (phương án U2 hoặc U3) với chọn và đổi tenant, quyền không cộng gộp giữa tenant | Could (chờ Q4) | Đổi tenant tạo ngữ cảnh mới; quyền tenant A không có ở tenant B; thu hồi tư cách ở A không đăng xuất B | BR-TEN-01 / RULE-026 / J6 / UAT-TEN-07 |

#### Nhóm D. Cấu hình

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-018 | Cấu hình phân tầng nền tảng, tenant, Company, Branch có ngày hiệu lực; hiển thị nguồn của giá trị đang áp dụng; gồm chính sách lưu trữ, mật khẩu, hạn mức giảm giá mặc định | Must | Đổi cấu hình tenant không ảnh hưởng tenant khác; giá trị tầng dưới ghi đè tầng trên theo quy tắc; chứng từ đã phát hành giữ giá trị cũ | BR-TEN-03 / RULE-019 / – / UAT-TEN-08 |
| FR-TEN-019 | Danh mục pháp lý do nền tảng quản lý (thuế suất, chu kỳ đăng kiểm, khung mẫu theo luật) phát hành cho tenant có ngày hiệu lực; cho phép hoặc không cho tenant ghi đè theo quyết định Q16; với tenant tự đăng ký, nền tảng chịu trách nhiệm cập nhật để tenant không phải tự theo dõi luật | Must | Đổi thuế suất ở nền tảng áp cho lệnh sau ngày hiệu lực của mọi tenant trong phạm vi phát hành, không sửa mã; có ghi nhận ai phát hành | BR-TEN-03 / RULE-019 / – / UAT-TEN-08 (mở rộng UAT-09) |
| FR-TEN-020 | Đánh số, mã chi nhánh, mã nhân viên, mã khách duy nhất trong tenant; khóa dãy số chứa tenant; hai tenant được trùng số | Must | Hai tenant cùng phát hành số đầu tiên của cùng loại chứng từ không xung đột và không ảnh hưởng nhau | BR-TEN-03 / RULE-018 / – / UAT-TEN-08 |
| FR-TEN-021 | Cấu hình tích hợp theo tenant và Company, do chính tenant tự khai trong wizard (mỗi tenant có nhà cung cấp hóa đơn, tài khoản và chứng thư số riêng; nền tảng không cấp thay; phát hành thật chỉ sau khi đạt xác minh FR-TEN-040): nhà cung cấp hóa đơn, SMS/Zalo, khóa/bí mật, chứng thư, môi trường thử/thật; không dùng chung; chưa cấu hình thì "Chưa kích hoạt" | Must | Hóa đơn của tenant A mang đơn vị phát hành của A; không hóa đơn nào dùng bí mật của tenant khác; `fake` bị từ chối ở `live` | BR-TEN-03 / RULE-024, 025 / – / UAT-TEN-09 |
| FR-TEN-022 | Mẫu in và thương hiệu theo tenant (tên, logo, nội dung chân trang); phần bắt buộc theo luật hóa đơn không gỡ được | Should | Phiếu in của tenant A không có thương hiệu của B; mẫu hóa đơn thiếu trường bắt buộc bị chặn | BR-TEN-03 / – / – / UAT-TEN-09 |
| FR-TEN-023 | Tên miền con hoặc tên miền riêng cho tenant | Could (chờ Q6) | Truy cập theo tên miền của tenant dẫn đúng ngữ cảnh tenant; tên miền không lộ danh sách tenant | BR-TEN-03 / RULE-026 / – / – |

#### Nhóm E. Gói, quota, billing

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-024 | Danh mục gói dịch vụ và hạn mức (chiều theo Q13) có ngày hiệu lực; gán gói cho tenant có lịch sử | Should | Đổi gói áp từ ngày hiệu lực; lịch sử gói của tenant xem được | BR-TEN-06 / – / – / UAT-TEN-10 |
| FR-TEN-025 | Thực thi hạn mức: cảnh báo theo ngưỡng; vượt thì chặn tạo mới hoặc ghi nhận vượt tùy loại; không chặn hoàn tất chứng từ đang mở | Should | Vượt số chi nhánh thì không tạo thêm nhưng lệnh đang mở vẫn thu tiền và giao xe; cảnh báo gửi đúng người | BR-TEN-06 / RULE-023 / J3 / UAT-TEN-10 |
| FR-TEN-026 | Bật/tắt module theo gói; module tắt không hiện, không gọi được qua API, dữ liệu đã có giữ nguyên | Should | Tắt PUR ở tenant A không còn menu và API; bật lại thấy dữ liệu cũ | BR-TEN-06 / – / – / UAT-TEN-10 |
| FR-TEN-027 | Ghi nhận mức sử dụng theo tenant theo các chiều đã chọn, có kỳ và có thể đối chiếu | Should | Số liệu sử dụng khớp số đếm từ nguồn cho cùng kỳ | BR-TEN-06 / – / – / UAT-TEN-10 |
| FR-TEN-028 | Billing: kỳ thanh toán, bảng kê, công nợ tenant, liên kết trạng thái thanh toán với `restricted` sau thời gian ân hạn; phương án B0 đến B3 theo mục 8.3 (B0 thuộc MT-0: chỗ lưu gói và trạng thái thuê bao); thanh toán, hóa đơn nền tảng và dunning tách thành FR-TEN-047 đến 049 | Should | Quá hạn sau ân hạn chuyển `restricted` có nhật ký; trả nợ chuyển lại `active` | BR-TEN-06 / RULE-023, 025 / J3 / UAT-TEN-10 |

#### Nhóm F. Onboarding và di chuyển

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-029 | Nhập Excel theo tenant (mở rộng FR-SYS-007): lô, lỗi, xem trước, hoàn tác theo lô thuộc tenant; mẫu chuẩn nền tảng và ánh xạ cột theo tenant | Must | Lô của tenant A không thấy và không hoàn tác được từ tenant B; tệp lỗi không ghi một phần | BR-TEN-07 / RULE-016 / J1 / UAT-TEN-11 |
| FR-TEN-030 | Môi trường thử cho tenant đang triển khai: dữ liệu thử tách khỏi dữ liệu thật, hóa đơn `fake`, có thể xóa dữ liệu thử trước khi kích hoạt | Should | Dữ liệu thử xóa được mà không ảnh hưởng cấu hình; không phát hành hóa đơn thật ở `onboarding` | BR-TEN-07 / RULE-024 / J1 / UAT-TEN-01 |
| FR-TEN-031 | Đưa dữ liệu hiện có thành tenant số 1 (hiện chỉ trên Emulator, chưa có dữ liệu thật: làm ngay, trước khi có dữ liệu thật hoặc dự án GCP; thuộc MT-0): giữ nguyên số chứng từ đã cấp, hóa đơn và khóa chống trùng, nhật ký; có kế hoạch quay lui; đối chiếu số lượng trước và sau | Must | Số bản ghi và tổng tiền từng loại trước và sau khớp; không số chứng từ nào đổi; không phát hành hóa đơn trùng sau di chuyển | BR-TEN-02 / RULE-016, 018 / mục 9.3 / UAT-TEN-11 |
| FR-TEN-032 | (Gộp vào wizard FR-TEN-043 khi tự phục vụ) Bộ câu hỏi khảo sát chuẩn cho tenant mới (pháp nhân, hóa đơn, đánh số, kỳ, quy trình, lưu trữ) lưu cùng hồ sơ | Could | Hồ sơ tenant có phiên bản bộ câu hỏi và câu trả lời | BR-TEN-07 / – / J1 / – |

#### Nhóm G. Báo cáo nền tảng, vận hành, tuân thủ

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-033 | Báo cáo nền tảng: danh mục tenant, trạng thái, gói, mức sử dụng, sức khỏe tích hợp; không chứa bản ghi nghiệp vụ | Should | Báo cáo hiện số liệu tổng hợp theo tenant; không có đường dẫn đào sâu tới lệnh hay khách | BR-TEN-08 / RULE-017 / – / UAT-TEN-06 |
| FR-TEN-034 | Sao lưu và khôi phục theo tenant: khôi phục riêng một tenant tới thời điểm chọn không ảnh hưởng tenant khác; mục tiêu RPO/RTO theo SLA đã thỏa thuận (mở rộng FR-SYS-010, NFR-AVA-02) | Must | Thử khôi phục một tenant thành công, dữ liệu tenant khác không đổi; có biên bản thử theo lịch | BR-TEN-01, 02 / RULE-016 / – / UAT-TEN-12 |
| FR-TEN-035 | Thông báo vận hành từ nền tảng tới tenant (bảo trì, sự cố, thay đổi luật, phiên bản mới) theo vai trò nhận | Should | CH và AD tenant nhận thông báo; không tenant nào nhận thông báo dành riêng tenant khác | BR-TEN-02 / – / – / – |
| FR-TEN-036 | Quy trình xử lý sự cố dữ liệu cá nhân: xác định tenant bị ảnh hưởng, báo cho tenant theo hạn thỏa thuận, lưu hồ sơ sự cố (thời hạn pháp lý chờ luật sư, Q8) | Must | Có mẫu và đầu mối; hồ sơ sự cố liên kết nhật ký; chỉ tenant bị ảnh hưởng nhận thông báo | BR-TEN-05 / RULE-017, 027 / – / UAT-TEN-12 |
| FR-TEN-037 | Ghi nhận chấp thuận điều khoản dịch vụ và thỏa thuận xử lý dữ liệu theo phiên bản, theo tenant (mở rộng FR-SYS-023 đề xuất); chấp nhận điện tử (click-wrap) khi tự đăng ký, hiệu lực pháp lý do luật sư xác nhận (Q8, Q30); phiên bản mới cần chấp thuận lại | Must | Tenant chưa chấp thuận phiên bản hiện hành không nhập được dữ liệu thật và không kích hoạt được (RULE-029); có lịch sử người chấp thuận và thời điểm | BR-TEN-05 / – / J1 / UAT-TEN-01 |

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-038 | Số liệu tổng hợp ẩn danh và benchmark giữa tenant, chỉ gồm tenant đã đồng ý, có ngưỡng số tenant tối thiểu để không suy ngược được một tenant | Could (chờ Q10) | Tenant không đồng ý không có mặt trong số liệu; không xem được số liệu riêng từng tenant khác | BR-TEN-08 / RULE-017 / – / UAT-TEN-06 |

#### Nhóm H. Đăng ký tự phục vụ, xác minh, chống lạm dụng, triển khai và hỗ trợ (mới 05/11/2026, theo D2)

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-039 | Đăng ký tự phục vụ: trang đăng ký công khai thu thông tin tối thiểu (tên doanh nghiệp hoặc hộ kinh doanh, MST, người đại diện, email, SĐT), xác thực email (và SĐT nếu cấu hình), chấp nhận điều khoản và DPA (FR-TEN-037); tạo yêu cầu ở `signup_pending`, chưa tạo dữ liệu nghiệp vụ | Must | Gửi lại cùng đăng ký không tạo hai yêu cầu; chưa xác thực email thì không sang bước sau; liên kết xác thực hết hạn theo tham số (đề xuất 72 giờ, `[Cần xác nhận]`) và cấp lại được; thông báo khi email hoặc MST đã tồn tại là trung lập, không lộ tenant nào | BR-TEN-09, 11 / RULE-028, 029, 032 / J7 / UAT-TEN-13 |
| FR-TEN-040 | Xác minh tenant mới: đối chiếu MST và pháp nhân với nguồn tin cậy (mức tự động hay duyệt tay theo cấu hình, Q28); kết quả đạt, cần bổ sung, từ chối, kèm lý do; chỉ khi đạt mới được phát hành hóa đơn thật | Must | MST sai định dạng hoặc không tồn tại không qua; MST đã gắn tenant đang hoạt động vào hàng chờ duyệt (RULE-032); tenant chưa đạt không phát hành hóa đơn thật (RULE-028); từ chối có lý do và đường khiếu nại; hồ sơ xác minh được bảo vệ như dữ liệu cá nhân | BR-TEN-09, 11 / RULE-028, 032 / J7 / UAT-TEN-13 |
| FR-TEN-041 | Chống lạm dụng đăng ký: giới hạn tần suất theo nguồn, kiểm tra người thật, chặn email dùng một lần, danh sách chặn/cho phép, cờ nghi ngờ vào hàng chờ duyệt tay, trần số tenant mới mỗi giờ/ngày (bảo vệ chi phí), tenant bị cờ chỉ ở sandbox | Must | Đăng ký dồn dập từ một nguồn bị chặn sau ngưỡng cấu hình; email dùng một lần bị từ chối; ca bị cờ không phát hành hóa đơn thật, không gửi tin hàng loạt; vượt trần ngày thì xếp hàng chờ, có cảnh báo cho nền tảng; mọi quyết định có nhật ký nền tảng | BR-TEN-11 / RULE-028, 032 / J7 / UAT-TEN-14 |
| FR-TEN-042 | Cấp phát tự động tự phục vụ: sau xác minh đạt, chạy checklist FR-TEN-002 không cần nhân sự (tạo tenant, Company đầu tiên, cấu hình mặc định, chủ garage, môi trường `onboarding`); lỗi thì tự thử lại, quá số lần thì báo nhân sự nền tảng; kết quả idempotent | Must | Hai lần kích hoạt cùng một yêu cầu không tạo tenant thứ hai; lỗi giữa chừng tự thử lại không tạo trùng; thời gian đạt NFR-TEN-05; tenant mới không thấy dữ liệu tenant khác | BR-TEN-09 / RULE-018, 028 / J7 / UAT-TEN-15 |
| FR-TEN-043 | Wizard onboarding cho chủ garage: các bước pháp nhân, chi nhánh và kho, mời nhân sự và vai trò, bảng giá và dịch vụ mẫu, khai hóa đơn (nhà cung cấp, hoặc chạy `fake`), nhập Excel, kiểm tra kích hoạt (FR-TEN-004); lưu tiến độ, tiếp tục sau, bỏ qua có kiểm soát; hợp nhất bộ câu hỏi chuẩn (FR-TEN-032, Phụ lục A) | Should | Thoát giữa chừng rồi vào lại tiếp tục đúng bước; bước bắt buộc chưa xong thì không `active`; dữ liệu mẫu xóa được; không bước nào cần nhân sự nền tảng | BR-TEN-07, 09 / RULE-024, 028 / J8 / UAT-TEN-15 |
| FR-TEN-050 | Hỗ trợ tự phục vụ và SLA: tenant gửi và tra yêu cầu hỗ trợ, thấy trạng thái, kênh và mức SLA theo gói (Q9, Q23, Q33); có thể kèm đồng ý cấp phiên hỗ trợ (FR-TEN-012); nền tảng thấy hàng chờ nhưng không thấy dữ liệu nghiệp vụ; thông báo sự cố (FR-TEN-035) | Should | Yêu cầu của tenant A không hiện ở tenant B; hàng chờ nền tảng không có bản ghi nghiệp vụ; mức SLA hiển thị đúng gói hiện tại | BR-TEN-09 / RULE-022 / J5 / UAT-TEN-19 |

#### Nhóm I. Thuê bao, thanh toán, hóa đơn nền tảng, nợ phí (mới 05/11/2026, theo D3; làm sau, nền không được chặn)

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-044 | Dùng thử hoặc early access: giai đoạn chưa thu phí có hạn (thời lượng Q21/Q34 chưa quyết); hiển thị ngày hết hạn; cảnh báo ở các mốc cấu hình; hết hạn không xóa dữ liệu mà đi theo thang RULE-030 (hạn chế, rồi chỉ đọc, vẫn tải được dữ liệu); chuyển sang gói trả phí thì giữ nguyên dữ liệu | Should | Hết hạn dùng thử: không tạo mới theo cấu hình nhưng lệnh đang mở vẫn hoàn tất, dữ liệu nguyên vẹn, tải được hóa đơn và xuất dữ liệu; nâng sang trả phí mở lại ngay | BR-TEN-06, 10 / RULE-021, 023, 030 / J10 / UAT-TEN-16 |
| FR-TEN-045 | Nâng và hạ gói: nâng hiệu lực ngay (hoặc theo cấu hình), hạ hiệu lực kỳ kế tiếp; hạ gói bị chặn hoặc cảnh báo khi mức dùng hiện tại vượt hạn mức gói mới (không xóa dữ liệu); lịch sử gói và nhật ký | Should | Hạ gói khi đang vượt số chi nhánh của gói mới: bị chặn hoặc cảnh báo theo cấu hình, dữ liệu giữ nguyên; lịch sử gói đúng ngày hiệu lực | BR-TEN-06, 10 / RULE-023, 030 / J9 / UAT-TEN-17 |
| FR-TEN-046 | Feature flag theo tenant: bật/tắt tính năng cho từng tenant, gói hoặc nhóm thử (khác FR-TEN-026: module theo gói là thương mại, flag là phát hành dần); mặc định tắt cho tính năng mới; không dùng flag đổi quy tắc luật định | Should | Bật cho tenant A không ảnh hưởng B; mọi thay đổi có nhật ký nền tảng; tắt flag không mất dữ liệu | BR-TEN-06 / RULE-019 / – / UAT-TEN-17 |
| FR-TEN-047 | Thanh toán gói: tenant tự thanh toán qua kênh đã chọn (Q27), trả định kỳ hoặc trả trước; trạng thái thanh toán độc lập với trạng thái tenant; idempotent; đối soát; hoàn tiền bằng điều chỉnh | Should (MT-3) | Bấm hai lần hoặc hết thời gian chờ không thu hai lần; đối soát khớp với kênh thanh toán; hoàn tiền là bút toán điều chỉnh, không xóa giao dịch | BR-TEN-10 / RULE-031 / J9 / UAT-TEN-18 |
| FR-TEN-048 | Hóa đơn của nền tảng cho tenant: pháp nhân nền tảng (Q12) phát hành hóa đơn điện tử tiền dịch vụ theo cơ chế riêng, tách khỏi hóa đơn của tenant (RULE-025); thuế VAT theo cấu hình có hiệu lực theo ngày; thông tin người mua lấy từ hồ sơ tenant đã xác minh; idempotent; tenant xem và tải | Should (MT-3) | Hóa đơn nền tảng không lẫn với hóa đơn của tenant; không phát hành trùng; thuế suất đổi theo ngày hiệu lực không sửa hóa đơn cũ; dùng thử miễn phí không phát sinh hóa đơn | BR-TEN-10 / RULE-025, 031 / J9 / UAT-TEN-18 |
| FR-TEN-049 | Dunning và tạm ngưng khi nợ phí: thang cấu hình nhắc, ân hạn, `restricted`, `suspended` (chỉ đọc); mỗi bước thông báo CH và AD tenant; không chặn hoàn tất chứng từ đang mở (RULE-023) và không chặn tải hóa đơn, xuất dữ liệu (RULE-021); thanh toán xong tự mở lại; có nhật ký | Should (MT-3) | Quá hạn sau ân hạn chuyển `restricted` đúng ngày và có thông báo; lệnh đang mở vẫn thu tiền và giao xe; thanh toán xong về `active`; không bước nào xóa dữ liệu | BR-TEN-10 / RULE-021, 023, 030 / J3, J9 / UAT-TEN-18 |

#### Nhóm J. Bản tối giản và feedback 06/11/2026 (mới, đề xuất; xem mục 0A.3)

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận | BR / RULE / Workflow / UAT |
| --- | --- | --- | --- | --- |
| FR-TEN-051 | Tổ chức mặc định một chi nhánh một kho và hiển thị theo số lượng. Tenant tự đăng ký có đúng 1 chi nhánh và 1 kho; UI nhiều chi nhánh/kho (bộ chọn chi nhánh, nhóm chi nhánh, QV, chuyển kho liên chi nhánh, báo cáo hợp nhất) chỉ hiện khi có từ 2 chi nhánh (hoặc 2 kho) hoạt động; thêm ở Cài đặt | Must | Tenant mới không thấy bộ chọn chi nhánh; mọi bản ghi vẫn có `branch_id`, `resolveScope` vẫn chạy; thêm chi nhánh thứ hai làm UI nhiều chi nhánh hiện ngay và dữ liệu cũ gán đúng chi nhánh đầu; kiểm thử cô lập NFR-ISO-01 vẫn đạt | BR-TEN-07, 09 / RULE-033 / J8 / UAT-TEN-20 |
| FR-TEN-052 | Thiết lập dần: checklist, trạng thái Chưa làm/Xong/Bỏ qua, mục chặn chỉ gồm phát hành hóa đơn thật; mặc định lấy từ cấu hình hiệu lực theo ngày | Should | Không mục nào ngoài mục chặn hóa đơn thật chặn thao tác; bỏ qua mục không chặn không mất dữ liệu; phát hành thật bị khóa tới khi mục xác minh và nhà cung cấp đạt | BR-TEN-07 / RULE-024, 028 / J8 / UAT-TEN-15 |
| FR-TEN-053 | Liên kết xác thực email dùng một lần, hạn 72 giờ (tham số), **tự đăng nhập bất kể trình duyệt**, chỉ cho lần xác thực đầu; mở bằng GET chỉ hiện trang, tiêu thụ bằng POST; có nhật ký và email thông báo; phiên chỉ tạo khi tài khoản sẵn sàng; đổi email/mật khẩu, xuất dữ liệu, phát hành hóa đơn thật yêu cầu nhập lại mật khẩu (nếu C-S17 chấp nhận) | Should | Mở ở trình duyệt khác (kể cả trình duyệt nhúng của Gmail) vẫn nhận phiên; liên kết đã dùng, hết hạn hoặc mở bởi quét thư không tạo phiên sai; có nhật ký và email thông báo | BR-TEN-09, 11 / RULE-026, 028 / J7 / UAT-TEN-21 |
| FR-TEN-054 | Kênh hỗ trợ cấu hình (`support.phone`, `support.zalo`, `support.hours`, `support.email` dự phòng), hiển thị ở các màn đăng ký, chờ duyệt, bổ sung, từ chối, tạo chậm, checklist, hết dùng thử, khóa; không viết cứng; cảnh báo ở cấu hình khi rỗng | Should | Cấu hình rỗng vẫn hiện khối với kênh dự phòng và cảnh báo quản trị; đổi giá trị có hiệu lực không cần phát hành lại | BR-TEN-09 / RULE-019 / J7 / UAT-TEN-22 |
| FR-TEN-055 | Tên thương hiệu hiển thị là một hằng cấu hình (`brand.name`) dùng cho tiêu đề, email, mẫu in, hóa đơn thử; không còn tên dự án nội bộ hiển thị cho người dùng cuối | Could | Đổi một nơi đổi toàn bộ chuỗi hiển thị | BR-TEN-09 / – / – / UAT-TEN-22 |

Tổng cộng: **55 FR-TEN** (29 Must, 21 Should, 5 Could); bản gốc 50 mã (28 Must, 18 Should, 4 Could) cộng 5 mã nhóm J ngày 06/11/2026; bảng kiểm đếm theo mã ở mục 21.

(Dòng cũ của bản v2:) Tổng cộng: **50 FR-TEN** (28 Must, 18 Should, 4 Could); bảng kiểm đếm theo mã ở mục 21. FR-TEN-038 nằm ở bảng riêng phía trên vì thuộc nhóm báo cáo nhưng được thêm sau; FR-TEN-039 đến 050 là nhóm H và I thêm ngày 05/11/2026 (mã mới ở cuối, không đổi mã cũ).

### 14.4 Yêu cầu phi chức năng đề xuất (NFR-TEN)

| Mã | Nhóm | Yêu cầu | Mức đề xuất |
| --- | --- | --- | --- |
| NFR-TEN-01 | Cách ly | Mọi kiểm thử cách ly, dữ liệu seed và UAT có trục tenant; không giả định một tenant | Điều kiện phát hành, mở rộng UAT-06 |
| NFR-TEN-02 | Hiệu năng | Hiệu năng của tenant không giảm quá ngưỡng NFR-PERF-01, 02 do tenant khác dùng nặng | Đo ở kiểm thử tải đa tenant `[Cần xác nhận: số tenant và tải]` |
| NFR-TEN-03 | Khả dụng | SLA theo gói: tỷ lệ khả dụng, RPO, RTO, giờ hỗ trợ; ngoại lệ bảo trì báo trước | `[Cần xác nhận: Chủ dự án]`; hiện đề xuất 99,5% giờ làm việc và RPO 1 giờ, RTO 4 giờ (NFR-AVA-01, 02) chỉ cho tenant 1 |
| NFR-TEN-04 | Khôi phục | Khôi phục, xuất và xóa theo từng tenant | Có biên bản thử theo lịch (FR-TEN-034) |
| NFR-TEN-05 | Cấp phát | Thời gian cấp phát một tenant mới và số bước thủ công | Từ xác minh đạt đến đăng nhập được: đề xuất vài phút và 0 bước thủ công của nhân sự nền tảng cho ca không bị cờ (tự phục vụ, D2); chỉ tiêu cụ thể `[Cần xác nhận]`; đo ở tenant thứ hai |
| NFR-TEN-06 | Quy mô | Số tenant và quy mô mỗi tenant thiết kế | `[Cần xác nhận: Chủ dự án]`, hiện chưa có số (Q2, nay chặn ADR 0002); NFR-SCL-01 chỉ mô tả một tenant |
| NFR-TEN-07 | Chống lạm dụng | Trần đăng ký mới mỗi giờ/ngày, tỷ lệ đăng ký bị cờ vào hàng chờ, thời gian duyệt tay tối đa, chi phí tối đa cho tenant chưa trả tiền | Con số `[Cần xác nhận: Chủ dự án]` (Q29); đo bằng kiểm thử tải đăng ký |
| NFR-TEN-08 | An ninh giữa tenant lạ | Kiểm thử xâm nhập có kịch bản "tenant độc hại tự đăng ký rồi thử đọc, ghi, đoán định danh tenant khác"; không rò rỉ chéo tenant | Điều kiện mở đăng ký công khai (MT-1); bổ sung vào thử xâm nhập của slice 1.12 hiện chưa làm |
| NFR-TEN-09 | Chính xác thương mại | Mức dùng và phí đối chiếu được với nguồn; không thu trùng, không thu sai kỳ; công thức giá và thuế có ví dụ kiểm thử do kế toán nền tảng xác nhận (như NFR-MNT-01) | Áp dụng từ B1 |

## 15. User journey chính

### J1. Chủ nền tảng đưa một tenant mới vào vận hành

| Bước | Hành động | Hệ thống | Ngoại lệ |
| --- | --- | --- | --- |
| 1 | Quản trị nền tảng tạo hồ sơ tenant sau khi ký hợp đồng | `proposed`, ghi tham chiếu hợp đồng | Thiếu thông tin pháp nhân thì không sang bước 2 |
| 2 | Duyệt và chạy cấp phát | `provisioning`, checklist từng bước | Lỗi một bước: `provision_failed`, thử lại hoặc hủy |
| 3 | Chủ garage nhận lời mời, đặt mật khẩu, chấp nhận điều khoản | Ghi chấp thuận theo phiên bản | Lời mời hết hạn thì cấp lại |
| 4 | Khảo sát chuẩn, cấu hình pháp nhân, chi nhánh, kho, vai trò | `onboarding` | Pháp nhân chưa rõ thì chỉ chạy `fake` |
| 5 | Nhập Excel, đối chiếu, chạy thử | Dữ liệu thử tách khỏi dữ liệu thật | Lô lỗi không ghi một phần |
| 6 | Kiểm tra trước kích hoạt, CH xác nhận | `active` | Thiếu mục thì giữ `onboarding` |

### J2. Chủ garage của tenant trong tuần đầu

Đăng nhập, xem mình ở đâu (tên tenant, gói, hạn mức còn lại), mời quản lý chi nhánh và AD, xem lịch sử phiên hỗ trợ và nhật ký, cấu hình chính sách lưu trữ. Không thấy hay đoán được tenant khác (RULE-017).

### J3. Hạn chế vì hạn mức hoặc công nợ thương mại

Hệ thống cảnh báo CH tenant ở ngưỡng; quá hạn thì chuyển `restricted` sau thời gian ân hạn đã thỏa thuận. Cố vấn vẫn hoàn tất lệnh đang mở, thu ngân thu tiền, kế toán phát hành hóa đơn của lệnh đã giao; không tạo lệnh mới nếu chính sách chặn. Sau khi khắc phục, `active` trở lại. Mọi bước ghi nhật ký nền tảng.

### J4. Chấm dứt và trả dữ liệu

| Bước | Hành động | Ngoại lệ |
| --- | --- | --- |
| 1 | Tenant gửi yêu cầu bằng văn bản; Chủ nền tảng duyệt, lý do ghi nhật ký | Còn công nợ: xử lý trước hoặc ghi nhận điều khoản |
| 2 | Chuyển `terminating`, tenant chỉ đọc và tải | Có lệnh mở: yêu cầu hoàn tất hoặc ghi nhận chấp nhận |
| 3 | Tạo và bàn giao gói xuất; tenant xác nhận nhận | Không xác nhận trong hạn: theo hợp đồng |
| 4 | `terminated`, bắt đầu thời hạn giữ | Giữ pháp lý: chặn xóa |
| 5 | Duyệt xóa hoặc ẩn danh, ra chứng nhận | Chưa có chính sách: không xóa |

### J5. Hỗ trợ truy cập một vấn đề của tenant

CH hoặc AD tenant gửi yêu cầu hỗ trợ kèm đồng ý cấp quyền xem trong N giờ (tham số); nhân sự hỗ trợ mở phiên, thấy dữ liệu đã che; mỗi lần "Hiện" ghi lý do; hết giờ phiên tự đóng; CH tenant xem được lịch sử. Khẩn cấp (sự cố) có người duyệt thứ hai và báo lại tenant.

### J6. Kế toán làm việc cho hai tenant (nếu chọn U2 hoặc U3)

Đăng nhập, chọn tenant A, làm việc; đổi sang tenant B (ngữ cảnh mới, quyền của B); A thu hồi tư cách thì B không bị ảnh hưởng. Nếu chọn U1: hai tài khoản riêng.

### J7. Chủ garage tự đăng ký (mới, D2)

| Bước | Hành động | Hệ thống | Ngoại lệ |
| --- | --- | --- | --- |
| 1 | Vào trang đăng ký, nhập thông tin doanh nghiệp, MST, người đại diện, email, SĐT; chấp nhận điều khoản và DPA | `signup_pending`; lưu phiên bản điều khoản | Email hoặc MST đã tồn tại: thông báo trung lập, MST trùng vào hàng chờ duyệt |
| 2 | Xác thực email (và SĐT nếu cấu hình) | Kiểm tra chống lạm dụng | Liên kết hết hạn: cấp lại; bị chặn tần suất: thử lại sau |
| 3 | Chờ xác minh doanh nghiệp | Tự động, hoặc hàng chờ duyệt tay nếu bị cờ | Không đạt: `rejected` kèm lý do và đường khiếu nại; cần bổ sung: người đăng ký nộp thêm |
| 4 | Nhận thông báo, đăng nhập lần đầu | `provisioning` rồi `onboarding`, tự động | Lỗi cấp phát: tự thử lại; quá số lần báo nhân sự nền tảng, người đăng ký thấy "đang xử lý" |
| 5 | Vào wizard (J8) | Hóa đơn `fake`, dữ liệu thử tách riêng | |

### J8. Chủ garage hoàn tất onboarding bằng wizard (mới, D2)

Chủ garage đi qua các bước ở mục 9.4: pháp nhân, chi nhánh và kho, mời nhân sự, bảng giá và dịch vụ mẫu, khai hóa đơn (nhà cung cấp riêng, chứng thư số), nhập Excel, chạy thử. Có thể thoát và vào lại đúng bước. Kiểm tra trước kích hoạt rồi tự chuyển `active`. Ngoại lệ: chưa đạt xác minh thì chỉ chạy `fake`; chưa khai đơn vị phát hành hóa đơn thì không phát hành thật; lô nhập lỗi không ghi một phần; bỏ qua bước không bắt buộc thì được nhắc lại ở màn hình chính.

### J9. Nâng hoặc hạ gói (mới, D3; từ B1)

Chủ garage xem gói hiện tại, mức dùng, hạn mức còn lại. Nâng: có hiệu lực ngay, cập nhật hạn mức. Hạ: hiệu lực kỳ kế tiếp; nếu mức dùng hiện tại vượt gói mới thì hệ thống chặn hoặc cảnh báo và nêu rõ phải giảm gì (không xóa dữ liệu). Từ B2: thanh toán trong hệ thống, nhận hóa đơn của nền tảng; mọi thay đổi ghi lịch sử gói và nhật ký nền tảng. Ngoại lệ: thanh toán lỗi hoặc hết thời gian chờ không thu hai lần; yêu cầu hủy có hiệu lực cuối kỳ rồi theo J4.

### J10. Hết hạn dùng thử (mới, D3; khi Q21 chọn trial)

Hệ thống cảnh báo CH và AD ở các mốc cấu hình trước ngày hết hạn. Hết hạn mà chưa chọn gói: tenant đi theo thang RULE-030 (hạn chế tạo mới, rồi chỉ đọc), lệnh đang mở vẫn hoàn tất, hóa đơn và dữ liệu vẫn tải được; **không xóa dữ liệu**. Chọn gói trả phí lúc nào cũng mở lại ngay và giữ nguyên dữ liệu. Không chọn trong thời hạn giữ thì theo J4 (chấm dứt, xuất, xóa theo chính sách đã xác nhận).

## 16. Kịch bản nghiệm thu đề xuất (UAT-TEN)

Mã tạm, chốt khi áp dụng vào FRD; không trùng UAT-01 đến 26 và UAT-27 đến 31 tạm của dev.

| Mã | Kịch bản | Kết quả mong đợi | FR |
| --- | --- | --- | --- |
| UAT-TEN-01 | Cấp phát và kích hoạt tenant mới | Cấp phát lặp không tạo trùng; lỗi giữa chừng thử lại được; thiếu mục kích hoạt thì chặn; hóa đơn thật bị chặn ở `onboarding` | FR-TEN-001, 002, 004, 030, 037 |
| UAT-TEN-02 | Đổi trạng thái vòng đời | Chuyển trái quy tắc bị chặn; thiếu lý do hoặc người duyệt bị từ chối; có nhật ký nền tảng; mở lại trong hạn | FR-TEN-003, 008, 013 |
| UAT-TEN-03 | Hạn chế và tạm ngưng | Lệnh đang mở vẫn thu tiền, giao xe; chỉ đọc vẫn tải được hóa đơn; dữ liệu không đổi | FR-TEN-005, 025 |
| UAT-TEN-04 | Chấm dứt, gói xuất, xóa | Gói khớp số bản ghi và mã toàn vẹn; chưa có chính sách thì không xóa; giữ pháp lý chặn xóa; có chứng nhận xóa | FR-TEN-006, 007 |
| UAT-TEN-05 | Cô lập giữa tenant | Tài khoản tenant A không thấy dữ liệu tenant B ở danh sách, tìm kiếm, báo cáo, xuất, API, tệp, thông báo; sửa tham số không vượt được | FR-TEN-009, 010, 014 |
| UAT-TEN-06 | Quyền nền tảng và hỗ trợ | Nhân sự nền tảng không xem dữ liệu nghiệp vụ ngoài phiên hỗ trợ; phiên hết hạn tự đóng; báo cáo nền tảng không có bản ghi nghiệp vụ | FR-TEN-011, 012, 033, 038 |
| UAT-TEN-07 | Người dùng và đăng nhập đa tenant | Cùng email hoặc mã nhân viên ở hai tenant vào đúng tenant; thông báo lỗi trung lập; thu hồi ở A không ảnh hưởng B | FR-TEN-016, 017 |
| UAT-TEN-08 | Cấu hình và đánh số theo tenant | Hai tenant phát hành cùng số đầu tiên không xung đột; đổi thuế suất áp theo hiệu lực, chứng từ cũ không đổi | FR-TEN-018, 019, 020 |
| UAT-TEN-09 | Tích hợp, mẫu in và thương hiệu theo tenant | Hóa đơn mang đúng đơn vị phát hành; không dùng bí mật tenant khác; mẫu thiếu trường bắt buộc bị chặn | FR-TEN-021, 022 |
| UAT-TEN-10 | Gói, hạn mức, module | Cảnh báo theo ngưỡng; vượt thì chặn tạo mới nhưng không chặn hoàn tất; tắt module thì ẩn và chặn API | FR-TEN-024, 025, 026, 027, 028 |
| UAT-TEN-11 | Nhập Excel và di chuyển tenant 1 | Lô tách theo tenant; số bản ghi và tổng tiền trước sau di chuyển khớp; không đổi số chứng từ; không hóa đơn trùng | FR-TEN-029, 031 |
| UAT-TEN-12 | Khôi phục, tải đa tenant, sự cố dữ liệu | Khôi phục một tenant không ảnh hưởng tenant khác; một tenant tải nặng không làm tenant khác vượt NFR; hồ sơ sự cố đúng tenant | FR-TEN-015, 034, 036 |
| UAT-TEN-13 | Tự đăng ký và xác minh | Gửi lại đăng ký không tạo trùng; chưa xác thực email không đi tiếp; MST sai không qua; MST trùng vào hàng chờ; chưa chấp nhận điều khoản thì không nhập dữ liệu thật; từ chối có lý do | FR-TEN-039, 040, 037 |
| UAT-TEN-14 | Chống lạm dụng và tenant độc hại | Đăng ký dồn dập bị chặn; email dùng một lần bị từ chối; tenant bị cờ không phát hành hóa đơn thật; tenant mới đăng ký thử đọc, ghi, tìm, tải dữ liệu tenant khác ở mọi kênh đều thất bại | FR-TEN-041, 015, 009, 010 |
| UAT-TEN-15 | Cấp phát tự động và wizard | Không cần nhân sự nền tảng cho ca không bị cờ; cấp phát lặp không tạo trùng; thoát và vào lại wizard đúng bước; thiếu bước bắt buộc không `active`; đạt thời gian NFR-TEN-05 | FR-TEN-042, 043, 004 |
| UAT-TEN-16 | Hết hạn dùng thử | Cảnh báo đúng mốc; hết hạn không xóa dữ liệu; lệnh đang mở vẫn hoàn tất; tải được hóa đơn; chọn gói mở lại ngay | FR-TEN-044 |
| UAT-TEN-17 | Nâng/hạ gói và feature flag | Nâng hiệu lực ngay; hạ hiệu lực kỳ sau và bị chặn hoặc cảnh báo khi vượt hạn mức; lịch sử gói đúng; flag bật cho A không ảnh hưởng B | FR-TEN-045, 046, 025, 026 |
| UAT-TEN-18 | Thanh toán, hóa đơn nền tảng, nợ phí | Không thu hai lần; đối soát khớp; hóa đơn nền tảng tách khỏi hóa đơn tenant, không trùng; quá hạn đi theo thang, không chặn hoàn tất chứng từ đang mở; trả nợ tự mở lại | FR-TEN-047, 048, 049 |
| UAT-TEN-19 | Hỗ trợ tự phục vụ và SLA | Yêu cầu của tenant A không hiện ở B; hàng chờ nền tảng không có bản ghi nghiệp vụ; SLA đúng gói | FR-TEN-050 |
| UAT-TEN-20 | Một chi nhánh một kho và ẩn UI theo số lượng (mới 06/11/2026) | Tenant mới tự đăng ký có đúng 1 Company, 1 chi nhánh, 1 kho, không thấy bộ chọn chi nhánh, QV, chuyển kho liên chi nhánh; mọi bản ghi có `branch_id`; thêm chi nhánh thứ hai thì UI nhiều chi nhánh hiện, dữ liệu cũ thuộc chi nhánh đầu; kiểm thử cô lập NFR-ISO-01 vẫn đạt | FR-TEN-051, 042 (AC-S07, S10 đến S12) |
| UAT-TEN-21 | Đăng nhập email + mật khẩu và liên kết xác thực một lần (mới 06/11/2026) | Không ô Mã công ty; sai email, sai mật khẩu, tenant đã chấm dứt cùng một câu, cùng mã trạng thái; email thuộc hai công ty thì chỉ sau mật khẩu đúng mới hiện "Chọn công ty"; liên kết mở ở trình duyệt khác vẫn tự đăng nhập, dùng lại hoặc hết hạn thì không tạo phiên; quét thư chỉ GET không làm hỏng liên kết; email đã có tài khoản đăng ký garage mới không đổi mật khẩu cũ | FR-TEN-016, 053, 039 (AC-S24 đến S29, S41) |
| UAT-TEN-22 | Kênh hỗ trợ và tên thương hiệu cấu hình (mới 06/11/2026) | Khối hỗ trợ có mặt ở các màn nêu, lấy từ cấu hình; cấu hình rỗng vẫn hiện kênh dự phòng và cảnh báo quản trị; mọi chuỗi tên sản phẩm lấy từ `brand.name` | FR-TEN-054, 055 (AC-S30, S40) |

## 17. Phân đợt và điều kiện bắt đầu

Phân đợt là **đề xuất BA đã xếp lại theo quyết định 05/11/2026** (mục 0), chưa phải kế hoạch được duyệt. Thay đổi so với bản trước: MT-0 từ "kỷ luật, không có FR" thành "nền, có 14 FR, thuộc Phase 1"; tự đăng ký và triển khai tự phục vụ vào MT-1 (không còn "ngoài mục tiêu"); billing đi B0 → B3 theo đợt.

### 17.1 Nguyên tắc xếp ưu tiên

1. **Nền đi trước, vì sửa sau rất đắt:** mọi thứ làm thay đổi cách dữ liệu được khóa, lọc, đánh số, lưu và ghi nhật ký phải đúng ngay từ Phase 1 (MT-0).
2. **Không mở cửa cho người lạ trước khi có hàng rào:** tự đăng ký công khai (MT-1) chỉ mở khi có xác minh, chống lạm dụng, điều khoản/DPA, cách ly đã kiểm thử và quy trình ngưng/xuất/xóa.
3. **Thu tiền sau, nhưng nền có chỗ cho thu tiền:** gói, quota, thuê bao, thanh toán, hóa đơn nền tảng, dunning làm ở MT-2 và MT-3; MT-0 chỉ giữ các hook ở mục 8.3 và 17.3.
4. **Pilot của khách đầu tiên vẫn là tenant số 1 và là ưu tiên:** MT-0 phải đi cùng Phase 1, không được làm trễ go-live pilot ngoài mức owner chấp nhận (R-TEN-10).

### 17.2 Bảng đợt và phân loại từng FR

| Đợt | Mục tiêu | FR | Số FR | Hình thức vận hành |
| --- | --- | --- | --- | --- |
| **MT-0 Nền** (cùng Phase 1) | Tenant-aware từ đầu; tenant số 1 là một tenant thật; chưa có giao diện tự phục vụ | 001, 002, 003, 009, 010, 011, 013, 014, 016, 018, 020, 021, 029, 031; cộng phần B0 của 028 | 14 | Cấp phát tenant bằng quy trình nội bộ có chạy lại được (FR-TEN-002); đăng nhập theo U1 mặc định nếu Q4 chưa quyết |
| **MT-1 Tự phục vụ có kiểm soát** | Mở đăng ký cho người ngoài | 004, 005, 006, 007, 012, 015, 019, 030, 034, 036, 037, 039, 040, 041, 042, 043; **thêm 06/11/2026:** 051, 052, 053, 054, 055 | 21 | Tự đăng ký, xác minh, cấp phát tự động, onboarding hai màn + checklist; chưa thu tiền (thuê bao `none`/`trial`, B0) |
| **MT-2 Gói và dùng thử** | Sẵn sàng thu tiền thủ công | 008, 022, 024, 025, 026, 027, 028 (B1), 032, 033, 035, 044, 045, 046, 050 | 14 | Gói, trial, quota, flag, đo mức dùng, bảng kê, B1 |
| **MT-3 Thu tiền và mở rộng** | Thu tiền tự động, mở rộng | 017, 023, 038, 047, 048, 049 | 6 | Thanh toán, hóa đơn nền tảng, dunning (B2); người dùng nhiều tenant, tên miền, benchmark |
| | | **Tổng** | **55** (50 v2 + 5 nhóm J) | |

Ghi chú: MT-1 gồm toàn bộ Must còn lại và hai Should (030, 043) bắt buộc cho trải nghiệm tự phục vụ. FR-TEN-034 (khôi phục theo tenant) thuộc MT-1 nhưng **mô hình cô lập phải quyết ở MT-0** vì quyết định khả năng khôi phục riêng một tenant.

Điều chỉnh MoSCoW so với bản trước (cột MoSCoW ở 14.3 đã sửa):

| FR | Trước | Nay | Lý do |
| --- | --- | --- | --- |
| 004 Kiểm tra trước kích hoạt | Should | Must | Là cổng an toàn của tự kích hoạt |
| 015 Hạn mức công bằng, chống dùng nặng | Should | Must | Người lạ có thể lạm dụng tài nguyên |
| 019 Danh mục pháp lý do nền tảng quản lý | Should | Must | Tenant tự đăng ký không thể tự theo dõi thay đổi luật thuế |
| 037 Chấp nhận điều khoản và DPA | Should | Must | Không có hợp đồng thương lượng; RULE-029 |
| 028 Billing | Could | Should | D3: có gói và thu tiền (phần thu tiền vẫn ở MT-2, MT-3) |
| BR-TEN-07 Onboarding nhanh | Should | Must | D2 |

### 17.3 Phase 1 pilot cần gì; làm sau nhưng không được chặn gì

**Phase 1 pilot cần (MT-0, bắt buộc):**

1. `tenantId` là lớp phạm vi ngoài cùng trong `resolveScope` và mọi repository, truy vấn, chỉ mục, đường dẫn tệp, nhật ký, khóa đánh số, khóa chống trùng, cấu hình có hiệu lực theo ngày; `Company` giữ nghĩa pháp nhân (xử lý M1).
2. Hồ sơ tenant và vòng đời tenant (đủ các trạng thái ở mục 5, kể cả khi chưa có giao diện); đưa dữ liệu hiện có vào tenant số 1 (FR-TEN-031).
3. Phiên và yêu cầu thuộc đúng một tenant do hệ thống xác định (FR-TEN-010); đăng nhập không giả định email duy nhất toàn nền tảng (FR-TEN-016).
4. Vai trò nền tảng tách khỏi 10 vai trò tenant, nhật ký nền tảng bất biến (FR-TEN-011, 013).
5. Cấu hình tích hợp (hóa đơn, SMS/Zalo) và bí mật theo tenant (FR-TEN-021); nhập Excel theo tenant (FR-TEN-029).
6. Kiểm thử cách ly có trục tenant, dữ liệu seed và UAT có từ hai tenant trở lên (FR-TEN-014, NFR-TEN-01).

**Làm sau, nhưng thiết kế không được chặn (hook từ MT-0):**

| Làm sau | Hook cần có ngay |
| --- | --- |
| Tự đăng ký, xác minh, chống lạm dụng, wizard (MT-1) | Trạng thái `signup_pending`/`rejected`; cấp phát chạy lại được và gọi được không cần người; tenant chưa xác minh bị hạn chế ở lớp phát hành hóa đơn và gửi tin |
| Gói, trial, quota, feature flag (MT-2) | Chỗ lưu gói và trạng thái thuê bao trên hồ sơ tenant; một điểm kiểm tra hạn mức/tính năng, mặc định cho phép; sự kiện sử dụng đếm được theo tenant |
| Thanh toán, hóa đơn nền tảng, dunning (MT-3) | `restricted`/`suspended` thực thi ở lớp truy cập; thông tin người mua của tenant đã xác minh; số liệu tiền của nền tảng tách khỏi sổ tenant |
| Người dùng nhiều tenant, tên miền riêng (MT-3) | Không buộc email duy nhất toàn nền tảng; cách xác định tenant khi đăng nhập thay thế được (tên miền con hay mã tenant) mà không đổi dữ liệu |
| Tách riêng khách lớn (nếu có, Q3) | Mô hình cô lập cho phép di chuyển một tenant ra riêng; xuất/xóa/khôi phục theo tenant |

Cảnh báo cho dev (không phải quyết định BA): ngân sách chỉ mục 193/200 và ngưỡng lỗi 195 của `pnpm check:indexes` có thể bị tác động tùy mô hình cô lập; cần đo trước khi chọn (Q3).

### 17.4 Điều kiện bắt đầu

**Bắt đầu MT-0:** ADR 0002 chính thức (thay bản nháp hiện nêu tự đăng ký và billing là "ngoài mục tiêu") ít nhất trả lời Q3 (mô hình cô lập), Q4/Q25 (định danh), Q26 (cấp phát trên Firebase/GCP) và Q14 (sở hữu hạ tầng, khách đầu tiên đồng ý chia sẻ); có thể quyết có điều kiện và ghi rõ. Chưa trả lời thì dev tiếp tục theo kỷ luật MT-0 cũ nhưng không viết thêm slice theo kiểu một tenant.

**Mở đăng ký công khai (kết thúc MT-1), đề xuất:**

1. Q8 (luật sư: vai trò dữ liệu cá nhân, DPA, chuyển dữ liệu ra nước ngoài cho tenant tự đăng ký) và Q30 (hiệu lực chấp nhận điện tử) đã có văn bản.
2. Q14: khách đầu tiên xác nhận bằng văn bản việc dùng chung nền tảng và nơi đặt hạ tầng.
3. Q28 (mức xác minh) và Q29 (chính sách chống lạm dụng, trần chi phí) đã chốt.
4. UAT-TEN-05, 13, 14, 15 đạt; thử xâm nhập có kịch bản tenant độc hại (NFR-TEN-08); khôi phục một tenant đã thử (UAT-TEN-12).
5. Có đầu mối hỗ trợ và mức SLA tối thiểu công bố (Q9, Q33).
6. Thứ tự giữa MT-1 và pilot (song song hay sau go-live pilot ổn định): `[Cần xác nhận: Chủ dự án]`; BA không quyết.

**Bắt đầu thu tiền (MT-2 đến MT-3):** Q13 (gói và hạn mức), Q12/Q32 (pháp nhân và VAT), Q27 (cổng thanh toán), Q21/Q34 (dùng thử) đã quyết.

## 18. Điểm `[Cần xác nhận]` và câu hỏi cho owner/khách

**Cập nhật 05/11/2026:** Q1 và Q11 đã quyết, Q5 quyết một phần (mục 0.2). Các câu còn lại giữ nguyên bên dưới, kèm nhãn nếu nay chặn sớm hơn. Câu mới Q25 đến Q35 và bảng ưu tiên theo mức chặn ở **Phụ lục B**. Cột "Khuyến nghị BA" và "Ảnh hưởng" của các câu đã quyết được viết lại; các câu còn mở chưa quyết thay owner.

**Danh sách gom (06/11/2026):** các câu Q, C-xx, C-Sxx còn mở của toàn chương trình multi-tenant được gom, xếp theo mức chặn (ADR 0002, build, go-live, thu tiền) và người trả lời ở `docs/multi-tenant-open-questions.md`, kèm bốn câu mới Q36 (xác thực mạnh cho vai trò nền tảng), Q37 (thứ tự MT-1 so với pilot, mức trễ pilot chấp nhận), Q38 (tenant số 1 chấp nhận điều khoản/DPA thế nào) và Q39 (xem dòng dưới). Khi hai nơi lệch nhau thì file gom thắng.

- **Q39 (mới):** tách phạm vi quyết định giữa "mã công ty" nội bộ và mã người dùng thấy: QĐT-S01 bỏ ô Mã công ty ở đăng nhập nhưng giữ mã làm mã hỗ trợ; có cho tenant tự đổi mã không (C-20)? Khuyến nghị: không đổi ở giai đoạn đầu.

### 18.1 Câu hỏi quyết định (cần owner trả lời trước tiên)

| Mã | Chủ đề | Câu hỏi | Phương án | Khuyến nghị BA | Ảnh hưởng nếu chọn |
| --- | --- | --- | --- | --- | --- |
| Q1 | **ĐÃ QUYẾT 05/11/2026** Mô hình kinh doanh `[Chủ dự án]` | Bán dịch vụ theo mô hình nào? | S1 SaaS dùng chung (chọn, có tự đăng ký); S2; S4 | Đã quyết S1 | Cần toàn bộ FR-TEN theo các đợt MT-0 đến MT-3; S4 chỉ xét lại nếu Q3 cho thấy hợp đồng đòi tách vật lý |
| Q2 | **CÒN MỞ, chặn ADR 0002** Quy mô `[Chủ dự án]` | Số tenant dự kiến trong 2 năm, quy mô mỗi tenant, thời điểm tenant thứ hai? | Con số cụ thể | Cần con số để chọn mô hình cô lập | Ít tenant lớn nghiêng B/C; nhiều tenant nhỏ nghiêng A (ADR 0002) |
| Q3 | **CÒN MỞ, chặn ADR 0002 (nay là câu số một)** Mô hình cô lập `[Chủ dự án, Luật sư, Dev]` | Hợp đồng/pháp lý có yêu cầu tách dữ liệu vật lý không? | A dùng chung; B riêng cơ sở dữ liệu; C riêng dự án; khác nhau theo cấp khách | Hỏi yêu cầu hợp đồng trước; BA không chọn công nghệ | Mục 6; ảnh hưởng chi phí, ngân sách chỉ mục (193/200 ở A), xuất/xóa/khôi phục theo tenant |
| Q4 | **CÒN MỞ, chặn ADR 0002** Người dùng nhiều tenant `[Chủ dự án]` | Có người dùng cùng làm cho nhiều tenant (kế toán thuê ngoài, tư vấn)? | U1; U2; U3 | U1 cho MT-1 nếu chưa có nhu cầu thực, để MT-3 làm U2/U3 | Cách xác định tenant khi đăng nhập, email duy nhất toàn nền tảng hay trong tenant, phiên và thu hồi (FR-TEN-016, 017) |
| Q5 | **ĐÃ QUYẾT MỘT PHẦN 05/11/2026** Billing `[Chủ dự án]` | Có gói, thu tiền sau, phase hóa. Còn mở: giá, cổng thanh toán, thuế | B0 → B1 → B2 → B3 (mục 8.3) | Giữ phase hóa; chi tiết thương mại xem Q12, Q13, Q27 | B2 kéo thêm tích hợp thanh toán và pháp lý thuế; nền phải có hook ngay từ MT-0 (mục 17.3) |
| Q6 | Thương hiệu, tên miền `[Chủ dự án]` | Tenant có logo/tên riêng, tên miền con, hay tên miền riêng? | Chỉ tên và logo; thêm màu; tên miền con; tên miền riêng | Tên và logo trên giao diện và phiếu in; tên miền con nếu cần xác định tenant; tránh đổi màu vì design tokens bắt buộc | Tên miền riêng kéo theo chứng chỉ, DNS, cookie `__Host-`, vận hành |
| Q7 | Chấm dứt `[Chủ dự án, Kế toán khách, Luật sư]` | Khi chấm dứt: định dạng gói xuất, thời hạn tenant tải, thời hạn nền tảng còn giữ, có giữ hóa đơn thay tenant không, ai chịu chi phí? | Chỉ trả rồi xóa; trả và giữ N năm có phí; giữ lâu theo luật | Hai bước: trả dữ liệu rồi xóa theo chính sách đã xác nhận; mặc định không xóa | Nghĩa vụ lưu hóa đơn thuộc về tenant hay nền tảng; chi phí lưu trữ dài hạn; FR-TEN-006, 007 |
| Q8 | **CÒN MỞ, chặn mở đăng ký (và định hướng ADR 0002)** Pháp lý dữ liệu cá nhân `[Luật sư của chủ nền tảng]` | Vai trò tenant/nền tảng, thỏa thuận xử lý dữ liệu, chuyển dữ liệu ra nước ngoài cho tenant mới (A3 chỉ duyệt cho tenant 1), thông báo sự cố, hạn mức hiệu lực của Luật 91/2025 với doanh nghiệp nhỏ? | Nhiều | Mời luật sư trả lời bằng văn bản trước MT-1 | Có thể buộc đổi nơi đặt dữ liệu hoặc thêm điều khoản hợp đồng |
| Q9 | SLA và hỗ trợ `[Chủ dự án]` | Mức khả dụng, RPO/RTO, giờ hỗ trợ, kênh, thời hạn phản hồi theo gói? | Một mức; theo gói | Tối thiểu giữ NFR-AVA-01, 02 nếu chưa có cam kết khác | NFR-TEN-03; chi phí vận hành; bồi thường khi vi phạm |
| Q10 | Truy cập và tổng hợp dữ liệu `[Chủ dự án, Luật sư]` | Nhân sự nền tảng được xem gì, khi nào; có benchmark giữa tenant không và dựa trên đồng ý nào? | Không bao giờ; chỉ phiên hỗ trợ; có benchmark ẩn danh khi đồng ý | Chỉ phiên hỗ trợ, benchmark để MT-3 | FR-TEN-012, 038; niềm tin của tenant |
| Q11 | **ĐÃ QUYẾT 05/11/2026** Đăng ký `[Chủ dự án]` | Tenant mới tự đăng ký trên web (kênh bán hàng chỉ là đường phụ, giả định chưa hỏi) | Đã quyết: tự đăng ký | Đã quyết | Cần xác minh doanh nghiệp, chống lạm dụng, điều khoản/DPA tự động chấp nhận, cấp phát tự động: FR-TEN-039 đến 043; chi tiết còn mở ở Q28, Q29, Q30 |
| Q12 | **CÒN MỞ, chặn ADR 0002 ở mức hook và chặn MT-3** Pháp nhân nền tảng và VAT `[Chủ dự án, Kế toán của chủ nền tảng]` | Pháp nhân nào phát hành hóa đơn phí dịch vụ, thuế áp dụng cho dịch vụ phần mềm? | | | RULE-025; billing |
| Q13 | Gói và hạn mức `[Chủ dự án]` | Chiều tính hạn mức (mục 8.1), ngưỡng, mềm hay cứng? | Nhiều | Bắt đầu một đến hai chiều (số chi nhánh, số người dùng) | FR-TEN-024 đến 027 |
| Q14 | **CÒN MỞ, chặn ADR 0002 và chặn mở đăng ký** Quan hệ với khách đầu tiên `[Chủ dự án, Khách]` | Chủ dự án và khách đầu tiên có là cùng bên không; khách có đồng ý chia sẻ nền tảng với garage khác; ai sở hữu mã nguồn, dữ liệu, dự án GCP (ADR 0001 #2 chưa trả lời); khách có điều khoản về "quyền kiểm soát dữ liệu" (BRD Fit-Gap) | | Cần làm rõ **trước** mọi thiết kế | Có thể chặn cả chương trình hoặc buộc tách hạ tầng cho khách đầu tiên |
| Q15 | Phạm vi địa lý `[Chủ dự án]` | Tenant ngoài Việt Nam, ngôn ngữ và tiền tệ khác? | Chỉ Việt Nam; mở rộng | Chỉ Việt Nam (FR-SYS-009, luật VN) | Mở rộng kéo theo luật hóa đơn, thuế, dữ liệu cá nhân từng nước |
| Q16 | Danh mục pháp lý và kiểm thử `[Chủ dự án, Kế toán khách]` | Thuế suất và danh mục luật do nền tảng cập nhật chung; tenant có ghi đè không; ai chịu trách nhiệm đúng/sai và bộ ví dụ kiểm thử cho từng tenant? | Chung và khóa; chung và cho ghi đè; riêng từng tenant | Chung, tenant không ghi đè giá trị luật định | FR-TEN-019; NFR-MNT-01 |
| Q17 | Tùy biến `[Chủ dự án]` | Có nhận yêu cầu riêng của từng tenant (workflow, báo cáo) không; cấu hình hay mã riêng? | Chỉ cấu hình; cấu hình và gói dịch vụ chuyên biệt | Chỉ cấu hình trong nền tảng chung | Mã riêng cho từng tenant làm nâng cấp khó |
| Q18 | Phát hành phiên bản `[Chủ dự án, Dev]` | Mọi tenant cùng phiên bản? Có nhóm thử trước? Báo trước bao lâu khi đổi quy trình? | | Một phiên bản, báo trước | FR-TEN-035 |
| Q19 | Chia sẻ dữ liệu giữa tenant `[Chủ dự án]` | Có chia sẻ lịch sử xe, danh bạ nhà cung cấp phụ tùng giữa tenant? | Không; có với đồng ý | Không (RULE-017) | CRM, PUR; pháp lý dữ liệu cá nhân |
| Q20 | Chính sách lưu trữ mặc định `[Kế toán khách, Luật sư]` | Thời hạn lưu mỗi loại dữ liệu cho tenant mới | Theo bảng ba-answers §8.1 | Giữ "chưa đặt, không xóa" tới khi xác nhận | FR-TEN-007 |
| Q21 | **CÒN MỞ, liên quan trực tiếp D2, D3** Dùng thử `[Chủ dự án]` | Có giai đoạn dùng thử miễn phí; hết hạn xử lý dữ liệu ra sao? | | Chỉ dùng thử qua `onboarding` | FR-TEN-030 |
| Q22 | Sáp nhập, tách tenant `[Chủ dự án]` | Có hỗ trợ chuyển dữ liệu giữa tenant (mua lại, tách thương hiệu)? | Không; xuất và nhập có phí | Xuất và nhập, không chuyển trực tiếp (RULE-016) | Quy trình dịch vụ |
| Q23 | Hỗ trợ tại chỗ `[Chủ dự án]` | Ngôn ngữ, kênh và giờ hỗ trợ | | | NFR-TEN-03 |
| Q24 | Vai trò nền tảng `[Chủ dự án]` | Số người, nhóm vai trò nền tảng thực tế, có cần hai người duyệt cho thao tác nhạy cảm? | | Hai người cho ngưng, chấm dứt, xóa, truy cập khẩn cấp | RULE-027 |

### 18.2 Điểm `[Cần xác nhận]` đã có sẵn và liên quan

| Điểm | Nguồn | Liên quan |
| --- | --- | --- |
| Một hay nhiều pháp nhân trong một tenant | BRD mục 10; FR-SYS-018 | Chọn khóa đánh số, mã nhân viên theo tenant hay Company (M1) |
| Cấp dự án GCP thuộc tổ chức của khách (#2) | ADR 0001 §12 | Q14 |
| Thời hạn lưu trữ hóa đơn, chứng từ, nhật ký | NFR-DAT-01; ba-answers §8.1 | Q7, Q20 |
| Luật sư xác nhận nhóm doanh nghiệp miễn hay ân hạn | NFR-PRI-01 | Q8 |
| Nhà cung cấp hóa đơn, Zalo/SMS | CLAUDE.md "Open decisions" | Cấu hình theo tenant (FR-TEN-021) |
| Dãy số theo chi nhánh hay pháp nhân | ba-answers K2 | FR-TEN-020 |

## 19. Mâu thuẫn, khoảng trống phát hiện trong tài liệu hiện có

| Mã | Phát hiện | Nơi | Đề xuất |
| --- | --- | --- | --- |
| M1 | `Company` bị dùng cho cả "ranh giới ngoài cùng" (mã nhân viên duy nhất theo `companyId`, khóa dãy số, `CRON_COMPANY_ID`) lẫn "pháp nhân" (FR-SYS-018 cho phép nhiều pháp nhân, BR-EIN-04). Khi có tenant, các khóa này phải gắn tenant hay Company chưa được nói | ba-answers dòng 118 và §6; deploy-guide dòng 154; CLAUDE.md "Domain model" | Chốt thuật ngữ ở mục 2; tách "công ty (tenant)" khỏi "pháp nhân"; làm rõ trong FRD trước khi viết FR chính thức |
| M2 | FR-REC-030 có tiêu chí "mã duy nhất trên toàn hệ thống" (ba-answers dòng 327 ghi như vậy) trái với RULE-018 đề xuất | FRD, ba-answers | Sửa thành "duy nhất trong tenant" khi áp dụng |
| M3 | FRD mục 2 và BRD mục 5 viết AD "toàn hệ thống" dễ bị hiểu là quyền nền tảng | FRD mục 2, BRD mục 5 | Đổi thành "toàn tenant" và thêm vai trò nền tảng |
| M4 | NFR-ISO-01 chỉ nói chi nhánh; NFR-SCL-01 chỉ mô tả một tenant; NFR-AVA-02 giả định một khách | FRD mục 11 | Bổ sung theo mục 20 |
| M5 | ADR 0002 đặt billing, tự đăng ký, thương hiệu, tên miền là "không mục tiêu" nhưng chưa có nơi nào ghi nhu cầu nghiệp vụ | ADR 0002 §2 | Mục 8 của tài liệu này lấp chỗ trống; ADR chính thức cần tham chiếu |
| M6 | ADR 0001 A3 chấp nhận dữ liệu tại Singapore chỉ dựa trên khách đầu tiên; chưa có đánh giá cho tenant mới | ADR 0001 §12 | Q8 |
| M7 | Khóa chống trùng hóa đơn không hết hạn (FR-EIN-013) và di chuyển sang tenant: chưa có kịch bản bảo đảm giữ khóa | ba-answers §8.1 | FR-TEN-031 và UAT-TEN-11 |
| M8 | Chưa có FR nào nói về trạng thái tenant ngưng đối với tác vụ nền (đồng bộ hóa đơn, nhắc hạn, Idempotency-Key) | FRD | Bổ sung ở FR-TEN-005 và NFR |
| M9 | ADR 0001 §7.3 điều kiện 5 để mở việc cấp URL ký cho XML/PDF hóa đơn; với nhiều tenant cần kiểm tenant trong mọi URL ký | ADR 0001 | FR-TEN-009 |
| M10 | Mã FR-SYS-019 đến 032 và UAT-27 đến 31 đang ở trạng thái "đề xuất/tạm" ở dev docs; tài liệu này dựa vào chúng ở vài chỗ (FR-SYS-019, 023, 025, 028, 031) | ba-answers, proposed-doc-changes | Các tham chiếu này chỉ có hiệu lực khi các FR đó được nhập vào FRD |
| M11 | CLAUDE.md ghi "Multi-tenant (future, not built, not in current scope)"; ADR 0002 §2 coi tự đăng ký, billing là không mục tiêu và MT-0 chỉ là kỷ luật: **mâu thuẫn trực tiếp với quyết định 05/11/2026** | CLAUDE.md "Domain model"; ADR 0002 §2, §4 | Sửa theo mục 20 |
| M12 | CLAUDE.md nói `Company` là "top-level scope object" và "tenant id có thể thêm làm scope ngoài cùng sau"; nay `tenantId` phải ở ngoài cùng ngay từ đầu, `Company` là pháp nhân trong tenant | CLAUDE.md; M1 | Chốt thuật ngữ mục 2; sửa CLAUDE.md |
| M13 | Kế hoạch slice và trạng thái trong `docs/dev/implementation-plan.md` §7 và `status.md` tính theo một tenant; các slice 0.3 đến 1.11 đã build theo kiểu một tenant; ngân sách chỉ mục 193/200 chưa tính trục tenant | Dev docs; CLAUDE.md "Status" | Dev đánh giá phạm vi retrofit và chỉ mục; thêm slice MT-0 vào plan |
| M14 | Thử xâm nhập (slice 1.12, chưa làm) chưa có kịch bản "tenant độc hại tự đăng ký"; UAT-06 chưa có trục tenant | CLAUDE.md "Status"; FRD UAT-06 | NFR-TEN-08, UAT-TEN-14 |
| M15 | ADR 0001 giả định đăng nhập không có tự đăng ký (password + session cookie, tài khoản do chủ/AD tạo, lời mời 72 giờ); tự đăng ký thêm luồng xác thực email, chống bot, khôi phục mật khẩu cho người chưa có tenant | ADR 0001 §2.1; FR-SYS-019 đề xuất | Q25; kiểm tra lại ADR 0001 khi viết ADR 0002 |

### 19.2 Rủi ro mới (R-TEN), theo quyết định 05/11/2026

| Mã | Rủi ro | Mức | Giảm thiểu (FR/RULE/NFR) | Người chịu trách nhiệm đề xuất |
| --- | --- | --- | --- | --- |
| R-TEN-01 | **Lạm dụng đăng ký**: bot, spam, đăng ký hàng loạt tốn chi phí hạ tầng; dùng nền tảng để gửi tin hoặc lập hóa đơn giả | Cao | FR-TEN-040, 041, 015; RULE-028, 032; NFR-TEN-07; UAT-TEN-14 | Chủ nền tảng |
| R-TEN-02 | **Cô lập giữa tenant lạ nhau**: không còn quan hệ tin cậy; tenant độc hại có thể thử tấn công; mọi lỗi lọc là sự cố dữ liệu cá nhân của người ngoài | Cao | FR-TEN-009, 010, 014; RULE-016, 017; NFR-TEN-08; UAT-TEN-05, 14 | Dev, Chủ nền tảng |
| R-TEN-03 | **Pháp lý bên xử lý dữ liệu cho tenant tự đăng ký**: không thương lượng hợp đồng; hiệu lực click-wrap; DPA tự động chấp nhận; dữ liệu đặt ở Singapore (ADR 0001 A3 chỉ duyệt cho khách đầu tiên); thông báo sự cố | Cao | FR-TEN-037, 036; RULE-029; Q8, Q30 | Luật sư |
| R-TEN-04 | **Hóa đơn điện tử theo từng tenant với nhà cung cấp riêng**: nhiều nhà cung cấp (chi phí tích hợp, lỗi cấu hình), chứng thư số của tenant do nền tảng giữ (bí mật), sai đơn vị phát hành, phát hành trùng, nền tảng bị hiểu nhầm là phát hành thay | Cao | FR-TEN-021, 040; RULE-024, 025, 028; UAT-TEN-09; Q31 | Dev, Kế toán |
| R-TEN-05 | **Hỗ trợ và SLA**: tenant tự đăng ký kỳ vọng hỗ trợ khi chưa có hợp đồng; khối lượng hỗ trợ tăng theo số tenant; hỗ trợ tiếng Việt, giờ làm việc; SLA không có doanh thu khi chưa thu phí | Trung bình đến cao | FR-TEN-050, 012, 035; NFR-TEN-03; Q9, Q33 | Chủ nền tảng |
| R-TEN-06 | **Khách đầu tiên không đồng ý hoặc quyền sở hữu hạ tầng chưa rõ** (Q14) | Cao | Q14 trước ADR 0002 và trước mở đăng ký | Chủ dự án |
| R-TEN-07 | **Chi phí hạ tầng không có doanh thu**: early access hoặc dùng thử không trần; tenant bỏ hoang vẫn tốn | Trung bình | FR-TEN-015, 041, 044; NFR-TEN-07; Q29, Q34 | Chủ nền tảng |
| R-TEN-08 | **Thuế và hóa đơn nền tảng chưa rõ khi bắt đầu thu tiền**: pháp nhân, VAT, thời điểm lập hóa đơn | Trung bình | FR-TEN-048; RULE-031; Q12 | Kế toán nền tảng |
| R-TEN-09 | **Làm nền muộn**: retrofit `tenantId` vào dữ liệu, chỉ mục, đánh số, nhật ký sau khi có dữ liệu thật rất đắt; ngân sách chỉ mục 193/200 | Cao nếu trễ | MT-0 cùng Phase 1; FR-TEN-031; M13 | Dev |
| R-TEN-10 | **Phạm vi phình, trễ pilot** của khách đầu tiên khi làm cùng lúc nền multi-tenant | Trung bình | Phân đợt mục 17; chỉ MT-0 vào Phase 1; owner xác nhận mức chấp nhận trễ | Chủ dự án |
| R-TEN-11 | **Tranh chấp khi hết dùng thử, nợ phí, chấm dứt**: giữ dữ liệu làm con tin hoặc xóa quá sớm so với nghĩa vụ lưu trữ hóa đơn | Trung bình | RULE-020, 021, 030; FR-TEN-006, 007, 049; Q7 | Luật sư |
| R-TEN-12 | **Mạo danh doanh nghiệp** (dùng MST của người khác) để phát hành hóa đơn hoặc lấy dữ liệu | Cao | FR-TEN-040; RULE-028, 032; Q28 | Chủ nền tảng |

## 20. Danh sách chỉnh sửa đề xuất cho các tài liệu khác

**Trạng thái 06/11/2026:** phần lớn danh sách dưới đã làm (xem mục 0A.5 để biết file nào đã sửa, file nào chưa: user journey, ba-answers, implementation-plan, status, index-budget còn lại). Nội dung bên dưới giữ nguyên làm nguồn truy vết. Bản gốc ghi: chưa sửa các file này (lần cập nhật đó chỉ sửa tài liệu phân tích). Sau quyết định 05/11/2026, danh sách dưới đây là **việc cần làm, không còn chờ "nếu owner duyệt"** ở phần phạm vi và ưu tiên; mã FR/BR/RULE mới chỉ nhập vào BRD/FRD khi owner xác nhận bản mã ở tài liệu này. Giữ nguyên mã hiện có; mã mới thêm vào cuối từng mục. **Thứ tự ưu tiên:** (1) CLAUDE.md (đang mâu thuẫn, ảnh hưởng mọi agent), (2) ADR 0002 viết lại, (3) implementation-plan và status, (4) BRD, FRD, user journey, (5) thiết kế giao diện.

### CLAUDE.md (ưu tiên cao nhất)

1. Dòng **"Multi-tenant (future, not built, not in current scope)"** trong mục "Domain model and rules that span modules": thay bằng nội dung đề xuất sau (tiếng Anh, theo văn phong file):

   > **Multi-tenant (decided 05/11/2026: designed from the start; self-service sign-up and paid plans follow in phases)**: GMEP is a shared SaaS platform: Platform → Tenant → Company (legal entity) → Branch → Warehouse. Other garage owners will register and onboard themselves, and paid plans (billing/subscription, phased B0 to B3) come later. The foundation (wave MT-0, part of Phase 1) is mandatory now: `tenantId` is the outermost scope in `resolveScope` and in every repository, query shape, index, storage path, audit entry, numbering key, idempotency key and effective-dated config; tenant record and lifecycle; platform roles separate from the 10 tenant roles; per-tenant integration config and secrets; isolation tests with a tenant axis. Sign-up, verification, auto-provisioning, plans/trial/quota, payment and platform invoicing are later waves (MT-1 to MT-3) but Phase 1 choices must not block them. Undecided and blocking ADR 0002: isolation model, login identity across tenants, provisioning on Firebase/GCP, billing provider, VAT for platform invoices. Do not write new slices in single-tenant style. See `docs/multi-tenant-analysis.md`.

2. Mục "Domain model", dòng Multi-branch: đổi "Company → Branch → Warehouse" thành có Platform và Tenant; bỏ ý "Company là top-level scope object" (M12).
3. Mục "Status" và "Phasing": thêm MT-0 vào Phase 1; MT-1 đến MT-3 sau Phase 1; ghi các slice 0.3 đến 1.11 cần retrofit tenant.
4. Mục "Open decisions": thêm mô hình cô lập, định danh đa tenant, cấp phát trên Firebase/GCP, cổng thanh toán, VAT hóa đơn nền tảng, mức xác minh tenant, chính sách dùng thử.
5. Mục "Tech stack": ghi chú tự đăng ký thêm luồng xác thực mới (M15); không đổi stack.

### BRD (`docs/business-requirements.md`)

1. Mục 4: **không** đưa Multi-tenant vào nhóm ngoài phạm vi; ghi vào phạm vi: nền multi-tenant (MT-0) thuộc Phase 1, tự đăng ký/gói/thu tiền (MT-1 đến MT-3) là các đợt sau Phase 1. Rà lại danh sách ngoài phạm vi (dòng 136 đến 142) nếu có nhắc nhiều pháp nhân hay multi-tenant.

### BRD (`docs/business-requirements.md`)

2. Mục 5: sửa "Quản trị hệ thống: Toàn hệ thống" thành "toàn tenant"; thêm bốn vai trò nền tảng ở mục 4.1 và bên ngoài ở mục 4.3.
3. Mục 6: thêm BR-TEN-01 đến 11 vào bảng BR bản mới; RULE-016 đến 032 vào "Quy tắc nghiệp vụ".
4. Mục 7: thêm ghi chú pháp lý cho nền tảng (vai trò xử lý dữ liệu, lưu hóa đơn khi chấm dứt, điều khoản dịch vụ và DPA chấp nhận điện tử, hóa đơn VAT cho dịch vụ nền tảng) sau khi luật sư và kế toán nền tảng trả lời.
5. Mục 8: thêm rủi ro R-TEN-01 đến 12 (mục 19.2): lạm dụng đăng ký, tenant độc hại, pháp lý bên xử lý dữ liệu, hóa đơn từng tenant, SLA, khách đầu tiên không đồng ý chia sẻ nền tảng, làm nền muộn, chi phí không doanh thu, phụ thuộc một đội ngũ hỗ trợ.
6. Mục 9 và 10: thêm lộ trình MT-0 (cùng Phase 1) đến MT-3 (sau Phase 1) và Q1 đến Q35; ghi Q1, Q11 đã quyết, Q5 một phần.
7. Mục 3: bổ sung chỉ số thành công cho nền tảng (số tenant, thời gian cấp phát) nếu owner duyệt.

### FRD (`docs/functional-requirements.md`)

1. Mục 2: thêm ma trận quyền nền tảng riêng (FR-TEN-011) và ghi chú AD là quản trị tenant.
2. Thêm mục mới "FR: Multi-tenant (TEN)" sau mục 10, với FR-TEN-001 đến 050 và cột "Đợt" (mục 17.2).
3. FR-SYS-002, 005, 006, 007, 010, 011, 012, 017, 018: thêm câu "trong phạm vi một tenant" và liên kết FR-TEN tương ứng; FR-SYS-018: phân biệt tenant và Company.
4. FR-REC-030: sửa tiêu chí "duy nhất trên toàn hệ thống" thành "duy nhất trong tenant" (RULE-018).
5. Mục 11: NFR-ISO-01 mở rộng lên tenant; thêm NFR-TEN-01 đến 09; làm rõ NFR-SCL-01 và NFR-AVA-02 chỉ cho khách đầu tiên.
6. Mục 12: ghi tích hợp bên ngoài theo tenant (hóa đơn, SMS, Zalo); thêm "nhập Excel theo tenant".
7. Mục 13: thêm UAT-TEN-01 đến 19; thêm hàng TEN vào ma trận truy vết; ghi 14 FR MT-0 vào danh sách Phase 1 và ghi MT-1 đến MT-3 là sau Phase 1.
8. Tiêu đề ở mục "Tổng hợp theo phân hệ": thêm phân hệ TEN (owner đã quyết hướng đi; chỉ nhập mã khi owner xác nhận bản mã).
9. Tính lại số FR (hiện 182) và mọi bảng đếm theo phase và MoSCoW sau khi nhập.
10. UAT-06 (cô lập chi nhánh): thêm trục tenant (NFR-TEN-01).

### User journey (`docs/user-journey-business-workflow.md`)

1. Mục 1: thêm persona nền tảng (Chủ nền tảng, Quản trị nền tảng, Hỗ trợ).
2. Mục 2: thêm hành trình J1 đến J10 (J7 đến J10: đăng ký tự phục vụ, wizard onboarding, nâng/hạ gói, hết hạn dùng thử).
3. Mục 7: thêm bộ trạng thái tenant (mục 5.1, gồm `signup_pending`, `rejected`) làm đối tượng thứ sáu và bộ trạng thái thuê bao (mục 5.5) làm đối tượng thứ bảy, ghi rõ tách khỏi năm đối tượng hiện có và tách nhau; thêm hàng vào ma trận phê duyệt cho ngưng, chấm dứt, xóa, truy cập khẩn cấp (hai người duyệt).
4. Mục 8: thêm ngoại lệ trong mục 5.4.

### Tài liệu dev và ADR

1. `docs/adr/0002-multi-tenant.md` **cần viết lại** (không chỉ nối thêm): bản nháp coi tự đăng ký, billing, thương hiệu, tên miền là không mục tiêu (§2) và MT-0 chỉ là kỷ luật (§4), không còn đúng. ADR chính thức phải trả lời nhóm P0 ở Phụ lục B (mô hình cô lập, định danh đăng nhập, cấp phát trên Firebase/GCP, hook billing, VAT hóa đơn nền tảng), nêu hệ quả M1, M7, M9, M13, M15, ngân sách chỉ mục, và tham chiếu RULE-016 đến 032. Dev viết; BA chỉ cung cấp yêu cầu nghiệp vụ, không chọn công nghệ.
2. `docs/dev/open-questions-for-ba.md`: thêm Q-TEN (Q1 đến Q35 ở mục 18 và Phụ lục B); ghi Q1, Q11 đã quyết, Q5 một phần.
3. `docs/dev/ba-answers-for-dev.md`: ghi quyết định D1 đến D3; làm rõ phạm vi khóa dãy số và mã nhân viên (tenant hay Company) khi có quyết định M1.
4. `docs/dev/implementation-plan.md` §7 và `docs/dev/status.md`: thêm slice MT-0 (retrofit tenant cho các slice 0.3 đến 1.11, FR-TEN-001 đến 003, 009 đến 011, 013, 014, 016, 018, 020, 021, 029, 031) trước go-live pilot; thêm MT-1 đến MT-3 như đợt sau Phase 1; `docs/dev/index-budget.md` đánh giá ảnh hưởng của trục tenant lên ngân sách chỉ mục.
5. `docs/adr/0001-tech-stack.md` §12: câu #2 (dự án GCP thuộc tổ chức nào) và A3 (dữ liệu tại Singapore) phải xem lại cho tenant tự đăng ký (Q14, Q8).
6. Thiết kế giao diện (`design/`, `docs/ui-ux/`): cần màn hình mới: đăng ký và xác minh, wizard onboarding, trang gói, mức dùng và hạn mức, hết hạn dùng thử, cổng hỗ trợ, bảng điều khiển nền tảng (danh mục tenant, hàng chờ duyệt, phiên hỗ trợ). Chuyển cho designer sau khi owner xác nhận các FR-TEN-039 đến 050.

## 21. Ma trận truy vết

| BR | RULE | FR-TEN | UAT-TEN | FR/NFR hiện có liên quan |
| --- | --- | --- | --- | --- |
| BR-TEN-01 | 016, 017, 026 | 009, 010, 014, 015, 016, 017, 034 | 05, 07, 12, 14 | NFR-ISO-01, FR-SYS-002, RULE-012 |
| BR-TEN-02 | 016, 018, 020, 027 | 001, 002, 003, 005, 006, 007, 008, 013, 031, 034, 035 | 01, 02, 03, 04, 11, 12 | FR-SYS-003, 010, 011, RULE-010 |
| BR-TEN-03 | 018, 019, 024, 025 | 018, 019, 020, 021, 022, 023 | 08, 09 | FR-SYS-005, 006, 016, FR-EIN-003, BR-ACC-08, NFR-MNT-01 |
| BR-TEN-04 | 022, 027 | 011, 012, 013 | 06 | FRD mục 2 (ghi chú AD), FR-SYS-025 đề xuất |
| BR-TEN-05 | 020, 021, 029 | 005, 006, 007, 036, 037 | 03, 04, 12, 13 | NFR-DAT-01, NFR-PRI-01, FR-SYS-031 đề xuất, FR-CRM-010, 011, RULE-010 |
| BR-TEN-06 | 023, 025, 030 | 024, 025, 026, 027, 028, 044, 045, 046 | 10, 16, 17 | NFR-SCL-01, NFR-SCA-01 |
| BR-TEN-07 | 016, 024, 033 | 004, 029, 030, 032, 043, 051, 052 | 01, 11, 15, 20 | FR-SYS-007, BRD mục 12 |
| BR-TEN-08 | 017 | 033, 038 | 06 | RULE-015 |
| BR-TEN-09 | 028, 029, 032, 033, 034 | 004, 039, 040, 042, 043, 050, 051, 052, 053, 054, 055 | 13, 15, 19, 20, 21, 22 | FR-SYS-019 đề xuất (lời mời), ADR 0001 §2.1 |
| BR-TEN-10 | 023, 025, 030, 031 | 028, 044, 045, 047, 048, 049 | 16, 17, 18 | RULE-010, FR-EIN-003 (tách khỏi hóa đơn tenant) |
| BR-TEN-11 | 017, 028, 032 | 009, 014, 015, 039, 040, 041 | 05, 13, 14 | NFR-ISO-01, NFR-SEC (thử xâm nhập) |

Kiểm đếm FR-TEN theo ưu tiên (55 mã, cập nhật 06/11/2026):

| MoSCoW | Số lượng | Mã |
| --- | --- | --- |
| Must | 29 | 001, 002, 003, 004, 005, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 018, 019, 020, 021, 029, 031, 034, 036, 037, 039, 040, 041, 042, 051 |
| Should | 21 | 008, 022, 024, 025, 026, 027, 028, 030, 033, 035, 043, 044, 045, 046, 047, 048, 049, 050, 052, 053, 054 |
| Could | 5 | 017, 023, 032, 038, 055 |

Kiểm đếm theo đợt (mục 17.2): MT-0 14, MT-1 21, MT-2 14, MT-3 6 (tổng 55). BR-TEN: 8 Must (01, 02, 03, 04, 05, 07, 09, 11), 3 Should (06, 08, 10).

FR thay đổi so với bản trước: **5 đổi MoSCoW** (004, 015, 019, 037 lên Must; 028 lên Should), **10 sửa nội dung hoặc đợt** (002, 004, 015, 016, 019, 021, 028, 031, 032, 037; 004, 015, 019, 028, 037 đã nằm trong nhóm đổi MoSCoW), **12 FR mới** (039 đến 050). Tổng FR bị tác động: 22 (10 cũ + 12 mới). BR: 07 đổi Must, 09 đến 11 mới. RULE: 028 đến 032 mới. NFR: 05 sửa, 07 đến 09 mới. UAT: 13 đến 19 mới. Journey: J7 đến J10 mới. Rủi ro: R-TEN-01 đến 12 mới.

Số lượng đề xuất (v2, 05/11/2026): 11 BR-TEN, 17 RULE (016 đến 032), 50 FR-TEN, 9 NFR-TEN, 19 UAT-TEN. **Hiện hành (v3, 06/11/2026): 11 BR-TEN, 19 RULE (016 đến 034), 55 FR-TEN, 9 NFR-TEN, 22 UAT-TEN** (mục 0A.2).

---

### Phụ lục A. Bộ câu hỏi khảo sát chuẩn cho tenant mới (tóm tắt)

1. Mô hình pháp lý: một công ty nhiều chi nhánh phụ thuộc, nhiều pháp nhân, hộ kinh doanh; ai là đơn vị phát hành hóa đơn.
2. Nhà cung cấp hóa đơn điện tử, mẫu số, ký hiệu, ai giữ chứng thư số.
3. Đánh số chứng từ: dãy theo chi nhánh hay pháp nhân, kỳ đặt lại số, liền số.
4. Kỳ kế toán, phần mềm kế toán đang dùng, định dạng xuất kỳ cuối.
5. Quy trình theo loại dịch vụ, có đồng sơn không.
6. Quy tắc tính công, hoa hồng, hạn mức giảm giá, hạn mức duyệt.
7. Số chi nhánh, người dùng, xe mỗi ngày, số năm lịch sử cần chuyển.
8. Chính sách lưu trữ và kế toán trưởng/luật sư của tenant.
9. Thiết bị và máy in tại chi nhánh.
10. Người phụ trách dữ liệu, kế hoạch huấn luyện và vận hành song song.

(Với tự phục vụ, bộ câu hỏi này chạy trong wizard FR-TEN-043 thay cho buổi khảo sát có nhân sự.)

---

### Phụ lục B. Câu hỏi còn mở, ưu tiên các câu chặn ADR 0002

Cập nhật 05/11/2026. **Đã quyết (không hỏi lại):** Q1 (SaaS dùng chung), Q11 (tự đăng ký), Q5 một phần (có gói, thu tiền sau, phase hóa). Mọi mục dưới đây là câu mở; BA nêu khuyến nghị nhưng **không quyết thay owner** và không chọn công nghệ. Mã Q1 đến Q24 xem mục 18; Q25 đến Q35 là mới.

#### B.1 Nhóm P0: chặn ADR 0002 (không viết được ADR chính thức nếu thiếu)

| Mã | Câu hỏi | Phương án | Khuyến nghị BA | Ảnh hưởng của từng lựa chọn | Ai trả lời |
| --- | --- | --- | --- | --- | --- |
| Q3 | **Mô hình cô lập dữ liệu.** Có hợp đồng, quy định hay khách mục tiêu nào đòi tách dữ liệu vật lý? Nền tảng có cần một hạng "khách lớn tách riêng" sau này? | A: dùng chung dữ liệu, tách bằng mã tenant; B: cơ sở dữ liệu riêng mỗi tenant; C: dự án hạ tầng riêng mỗi tenant; lai theo hạng khách | Trả lời hai câu nghiệp vụ trước (có đòi tách vật lý không; có hạng khách lớn không) rồi để dev đánh giá phương án theo tiêu chí ở mục 6, kèm đo ngân sách chỉ mục (193/200). Tự đăng ký quy mô lớn làm phương án nặng vận hành khó mở rộng, nhưng đây là nhận định nghiệp vụ, không phải chọn công nghệ | A: rẻ nhất, rủi ro lỗi lọc cao nhất, xuất/xóa/khôi phục riêng khó nhất; B: cân bằng, bị giới hạn số cơ sở dữ liệu; C: cô lập tốt nhất, chi phí và cấp phát tự động khó. Quyết định ảnh hưởng FR-TEN-009, 034, 007, 006 và mọi slice | Chủ dự án, Luật sư, Dev |
| Q4, Q25 | **Định danh đăng nhập và nhiều tenant.** (a) Một người có thể thuộc nhiều tenant (kế toán thuê ngoài, tư vấn, người lập tenant thứ hai)? (b) Email có duy nhất toàn nền tảng hay chỉ trong tenant? (c) Tenant được xác định khi đăng nhập bằng gì: tên miền con, mã tenant gõ vào, hay tra theo email? | U1 một tài khoản một tenant; U2 một danh tính nhiều tư cách thành viên; U3 chỉ nhóm vai trò đặc biệt. Cách xác định: tên miền con / mã tenant / tra theo email | U1 và xác định bằng mã hoặc tên miền con cho MT-0 và MT-1; **không** buộc email duy nhất toàn nền tảng để còn đường lên U2 ở MT-3. Chưa quyết thì FR-TEN-016 vẫn thiết kế theo hướng không giả định email duy nhất | U1: đơn giản, cô lập mạnh, bất tiện cho kế toán thuê ngoài; U2: tiện nhưng cần phiên một-tenant, quyền không cộng gộp, thu hồi từng tư cách, và thông báo lỗi không lộ tài khoản; tra theo email cần email duy nhất; tên miền con kéo theo tên miền, chứng chỉ, cookie (Q6). Tự đăng ký làm câu này cấp bách vì người lạ có thể đăng ký trùng email | Chủ dự án, Dev |
| Q26 | **Cấp phát tenant trên Firebase/GCP.** Tạo một tenant mới (tự động, không người) cần tạo gì: chỉ bản ghi cấu hình, hay tài nguyên hạ tầng riêng (cơ sở dữ liệu, kho tệp, dự án)? Nhà cung cấp cho tạo tự động đến mức nào, giới hạn số lượng, độ trễ, chi phí cố định mỗi tenant (kể cả tenant không trả tiền)? Ai sở hữu tổ chức GCP và tài khoản thanh toán? Vùng dữ liệu? | (i) chỉ dữ liệu, không tài nguyên mới; (ii) tài nguyên logic riêng trong cùng dự án; (iii) dự án riêng mỗi tenant | Yêu cầu nghiệp vụ BA đặt cho dev: không bước thủ công, vài phút (NFR-TEN-05), chi phí cố định mỗi tenant gần 0 khi chưa trả tiền (R-TEN-07), xuất/xóa/khôi phục riêng được. Dev trả lời phương án nào đạt, bằng spike (ADR 0002 §6). Phụ thuộc Q3 và Q14 | (i) rẻ, nhanh, phụ thuộc Q3=A; (ii) giới hạn số lượng của nhà cung cấp; (iii) tốn thời gian và quyền tạo dự án, khó tự động. Ảnh hưởng FR-TEN-002, 042, NFR-TEN-05 | Dev, Chủ dự án |
| Q14 | **Quan hệ với khách đầu tiên và quyền sở hữu hạ tầng.** Khách đầu tiên có đồng ý nền tảng phục vụ garage khác trên cùng hạ tầng? Ai sở hữu mã nguồn, dữ liệu, dự án GCP (ADR 0001 §12 #2 chưa trả lời)? Có điều khoản "quyền kiểm soát dữ liệu" (BRD Fit-Gap) cản trở? | Đồng ý chia sẻ; chỉ chia sẻ mã nguồn, hạ tầng tách; không đồng ý | Làm rõ **trước** ADR 0002 và trước khi mở đăng ký; cần văn bản của khách đầu tiên | Không đồng ý: tách hạ tầng cho khách đầu tiên (đổi Q3, Q26) hoặc dừng hướng dùng chung; đồng ý: khách đầu tiên thành tenant số 1 theo cùng điều khoản | Chủ dự án, Khách đầu tiên |
| Q27 | **Nhà cung cấp thanh toán và billing.** Thu tiền gói qua kênh nào (chuyển khoản và QR thủ công, cổng thanh toán nội địa, thẻ, ví, hay nhà cung cấp thuê bao)? Có lưu thông tin thẻ trong hệ thống? Billing nằm trong hay ngoài hệ thống ở MT-2? | B1 thủ công ngoài hệ thống; B2 cổng thanh toán; nhà cung cấp thuê bao quốc tế | Chỉ cần quyết ở mức định hướng cho ADR (billing trong hay ngoài hệ thống ở MT-2; **không lưu thông tin thẻ**, dùng trang thanh toán của cổng); chọn nhà cung cấp cụ thể ở MT-3 sau khảo sát | Chọn sớm giúp thiết kế hook thuê bao và đối soát; thu ngoại tệ hoặc nhà cung cấp nước ngoài kéo theo thuế và pháp lý; lưu thẻ kéo theo yêu cầu bảo mật thanh toán rất nặng | Chủ dự án, Kế toán nền tảng |
| Q12, Q32 | **VAT cho gói dịch vụ và hóa đơn của nền tảng.** Pháp nhân nào phát hành hóa đơn tiền dịch vụ cho tenant? Thuế GTGT áp dụng cho dịch vụ phần mềm trực tuyến (thuế suất, có ưu đãi hoặc miễn không)? Giá niêm yết đã gồm VAT chưa? Thời điểm lập hóa đơn? Tenant là hộ kinh doanh hoặc cá nhân thì xử lý ra sao? Dùng thử miễn phí có phát sinh hóa đơn? Hoàn tiền và credit note? | Do kế toán và luật sư của chủ nền tảng xác nhận theo luật hóa đơn và thuế GTGT hiện hành (CLAUDE.md nêu Nghị định 254/2026/NĐ-CP cho hóa đơn); BA không khẳng định nội dung điều luật | Thuế suất và quy tắc là cấu hình có hiệu lực theo ngày, **không hard-code**; hóa đơn nền tảng tách khỏi hóa đơn của tenant (RULE-025, 031); chỉ chặn ADR ở mức: có chỗ lưu thông tin người mua đã xác minh và tách số liệu tiền | Quyết định giá niêm yết, mô hình dữ liệu hóa đơn nền tảng, nhà cung cấp hóa đơn của nền tảng; chậm quyết thì MT-3 không bắt đầu được | Chủ dự án, Kế toán và Luật sư của nền tảng |

#### B.2 Nhóm P1: chặn mở đăng ký công khai (kết thúc MT-1)

| Mã | Câu hỏi | Khuyến nghị BA | Ai trả lời |
| --- | --- | --- | --- |
| Q8 | Vai trò bên kiểm soát/bên xử lý dữ liệu, DPA, chuyển dữ liệu ra nước ngoài (Singapore) cho tenant tự đăng ký, thông báo sự cố | Văn bản của luật sư trước khi mở đăng ký | Luật sư |
| Q30 | Điều khoản dịch vụ và DPA chấp nhận điện tử (click-wrap): hiệu lực, người có thẩm quyền chấp nhận, bằng chứng lưu, đổi điều khoản một phía, luật áp dụng, giới hạn trách nhiệm | Luật sư soạn bản chuẩn có phiên bản; lưu phiên bản và thời điểm chấp nhận (RULE-029) | Luật sư |
| Q28 | Mức xác minh tenant mới: tra cứu MST ở nguồn nào, có cần giấy đăng ký kinh doanh, xác thực người đại diện, tự động hay duyệt tay; có nhận cá nhân hoặc hộ kinh doanh không; ngoại lệ cho RULE-032 (nhượng quyền, nhiều thương hiệu cùng pháp nhân); đường khiếu nại khi bị từ chối | Tự động MST và duyệt tay ca bị cờ; chỉ nhận doanh nghiệp, hộ kinh doanh có MST (giả định, cần xác nhận) | Chủ dự án, Luật sư |
| Q29 | Chính sách chống lạm dụng: chỉ nhận đăng ký từ Việt Nam hay không, trần tenant mới mỗi giờ/ngày, chi phí tối đa cho tenant chưa trả tiền, danh sách chặn, xử lý tài khoản spam | Trần thấp lúc đầu, tăng dần khi có dữ liệu; con số do owner chọn (NFR-TEN-07) | Chủ dự án |
| Q31 | Hóa đơn điện tử theo từng tenant: nền tảng tích hợp sẵn những nhà cung cấp nào; tenant tự có hợp đồng nhà cung cấp và chứng thư số; nền tảng có làm đại lý hay không; ai trả phí nhà cung cấp; nơi giữ bí mật của tenant | Tenant tự có nhà cung cấp và chứng thư; nền tảng không phát hành thay (RULE-025); danh sách nhà cung cấp hỗ trợ là quyết định thương mại và kỹ thuật | Chủ dự án, Dev, Kế toán |
| Q9, Q23, Q33 | SLA, RPO/RTO, giờ và kênh hỗ trợ cho tenant tự phục vụ; hỗ trợ có tính phí không; mức hỗ trợ khi chưa thu phí | Công bố mức tối thiểu trước khi mở; giữ NFR-AVA-01, 02 nếu chưa có cam kết khác | Chủ dự án |
| Q35 | Đối tượng tenant mục tiêu: chỉ chuỗi garage, hay cả gara đơn lẻ và hộ kinh doanh; có tenant ngoài Việt Nam (Q15) | Chỉ Việt Nam; phạm vi đối tượng do owner chọn, ảnh hưởng xác minh, quota nhỏ nhất, độ phức tạp wizard | Chủ dự án |
| Q14, Q8 | (đã nêu ở P0 và trên) | | |

#### B.3 Nhóm P2: chặn thu tiền (MT-2, MT-3) hoặc ảnh hưởng thiết kế chi tiết

| Mã | Câu hỏi | Ghi chú |
| --- | --- | --- |
| Q13 | Gói và hạn mức: chiều tính, ngưỡng cảnh báo, mềm hay cứng | Bắt đầu một đến hai chiều (số chi nhánh, số người dùng) |
| Q21, Q34 | Dùng thử hay early access: thời lượng, giới hạn, dữ liệu sau hết hạn (RULE-030 là sàn: không xóa) | Quyết trước khi mở đăng ký để ToS nêu đúng (thuê bao `none` hay `trial`) |
| Q16 | Danh mục pháp lý do nền tảng cập nhật chung, tenant ghi đè không, ai chịu trách nhiệm | FR-TEN-019 đã lên Must; khuyến nghị nền tảng chịu trách nhiệm |
| Q6 | Thương hiệu, tên miền con hay riêng | Liên quan Q25 |
| Q10, Q18, Q24 | Truy cập và tổng hợp dữ liệu, phát hành phiên bản và nhóm thử, số người và phê duyệt hai người cho vai trò nền tảng | |
| Q17 | Chỉ cấu hình, không mã riêng theo tenant | Đã suy ra từ D2, chờ xác nhận |

#### B.4 Nhóm P3: câu cũ vẫn mở, không chặn sớm

Q2 (quy mô; thực ra cần cùng P0 vì ảnh hưởng Q3), Q7 (chấm dứt và lưu trữ), Q15 (phạm vi địa lý), Q19 (chia sẻ dữ liệu giữa tenant), Q20 (chính sách lưu trữ mặc định), Q22 (sáp nhập, tách tenant). Ghi chú: **Q2 nên được trả lời cùng nhóm P0** vì quyết định mô hình cô lập cần con số tenant và quy mô.

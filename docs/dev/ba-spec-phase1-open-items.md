# Đặc tả đề xuất cho bốn mục còn mở của Phase 1 (BA, 05/11/2026)

Phiên bản 0.1 · Người lập: BA · Trạng thái: **BA đề xuất, chờ Chủ dự án và khách xác nhận**. Tài liệu này chưa sửa FRD, BRD hay Journey; phần "Tác động tài liệu" ở cuối mỗi mục liệt kê việc cần sửa khi được chốt. Mã `OI-…` là mã tạm của tài liệu này để dev và test trích dẫn; chưa phải mã chính thức trong FRD (mã FR mới, nếu có, sẽ thêm vào cuối module khi được duyệt, không đổi số cũ).

Căn cứ: `ba-answers-for-dev.md` §25 (F-1, Q-B, Q-C), §24 (R94, R97, R104 đến R106); `plan-next-work.md` mục 4d, 5d; `status.md` mục (8); `stream-a-findings.md` F-1; `open-questions-for-ba.md` (R62, R97, R106, F-1); FRD FR-ACC-004, 005, 012, FR-CRM-003, 004, 010, 011, 014, 018, FR-INS-001 đến 009, UAT-07, 10, 15, 18, NFR-ISO-01; BRD BR-INS-01, BR-ACC-05, RULE-007, 010; `implementation-plan.md` §Giai đoạn 1.

Quy ước: `[Cần xác nhận: bên quyết định]` là quyết định còn mở, dev **không** hard-code; giá trị "mặc định đề xuất" chỉ là giá trị cấu hình khởi điểm để dev chạy được, không phải quyết định. Mục nào dev làm được ngay mà không cần chốt thì ghi rõ "dev làm được ngay".

## 0. Bảng tóm tắt

| # | Mục | Tình trạng | Dev làm được ngay | Cần chốt (tóm tắt) |
| --- | --- | --- | --- | --- |
| 1 | F-1 ghi chéo chi nhánh | Đã chặn (409 `switch_branch_required`, `status.md` mục 8); còn thiếu quy tắc cho thực thể có liên kết nhiều chi nhánh và ngoại lệ cấp công ty | Có: thêm test và thông điệp; không đổi hành vi | Ghi khách/xe liên kết nhiều chi nhánh; chế độ hợp nhất; thông điệp có nêu chi nhánh không |
| 2 | Khóa kỳ tháng (FR-ACC-005) | Hoãn Phase 2/3 (§25 Q-B); chưa có định nghĩa chốt | Chỉ giữ một điểm kiểm tra ngày chốt và `businessDate` | Định nghĩa kỳ, hạn khóa, ai khóa, chứng từ EIN/INV thuộc kỳ nào, định dạng xuất kỳ |
| 3 | Gộp khách trùng (R97, FR-CRM-003) | Hoãn Phase 2 (§25 Q-C) | Không | Khóa nhận diện, quyền duyệt, đồng ý khi mâu thuẫn, hoàn tác, cách xử lý chứng từ ghi sổ |
| 4 | INS (slice 1.10) | Chưa xây; chờ BA-19 | Không (không dựng INS khi chưa có xác nhận) | Pilot có kiểm tra xe số không, có video không |

---

## 1. F-1: ghi chéo chi nhánh (NFR-ISO-01, BA §25 F-1(3))

### 1.1 Hiện trạng và lời đính chính

- `open-questions-for-ba.md` dòng "F-1 ghi chéo (dev, 04/11/2026)" nêu khoảng trống: CH đang chọn Q7 sửa được xe của Thủ Đức (PATCH vehicle 200). Dòng ngay sau và `status.md` mục (8) cho biết **đã chặn** (409 `switch_branch_required`); `isolation-matrix.test.ts` ca "BA §25 F-1(3)" khẳng định xe, khách, kho của Thủ Đức bị chặn khi CH làm việc ở Q7, cho phép khi chuyển sang Thủ Đức, và giữ nguyên khi chưa chọn chi nhánh. Vậy khoảng trống 200 **chỉ còn đúng với xe hoặc khách có liên kết (`branchIds`) tới cả Q7 và Thủ Đức**, vì phạm vi ghi bị thu hẹp về chi nhánh làm việc nên bản ghi nào có liên kết tới Q7 thì sửa được. Dev cần xác nhận lại ca nào đang trả 200 trước khi coi mục này là lỗi.
- Quy tắc hiện đã cài: quyền ghi (`create`, `update`, `archive`, `approve`, `reject`, `manage`) thu hẹp về chi nhánh làm việc khi đã chọn; đọc, xuất giữ phạm vi quyền (khoan sâu và liên kết vẫn mở); tài nguyên cấp công ty không thu hẹp (`COMPANY_LEVEL_RESOURCES`); 404 của thao tác ghi đổi thành 409 cho người có phạm vi rộng hơn chi nhánh làm việc; người một chi nhánh vẫn 404.
- Không mâu thuẫn với F-1(1) đến (5) ở §25; phần dưới là làm rõ phần BA §25 chưa nói: thực thể có liên kết nhiều chi nhánh và danh sách ngoại lệ.

### 1.2 Quy tắc đề xuất

| Mã | Quy tắc | Căn cứ |
| --- | --- | --- |
| OI-1.1 | **Bản ghi thuộc một chi nhánh** (lệnh, báo giá, chứng từ kho, phiếu thu/chi, ca, chốt ngày, hóa đơn, kho, lịch hẹn): thao tác ghi chỉ thực hiện khi `branchId` của bản ghi bằng chi nhánh làm việc. Khác chi nhánh: từ chối 409 `switch_branch_required`, không thay đổi dữ liệu | NFR-ISO-01; §25 F-1(3); RULE-007 |
| OI-1.2 | **Khách và xe là bản ghi cấp công ty có liên kết chi nhánh** (BA §10.1.5, `Customer.branchIds`, `Vehicle.branchIds`): được ghi khi **chi nhánh làm việc nằm trong danh sách liên kết**; không nằm trong danh sách thì 409 `switch_branch_required` cho người có phạm vi rộng, 404 cho người một chi nhánh. Lý do: xe sửa ở Q7 rồi vào Thủ Đức phải cập nhật số km, chủ xe ngay khi tiếp nhận (FR-REC-002, FR-CRM-014); chặn ghi theo "chi nhánh gốc" sẽ chặn luồng tiếp nhận. `[Cần xác nhận: Chủ dự án]` (mục 1.4, câu F1-1) |
| OI-1.3 | **Ngoại lệ cấp công ty** không bị chặn khi ghi, ghi theo phạm vi quyền: tổ chức (`org`), vai trò (`role`), người dùng (`user`), cấu hình có hiệu lực theo ngày và danh mục công ty (`acc-policy`, `approval-limit`, `cost-method`, `discount-limit`, `consent-evidence`, `doc-template`, `einvoice-config`, `inventory-policy`, `numbering-series`, `part-catalog`, `price-list`, `report-config`, `service-catalog`, `tax-rate`). Điều kiện đi kèm: mọi thay đổi vẫn qua đề xuất và duyệt hoặc nhật ký như hiện hành (FR-SYS-004); cấu hình có phạm vi chi nhánh (ví dụ đơn giá giờ công, hạn mức giảm giá theo chi nhánh) ghi theo **chi nhánh đích của dòng cấu hình**, và nếu khác chi nhánh làm việc thì áp OI-1.1. `[Cần xác nhận: Chủ dự án]` danh sách đúng chưa (đã hỏi ở mục F-1 của open-questions, mục (a)) |
| OI-1.4 | **Người dùng** là bản ghi cấp công ty nhưng gán vai trò theo chi nhánh: sửa hồ sơ chung (tên, email) không bị chặn; **gán, đổi, thu hồi vai trò theo một chi nhánh** là thao tác thuộc chi nhánh đó, cần quyền ở chi nhánh đó, không cần chuyển chi nhánh làm việc nếu người thực hiện là CH (quyền cấp công ty) và có lý do ghi nhật ký. Đề xuất giữ hành vi hiện tại (không chặn) cho `user`; chặn chỉ bằng quyền và duyệt N3 (open-questions) | N3, FR-SYS-004 |
| OI-1.5 | **Chế độ hợp nhất** (chưa chọn chi nhánh, `scope_merged`): giữ như nay. Thao tác ghi cần chi nhánh làm việc trả `scope_merged` (409) và hướng dẫn chọn chi nhánh; không cho ghi "ngầm" ở chế độ hợp nhất. Ngoại lệ OI-1.3 vẫn ghi được | NFR-ISO-01 |
| OI-1.6 | **Duyệt** (`approve`/`reject`) bản ghi của chi nhánh khác: cùng quy tắc ghi (đã có trong `acc.test.ts`: chủ đang làm ở chi nhánh khác thấy `decide.allowed=false` với lý do `switch_branch_required`). Hộp thư duyệt hợp nhất vẫn **liệt kê** yêu cầu mọi chi nhánh trong quyền (đọc) kèm nhãn chi nhánh và nút "Chuyển sang chi nhánh X để duyệt" | §25 F-1(2), (3) |
| OI-1.7 | **Đọc** không đổi: 200 trong phạm vi quyền, kèm nhãn "thuộc chi nhánh X, khác chi nhánh đang làm việc" (việc của designer/dev; DTO lệnh chưa có nhãn, `status.md` mục (7)) | §25 F-1(2) |
| OI-1.8 | **Cron, hệ thống** (`system:cron`) không chịu rào chi nhánh làm việc (không có phiên); vẫn phải qua kiểm tra phạm vi theo từng chi nhánh | A1 (cron) |

### 1.3 Mã lỗi và thông điệp

- Mã trạng thái 409, `code: switch_branch_required`, dạng RFC 9457 (đang dùng). Thông điệp hiện tại: "Hãy chuyển sang chi nhánh của bản ghi này trước khi sửa". Giữ.
- Thân lỗi **không** chứa mã, tên chi nhánh đích hay dữ liệu của bản ghi (kiểm thử đã khẳng định thân lỗi không có `ZZTD`). Lý do: dev không phân biệt được "id không tồn tại" với "bản ghi chi nhánh khác" mà không đọc thêm, và nhất quán với việc người phạm vi rộng nhận 409 cho cả hai trường hợp (không lộ sự tồn tại; chấp nhận hệ quả này, `status.md` mục (8)).
- `[Cần xác nhận: Chủ dự án]` câu F1-3: có muốn thông điệp nêu tên chi nhánh đích để một thao tác chuyển chi nhánh nhanh hơn không. Đề xuất mặc định: **không** ở pilot. Tác động nếu có: thêm một lần đọc có kiểm quyền cho mỗi lần bị chặn; chỉ nêu tên khi bản ghi nằm trong phạm vi đọc của người dùng.
- Mã lỗi `scope_merged` giữ cho chế độ hợp nhất. Màn hình: hộp thoại có nút "Chuyển chi nhánh" mở bộ chọn phạm vi, sau khi chuyển quay lại bản ghi và giữ nguyên dữ liệu người dùng đã nhập nếu form chưa gửi (đề xuất cho designer, chưa có trong design).

### 1.4 Câu hỏi cho Chủ dự án (khách)

| # | Câu hỏi | Lựa chọn | Đề xuất | Tác động |
| --- | --- | --- | --- | --- |
| F1-1 | Khách hoặc xe có liên kết với nhiều chi nhánh: chi nhánh nào được sửa? | (A) mọi chi nhánh có liên kết (hiện tại); (B) chỉ chi nhánh tạo bản ghi, chi nhánh khác chỉ đọc và phải gửi yêu cầu sửa; (C) chia theo trường: trường nhận diện (tên, SĐT, số khung) chỉ chi nhánh tạo hoặc cấp công ty sửa, trường vận hành (số km, ghi chú, nhãn) mọi chi nhánh có liên kết | (A) cho pilot một chi nhánh (chưa có ghi chéo thực tế); xem lại (C) trước đợt mở rộng chi nhánh thứ hai (R1) | (B) chặn cập nhật số km khi tiếp nhận ở chi nhánh khác, làm hỏng luồng REC; (C) cần danh sách trường và thêm luồng yêu cầu sửa |
| F1-2 | CH ở chế độ hợp nhất (chưa chọn chi nhánh) có được ghi bản ghi chi nhánh bất kỳ không | (A) không, bắt chọn chi nhánh (hiện tại); (B) được, có ghi nhật ký | (A) | (B) làm mất mục đích của rào F-1(3) (sửa nhầm) |
| F1-3 | Thông điệp 409 có nêu tên chi nhánh đích không | Có / Không | Không | Xem mục 1.3 |
| F1-4 | Danh sách ngoại lệ cấp công ty (OI-1.3) và việc gán vai trò theo chi nhánh (OI-1.4) đúng chưa | Đúng / sửa | Đúng như OI-1.3, OI-1.4 | Thêm một tài nguyên vào danh sách là đổi dữ liệu cấu hình, không đổi nghiệp vụ |

### 1.5 Tiêu chí chấp nhận (Given/When/Then)

1. **Bản ghi một chi nhánh bị chặn.** Given CH đang chọn chi nhánh Q7, And lệnh L thuộc Thủ Đức. When CH gọi thao tác ghi lên L (sửa, duyệt, đảo, chốt). Then 409 `switch_branch_required`, dữ liệu và `version` không đổi, nhật ký ghi lần bị từ chối không chứa dữ liệu cá nhân. (NFR-ISO-01)
2. **Xe liên kết.** Given xe X có `branchIds` = [Thủ Đức], CH đang ở Q7. When PATCH X. Then 409 `switch_branch_required`. Given X có `branchIds` = [Q7, Thủ Đức] và CH đang ở Q7. When PATCH X. Then 200 và nhật ký ghi chi nhánh làm việc Q7 (theo mặc định F1-1 phương án A; test phải đổi nếu Chủ dự án chọn B hoặc C).
3. **Chuyển chi nhánh.** Given 409 ở ca 1. When CH chuyển chi nhánh làm việc sang Thủ Đức và gửi lại với khóa idempotency mới. Then 200.
4. **Ngoại lệ cấp công ty.** Given CH đang ở Q7. When đề xuất `tax-rate` (hoặc tạo vai trò). Then thành công, không phải chuyển chi nhánh.
5. **Hợp nhất.** Given CH chưa chọn chi nhánh. When sửa xe. Then 409 `scope_merged`, không phải `switch_branch_required`.
6. **Người một chi nhánh.** Given QL Q7. When sửa bản ghi Thủ Đức hoặc id không có thật. Then 404 giống hệt nhau (cùng mã, cùng thân lỗi).
7. **Đọc.** Given CH ở Q7. When GET bản ghi Thủ Đức theo id. Then 200 (kèm nhãn chi nhánh khi DTO có); danh sách và xuất chỉ có Q7.
8. **Thân lỗi sạch.** Phản hồi 409 không chứa tên, mã, địa chỉ chi nhánh đích hoặc trường của bản ghi.
9. **Duyệt.** Given chủ đang ở chi nhánh khác chi nhánh của yêu cầu. When bấm duyệt. Then 409 `switch_branch_required` và giao diện hiện nút chuyển chi nhánh; yêu cầu vẫn thấy trong hộp thư duyệt.

### 1.6 Ca test cho dev

Đã có: `tests/unit/rbac-write-fence.test.ts`, `isolation-matrix.test.ts` (CRM xe/khách, SYS kho), `acc.test.ts` (duyệt). Cần thêm: (a) ca 2 với xe và khách có `branchIds` nhiều chi nhánh (hiện chưa có ví dụ trong ma trận); (b) ca 4 với cấu hình có phạm vi chi nhánh; (c) ca 8 (thân lỗi) cho mọi module ghi; (d) ca 9 ở mức giao diện (e2e); (e) rà mọi route ghi mới (REC, INV, EIN) đều đi qua `authed`/`resolveScope` (đã có trong ma trận route GET; bổ sung cho route ghi).

### 1.7 Tác động tài liệu

FRD NFR-ISO-01 (đã nêu ở §25.3, thêm OI-1.2 và OI-1.5); UAT mới "ghi chéo chi nhánh" (UAT-06 mở rộng); `ba-answers-for-dev.md` §25 F-1 ghi nhận bản này; Journey: thêm ngoại lệ "bị chặn vì khác chi nhánh làm việc" ở workflow chuyển chi nhánh; designer: nhãn chi nhánh và nút chuyển. BRD: không đổi.

---

## 2. Khóa kỳ tháng (FR-ACC-005, R106(e), câu 57, 59)

### 2.1 Phát hiện về tài liệu

- FR-ACC-005 trong FRD ghi **Must** nhưng FRD §13 và `implementation-plan.md` đưa vào Phase 1 chỉ FR-ACC-001 đến 004 (chốt ngày); khóa kỳ không nằm trong Phase 1. §25 Q-B đã đề xuất xếp Phase 2/3 cùng FR-ACC-012. **Đề xuất sửa:** hạ FR-ACC-005 xuống Should hoặc giữ Must nhưng ghi rõ phase 2/3; cần Chủ dự án chọn (câu P-1).
- "Mở lại ngày" (R62, R106, đã cài) khác "mở lại kỳ": mở lại ngày chỉ cho ngày làm việc hiện tại và không đụng ngày đã chốt trong quá khứ; ngày cũ sửa bằng phiếu đảo ghi vào ngày đang mở.
- Hiện trạng dữ liệu (`status.md` mục (7)): chứng từ tiền của ACC có `businessDate` và `branchId`, đi qua `loadMoneyCtx`/`assertDayOpen`; phiếu kho INV có `businessDate`; **hóa đơn EIN chỉ có `issuedAt`**, INV và EIN không kiểm "ngày đã chốt". Đây là điều kiện tiên quyết cần quyết định trước khi làm khóa kỳ (OI-2.6).
- Mâu thuẫn nhỏ: câu 59 (§25.4) nói "ai khóa" theo bảng Q-B; câu 57 chỉ hỏi mở lại ngày. Bản này gộp hai câu.

### 2.2 Quy tắc đề xuất (cho khi làm ở Phase 2/3)

| Mã | Chủ đề | Quy tắc đề xuất |
| --- | --- | --- |
| OI-2.1 | Định nghĩa kỳ | Mặc định **tháng dương lịch theo từng chi nhánh** (kỳ `YYYY-MM`, múi giờ `Asia/Ho_Chi_Minh`). Kiểu kỳ và hạn khóa là **cấu hình có ngày hiệu lực** (`period-policy`), không hard-code, để đổi kỳ (ví dụ kỳ lệch ngày 26 đến 25) hay thêm pháp nhân không sửa mã. Bản đầu chỉ hỗ trợ tháng lịch. `[Cần xác nhận: Kế toán khách]` (P-2) |
| OI-2.2 | Thời điểm khóa | Không khóa kỳ chưa kết thúc (không khóa tháng đang chạy). Khóa sau ngày cuối tháng; **hạn khóa** là cấu hình (khởi điểm gợi ý: ngày làm việc thứ 5 của tháng sau; đây là giả định BA, chờ kế toán). Quá hạn: nhắc KT và CH trong ứng dụng, không tự khóa (khóa tự động là quyết định mở) |
| OI-2.3 | Ai khóa, ai mở | Khóa: KT cho chi nhánh trong phạm vi quyền; CH khóa mọi chi nhánh; QL chi nhánh **không** khóa. Mở lại: chỉ **CH duyệt** (người đề xuất mở là KT hoặc CH), nhập lại mật khẩu, lý do bắt buộc, duyệt dùng một lần có hạn dùng (khởi điểm 4 giờ; ngày là 2 giờ, R106; giá trị kỳ là giả định), nhật ký bất biến, **mọi lần mở lại kỳ** là ngoại lệ báo CH và KT (khác ngày: không có ngưỡng 3 lần). Không mở kỳ khi kỳ sau đã khóa (mở theo thứ tự ngược). `[Cần xác nhận: Chủ dự án]` (P-3) |
| OI-2.4 | Điều kiện khóa (kiểm tra theo kỳ và chi nhánh) | **Chặn:** còn ngày chưa chốt (FR-ACC-004), liệt kê từng ngày; còn chênh lệch quỹ chưa giải trình; còn đề xuất chi hoặc hoàn tiền đang chờ duyệt; còn phiếu kho nháp có `businessDate` trong kỳ; còn ca đang mở; kỳ trước chưa khóa. **Cảnh báo, không chặn:** lệnh đã giao chưa có hóa đơn; lô hóa đơn trong hàng chờ lỗi; lệnh còn mở xuyên kỳ. Kiểm tra trả danh sách đầy đủ, không dừng ở lỗi đầu tiên |
| OI-2.5 | Chứng từ bị khóa | Theo `businessDate` của chứng từ (không theo ngày nhập): phiếu thu, phiếu chi, hoàn cọc, hoàn tiền, ca, chốt ngày, sổ quỹ, phiếu kho ghi sổ (nhập, xuất, hoàn, điều chỉnh, kiểm kê), phiếu đảo. **Không tạo mới, không ghi sổ, không đảo trực tiếp** chứng từ có `businessDate` trong kỳ khóa. Đọc, in, xuất vẫn được |
| OI-2.6 | EIN và INV | Hóa đơn điện tử cần `businessDate` (đề xuất: ngày phát hành theo múi giờ Việt Nam, suy từ `issuedAt`, dữ liệu cũ tính ngược khi di chuyển). Hóa đơn đã phát hành không sửa, xử lý bằng điều chỉnh hoặc thay thế (FR-EIN-012, RULE-010); hóa đơn điều chỉnh và hóa đơn **mới phát hành sau khi kỳ khóa** mang ngày phát hành trong kỳ đang mở. Nội dung ngày hóa đơn đúng luật do kế toán, luật sư xác nhận (NĐ 254/2026/NĐ-CP). Lệnh giao tháng trước mà phát hành hóa đơn tháng sau: doanh thu quản trị tính theo kỳ nào thì `[Cần xác nhận: Kế toán khách]` (P-4) |
| OI-2.7 | Sửa sau khóa | Không sửa, không xóa (RULE-010). Sai sót kỳ khóa: phiếu đảo và phiếu mới ghi vào **kỳ đang mở**, có liên kết chứng từ gốc và nhãn "điều chỉnh kỳ trước"; hiện trong báo cáo ngoại lệ và trên bảng đối chiếu kỳ. Báo cáo kỳ cũ giữ số lúc khóa (ảnh chụp tổng), kèm dòng "điều chỉnh sau khóa" nếu có |
| OI-2.8 | Quan hệ với chốt ngày | Chốt ngày (FR-ACC-004) là điều kiện cần của khóa kỳ; khóa kỳ chặn **mở lại ngày** của mọi ngày trong kỳ (phải mở lại kỳ trước, rồi mới mở lại ngày). Mở lại ngày trong tháng đang mở giữ nguyên R106. Hai cơ chế dùng **một điểm kiểm tra duy nhất** (hiện là `assertDayOpen`): thêm kiểm tra kỳ vào đó, không rải ở từng module |
| OI-2.9 | Xuất kỳ cho phần mềm kế toán | Chỉ xuất kỳ **đã khóa**. Mỗi lần xuất có số phiên bản, ảnh chụp tổng, người xuất, thời điểm, tổng kiểm (checksum); xuất lại cùng kỳ và cùng phiên bản cho cùng tệp (idempotent). Mở lại kỳ đã xuất: cần xác nhận thêm của KT và đánh dấu mọi lần xuất cũ "lỗi thời"; kỳ khóa lại và xuất lại có số phiên bản mới, tệp ghi rõ thay thế phiên bản nào (tránh nhập hai lần vào phần mềm đích). Định dạng và phần mềm đích: `[Cần xác nhận: Kế toán khách]` (FR-ACC-012, P-5). Không ghi sổ kép (BRD: hệ thống không thay phần mềm kế toán) |
| OI-2.10 | Dữ liệu | Bản ghi kỳ (khóa theo công ty, chi nhánh, mã kỳ) có trạng thái `open`, `locked`, `reopened`; người khóa, thời điểm, ảnh chụp tổng, danh sách lần mở lại và lần xuất. Lịch sử trạng thái bất biến. Dev chọn cách lưu; ghi chú: ngân sách chỉ mục composite còn 2 chỗ trước ngưỡng fail (193/195), thiết kế phải đọc theo khóa, không thêm chỉ mục mới (dev xác nhận) |
| OI-2.11 | Phân quyền | Quyền mới đề xuất: `period:view` (CH, KT, QV), `period:lock` (CH, KT), `period:reopen-request` (KT, CH), duyệt mở lại theo luồng duyệt có sẵn (CH). Ma trận chính thức do Chủ dự án chốt (Q1) |

### 2.3 Câu hỏi cho khách

| # | Gửi | Câu hỏi | Lựa chọn | Đề xuất | Tác động |
| --- | --- | --- | --- | --- | --- |
| P-1 | Chủ dự án | FR-ACC-005 ở phase nào và mức ưu tiên | Phase 2 (cùng ACC); Phase 3 (cùng xuất kỳ); đưa vào pilot | Phase 3 cùng FR-ACC-012 (khóa kỳ chỉ có ý nghĩa khi có xuất kỳ và KT đối chiếu); pilot giữ chốt ngày và mở lại ngày | Đưa vào pilot: thêm ước tính cho slice, cần kế toán tham gia ngay |
| P-2 | Kế toán khách | Kỳ kế toán của khách có phải tháng dương lịch cho mọi chi nhánh không; có pháp nhân riêng cần kỳ riêng không | Tháng lịch; kỳ lệch ngày; theo pháp nhân | Tháng lịch theo chi nhánh | Kỳ khác: cấu hình kỳ phức tạp hơn, ảnh hưởng báo cáo tháng RPT |
| P-3 | Chủ dự án | Ai khóa, ai mở lại | KT khóa + CH mở (đề xuất); chỉ CH khóa và mở; KT khóa và mở có CH biết | KT khóa, CH duyệt mở | KT tự mở lại: yếu về kiểm soát, trái nguyên tắc người duyệt khác người đề xuất (R59) |
| P-4 | Kế toán khách | Doanh thu và giá vốn quản trị tính theo kỳ nào: ngày giao xe, ngày thu tiền hay ngày phát hành hóa đơn; hóa đơn phát hành tháng sau cho lệnh giao tháng trước | Ngày giao; ngày hóa đơn; ngày thu | Chưa đề xuất giá trị: cần ví dụ số kế toán ký (NFR-MNT-01) | Ảnh hưởng điều kiện khóa (cảnh báo lệnh chưa hóa đơn) và báo cáo lợi nhuận |
| P-5 | Kế toán khách | Phần mềm kế toán đích và định dạng nhập; có nhập lại được kỳ đã nhập (thay thế) hay chỉ nhập mới | Tên phần mềm; CSV/Excel/XML | Chờ khách; thiết kế phiên bản xuất theo OI-2.9 | Nếu phần mềm đích không thay thế được: quy trình mở lại kỳ đã xuất phải xuất bút toán chênh lệch thay vì xuất lại cả kỳ |
| P-6 | Chủ dự án, KT | Hạn khóa sau cuối tháng và có tự khóa khi quá hạn không | Ngày thứ N; nhắc không tự khóa; tự khóa | Nhắc, không tự khóa; N do kế toán chọn | Tự khóa có thể khóa khi còn chênh lệch chưa giải trình |

### 2.4 Tiêu chí chấp nhận (khi làm)

1. Khóa bị chặn khi còn ngày chưa chốt: lỗi liệt kê đủ các ngày chưa chốt và các điều kiện chặn khác (OI-2.4); kỳ chưa kết thúc không khóa được.
2. Sau khóa, tạo, ghi sổ, đảo trực tiếp phiếu thu, chi, hoàn, kho có `businessDate` trong kỳ bị từ chối với mã `period_locked` (mã đề xuất) và thông điệp hướng dẫn "ghi phiếu đảo vào kỳ đang mở".
3. Phiếu đảo ghi vào kỳ đang mở, có liên kết gốc và nhãn "điều chỉnh kỳ trước"; báo cáo kỳ đã khóa giữ số lúc khóa.
4. Mở lại kỳ: thiếu mật khẩu, thiếu lý do, người duyệt trùng người đề xuất, duyệt hết hạn, hoặc kỳ sau đã khóa: đều bị từ chối; duyệt dùng một lần; CH và KT nhận thông báo ngoại lệ mỗi lần mở.
5. Mở lại ngày trong kỳ đã khóa bị chặn; mở lại ngày trong kỳ đang mở giữ nguyên R106.
6. Xuất kỳ chưa khóa bị chặn; xuất lại cùng kỳ cùng phiên bản cho cùng tệp; mở lại kỳ đã xuất đánh dấu lần xuất cũ "lỗi thời" và lần xuất mới có phiên bản mới.
7. Khóa kỳ của chi nhánh A không ảnh hưởng chi nhánh B; người ngoài phạm vi 404 (NFR-ISO-01).
8. Hóa đơn: có `businessDate`, hóa đơn phát hành sau khóa nằm ở kỳ đang mở; hóa đơn đã phát hành không bị sửa.
9. Mọi thao tác khóa, mở, xuất có nhật ký, không chứa dữ liệu cá nhân.

### 2.5 Việc cho dev ngay bây giờ (không dựng khóa kỳ)

(1) Giữ đúng một điểm kiểm tra ngày chốt cho mọi chứng từ tiền, kho; (2) kế hoạch thêm `businessDate` cho hóa đơn EIN (chỉ lập kế hoạch, thay đổi dữ liệu chờ P-4); (3) không thêm chỉ mục. Đã đúng với `status.md` mục (7).

### 2.6 Tác động tài liệu

FRD FR-ACC-005 (thêm OI-2.1 đến 2.9, đổi phase, thêm tiêu chí), FR-ACC-012, FR-EIN (thêm `businessDate`); BRD BR-ACC-05 ghi nhận phạm vi; Journey: workflow khóa kỳ và ngoại lệ mở lại; UAT mới "Khóa kỳ" cạnh UAT-07, 08; traceability FR-ACC-005 đến UAT; designer: màn khóa kỳ (chưa có, hoãn).

---

## 3. Gộp khách trùng (R97, FR-CRM-003)

### 3.1 Phát hiện về tài liệu

- FR-CRM-003 viết "theo điện thoại **hoặc biển số**"; nhưng biển số duy nhất toàn hệ thống (FR-CRM-002) và xe đổi chủ giữ lịch sử (FR-CRM-014). Hai khách cùng biển số chỉ xảy ra khi xe đã đổi chủ (không phải trùng), còn khách tạo hai lần ở hai chi nhánh với cùng xe bị chặn bởi biển số duy nhất. **Biển số và số khung không phải khóa nhận diện khách trùng**; §25 Q-C ghi "biển số/số khung", cần sửa. Đề xuất sửa FR-CRM-003 như OI-3.1.
- §25 Q-C loại khách doanh nghiệp khỏi gợi ý tự động; yêu cầu mới ở đây dùng MST làm khóa mạnh cho khách doanh nghiệp. Đây là thay đổi so với §25, cần xác nhận (câu M-1).
- R97 trong công cụ nhập: không gộp theo SĐT, chỉ cảnh báo, không lộ khách ngoài phạm vi; phần đó giữ nguyên, không thuộc mục này.
- Hiện trạng: dữ liệu CRM gồm `Customer` (mã `KH-<MÃCN>-<STT>`, `status` `active` hoặc `anonymized`, `branchIds`), `CustomerPii` (SĐT, email, địa chỉ ở tài liệu riêng), `CustomerLink` theo chi nhánh, quan hệ sở hữu xe có hiệu lực, đồng ý, yêu cầu chủ dữ liệu, `CustomerRetentionPort` (chưa xác minh trong lượt này việc REC/ACC/EIN đã nối cổng thật hay còn stub; `open-questions-for-ba.md` C17 từng ghi là stub; dev xác nhận). Lịch sử xe xuyên chi nhánh (`VehicleHistoryEntry`) không chứa mã khách nên không bị ảnh hưởng.

### 3.2 Quy tắc đề xuất

| Mã | Chủ đề | Quy tắc đề xuất |
| --- | --- | --- |
| OI-3.1 | Khóa nhận diện (chỉ **gợi ý**, không bao giờ tự gộp) | (a) Khách doanh nghiệp: **cùng MST** (MST 10 số của pháp nhân; MST 13 số của đơn vị phụ thuộc là mã khác, không gợi ý trùng với trụ sở). (b) Khách cá nhân: **cùng SĐT chuẩn hóa và tên chuẩn hóa không dấu giống hoặc gần giống**; SĐT một mình không đủ (gia đình, công ty dùng chung, R97). (c) Biển số và số khung: **không dùng**. Gợi ý chỉ hiện cho người có quyền xem cả hai hồ sơ trong phạm vi của mình (không lộ khách ngoài phạm vi); tra cứu chính xác xuyên chi nhánh (C9) vẫn là con đường tìm khách ở chi nhánh khác. Hai khách khác loại (cá nhân và doanh nghiệp) không gộp được |
| OI-3.2 | Điều kiện cho phép gộp | Cả hai `active` (không gộp hồ sơ `anonymized` hoặc đã gộp); không có yêu cầu xóa của chủ dữ liệu đang mở ở bên nào (chặn đến khi xử lý xong, §25); không có yêu cầu chủ dữ liệu khác đang ở bước đang xử lý dở mà thay đổi dữ liệu (xem OI-3.6); cả hai nằm trong phạm vi quyền của người gộp |
| OI-3.3 | Bản ghi giữ lại | Người gộp chọn; **mặc định là bản tạo sớm hơn** (mã khách ổn định). Bản bị gộp chuyển sang trạng thái `merged` (giá trị mới của `CustomerStatus`), có `mergedInto`, **không xóa**, mã không tái dùng, tra bằng mã cũ dẫn tới bản giữ. Trường dữ liệu (tên, SĐT, email, địa chỉ, MST, người liên hệ): mặc định lấy của bản giữ; người gộp được chọn từng trường lấy từ bản kia. Giá trị của bản bị gộp **không** giữ trong hồ sơ sau gộp (tối thiểu hóa dữ liệu, PDPL) ngoài bản đồ chuyển phục vụ hoàn tác (OI-3.8) |
| OI-3.4 | Xe và quan hệ sở hữu (FR-CRM-014) | Mọi quan hệ sở hữu có hiệu lực (từ ngày đến ngày) của bản bị gộp chuyển sang bản giữ, **giữ nguyên ngày hiệu lực**, kể cả hai khoảng liên tiếp cùng một chủ (không gộp khoảng, giữ lịch sử). Nếu hai khoảng sở hữu **cùng một xe chồng lấn** thời gian thì chặn gộp và báo xe nào (lỗi dữ liệu, xử lý thủ công). `currentOwnerId` và `vehicleCount` tính lại. Xe không bị gộp (biển số duy nhất). Lịch sử sửa chữa xe giữ nguyên |
| OI-3.5 | Đồng ý (FR-CRM-010, FR-CRM-013) | Giữ nguyên **toàn bộ bản ghi đồng ý và bằng chứng** của hai bên, gắn lại vào bản giữ kèm `originCustomerId`. Trạng thái hiệu lực sau gộp tính **theo từng mục đích và kênh, theo nguyên tắc an toàn**: nếu một bên đã rút hoặc chưa từng đồng ý cho mục đích/kênh đó thì sau gộp coi là **chưa có** đồng ý; đồng ý quảng cáo chỉ còn khi **cả hai bên** có đồng ý còn hiệu lực. Không suy ra đồng ý mới từ việc gộp. Nhãn `no_marketing` của một bên thì giữ. Tính lại `marketing` (số kênh có đồng ý quảng cáo). Căn cứ pháp lý khác (hợp đồng, nghĩa vụ pháp luật) giữ cho phạm vi đã ghi. `[Cần xác nhận: Luật sư khách]` (M-3): một bên đồng ý, bên kia im lặng, có coi là đủ không |
| OI-3.6 | Yêu cầu chủ dữ liệu (FR-CRM-011) | Yêu cầu xem, chỉnh sửa đang mở và đã đóng của bên bị gộp chuyển sang bản giữ, **giữ nguyên hạn xử lý nội bộ và hạn pháp lý** (C3), người xử lý, lịch sử. Yêu cầu **xóa** đang mở ở bất kỳ bên nào chặn gộp (OI-3.2). Yêu cầu xem đang mở: kết quả phải gồm dữ liệu của cả hai hồ sơ cũ (nêu trong ghi chú xử lý). Sau gộp, yêu cầu xóa mới của bản giữ phải áp dụng cho cả dữ liệu đã chuyển (OI-3.7) |
| OI-3.7 | RetentionPort và dữ liệu cá nhân | Cổng giữ dữ liệu (`CustomerRetentionPort`) hỏi theo bản giữ phải bao gồm chứng từ, lệnh, công nợ, bảo hành, hóa đơn của **cả hai hồ sơ cũ** (qua `mergedInto`), để điều kiện chặn xóa không bị hụt sau gộp. Hồ sơ `merged` không còn dữ liệu cá nhân (SĐT, email, địa chỉ, tên có thể giữ dạng tên hiển thị tối thiểu để dẫn chiếu). Nhật ký ghi **mã nội bộ**, không ghi họ tên, SĐT (R96, §8.3). Che dữ liệu theo vai trò áp dụng cả màn so sánh: màn gộp hiện kết quả so khớp ("giống", "khác") do máy chủ tính, và giá trị đầy đủ chỉ hiện sau thao tác "Hiện" có nhật ký truy cập (NFR-SEC-03) |
| OI-3.8 | Chứng từ và quan hệ tài chính (RULE-010) | Công nợ, thu tiền, lệnh, báo giá, lịch hẹn, ghi chú, nhãn của bên bị gộp thuộc về bản giữ. **Chứng từ tài chính đã ghi sổ không bị sửa nội dung** (số tiền, bên mua trên hóa đơn): chỉ đổi liên kết khách hoặc thể hiện bằng liên kết chuyển hướng `mergedInto`; **hóa đơn đã phát hành giữ nguyên thông tin người mua** lúc phát hành. Tổng công nợ sau gộp bằng tổng hai bên. Cách thực hiện (viết lại liên kết hay đọc qua `mergedInto`) là quyết định của dev, với điều kiện không sửa nội dung chứng từ ghi sổ và có thể hoàn tác; dev cần ước tính ảnh hưởng chỉ mục (193/200) trước khi chọn |
| OI-3.9 | Quan hệ chi nhánh và lịch sử xuyên chi nhánh | `branchIds` và `CustomerLink` của bản giữ là **hợp** của hai bên (trùng chi nhánh thì giữ liên kết có nguồn sớm hơn); người gộp **không** được thấy thêm dữ liệu chi nhánh ngoài phạm vi của mình: màn gộp chỉ hiện số lượng, không hiện nội dung của chi nhánh khác. Lịch sử xe xuyên chi nhánh (phép chiếu P3) không đổi vì không chứa mã khách |
| OI-3.10 | Quyền và duyệt | Quyền mới `customer:merge`; người gộp phải thấy cả hai hồ sơ trong phạm vi. Gộp hai hồ sơ **cùng thuộc chi nhánh làm việc**: QL đề xuất và thực hiện, **cần người khác duyệt** (R59; mặc định CH). Gộp có hồ sơ liên kết chi nhánh khác: chỉ CH hoặc vai trò cấp công ty được cấp quyền, và vẫn cần người khác duyệt; người dùng một người (CH) cần vai trò duyệt thứ hai do khách chỉ định `[Cần xác nhận: Chủ dự án]` (M-4). Áp dụng rào ghi chi nhánh làm việc (mục 1): gộp cần chi nhánh làm việc thuộc liên kết của cả hai hồ sơ hoặc chuyển chi nhánh |
| OI-3.11 | Hoàn tác | Cho **hoàn tác trong hạn cấu hình (khởi điểm 30 ngày)** nếu từ lúc gộp: chưa có lệnh, báo giá, thu tiền, hóa đơn **mới** nào gắn với bản giữ hoặc xe đã chuyển; hồ sơ giữ chưa sửa thêm (so `version`); chưa có yêu cầu chủ dữ liệu mới. Hoàn tác khôi phục bản bị gộp về `active` với dữ liệu cá nhân từ bản đồ chuyển, trả quan hệ sở hữu, đồng ý, yêu cầu về đúng bên, và ghi nhật ký. Quá hạn hoặc đã phát sinh: không tự hoàn tác, xử lý bằng **tách thủ công có duyệt** (ngoài phạm vi bản này, cần đặc tả riêng). Bản đồ chuyển (chứng từ, xe, đồng ý, yêu cầu nào đã chuyển và giá trị cũ của từng trường) lưu trong thời hạn hoàn tác rồi **xóa phần dữ liệu cá nhân** (PDPL); hết hạn thì mất khả năng hoàn tác tự động. Hoàn tác cần cùng cấp duyệt với gộp. `[Cần xác nhận: Chủ dự án, Luật sư khách]` (M-5) |
| OI-3.12 | Nhật ký và thông báo | Nhật ký bất biến cho: gợi ý bị bỏ qua (tùy chọn), gộp, hoàn tác, từ chối; ghi người đề xuất, người duyệt, mã hai hồ sơ, bản giữ, trường lấy từ bên nào (tên trường, không giá trị cá nhân), số xe, số chứng từ chuyển. Báo cáo ngoại lệ: số lần gộp trong tháng và gộp xuyên chi nhánh cho CH |

### 3.3 Câu hỏi cho khách

| # | Gửi | Câu hỏi | Lựa chọn | Đề xuất | Tác động |
| --- | --- | --- | --- | --- | --- |
| M-1 | Chủ dự án | Khóa gợi ý trùng: dùng MST cho khách doanh nghiệp và SĐT + tên cho khách cá nhân; không dùng biển số, số khung | Như đề xuất; chỉ SĐT; thêm email | Như đề xuất (OI-3.1) | Chỉ SĐT: nhiều gợi ý sai (gia đình dùng chung); bỏ MST: bỏ sót trùng doanh nghiệp |
| M-2 | Chủ dự án | Bản giữ: mặc định tạo sớm hơn hay bản có nhiều lịch sử hơn hay chọn tay | Sớm hơn; nhiều lịch sử; chọn tay (có mặc định) | Chọn tay, mặc định sớm hơn | Mã khách đã in trên chứng từ cũ: bản giữ khác mã sẽ có chứng từ in mã cũ (đã có dẫn chiếu `mergedInto`) |
| M-3 | Luật sư khách | Đồng ý khi hai bên khác nhau: lấy phương án hạn chế nhất; có phải thông báo cho khách về việc gộp hồ sơ không | Hạn chế nhất (đề xuất); hợp (có đồng ý ở một bên là đủ); hỏi lại khách | Hạn chế nhất; không tự suy ra đồng ý mới; có hay không thông báo cho khách do luật sư nêu | "Hợp" rủi ro gửi quảng cáo cho người đã rút đồng ý (FR-CRM-013, phạt theo PDPL 2025) |
| M-4 | Chủ dự án | Ai duyệt gộp khi chỉ có một CH | CH + một vai trò thứ hai (KT, QV); QL chi nhánh duyệt khi cả hai hồ sơ chỉ thuộc chi nhánh đó | Gộp trong một chi nhánh: QL đề xuất, CH duyệt; xuyên chi nhánh: KT hoặc QV đề xuất, CH duyệt | Không có người duyệt thứ hai: vi phạm nguyên tắc R59 |
| M-5 | Chủ dự án, Luật sư | Hoàn tác trong 30 ngày có đủ không; có chấp nhận lưu dữ liệu cá nhân bên bị gộp trong bản đồ chuyển trong thời hạn đó không | 0 ngày (không hoàn tác); 30 ngày; 90 ngày | 30 ngày, xóa phần dữ liệu cá nhân khi hết hạn | Không hoàn tác: gộp nhầm chỉ sửa được bằng tách thủ công; dài hơn: giữ dữ liệu cá nhân lâu hơn |
| M-6 | Chủ dự án | Phase của FR-CRM-003 và mức ưu tiên (Should) | Phase 2 (đề xuất); sớm hơn (pilot) | Phase 2: pilot chỉ cảnh báo trùng SĐT trong phạm vi | Làm sớm: thêm thiết kế đồng ý, nhật ký, ước tính L trước pilot |
| M-7 | Kế toán khách | Chứng từ đã ghi sổ đổi liên kết khách (không đổi số tiền, không đổi bên mua đã in trên hóa đơn) có chấp nhận được không | Chấp nhận; không chấp nhận (chỉ dùng liên kết chuyển hướng) | Chấp nhận miễn có nhật ký và hoàn tác | Không chấp nhận: bắt buộc cách đọc qua `mergedInto`, báo cáo công nợ phải gom theo nhóm hồ sơ đã gộp |

### 3.4 Tiêu chí chấp nhận (khi làm)

1. Gợi ý theo MST (khách doanh nghiệp) hoặc SĐT chuẩn hóa + tên (khách cá nhân); không bao giờ có gợi ý theo biển số, số khung; chỉ hiện hồ sơ trong phạm vi người dùng.
2. Gộp giữ đủ lịch sử hai hồ sơ (xe, quan hệ sở hữu, lệnh, báo giá, công nợ, ghi chú, đồng ý, yêu cầu) và có nhật ký (FR-CRM-003).
3. Hai khoảng sở hữu cùng xe chồng lấn: gộp bị chặn và nêu xe; không chồng lấn: cả hai khoảng giữ nguyên ngày.
4. Đồng ý: bên nào đã rút hoặc chưa đồng ý quảng cáo thì sau gộp không gửi được quảng cáo; chiến dịch loại khách này và báo số bị loại (FR-CRM-013); bằng chứng đồng ý của cả hai còn xem được.
5. Yêu cầu xóa đang mở ở một bên: gộp bị chặn; yêu cầu khác chuyển sang bản giữ giữ nguyên hạn xử lý.
6. Công nợ tổng sau gộp bằng tổng hai bên; hóa đơn đã phát hành giữ nguyên người mua; chứng từ ghi sổ không đổi số tiền.
7. Người gộp không thấy tên, SĐT, nội dung chứng từ của chi nhánh ngoài phạm vi; mọi giá trị cá nhân ở màn so sánh bị che đến khi bấm "Hiện" (có nhật ký truy cập).
8. Không tự duyệt: người duyệt khác người đề xuất; thiếu duyệt thì không gộp.
9. Nhật ký chỉ có mã nội bộ, không có họ tên, SĐT, email, địa chỉ.
10. Yêu cầu xóa dữ liệu của bản giữ sau gộp: `CustomerRetentionPort` chặn nếu bên bị gộp còn lệnh mở, công nợ, bảo hành.
11. Hoàn tác trong hạn và chưa có phát sinh mới: khôi phục đúng liên kết, đồng ý, yêu cầu, quan hệ sở hữu; có phát sinh mới hoặc quá hạn: từ chối kèm lý do.
12. Gộp hồ sơ `anonymized` hoặc `merged` bị từ chối.

### 3.5 Ca test cho dev (khi làm)

Test domain: hàm hợp trạng thái đồng ý (bảng chân trị theo mục đích × kênh × bốn trạng thái mỗi bên); chồng lấn sở hữu; hợp `branchIds`. Test tích hợp: gộp có chứng từ ACC/EIN (công nợ tổng, hóa đơn giữ người mua), `CustomerRetentionPort` qua `mergedInto`, hoàn tác trong hạn và sau phát sinh, cách ly (người gộp không thấy chi nhánh ngoài), nhật ký không chứa dữ liệu cá nhân (như R96), quyền và duyệt hai người, chặn bởi yêu cầu xóa. Ca đồng thời: hai người gộp cùng một hồ sơ (một thành công, một lỗi phiên bản). Idempotency: gửi lại cùng khóa không gộp hai lần.

### 3.6 Tác động tài liệu

FRD FR-CRM-003 (sửa khóa nhận diện, thêm OI-3.2 đến 3.12, xếp Phase 2), FR-CRM-010/011 (hợp đồng ý, chuyển yêu cầu), FR-CRM-014 (chồng lấn sở hữu); BRD BR-CRM-01 và BR-CRM-05 ghi nhận; Journey: workflow gộp khách, ngoại lệ; UAT mới "Gộp khách trùng" cạnh UAT-10, 18; designer: màn gộp (CRM-08) có so sánh che dữ liệu; `ba-answers-for-dev.md` §25 Q-C cập nhật bỏ "biển số/số khung".

---

## 4. Slice 1.10 INS khi khách không xác nhận

### 4.1 Hiện trạng và phụ thuộc

- INS không nằm trong Phase 1 theo FRD §13: "đưa vào giai đoạn 1 nếu khách xác nhận cần kiểm tra xe số; các FR đều mức Should". FR-INS-001 đến 008 là Should, FR-INS-009 là Could; BR-INS-01 là Should; FRD ghi rõ "khách chưa xác nhận cần kiểm tra xe số [Cần xác nhận]". `uat-coverage.md` dòng 15: "CHƯA XÂY, INS chờ khách xác nhận phạm vi". BA-19 ở `review-docs-and-design.md` (Minor) vẫn mở. `implementation-plan.md` ước 6 đến 9 người-tuần cho slice 1.10 và **không tính vào tổng Phase 1 (120 đến 160)**.
- Dev đã giữ chỗ không xây INS; `status.md` ghi slice 1.10 chưa bắt đầu; REC đã giữ ảnh tiếp nhận (FR-REC-002), đề xuất phát sinh của thợ kèm ảnh (FR-REC-014, R104, R107), QC (FR-REC-016). ADR 0001 §7.3 (tệp và media): video là phần tốn công nhất vì tải lên qua API (rủi ro R-10, "đo ở spike và ở INS").
- Journey (`user-journey-business-workflow.md` dòng 79) mô tả bước thợ đánh dấu xanh, vàng, đỏ kèm ảnh hoặc video; đây là mô tả có điều kiện, không phải Must.

### 4.2 Tác động nếu khách KHÔNG xác nhận INS cho pilot

| Đối tượng | Tác động | Xử lý đề xuất |
| --- | --- | --- |
| UAT-15 "Từ kiểm tra xe số đến báo giá" (FR-INS-003, 005) | Không chạy ở pilot; không còn kịch bản UAT-15 trong cổng pilot. Số kịch bản UAT bắt buộc giảm 1; UAT-15 chuyển trạng thái "hoãn, chờ kích hoạt lại" (không xóa, giữ traceability INS → BR-INS-01 → UAT-15) | Ghi vào `uat-coverage.md` là "Ngoài phạm vi pilot theo quyết định của Chủ dự án", ngày quyết định. Thay bằng UAT-15b (mục 4.4) nếu chọn phương án B |
| FR-INS-001 đến 009 | Giữ nguyên trong FRD ở mức Should, đánh dấu "Phase 2 (chờ xác nhận)". Không hạ xuống Won't vì khách chưa từ chối nội dung, chỉ chưa chọn thời điểm | Cập nhật FRD §13 và traceability INS |
| Design G2-INS-01, 02, 03 (thực hiện kiểm tra, kết quả và danh sách lỗi, quản lý mẫu) | Giữ nguyên trong `design/` (đã qua rà soát); đánh dấu `P2` thay `P1?`; không dựng. Không bắt designer sửa; ghi vào `docs/ui-ux/STATUS.md` | Cập nhật nhãn ưu tiên màn |
| Slice 1.10 | Bỏ khỏi đường găng Phase 1; không cần đường tải video. Giải phóng 6 đến 9 người-tuần. Rủi ro R-10 (video qua API) lùi đến khi INS được kích hoạt | Ghi trong `implementation-plan.md` |
| Tiêu chí thoát pilot (`implementation-plan.md`: mọi FR Must đạt UAT, chạy song song với Excel ít nhất 4 tuần, v.v.) | **Không đổi**: INS chỉ Should, không thuộc FR Must; không có tiêu chí thoát nào phụ thuộc INS. Thêm điều kiện: biên bản Chủ dự án ghi "INS ngoài phạm vi pilot" | Ghi vào biên bản chốt phạm vi Phase 1 |
| Chỉ số BRD §3 áp dụng cho một chi nhánh (thời gian từ nhận xe đến báo giá) | Không phụ thuộc INS; pilot đo thời gian bằng quy trình tiếp nhận hiện có. Nếu BRD có chỉ số riêng về tỉ lệ báo giá có ảnh hoặc "phát hiện lỗi qua kiểm tra xe số", chỉ số đó không đo được ở pilot (dev/BA kiểm tra lại BRD §3, chưa xác minh) | Loại chỉ số đó khỏi pilot hoặc ghi "không áp dụng" |
| Nghiệp vụ tại xưởng | Thợ không có công cụ kiểm tra có cấu trúc; phát hiện lỗi chỉ đi qua ghi hiện trạng và ảnh tiếp nhận (FR-REC-002, 025), đề xuất phát sinh của thợ kèm ảnh (FR-REC-014), checklist QC (FR-REC-016) | Phương án thay thế mục 4.3 |
| Dữ liệu | Không có `inspection` để di chuyển sau này; khi bật INS, lịch sử kiểm tra bắt đầu từ ngày bật (FR-INS-008 chỉ có dữ liệu từ lúc đó) | Ghi rõ với khách |

### 4.3 Phương án thay thế (đề xuất, chờ Chủ dự án chọn)

| Phương án | Nội dung | Ưu | Nhược | Chi phí (ước tính, dev xác nhận) |
| --- | --- | --- | --- | --- |
| A. Không làm gì thêm | Pilot dùng REC như hiện có: hiện trạng và ảnh lúc tiếp nhận, đề xuất phát sinh của thợ, QC | Không thêm công | Không có danh sách kiểm tra chuẩn cho bảo dưỡng; cố vấn nhập tay hạng mục | 0 |
| B. **Danh sách kiểm tra tối thiểu trong REC (đề xuất)** | Mẫu danh sách do chi nhánh dùng khi tiếp nhận hoặc khi thợ kiểm tra: mỗi hạng mục có kết quả xanh, vàng, đỏ, ghi chú ngắn, ảnh dùng lại đường ảnh của REC; **không video, không phát hành mẫu từ trụ sở theo phiên bản**; hạng mục vàng, đỏ cho phép "thêm vào báo giá" một thao tác (dòng báo giá đúng dịch vụ mẫu, theo FR-INS-005). Dữ liệu nằm trong lệnh hoặc hồ sơ tiếp nhận, mẫu là cấu hình có ngày hiệu lực trong SYS (dịch vụ) | Giữ được giá trị cốt lõi (UAT-15b) với một phần nhỏ công | Cần dev dựng lại một phần màn hình INS-01/02 trong REC; mẫu chỉ cấu hình ở mức công ty, không phát hành theo phiên bản chi nhánh | Khoảng 1 đến 2 người-tuần (BA ước lượng thô, **chưa có cơ sở dev**; dev đo trước khi cam kết); không thêm chỉ mục nếu đọc theo lệnh (dev xác nhận) |
| C. Kéo cả slice 1.10 vào pilot | Làm INS như kế hoạch, kể cả video | Đúng FRD | Tốn 6 đến 9 người-tuần, rủi ro R-10, không phải Must | 6 đến 9 người-tuần (kế hoạch) |

Mã yêu cầu mới đề xuất cho phương án B (thêm vào **cuối module REC** khi được duyệt, không đổi số cũ; FRD hiện có đến FR-REC-036): `FR-REC-037` Danh sách kiểm tra tiếp nhận tối thiểu (Should), trace BR-REC-01 và BR-INS-01, tiêu chí: (1) mỗi hạng mục có đúng một mức xanh, vàng hoặc đỏ; (2) lưu ngay khi chọn, không mất dữ liệu khi chuyển màn; (3) hạng mục vàng, đỏ thêm vào báo giá bằng một thao tác, hạng mục xanh không sinh dòng; (4) ảnh gắn hạng mục qua đường ảnh của REC (gỡ EXIF, kiểm loại tệp, R104); (5) thợ chỉ thấy lệnh được giao; (6) mẫu là cấu hình có ngày hiệu lực, sửa mẫu không đổi kết quả đã lưu. Dòng báo giá sinh ra phải đi qua quy tắc giá và phiên bản báo giá hiện hành (FR-REC-023, 031), không bỏ qua duyệt của khách (RULE-005, 006). Khi INS được kích hoạt lại, kết quả của FR-REC-037 phải **chuyển được** vào `inspection` (không làm lại): dev thiết kế dữ liệu để hạng mục, mức, ảnh tương thích FR-INS-002 đến 005.

### 4.4 Kịch bản UAT thay thế (nếu chọn B)

UAT-15b (mã tạm): Given lệnh đang tiếp nhận có danh sách kiểm tra với hạng mục xanh, vàng, đỏ. When cố vấn thêm các hạng mục vàng và đỏ vào báo giá bằng một thao tác. Then dòng báo giá sinh ra chỉ cho hạng mục vàng và đỏ, có công và phụ tùng gợi ý từ dịch vụ mẫu, hạng mục xanh không sinh dòng, báo giá vẫn cần khách duyệt từng dòng. Liên quan: FR-REC-037 (đề xuất), FR-INS-003, 005 (tham chiếu), UAT-15 hoãn.

### 4.5 Điều kiện kích hoạt lại INS

Kích hoạt khi **đủ cả hai**: (1) Chủ dự án hoặc khách xác nhận bằng văn bản phạm vi INS (có hay không video, ai tạo mẫu: FR-INS-001 do trụ sở tạo mẫu và phát hành); (2) có đo ở pilot cho biết **cần thiết**: ví dụ sau 4 đến 6 tuần pilot, tỉ lệ báo giá bổ sung do thợ đề xuất hoặc tỉ lệ báo giá bị khách từ chối vì thiếu bằng chứng vượt ngưỡng khách đặt (`[Cần xác nhận: Chủ dự án]` ngưỡng; BA chưa đề xuất số), hoặc khi mở rộng chi nhánh cần chuẩn hóa kiểm tra giữa các chi nhánh. Chuẩn bị trước khi kích hoạt: ADR §7.3 phương án tải video, thiết bị tablet và camera thật, ước tính lại slice. Slice 1.10 xếp Phase 2 (sau hoặc song song HRM, PUR), không đổi số slice.

### 4.6 Câu hỏi cho khách

| # | Gửi | Câu hỏi | Lựa chọn | Đề xuất | Tác động |
| --- | --- | --- | --- | --- | --- |
| K-1 | Khách, Chủ dự án (BA-19) | Pilot có dùng kiểm tra xe số không | Có, đầy đủ (C); có bản tối thiểu (B); không (A) | B nếu xưởng muốn danh sách kiểm tra chuẩn; A nếu không; C chỉ khi video là bắt buộc | C: +6 đến 9 người-tuần, rủi ro R-10; A: bỏ UAT-15 |
| K-2 | Khách | Có cần video không hay chỉ ảnh | Chỉ ảnh; ảnh và video | Chỉ ảnh ở pilot | Video: đường tải lên lớn, dung lượng lưu, thời hạn lưu (R104 chờ Luật sư) |
| K-3 | Khách | Mẫu kiểm tra: ai soạn và có khác nhau giữa chi nhánh không | Trụ sở soạn một mẫu cho chuỗi; mỗi chi nhánh tự soạn | Trụ sở soạn (FR-INS-001); pilot một chi nhánh nên dùng mẫu công ty | Mỗi chi nhánh tự soạn: mất chuẩn hóa, ảnh hưởng báo cáo |
| K-4 | Chủ dự án | Ngưỡng và thời điểm xem lại INS sau pilot | Sau 4 đến 6 tuần pilot; theo ngưỡng khách đặt | Xem lại sau pilot; BA đề xuất ngưỡng khi có số liệu | Chưa có ngưỡng thì chỉ kích hoạt theo xác nhận bằng văn bản |

### 4.7 Tiêu chí chấp nhận cho quyết định (không làm INS ở pilot)

1. Biên bản Chủ dự án ghi INS ngoài phạm vi pilot (hoặc phương án B/C), ngày quyết định.
2. FRD §13, traceability INS và `uat-coverage.md` UAT-15 ghi đúng trạng thái; không còn "chờ khách xác nhận" lơ lửng.
3. Không FR Must nào phụ thuộc INS (kiểm bằng traceability).
4. Màn G2-INS-01 đến 03 gắn nhãn `P2` (hoặc P1 nếu chọn C); không có menu INS trong ứng dụng pilot (nếu A) hoặc chỉ có danh sách kiểm tra trong lệnh (nếu B).
5. Nếu chọn B: UAT-15b đạt; ảnh kiểm tra qua đường ảnh REC, không video.

### 4.8 Tác động tài liệu

FRD §13 và §11 (phạm vi INS, UAT-15, traceability INS, thêm FR-REC-037 nếu chọn B); BRD BR-INS-01 (phase 2 hoặc giữ Should kèm ghi chú), BRD §3 chỉ số nếu có; Journey (bước kiểm tra xe số: đánh dấu "Phase 2" hoặc mô tả bản tối thiểu); `implementation-plan.md` slice 1.10 và bảng ước lượng; `uat-coverage.md`; `docs/ui-ux/STATUS.md` (nhãn P của ba màn INS).

---

## 5. Danh sách việc cần cập nhật tài liệu khi các mục được chốt

| Tài liệu | Thay đổi |
| --- | --- |
| `functional-requirements.md` | NFR-ISO-01 (mục 1); FR-ACC-005, 012 (mục 2); FR-CRM-003, 010, 011, 014 (mục 3); §13, FR-INS, UAT-15, thêm FR-REC-037 nếu chọn B (mục 4); UAT mới: ghi chéo (UAT-06 mở rộng), khóa kỳ, gộp khách, UAT-15b; traceability |
| `business-requirements.md` | BR-ACC-05, BR-CRM-01, BR-CRM-05, BR-INS-01 (phase, phạm vi); RULE-010 áp dụng cho khóa kỳ và gộp |
| `user-journey-business-workflow.md` | Workflow khóa kỳ, gộp khách, ngoại lệ "khác chi nhánh làm việc"; bước kiểm tra xe số |
| `ba-answers-for-dev.md` | §25 F-1, Q-B, Q-C: cập nhật theo bản này, sửa "biển số/số khung" |
| `docs/ui-ux/STATUS.md`, `design/` | Nhãn ưu tiên G2-INS; màn khóa kỳ và gộp khách (chưa có); nhãn chi nhánh khi mở liên kết chéo |
| `implementation-plan.md` | Slice 1.10, 3.2 (khóa kỳ), ước lượng |

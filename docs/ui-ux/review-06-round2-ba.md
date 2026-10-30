# Review lần 2 của BA – Gói 6 "Báo cáo và Hệ thống"

Ngày 30/10/2026 · Đối tượng: `design/g4-reports-system/*` và `docs/ui-ux/06-reports-system.md` v0.2 · Chuẩn: `ba-answers-06.md` (BA-06), `review-06-reports-system-ba.md` (vòng 1), `ba-decisions.md`, FRD §2, `app.js` đã vá. Không tin bảng tự khai §11: mọi kết luận dưới đây đối chiếu trực tiếp mã (`pack.js`, `pack.css`, các trang). Chưa mở trình duyệt.

## Kết luận: **CHƯA ĐẠT** (còn 2 Major, 8 Minor; sửa nhỏ là đạt)

- 34/35 finding vòng 1 **Đạt**, 1 **Chưa đạt** (F6-04, còn lộ chi nhánh ngoài nhóm của Quản lý vùng).
- Finding mới do chỉnh sửa: 1 Major (hộp thoại duyệt dùng chung ghi sai ảnh hưởng cho các thao tác nguy hiểm) và 8 Minor.
- Số liệu mẫu đã tính lại và cộng đúng ở mọi biến thể phạm vi (xem mục 3).

**Còn mở theo mức:** Blocker 0 · Major 2 (F6-04, F6R2-01) · Minor 8 (F6R2-02…09).

---

## 1. Kiểm tra từng finding F6-01…F6-35

| Finding | Kết quả | Bằng chứng trong mã / ghi chú |
| --- | --- | --- |
| F6-01 chữ trục ≥ 12px | **Đạt** | `pack.css:36` `min-width:640px` = viewBox `W=640` ở `pack.js:299` (line) và `pack.js:327` (bar) ⇒ hệ số ≥ 1; `.g4r-svg-text` 12px (`pack.css:38`); khung hẹp cuộn ngang (`.g4r-chart__scroll`). hbar/stacked là HTML, không co. Tài liệu §6/§8 đã sửa |
| F6-02 RPT-03 khớp số liệu | **Đạt** | `g4-rpt-03.html:33–39, 55–64`: doanh thu chưa thuế 22.590.909 + thuế 2.259.091 = 24.850.000; đã thu 19.350.000 + công nợ 5.500.000 = 24.850.000; có khối "Thu khác" (1.800.000 + 500.000) tổng 21.650.000; 6 phiếu / 5 lệnh; so sánh cùng 30 ngày; giá trị TB theo lệnh hoàn tất (612,4 tr ÷ 207) |
| F6-03 banner phạm vi | **Đạt** | `pack.js:127–134`: báo cáo dùng `data-scope-text` hoặc `scopeText`, `sample` hiện tag "Dữ liệu mẫu minh họa"; `cfgScope` chỉ còn ở màn SYS. KPI dùng `data-scope-label` bám bộ chọn |
| F6-04 lộ nhiều chi nhánh | **Chưa đạt (một phần)** | Đã làm: `g4r-only-merged/branch` và `g4r-notq7` (`pack.css:55–57`), KT ẩn Quận 1/Biên Hòa/Đà Nẵng ở RPT-02/05, CV lọc ở RPT-10. **Còn lỗi:** QV (phạm vi hợp nhất) vẫn thấy **Đà Nẵng** ở RPT-03 (`g4-rpt-03.html:91–92`, tổng 116.818.181 ₫ gồm 5 chi nhánh), RPT-04 (`:34–39, 61`, tổng 42), RPT-08 (`:59`), trong khi RPT-02 đã ẩn Đà Nẵng cho QV (`g4r-notqv`) và giả định của designer là QV chỉ có nhóm Miền Nam. TN có `data-own` nhưng CSS chỉ lọc CV (`pack.css:71–74`). Sửa: thêm `g4r-notqv` cho hàng/đoạn Đà Nẵng và tổng QV (4 chi nhánh = 91.954.545 ₫ chưa thuế) ở RPT-03/04/08 |
| F6-05 TK thấy giá vốn | **Đạt** | `pack.css:68` ẩn `.g4r-money` với TK; áp ở KPI giá trị tồn, vòng quay + hao hụt, biểu đồ giá trị, cột Giá trị hàng chậm (`g4-rpt-06.html:30, 33, 36, 67–71`); có thông báo giải thích `:28` |
| F6-06 SYS-04 | **Đạt** | `g4-sys-04.html:92` Xuất/Quản lý chỉ `allowed` khi `lv !== '-'`; bỏ tick Xem thì khóa và tắt Xuất/Quản lý (`:111–113`); đếm khác biệt thực theo `data-orig` (`:102`); hộp thoại lấy vai trò và số người từ vai trò đang chọn (`:98, 105`); trần che dữ liệu cá nhân (`:126`). Ma trận 120 ô vẫn khớp FRD §2 |
| F6-07 luồng duyệt | **Đạt, kèm F6R2-01** | `pack.js:177–190`: hộp thoại có Xem + tick xác nhận → Duyệt; Từ chối chỉ mở khi lý do ≥ 5 ký tự (`:502`); `g4rPending` ở SYS-04, 07, 08, 09, 10, 12, 14, 15, 16, 21, 22, 23, 24; SYS-21 L-0011 mở đúng lô (`g4-sys-21.html:35`). Lỗi nội dung hộp thoại: xem F6R2-01 |
| F6-08 thu hồi vai trò | **Đạt** | `g4-sys-03.html:75`: `dlg-role1/dlg-role2` riêng, có `data-g4r-pw`; lọc "chính mình". Cơ chế mật khẩu bắt buộc ở `pack.js:486–493` (sự kiện lồng kiểm tra lại mật khẩu, hoạt động đúng) |
| F6-09 SYS-06 | **Đạt** | `g4-sys-06.html:39–44, 62–67`: nhóm tài chính chỉ hiển thị + "Đổi…" (chỉ AD) mở drawer có ngày hiệu lực + lý do + chờ CH duyệt; chân trang tách rõ thông tin chung (hiệu lực ngay) và tài chính (qua duyệt) |
| F6-10 SYS-09 | **Đạt, kèm F6R2-03** | `g4-sys-09.html:38–42` "Đề xuất đổi" chỉ QV, CH "Xem và duyệt"; QL chỉ tạo chương trình; có kiểm tra mức giảm ≤ hạn mức (`:67`); SYS-19 đổi người duyệt. Dữ liệu mẫu chương trình 10% > hạn mức 5% mâu thuẫn quy tắc |
| F6-11 SYS-05 | **Đạt** | `g4-sys-05.html:38–42, 51`: bước 1 `dlg-stop` (gõ NGUNG, vẫn hoàn tất lệnh đang mở); bước 2 "Khóa hoàn toàn" bị khóa kèm 4 mục treo và liên kết xử lý; Đà Nẵng ở trạng thái "ngừng nhận lệnh mới" |
| F6-12 SYS-13 | **Đạt** | `g4-sys-13.html:44–48, 54–56`: bước báo giá (RULE-005/006), QC (FR-REC-016), thu tiền (RULE-007) khóa cờ Bắt buộc/cổng QC, kèm dòng lý do nhìn thấy. SYS-13 chưa có hàng chờ QL duyệt: F6R2-06 |
| F6-13 SYS-20 | **Đạt** | `g4-sys-20.html:46–52, 55, 126–127`: quyền theo loại (TK tồn, KT công nợ, AD/QL/CH khách và xe với cột cá nhân che), trường Ngày hiệu lực (≥ hôm nay), nhãn môi trường đổi theo lựa chọn, loại tài chính ở môi trường thật chuyển thành "Gửi duyệt ghi lô" |
| F6-14 SYS-22 | **Đạt** | `g4-sys-22.html:35, 50–58`: chọn ngày + giờ, ước tính mất dữ liệu theo thời điểm và theo chi nhánh, cảnh báo "Vượt mục tiêu RPO 1 giờ", hàng chờ CH duyệt |
| F6-15 RPT-01 | **Đạt, kèm F6R2-04** | `g4-rpt-01.html:28–38`: lối tắt theo vai trò (KT không còn RPT-04, TK → RPT-06, CV/QĐ → RPT-04), thẻ `#` đã bỏ, trạng thái rỗng `#rpt-none`. Nút "Mở Tổng quan" vẫn `href="#"`; TN còn thấy thẻ RPT-10 nên không rơi vào trạng thái rỗng |
| F6-16 điều hướng cài đặt | **Đạt, kèm F6R2-02** | `pack.js:151–174, 442–444`: `SYS_ALLOW` khớp 24 `data-allow` (đã đối chiếu), nhóm và `optgroup` rỗng ẩn. Shim menu xung đột với `app.js`: F6R2-02 |
| F6-17 công thức nhất quán | **Đạt** | RPT-02/03/04/08 dùng "Số lệnh mở" / "Số lệnh hoàn tất"; mốc Sẵn sàng bàn giao, trừ tạm dừng "Chờ khách duyệt phát sinh", trung vị; QC trả lại theo hạng mục + quay lại sửa lỗi 30 ngày tách riêng; DSO = 37,5 tr ÷ 673,64 tr × 30 = 1,7 ngày; không còn ghi chú "do BA xác nhận" (grep trống). Cộng lại: 173 ÷ 202 = 85,6%; QV 636 lệnh/1.891,3 tr = 2.973.742; KT 357/1.044,1 tr = 2.924.650 |
| F6-18 RPT-05 | **Đạt** | `g4-rpt-05.html:47, 66–67, 88`: "Không áp dụng" cho lệnh chỉ công, trạng thái hóa đơn Đã xuất/lỗi, quy tắc "thiếu" ở chân bảng |
| F6-19 SYS-24 | **Đạt** | `g4-sys-24.html:82–91`: bản đồ hướng yếu đi cho 11 ô + checkbox bỏ tick |
| F6-20 disabled bị ghi đè | **Đạt** | `pack.js:453–455` giữ `_d0` |
| F6-21 touch, lý do khóa | **Đạt** | `pack.css:76` `.table .check{min-width:44px}`, `:77` hbar 44px khi cảm ứng; dòng chữ lý do `g4r-why` cho nút Xuất (`pack.js:466`), radio SYS-20, SYS-13. Phần còn `title` đã nằm trong §14 (không chặn) |
| F6-22 màu ngữ nghĩa | **Đạt** | Không còn `tag--danger">Bắt buộc` trong gói; SYS-01 không còn `g4r-miss` cho MFA tùy chọn |
| F6-23 dữ liệu mâu thuẫn | **Đạt, ghi chú nhỏ** | Đà Nẵng "ngừng nhận lệnh mới từ 25/10" khớp doanh thu. Còn lệch nhẹ: SYS-05 `:51` "12 lệnh đang mở" so với RPT-04 chi nhánh này 7 lệnh (phần "chờ thu" là lệnh Hoàn tất còn công nợ, không phải lệnh mở) – ghi trong F6R2-08 |
| F6-24 SYS-02 | **Đạt (kiểm tra mẫu)** | `g4-sys-02.html:36, 42–43, 58, 68, 88`: khóa vai trò vượt quyền cho QL, thông báo trùng email trung lập |
| F6-25 SYS-01 | **Đạt (kiểm tra mẫu)** | Không còn nhãn MFA đỏ; bộ lọc vai trò bổ sung |
| F6-26 SYS-10 | **Đạt (kiểm tra mẫu)** | Có lịch sử, ví dụ làm tròn, ghi nhận chênh FR-ACC-009 (câu 6 bên dưới) |
| F6-27 vai trò/điều khiển | **Đạt (kiểm tra mẫu)** | `SYS_ALLOW`: SYS-12 thêm CH, QL; SYS-17 thêm CH; SYS-18 thêm CH; SYS-21 thêm QL; "Ngưng áp dụng" ở SYS-07; SYS-15 có ngày hiệu lực |
| F6-28 SYS-23 | **Đạt** | grep không còn "Đề xuất BA"/`ba-decisions` trong gói |
| F6-29 SYS-20 nhỏ | **Đạt** | Nêu 20 MB / 50.000 dòng (`g4-sys-20.html:19, 70`) |
| F6-30 hộp thoại xuất | **Đạt** | `pack.js:459` AD chỉ xuất ở G4-SYS-19; cột cá nhân chỉ CH, KT và cần lý do ≥ 5 ký tự + mật khẩu (`:461, 470–475`) |
| F6-31 biểu đồ, tiện ích | **Đạt** | `nice()` mới (`pack.js:286`: gợi ý thang 1…10 nên RPT-03 trục không còn gấp đôi); điểm dừng Tab duy nhất + mũi tên (`pack.js:318, 505–510`); lớp `g4r-s/f/b`; Ghim bật/tắt (RPT-01) |
| F6-32 mật khẩu xác nhận | **Đạt** | `pack.js:486–493` |
| F6-33 `document.write` | **Đạt** | `<noscript>` ở các trang (đã thấy ở RPT-03, 10), handoff §12 đúng; xem mục 5 |
| F6-34 RPT-02 | **Đạt, kèm F6R2-07** | Tổng 3 biến thể khớp (mục 3); thứ hạng chưa đánh số lại theo phạm vi |
| F6-35 tài liệu | **Đạt** | §6, §8, §5, §9, §10 đã sửa đúng với mã (đã đối chiếu các dòng nêu AD/12px/640) |

---

## 2. Finding mới do chỉnh sửa (F6R2)

### F6R2-01 · Major · Hộp thoại duyệt dùng chung ghi sai "Ảnh hưởng" và không có bước xác thực cho thao tác nguy hiểm
- **Vị trí:** `pack.js:177–184` (`approveDialog`), `pack.js:495–503`; dùng bởi `g4-sys-22.html:50` (khôi phục thật), `g4-sys-23.html` (ẩn danh), `g4-sys-21.html:35` (hoàn tác lô), `g4-sys-24.html:31` (hạ bảo mật), `g4-sys-16.html` (chuyển môi trường thật).
- **Vấn đề:** phần "Ảnh hưởng" là câu cố định: "Chỉ áp dụng cho chứng từ tạo từ ngày hiệu lực; chứng từ đã tạo không đổi; duyệt muộn thì chọn ngày hiệu lực mới". Câu này **sai** cho các thao tác không có ngày hiệu lực: khôi phục thật làm **mất** dữ liệu và hóa đơn đã phát hành, ẩn danh không hoàn tác được, hoàn tác lô gỡ dữ liệu. Chủ garage duyệt dựa trên mô tả sai. Ngoài ra nút Duyệt chỉ cần tick xác nhận, không nhập lại mật khẩu (D-02: thao tác nguy hiểm hỏi lại mật khẩu) và không gõ từ khóa như ở hộp thoại đề xuất.
- **Cách sửa:** truyền "Ảnh hưởng" theo từng yêu cầu (thêm phần tử thứ 4 vào `data-g4r-approve`; ví dụ khôi phục: nêu số lệnh/phiếu/hóa đơn mất và cảnh báo hóa đơn đã gửi cơ quan thuế); chỉ hiện câu về ngày hiệu lực cho yêu cầu có ngày hiệu lực; với nhóm nguy hiểm (khôi phục thật, ẩn danh/xóa, hoàn tác lô, môi trường thật, hạ bảo mật) bắt buộc nhập lại mật khẩu trước khi nút Duyệt bật.

### F6R2-02 · Minor · Shim menu "Cài đặt" của `pack.js` mâu thuẫn với `app.js` đã vá
- **Vị trí:** `pack.js:434–440`; `app.js:332–348` (`set:'limited'` nhãn "Danh mục", `'approve'` nhãn "Xem và duyệt").
- **Đánh giá shim:** phần *hiện mục Cài đặt cho QV/KT/CV/QĐ/TK* và nhãn "Danh mục" **không còn cần** (app.js đã có). Phần **đổi `href` sang màn đầu tiên trong quyền** vẫn hữu ích (app.js trỏ cố định `g4-sys-01.html` nên KT/TK vào "Không có quyền"). Dòng 439 còn **xóa** thẻ `.nav-item__mode` của mọi vai trò ngoài danh sách (kể cả CH "Xem và duyệt" do app.js tạo), nên nhãn của CH mất mỗi khi đổi vai trò (MutationObserver chạy sau `applyRole`).
- **Cách sửa:** rút shim còn đúng một việc (đặt `href` theo `firstSys`) hoặc chuyển việc đó vào `app.js`; bỏ tạo/xóa nhãn và `hidden`.

### F6R2-03 · Minor · Chương trình giảm mẫu ở SYS-09 mâu thuẫn quy tắc "≤ hạn mức" (cần quyết định rõ)
- **Vị trí:** `g4-sys-09.html:52` (10% công bảo dưỡng, hạn mức chi nhánh 5%, QL được "Sửa"), `:67` (lỗi vượt hạn mức).
- **Nguyên nhân:** FR-INV-025 nói hạn mức "theo chi nhánh **và theo chương trình có thời hạn**"; BA-06 Phụ lục A.2 viết quá gọn ("trong hạn mức"). **Quyết định làm rõ ở mục 4 (câu A):** chương trình có mức vượt hạn mức chi nhánh là *hạn mức riêng của chương trình*, do QV đề xuất và CH duyệt; QL chỉ tạo/sửa chương trình trong hạn mức chi nhánh.
- **Cách sửa:** chương trình 10% hiển thị trạng thái "Hạn mức riêng đã duyệt (CH 28/09/2026)", nút Sửa khóa với QL; QL chỉ thêm chương trình ≤ 5%.

### F6R2-04 · Minor · Thu ngân (Xn) chưa được lọc "của tôi" và còn thẻ RPT-10 ở Trung tâm báo cáo
- **Vị trí:** `g4-rpt-10.html:14` (`data-own="CV TN"`), `pack.css:71–74` (chỉ CV); `g4-rpt-01.html:63` (thẻ RPT-10 cho `CV TN`).
- **Vấn đề:** TN thấy cả 6 lệnh/6 phiếu thu của chi nhánh dù banner nói chỉ phần của mình; thẻ RPT-10 là đích đi sâu, không phải báo cáo, nên bỏ khỏi danh sách thẻ (TN/TH rơi vào trạng thái rỗng đúng ý BA-06 A.5).
- **Cách sửa:** lọc TN theo phiếu thu mình lập; bỏ thẻ RPT-10 khỏi RPT-01 (vẫn mở được từ con số); `href` của "Mở Tổng quan" trỏ dashboard thật.

### F6R2-05 · Minor · Thiếu nơi cấu hình "Nhóm chi nhánh" (nhóm của Quản lý vùng)
- **Vị trí:** `pack.js:76–90` (bộ chọn có Nhóm Miền Nam/Miền Trung) nhưng `g4-sys-05.html`, `g4-sys-02.html`, `g4-sys-03.html` không có thực thể "Nhóm chi nhánh" (grep không thấy).
- **Vấn đề:** FRD §2 "quản lý vùng thấy nhóm chi nhánh được giao"; không có nơi tạo nhóm và gán QV vào nhóm. Quyết định: xem câu 3 bên dưới.
- **Cách sửa:** thêm nhóm "Nhóm chi nhánh" vào cây SYS-05 (tên nhóm, danh sách chi nhánh, đổi nhóm có ngày hiệu lực) và ở SYS-02/03 cho phép gán QV theo nhóm thay vì từng chi nhánh.

### F6R2-06 · Minor · Một số cấu hình gửi duyệt nhưng người duyệt không có chỗ duyệt
- **Vị trí:** SYS-06 (drawer "Gửi Chủ garage duyệt"), SYS-11 (thuộc nhóm CH duyệt), SYS-13 (QL duyệt) không có `g4rPending`/nút "Xem và duyệt".
- **Cách sửa:** thêm khối chờ duyệt (CH cho SYS-06, 11; QL cho SYS-13) cùng component; hoặc ghi rõ ở trang "người duyệt thấy tại hàng chờ phê duyệt G4-APR-01".

### F6R2-07 · Minor · RPT-02 xếp hạng đánh số cố định
- **Vị trí:** `g4-rpt-02.html:72–75` (`g4r-rank` 1…5 tĩnh, hàng bị ẩn theo vai trò).
- **Vấn đề:** KT thấy hạng 1 và 3, QV thấy 1, 2, 3, 5: "Bảng xếp hạng đúng thứ tự" (FR-RPT-002) bị phá khi rút gọn phạm vi. **Sửa:** đánh số lại bằng CSS counter trên hàng đang hiện hoặc render theo vai trò.

### F6R2-08 · Minor · Chỉ số và dữ liệu mẫu còn lệch nhỏ
- DSO 1,7 ngày dùng `kpi--danger` (`g4-rpt-08.html:40`) không có ngưỡng cấu hình nêu ra: màu đỏ cho giá trị rất thấp dễ gây hiểu sai. Dùng màu trung tính cho tới khi có ngưỡng.
- SYS-05 `:51` "12 lệnh đang mở" của Đà Nẵng so với RPT-04 (7 lệnh đang xử lý): đồng bộ (thêm 5 lệnh Hoàn tất còn công nợ vào mục riêng).
- RPT-02: chi nhánh "ngừng nhận lệnh mới" nên có tag trạng thái trong bảng xếp hạng.

### F6R2-09 · Minor · SYS-04 chỉ có một cột "Xuất dữ liệu"
- **Vị trí:** `g4-sys-04.html:81` (`A` có 8 hành động).
- **Vấn đề:** BA-06 câu 3 tách "xuất báo cáo (đã che)" và "xuất cột cá nhân đầy đủ" (FR-CRM-017, quyền riêng). Một cột không biểu diễn được "QL xuất được báo cáo nhưng chưa xuất được cột cá nhân".
- **Cách sửa:** thêm cột/công tắc "Xuất cột cá nhân đầy đủ" chỉ hiện ở chức năng "Hồ sơ khách và xe", mặc định bật cho CH, KT; mọi vai trò khác tắt; cấp mới cần CH duyệt (xem câu 2 bên dưới).

---

## 3. Số liệu đã tính lại (đạt)

RPT-02: 612,4+548,9+431,7+337,2+298,3 = 2.228,5 tr; lệnh mở 781, hoàn tất 752 (207+181+150+116+98); QV (không Đà Nẵng) 1.891,3 tr / 660 / 636; KT (Quận 7 + Thủ Đức) 1.044,1 tr / 370 / 357; giá trị TB từng chi nhánh khớp; đúng hạn có trọng số 87,5% / 87,0% / 88,4%. RPT-03: 22.590.909 × 1,1 = 24.850.000; 5 chi nhánh = 116.818.181 ₫ (× 1,1 = 128,5 tr gồm thuế, khớp design-system §7). RPT-04: 12 lệnh Quận 7 và 42 toàn chuỗi (19+7+6+6+4). RPT-06: khả dụng = thực tế − giữ. RPT-10: 24,85 tr / 19,35 tr / 5,5 tr; CV: 3 lệnh 18.650.000 ₫.

---

## 4. Trả lời 11 câu hỏi còn lại (§13 tài liệu) và giả định của designer — BA đề xuất, chờ xác nhận

1. **`ROLE_MENU`.** Xác nhận nhãn chế độ: `limited` = "Danh mục" (QV, KT, CV, QĐ, TK) và `approve` = "Xem và duyệt" (CH, QL một số mục), đúng với `app.js` đã vá. `00-foundation.md` §7 cập nhật theo `app.js`. Shim trong `pack.js` thu gọn còn đặt đích menu theo màn đầu tiên trong quyền (F6R2-02).
2. **Quyền xuất của QV và xuất cột cá nhân hàng loạt của QL.** QV chỉ xuất trong **nhóm được giao**, không bao giờ ngoài nhóm (NFR-ISO-01 áp dụng cho cả xuất tệp). Xuất cột cá nhân đầy đủ là **quyền riêng** (FR-CRM-017), mặc định bật cho CH, KT; QV, QL, các vai trò khác tắt. Cấp cho QL cần CH duyệt, có lý do, ghi nhật ký (đề xuất thêm thời hạn tùy chọn). Thêm cột/công tắc riêng ở SYS-04 (F6R2-09).
3. **Nhóm chi nhánh của QV.** Chấp nhận Miền Nam = Quận 7, Quận 1, Thủ Đức, Biên Hòa; Miền Trung = Đà Nẵng **chỉ làm dữ liệu mẫu**. "Nhóm chi nhánh" là danh mục cấu hình có ngày hiệu lực do AD đề xuất, CH duyệt; một chi nhánh thuộc một nhóm tại một thời điểm; QV gán theo nhóm. Cần màn quản lý nhóm ở SYS-05 (F6R2-05).
4. **Chi nhánh KT được gán.** Chấp nhận Quận 7 + Thủ Đức làm mẫu (khớp bộ chọn và SYS-01); số chi nhánh thật của từng kế toán là cấu hình vai trò × chi nhánh ở SYS-02/03. Nếu khách có kế toán trung tâm, gán toàn bộ chi nhánh, không đổi thiết kế.
5. **Doanh thu chưa thuế và làm tròn.** Giữ doanh thu hiển thị **chưa thuế**, số thu/công nợ **gồm thuế**. Số "chưa thuế" thật là Σ giá chưa thuế các dòng (mỗi dòng một thuế suất), **không** suy bằng chia 1,1 (cách mẫu chỉ áp dụng vì dữ liệu minh họa, nên ghi "minh họa"). Quy tắc làm tròn đề xuất: tính thuế theo từng dòng, làm tròn đến đồng, tổng thuế = Σ thuế dòng, chênh làm tròn so với hóa đơn nhà cung cấp hiển thị riêng; kế toán xác nhận theo quy định hóa đơn hiện hành `[Cần xác nhận]` và đưa vào ví dụ kiểm thử SYS-10 (NFR-MNT-01).
6. **FR-ACC-009 "mặc định theo chính sách hiện hành" so với SYS-10 không mặc định.** Quyết định: hệ thống **không có mức thuế hiệu lực sẵn**; bộ khởi tạo có thể nạp **giá trị gợi ý ở trạng thái Nháp** cho kế toán xem, chỉ thành "Chờ duyệt" khi KT nhập/ký ví dụ kiểm thử và thành "Hiện hành" khi CH duyệt. Sửa chữ FRD thành "gợi ý theo chính sách hiện hành, kế toán xác nhận".
7. **Người duyệt cấp chi nhánh.** Dùng **một hàng chờ duyệt dùng chung** (G4-APR-01/02) lọc theo người duyệt; G4-APR-03 ánh xạ *loại yêu cầu → vai trò/cấp duyệt* (SYS-13, 14 → QL; SYS-12 mẫu kế toán → KT; còn lại → CH). Màn SYS chỉ hiển thị khối "Yêu cầu chờ duyệt" của đúng người duyệt cùng component (F6R2-06).
8. **Giảm giá vượt hạn mức khi chi nhánh không thuộc nhóm của QV nào.** CH duyệt. Nếu người duyệt đầu tiên (QV) quá hạn xử lý thì chuyển cấp và nhắc theo FR-SYS-015 (BR-SYS-07); thời hạn chuyển cấp cấu hình ở G4-APR-03.
9. **Khóa chi nhánh.** Bước 1 "Ngừng nhận lệnh mới": CH thực hiện trực tiếp; AD chỉ đề xuất, CH duyệt (vì dừng doanh thu); lý do + gõ NGUNG. Bước 2 "Khóa hoàn toàn": chỉ CH, gõ KHOA, chặn khi còn mục treo. Danh sách mục chặn bổ sung ngoài 4 mục đã có: lệnh bảo hành đang mở, đơn mua đang mở/hàng chưa nhận, phiếu chuyển kho đi từ chi nhánh này, kiểm kê chưa duyệt, tiền quỹ còn số dư chưa nộp/chuyển. Tồn kho còn lại không chặn khóa nhưng bắt buộc chọn xử lý (chuyển kho tổng hoặc giữ nguyên, ghi lý do).
10. **Dữ liệu mẫu giá và thuế.** Chấp nhận là minh họa; thêm mục vào danh sách Discovery: bảng giá/giờ chuẩn/đơn giá giờ công thật, thuế suất và ví dụ kiểm thử được kế toán ký, hạn mức giảm giá thật, trước khi nghiệm thu SYS-07…10 (NFR-MNT-01, D-11).
11. **Palette 5 màu.** Giữ BA-06 câu 14: thứ tự màu cố định theo quy trình, cùng một trạng thái luôn cùng một màu. Đề nghị chủ dự án ghi vào phụ lục `design-system.md` (không phải câu hỏi nghiệp vụ). Việc đo tương phản chữ trắng trên 5 màu để lại cho bước kiểm thử bằng công cụ.

**Giả định của designer:**
- Nhóm QV = Miền Nam, KT = Quận 7 + Thủ Đức: **chấp nhận làm mẫu**, thuộc cấu hình (câu 3, 4).
- Số mẫu chưa thuế: chấp nhận, ghi rõ "minh họa" (câu 5).
- Đà Nẵng "ngừng nhận lệnh mới": **chấp nhận**, khớp quyết định khóa hai bước (BA-06 Phụ lục A.1) và việc vẫn có doanh thu; cần đồng bộ số lệnh mở (F6R2-08).

**Làm rõ thêm (câu A – chương trình giảm giá).** FR-INV-025 cho phép hạn mức theo chương trình có thời hạn. Quyết định: chương trình có mức giảm ≤ hạn mức chi nhánh do QL tạo, không cần duyệt; chương trình vượt hạn mức chi nhánh là *hạn mức riêng của chương trình*, do QV đề xuất, CH duyệt, có thời hạn; hết hạn tự dừng, không xóa (RULE-010, tra cứu lệnh đã áp dụng). Cập nhật cách diễn đạt BA-06 Phụ lục A.2 tương ứng.

---

## 5. Về `document.write` và các điểm phụ thuộc trình duyệt/thiết bị/stack: **Chuyển cho dev (không chặn)**

- Dựng khung bằng `document.write` (`pack.js:116–117, 148, 206–207`): chấp nhận cho prototype `file://`; đã có `<noscript>` và handoff §12; dev dựng shell thành component, không sao chép kỹ thuật này.
- `SYS_ALLOW` (`pack.js:152`) là bản sao của 24 `data-allow` – hiện đã khớp; sản phẩm thật phải có một nguồn quyền duy nhất ở máy chủ.
- Lọc theo vai trò/phạm vi bằng CSS và `data-*` chỉ minh họa; lọc thật ở máy chủ (NFR-ISO-01, UAT-06).
- `title` làm tooltip trên nút `disabled` không hiện ở Firefox/cảm ứng; cần kiểm trên thiết bị thật (phần quan trọng đã có dòng chữ `g4r-why`).
- Roving tabindex cho ma trận SYS-04; skeleton theo hình từng khối; đo tương phản chữ trắng trên 5 màu biểu đồ; kiểm tra tràn chữ tiếng Việt và bố cục thực tế ở 320/768/1280 px; `ap-diff` dùng `innerHTML` (chỉ prototype).
- Tooltip biểu đồ trên cảm ứng; trạng thái số tạm/chính thức mới có ở RPT-02/03 (đã nêu ở §14).

## 6. Việc để hoàn tất vòng 3

1. F6-04: ẩn Đà Nẵng cho QV ở RPT-03/04/08 và lọc TN ở RPT-10 (F6R2-04).
2. F6R2-01: sửa nội dung và xác thực của hộp thoại duyệt.
3. Các Minor F6R2-02…09 có thể gộp cùng một lượt; không cần vòng review riêng ngoài việc BA kiểm lại F6-04 và F6R2-01.

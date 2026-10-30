# Review BA – Phase 0 Design Foundation (so với `design-system.md` và checklist §15)

Ngày 30/10/2026 · Người review: BA · Phạm vi đọc: `design/assets/tokens.css`, `base.css`, `app.js` (đọc đủ), `components.css` (đọc các phần chính + tìm kiếm theo mẫu), `design/foundation/*.html` (tìm kiếm theo mẫu badge, phông, phạm vi, menu, date-field; **không đọc từng dòng HTML**). Quyết định nghiệp vụ nêu ở đây lấy từ `docs/ui-ux/ba-decisions.md` (BA đề xuất — chờ xác nhận).

## 1. Tóm tắt

| Mức | Số finding | Mã |
| --- | --- | --- |
| Blocker | 1 | F-01 |
| Major | 9 | F-02 … F-10 |
| Minor | 7 | F-11 … F-17 |

Điểm đạt (không cần sửa): token §12 chép nguyên văn trong `tokens.css` (tên và giá trị khớp); 3 lớp token rõ ràng; badge nào cũng có chữ; không có cỡ chữ 11px (nhỏ nhất 12px cho caption/count); `tabular-nums` có ở `.num/.money/.plate/.code/.plate-tag/.kpi__value/.col-num/.input--num`; định dạng VND `3.450.000 ₫`, KPI `128,5 tr ₫`, ngày `30/10/2026`, tiêu đề "Thứ Sáu, 30/10/2026" đúng; Branch selector có nhãn "Phạm vi dữ liệu", banner phạm vi, và chỉ CH/QV có "Tất cả"; bảng → card ở dưới 640px; `prefers-reduced-motion`; `lang="vi"`; skip link; dialog nguy hiểm có lý do và mã xác nhận; đủ bộ component garage.

## 2. Finding

### Blocker

**F-01 – Trạng thái nghiệp vụ gắn nhầm đối tượng (vi phạm "5 đối tượng, 5 bộ trạng thái")**
- Vị trí: `design/foundation/components.html:203` (bộ "Lệnh sửa chữa" có "Chờ tiếp nhận", "Chờ duyệt báo giá", "Đã duyệt" = Info); `components.html:289-293, 335-336` (hàng bảng mẫu); `components.html:414-421` (Kanban điều phối có cột "Chờ duyệt báo giá" như trạng thái lệnh); `components.html:206` (Báo giá "Đã gửi" = Info); `shell.html:36` (pill menu "8 phiếu chờ duyệt" trên Phiếu sửa chữa), `shell.html:172-175` (bảng lệnh có "Chờ duyệt báo giá"); `docs/ui-ux/00-foundation.md` §6.
- Vấn đề: "Chờ duyệt báo giá" là trạng thái Báo giá; "Chờ tiếp nhận" là Lịch hẹn/Tiếp nhận; Lệnh chỉ có 7 trạng thái (Journey §7, WF-01). "Chờ phụ tùng" chưa có cách hiển thị (phải là Tạm dừng + tag lý do). Lan sang mọi màn hình Phase 1 nếu không sửa.
- Cách sửa: theo `ba-decisions.md` mục A.2: bộ Lệnh = Đã duyệt (Neutral), Đang sửa chữa (Info), Tạm dừng (Warning + tag lý do), Chờ QC (Purple), Sẵn sàng bàn giao, Hoàn tất (Success), Đã hủy (Danger); Báo giá "Đã gửi" = Warning, chữ "Chờ khách duyệt"; thêm bộ Lịch hẹn/Tiếp nhận; Kanban đổi cột đầu thành dải "Trước lệnh" lấy từ báo giá/lịch hẹn; pill menu ghi "báo giá chờ khách duyệt"; cập nhật `00-foundation.md` §6 và §11.

### Major

**F-02 – `:focus-visible` ghi đè bo góc của mọi phần tử**
- Vị trí: `design/assets/base.css:105-110` (`border-radius: var(--radius-sm)` trong `:focus-visible`).
- Vấn đề: khi focus, nút (8px), card (12px), input (8px), badge… đều bị đổi thành 6px; hình dạng nhảy, mâu thuẫn quyết định radius.
- Cách sửa: bỏ `border-radius` khỏi `:focus-visible`; để viền focus theo radius của phần tử (outline hiện đại bo theo phần tử). Giữ outline 2px + `--shadow-focus` (đã duyệt, quyết định C-iii).

**F-03 – Viền control nhập liệu dưới 3:1 (WCAG 2.2 SC 1.4.11)**
- Vị trí: `tokens.css:249, 263` (`--btn-secondary-border`, `--input-border` = border-strong #D1D5DB); `components.css` các `.check__box`, `.radio__box`, `.switch__track` (tìm thấy dùng border-strong, cần rà); `.chip-filter` (297).
- Cách sửa: theo `ba-decisions.md` mục C-iv: thêm `--input-border` ≈ #868D9A (đo lại, nếu < 3:1 dùng #6B7280), áp dụng chung `--control-border` cho checkbox/radio/switch/chip-filter; giữ border.default/strong cho card, bảng. Nút có chữ không bắt buộc. Cập nhật mục 9 của `00-foundation.md` từ "CHƯA ĐẠT" thành "Đạt".

**F-04 – Phông tải từ Google Fonts**
- Vị trí: `index.html:7-8`, `components.html:7-8`, `shell.html:7-8`; `base.css:4` ghi chú.
- Cách sửa: tự host WOFF2 Be Vietnam Pro 400/500/600/700 (subset vietnamese) trong `design/assets/fonts/`, khai báo `@font-face` với `font-display: swap`, bỏ thẻ preconnect/link (quyết định câu 17).

**F-05 – Control dưới 44px trong chế độ cảm ứng/tablet/mobile**
- Vị trí: `components.css:293` `.chip` min-height 32 và `.chip__x` 24×24 (294); `297` `.chip-filter` 36; `257` `.th-sort` 32; `438` `.toast__action` 32; `app.js:225` nút đóng toast 32×32 inline; `.pagination__item` đã có override (306) nhưng `.btn--sm` chỉ nâng khi coarse/<1024 (đã có, 81) thì đạt.
- Cách sửa: thêm vào media `(pointer: coarse), (max-width: 1023px)` min-height/width 44px cho `.chip` (nút xóa chip 44px vùng bấm, có thể vẫn hiển thị 24px bằng padding/pseudo-element), `.chip-filter`, `.th-sort`, `.toast__action`, `.toast__x`, `.pagination` đã có. Ghi rõ trong spec ngoại lệ 40/32px cho chuột ≥1024px (quyết định C-v).

**F-06 – Bảng vai trò → menu lệch FRD §2**
- Vị trí: `app.js:259-270` (`ROLE_MENU`); `00-foundation.md` §7.
- Vấn đề, so với FRD §2: (a) QĐ và TH bị ẩn "Khách hàng & Xe" nhưng FRD cho QĐ quyền X và TH quyền Xn hồ sơ khách/xe, cần xem xe của mình; (b) CV, TH bị ẩn "Nhân sự & Công thợ" nhưng FRD cho Xn (xem công của mình); (c) CV bị ẩn "Tài chính" nhưng FRD cho X "Thu tiền và sổ quỹ" (có thể giới hạn xem trạng thái thu của lệnh); (d) AD chỉ có "Cài đặt", nhưng D-09/G1-DSH-10 có dashboard hệ thống cho AD; (e) mã vai trò `QD` trong code khác `QĐ` trong tài liệu.
- Cách sửa: sửa ma trận: QĐ thêm `cust` (Xem); TH thêm `cust` (Xn, chỉ xe/khách của việc mình, dữ liệu cá nhân che theo câu 8) và `hr` (Xn); CV thêm `hr` (Xn) và `fin` (Xem trạng thái thu); AD thêm `dash` (chỉ sức khỏe hệ thống, không dữ liệu nghiệp vụ). Đặt tên mã vai trò một cách thống nhất (dùng khóa kỹ thuật không dấu, nhãn hiển thị có dấu). Thêm chỉ báo "chỉ xem"/"chỉ phần của tôi" trên mục menu có quyền Xem/Xn (hiện chưa phân biệt).

**F-07 – Branch selector thiếu cấp Nhóm chi nhánh và Pháp nhân; chưa có trạng thái "một chi nhánh"**
- Vị trí: `shell.html:63` và menu chi nhánh; `app.js:208-218, 283-289` (chỉ `data-branch-all` và từng chi nhánh).
- Cách sửa: theo `ba-decisions.md` câu 9: thêm nhóm (QV), nhãn "Tất cả nhóm được giao" cho QV, bộ lọc Pháp nhân ẩn khi một pháp nhân, trạng thái tĩnh khi chỉ một chi nhánh (Phase 1); khi đổi phạm vi có chứng từ đang soạn thì hỏi lưu nháp.

**F-08 – Dialog/dropdown chưa đạt bàn phím ở mức handoff**
- Vị trí: `app.js:119-130` (không khóa focus trong dialog, không `aria-modal` gán động, không inert nền), `app.js:151-169` (dropdown không điều hướng mũi tên, Esc không trả focus về nút gọi), tablist chỉ mũi tên trái/phải (đúng) nhưng thiếu Home/End.
- Mức: Major vì WCAG SC 2.4.3 Focus Order, 2.1.2. Prototype có thể chấp nhận nhưng spec bàn giao dev phải nêu: focus trap, trả focus, roving tabindex menu, `Home/End`.
- Cách sửa: bổ sung mục "Hành vi bàn phím" cho Dialog/Drawer/Dropdown/Menu/Tabs vào `00-foundation.md` §9 và danh sách chưa kiểm; sửa prototype nếu dùng để kiểm thử người dùng.

**F-09 – Dữ liệu cá nhân che theo vai trò chưa đúng quyết định, giá trị đầy đủ nằm sẵn trong DOM**
- Vị trí: `app.js:252-253` (`data-clear` giữ số thật; "Hiện số" không phân vai trò, không lý do); `components.html:189-196` (mẫu masked); `00-foundation.md` §4 (định dạng `090••• ••321`).
- Cách sửa: định dạng `09•• ••• 123`; địa chỉ che số nhà/đường; nút Hiện theo ma trận quyền (câu 8), KT bắt buộc chọn lý do; tự che lại sau 30 giây; ghi chú "production không gửi giá trị đầy đủ tới trình duyệt trước khi Hiện". Thêm mẫu trạng thái "Không có quyền xem" cho TH/TK/AD.

**F-10 – Thiếu Date Picker (popup lịch) trong danh sách component §6**
- Vị trí: `components.html:153-157, 349-350` (`date-field` chỉ là ô nhập `dd/MM/yyyy`), `components.css:135`.
- Vấn đề: design-system §6 liệt kê Date Picker; bộ lọc báo cáo, hạn báo giá, lịch hẹn cần chọn ngày/khoảng ngày.
- Cách sửa: thêm popup lịch (tuần bắt đầu thứ Hai, "Thứ 2… CN", tháng "Tháng 10/2026", hôm nay/hôm qua/7 ngày/30 ngày/tháng này), chế độ khoảng ngày, chặn ngày khóa sổ (WF-06), bàn phím nhập tay luôn được; thêm vào `components.html` và 00-foundation §3.

### Minor

**F-11 – Thiếu bộ badge/tag cho các điểm vừa chốt**
- Vị trí: `components.html:198-216` (khu badge).
- Cách sửa: thêm bộ Lịch hẹn/Tiếp nhận; tag lý do Tạm dừng ("Chờ phụ tùng", "Chờ khách duyệt phát sinh"); tag "Quá hạn" cho công nợ; chip phụ "Đang về N" ở Kho; badge "Chưa đặt định mức"; chỉ báo xử lý hóa đơn (đang gửi/lỗi) tách khỏi badge trạng thái (ba-decisions A.2).

**F-12 – Mã màu và giá trị cố định trong component CSS (ngoài ngoại lệ `#fff`)**
- Vị trí: `components.css:112` (`rgba(220,38,38,.18)` focus lỗi), `components.css:460` (tooltip dark `#E5E7EB/#111827`), `tokens.css:253-254, 193` (hex trong lớp component/semantic mà không đi qua primitive), nhiều `#fff` (36, 66-67, 143, 165, 304, 335, 555…).
- Cách sửa: dùng `--color-text-on-primary`/`--color-text-inverse` thay `#fff`; tạo `--shadow-focus-error`; đưa hex hover của danger vào `--palette-red-700/800`. Không đổi giá trị hiển thị.

**F-13 – Ô tìm kiếm topbar không có ranh giới nhìn thấy**
- Vị trí: `components.css:579` (nền surface-subtle, viền trong suốt) trên topbar trắng (tỉ lệ nền ≈ 1,1:1).
- Cách sửa: dùng `--input-border` (F-03) khi không focus, hoặc nền subtle kèm viền border.default và icon/placeholder đạt 4,5:1 (placeholder dùng text.tertiary #6B7280 đạt trên trắng, kiểm trên subtle).

**F-14 – Chi tiết prototype cần dọn**
- Vị trí: `app.js:215` chữ "8 chi nhánh" cố định; `app.js:92-101` nút đổi theme dark hiện trong showcase; `app.js:253` toast "cần BA xác nhận" nằm trong sản phẩm mẫu.
- Cách sửa: lấy số chi nhánh từ dữ liệu mẫu; ẩn hoặc ghi "bản nháp" cho nút dark (quyết định câu 16); đổi chữ toast thành "Việc xem đã được ghi nhật ký truy cập".

**F-15 – Badge có nội dung rỗng cần xác nhận**
- Vị trí: `components.html:490` (`badge badge--warning` nội dung chỉ thấy thẻ mở trong kết quả tìm, có thể chứa icon + chữ ở dòng sau).
- Cách sửa: designer kiểm tra; mọi badge phải có chữ (design-system §2). Ghi để xác nhận vì BA không đọc hết HTML.

**F-16 – Mẫu in mới là ghi chú**
- Vị trí: `base.css:129-133` (`@media print` chỉ ẩn chrome); `components.html:567` "Mẫu in (ghi chú)".
- Cách sửa: không chặn Phase 0; thêm vào backlog G2-PRT các khổ A4/A5/nhiệt 80 mm theo câu 12; kiểm tra bảng và chữ tối thiểu khi in.

**F-17 – Thiếu component cần cho Phase 1 dù chưa nằm trong §6**
- Vị trí: toàn bộ `components.html` (Select là `<select>` gốc).
- Vấn đề: FR-REC-001 (nhập biển số tra xe/khách), chọn phụ tùng (FR-REC-006) và khách cần Combobox/Autocomplete có tìm kiếm không phân biệt dấu; BR-REC-01 cần tải ảnh/chụp ảnh; bằng chứng duyệt cần OTP/ảnh/chữ ký (FR-REC-009).
- Cách sửa: thêm Combobox/Autocomplete (kể cả gợi ý chuẩn hóa biển số), File/photo upload (nhiều ảnh, nén, xem trước), Số lượng (stepper), Input OTP; đưa vào trước khi thiết kế G2-REC.

## 3. Đối chiếu checklist §15

| Mục | Kết luận |
| --- | --- |
| Đủ primitive và semantic tokens | Đạt. Lưu ý F-12 (hex còn lại) |
| Light theme và cấu trúc sẵn sàng Dark | Đạt (cấu trúc). Dark không thuộc phạm vi phát hành (câu 16) |
| Đủ màu trạng thái nghiệp vụ | **Chưa đạt** cho đến khi sửa F-01 và F-11 |
| Typography hỗ trợ tiếng Việt | Đạt sau khi tự host phông (F-04) |
| Spacing, radius, elevation thống nhất | Đạt sau F-02; radius input chốt 8px |
| Component variants và interaction states | Đạt, trừ F-10, F-17 |
| Bảng dữ liệu và filter patterns | Đạt (sticky header, tổng, chọn dòng, bulk, 4 trạng thái) |
| Responsive desktop/tablet/mobile | Đạt (bảng → card, bottom nav, drawer); F-05 cho cảm ứng |
| Empty, loading, error, permission states | Đạt (có đủ ở component); cần thêm mẫu che dữ liệu theo vai trò (F-09) |
| Accessibility và contrast | **Chưa đạt**: F-03, F-05, F-08, F-13 |
| Dashboard riêng theo role | Ngoài phạm vi Phase 0 (G1-DSH) |
| Figma variables và handoff | Chưa kiểm (không có Figma); tên token CSS khớp §12 |

## 4. Việc tiếp theo cho designer (thứ tự)
1. F-01 (Blocker) rồi F-11, vì các màn Phase 1 dùng trực tiếp.
2. F-02, F-03, F-05, F-13 (một đợt sửa CSS tương phản/focus/touch).
3. F-04, F-07, F-06, F-09 (theo quyết định BA).
4. F-10, F-17 (component còn thiếu), F-08, rồi các Minor còn lại.

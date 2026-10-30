# Review của BA – Gói 6 "Báo cáo và Hệ thống" (G4-RPT, G4-SYS)

Ngày 30/10/2026 · Người review: BA · Đối tượng: `design/g4-reports-system/` (35 màn + `pack.css`, `pack.js`, `index.html`) và `docs/ui-ux/06-reports-system.md`. Chuẩn đối chiếu: `docs/design-system.md`, `00-foundation.md`, `ba-decisions.md`, `screen-inventory.md` (§5, §6, §8.4–8.5), FRD (RPT, SYS, §2, NFR), BRD. Trả lời 14 câu hỏi: `docs/ui-ux/ba-answers-06.md` (gọi là **BA-06** bên dưới).

Phương pháp: đọc toàn bộ `pack.js`, `pack.css`, `index.html`, tài liệu gói 6 và cả 35 màn (RPT-01…11, SYS-01…24); đối chiếu token và class với `tokens.css`, `base.css`, `components.css`; tính lại các con số mẫu. **Chưa mở trình duyệt** nên bố cục thực tế, tràn chữ và tương phản chưa được kiểm trực quan.

## Kết quả

**35 finding: 0 Blocker, 18 Major, 17 Minor.** Không có Blocker vì mọi lỗi sửa được trong prototype/tài liệu mà không cần khách quyết thêm; các điểm cần quyết nghiệp vụ đã được chốt ở BA-06.

### Đã đạt (không cần sửa)

| Hạng mục | Kết quả |
| --- | --- |
| Đủ màn so với danh mục | 35/35 màn có file; mã, tên, ưu tiên khớp `screen-inventory.md` §8.4–8.5; `index.html` liệt kê đủ |
| Token | Các `var(--…)` trong `pack.css`/`pack.js`/HTML đã đối chiếu đều có thật trong `tokens.css` (token chart, z-index, radius, màu semantic, font-size, space, shadow, `--input-border`, `--touch-target`); không đổi giá trị token |
| Class | Class dùng từ `components.css`/`base.css` đều tồn tại (`kpi__scope`, `scope-banner`, `tag--reason`, `record-list--responsive`, `table-wrap--responsive`, `stepper`, `progress`, `bulk-bar`…); class mới có tiền tố `g4r-` (trừ lưu ý F6-31) |
| Biểu tượng | Mọi `#icon` dùng đều có trong `icons.svg` |
| Chữ nhỏ | Không có `11px`/`10px`; cỡ nhỏ nhất `--font-size-xs` = 12px (nhưng xem F6-01) |
| Badge/tag luôn có chữ | Không tìm thấy badge/tag chỉ có icon hoặc rỗng; thiếu/đạt dùng icon + chữ (`g4r-miss`/`g4r-ok`); delta KPI có mũi tên + chữ |
| Tabular-nums | Mã, số tiền, số lượng, KPI, bảng đều dùng `.num`/`.col-num`/`.code`/`.plate`/`.kpi__value`; SVG text và tooltip có `tabular-nums` |
| Biểu đồ (design-system §9) | Line (xu hướng), hbar (so sánh chi nhánh, sắp xếp giảm), stacked bar (trạng thái), bar dọc (tồn theo nhóm); mỗi biểu đồ có tên, đơn vị, kỳ, tooltip hover + focus, nút "Bảng số liệu", chú giải chữ; **không có biểu đồ tròn**, không dual-axis, trục bắt đầu từ 0 |
| RULE-015 | KPI có `kpi__scope`, tệp xuất ghi dòng đầu phạm vi + kỳ + thời điểm (ngoại lệ: F6-03) |
| Ma trận FRD §2 ở SYS-04 | **Đã đối chiếu 12 chức năng × 10 vai trò = 120 ô: khớp từng ô** với FRD §2; cột "Kế toán trưởng" chỉ khác ở hóa đơn điện tử (X→D) đúng ghi chú FRD |
| Không có "Xóa" cho dữ liệu đã ghi sổ/nhật ký | Đạt: dùng Khóa, Thu hồi, Hoàn tác (lô nhập), Ngưng áp dụng, điều chỉnh; nhật ký chỉ đọc (chữ "Xóa" chỉ còn ở "Xóa bộ lọc", lời khuyên sửa tệp Excel, và hành động "Xóa" thông báo ở SYS-23 là dữ liệu không phải chứng từ) |
| Thao tác nguy hiểm có xác nhận | Hầu hết có hộp thoại: tiêu đề hành động, hậu quả, lý do bắt buộc, gõ từ khóa (THAT, KHOI PHUC, GHI LO, AN DANH, mã lô/chi nhánh/tên) — ngoại lệ F6-07, F6-08, F6-32 |
| Trạng thái | Mỗi màn có data/loading/empty/(filtered)/error/denied; trạng thái đặc thù (single, unset, fail, dup, sent, locked, badfile, big, done) đều có; `aria-busy`, `role="alert"` đúng chỗ |
| Số mẫu cộng đúng | Đã tính lại: 612,4+548,9+431,7+337,2+298,3 = 2.228,5 tr; 214+188+156+121+102 = 781; 6.200+11.150+2.000 = 19.350; 19.350+5.500 = 24.850; 42 xe = 19+7+6+6+4; 27+3+1 = 31; 312/460 = 67,8%; 101/105 = 96,2%; tồn khả dụng = thực tế − giữ; ví dụ thuế 8% (85.600 ₫) đúng |

---

## Major

### F6-01 · Major · Chữ trục biểu đồ thực tế nhỏ hơn 12px (trái quy tắc "không nhỏ hơn 12px")
- **Vị trí:** `pack.css:35` (`.g4r-chart__scroll svg { min-width:520px; width:100% }`) với `pack.js:270` và `pack.js:298` (viewBox rộng 640); `06-reports-system.md:188, 235`.
- **Vấn đề:** SVG co theo khung. Khung 520–523 px (ví dụ cột trái `.g4r-split` ở 1280 px, hoặc tối thiểu trên máy tính bảng) thu nhỏ viewBox 640 → hệ số 0,81, nên chữ trục 12px render **≈ 9,7–9,8px**. Tài liệu viết "để chữ trục không nhỏ hơn 12px" là **không đúng**.
- **Cách sửa:** đặt `min-width` của SVG bằng đúng rộng viewBox (640) để hệ số thu nhỏ ≥ 1 và cuộn ngang khi hẹp, **hoặc** tính viewBox theo bề rộng khung (ResizeObserver) hoặc dựng nhãn trục bằng HTML. Cập nhật câu mô tả ở `06` §6 và §8.

### F6-02 · Major · RPT-03: "khớp số liệu" tính sai cơ sở, thiếu thu nợ cũ/cọc, không nêu thuế
- **Vị trí:** `g4-rpt-03.html:31–33, 37, 49–57` (KPI, khối Khớp số liệu, bảng thu theo hình thức); `g4-rpt-10.html:78`.
- **Vấn đề:** FR-RPT-003 yêu cầu doanh thu ngày = tổng phiếu thu **và công nợ phát sinh của ngày**. Prototype lấy "Đã thu" = **tổng phiếu thu trong ngày**, không phân biệt thu cho lệnh phát sinh hôm nay với thu nợ cũ/tiền cọc; nếu có thu nợ cũ thì đẳng thức vỡ, nếu bỏ thì không khớp sổ quỹ. Không ghi doanh thu **chưa thuế hay gồm thuế** trong khi thu và công nợ là số gồm thuế. Ngoài ra KPI ghi "5 phiếu" (`:32`), bảng ghi hàng tổng "5 lệnh" ở cột "Số phiếu" (`:55`) trong khi 3+2+1 = **6 phiếu** (khớp RPT-10) và alert ghi "6 lệnh".
- **Cách sửa:** áp BA-06 Câu 4.1: đổi nhãn thành "Đã thu của lệnh hoàn tất trong ngày", thêm dòng "Thu nợ cũ/Thu trước" riêng, ghi "chưa thuế"/"gồm thuế" ở từng số, sửa số phiếu (6 phiếu / 5 lệnh) và hàng tổng.

### F6-03 · Major · Banner phạm vi tĩnh và sai nhãn trên báo cáo (RULE-015)
- **Vị trí:** `g4-rpt-03.html:19`, `g4-rpt-10.html:19`, `g4-rpt-11.html:19` (dùng `cfgScope`); `pack.js:127–129`.
- **Vấn đề:** `cfgScope` làm banner ghi "**Phạm vi cấu hình:** Chi nhánh Quận 7 …" cố định, kể cả khi CH đang chọn "Tất cả chi nhánh" ở topbar; nhãn "Phạm vi cấu hình" là nhãn của màn cài đặt, sai ngữ nghĩa với báo cáo. Các màn RPT-02/04/06/07/08 dùng `data-scope-text` đúng nhưng dữ liệu bên dưới tĩnh (đã tự nhận ở `06` §11); riêng KPI RPT-08 `:31` dùng số của Quận 7 (214 lệnh, 612,4 tr) dưới nhãn "Phạm vi theo bộ chọn".
- **Cách sửa:** báo cáo không dùng `cfgScope`; dùng `data-scope-text` và với RPT-03/10 buộc phạm vi một chi nhánh (hoặc bảng nhiều dòng như BA-06 Câu 7). Khi dữ liệu mẫu cố định, khóa nhãn theo dữ liệu mẫu và ghi "(dữ liệu mẫu)" thay vì đổi nhãn giả.

### F6-04 · Major · Dữ liệu mẫu làm lộ nhiều chi nhánh cho vai trò chỉ có một chi nhánh (NFR-ISO-01, UAT-06)
- **Vị trí:** `g4-rpt-04.html:12, 33–38, 49–54` (mặc định QL: biểu đồ và bảng có Quận 1, Thủ Đức, Biên Hòa, Đà Nẵng); `g4-rpt-03.html:73–85` (bảng hợp nhất hiện cho QL/KT); `g4-rpt-09.html:45–49` (QL thấy Quận 1, Thủ Đức); `g4-rpt-10.html` (CV, TN thấy toàn bộ 6 lệnh, không lọc "của tôi").
- **Vấn đề:** vai trò QL/CV/QĐ chỉ có một chi nhánh (`ba-decisions.md` câu 9) nhưng màn mặc định cho QL hiện số liệu đa chi nhánh; người xem prototype hiểu nhầm là đúng. RPT-10 không có `data-own` nên Xn (CV, TN) không được lọc.
- **Cách sửa:** thêm `data-show-roles`/lớp theo vai trò như đã làm ở SYS-01/19 (`g4r-notq7`): QL chỉ thấy dòng chi nhánh mình, bảng hợp nhất chỉ CH/QV; đặt `data-own` cho RPT-10 và lọc theo người phụ trách; ghi chú rõ cho dev rằng lọc phải ở máy chủ.

### F6-05 · Major · RPT-06 cho Thủ kho thấy giá vốn (trái FRD §2)
- **Vị trí:** `g4-rpt-06.html:12` (mặc định TK), `:27` (Giá trị tồn kho), `:30` (hao hụt bằng tiền), `:33–37` (biểu đồ giá trị tồn theo nhóm), `:64–68` (cột Giá trị hàng chậm).
- **Vấn đề:** FRD §2 "Công nợ và giá vốn": TK = "–". Giá trị tồn, hao hụt tiền và giá trị hàng chậm đều dựa vào giá vốn (phương pháp giá vốn còn `[Cần xác nhận]`).
- **Cách sửa:** BA-06 Phụ lục A.3: TK chỉ thấy số lượng; ẩn bằng `data-show-roles="CH QV QL KT"` các KPI/biểu đồ/cột tiền, hiện dòng giải thích "Vai trò của bạn chỉ xem số lượng". Thêm trạng thái cho TK ở `data-own`.

### F6-06 · Major · SYS-04 tab "Quyền theo hành động": cột Xuất/Quản lý vượt ma trận chuẩn
- **Vị trí:** `g4-sys-04.html:85–90` (`var can = max[ai] === 1 || ai >= 6`), `:99` (đếm thay đổi), `:121` (hộp thoại).
- **Vấn đề:** hai cột "Xuất dữ liệu" và "Quản lý" luôn bật cho **mọi** chức năng, kể cả chức năng vai trò đó "–" (ví dụ Thợ, Thủ kho với hồ sơ khách, AD với dữ liệu nghiệp vụ) → cấp được quyền xuất dữ liệu không có quyền xem, trái FRD §2 và ghi chú AD. Bộ đếm "thay đổi chưa lưu" cộng mỗi lần bấm (bật rồi tắt vẫn tính 2); hộp thoại ảnh hưởng luôn nói "Vai trò Thủ kho… 2 người" dù chọn vai trò khác.
- **Cách sửa:** chỉ cho chọn Xuất/Quản lý khi đã có Xem (BA-06 Câu 10.4); AD không có Xuất ở chức năng khách; đếm theo **khác biệt thực** so với giá trị đã lưu; tạo nội dung hộp thoại từ vai trò đang chọn.

### F6-07 · Major · Luồng duyệt chưa đủ: thiếu Từ chối/hàng chờ; SYS-21 mở nhầm hộp thoại
- **Vị trí:** `g4-sys-21.html:34, 45` (nút "Duyệt hoàn tác" của lô **L-0011** mở `dlg-undo` có tiêu đề "Hoàn tác lô **L-0012**", bắt gõ `L-0012`, nút "Gửi yêu cầu hoàn tác" — là hộp thoại của người đề xuất); `g4-sys-07.html:49`, `g4-sys-08.html:32`, `g4-sys-09.html:39`, `g4-sys-10.html:36`, `g4-sys-12.html:49`, `g4-sys-14.html:43` (nút Duyệt bắn thông báo ngay, không xác nhận, không có Từ chối); `g4-sys-04.html`, `g4-sys-22.html`, `g4-sys-23.html`, `g4-sys-24.html`, `g4-sys-16.html:67` (CH được nói là duyệt nhưng **không có hàng chờ duyệt, nút Duyệt hay Từ chối**).
- **Vấn đề:** FR-SYS-013 có hai hành động Duyệt và Từ chối; BA-06 Câu 2 yêu cầu Từ chối bắt buộc lý do. Hiện chỉ phía người đề xuất được thiết kế.
- **Cách sửa:** một component "Yêu cầu chờ duyệt" dùng chung (người đề xuất, thay đổi trước → sau, ảnh hưởng, Duyệt/Từ chối + lý do); SYS-21 dùng hộp thoại riêng tham số hóa theo lô; Duyệt thay đổi tài chính cần xác nhận một bước.

### F6-08 · Major · SYS-03: "Thu hồi vai trò" mở hộp thoại "Khóa tài khoản"
- **Vị trí:** `g4-sys-03.html:43–44` (`data-open="dlg-lock"`), hộp thoại ở `:74`.
- **Vấn đề:** thu hồi **một** vai trò (người vẫn đăng nhập được) lại hiện hậu quả của khóa toàn bộ tài khoản ("đăng xuất khỏi mọi thiết bị"). Hậu quả sai làm mất ý nghĩa của xác nhận ở thao tác nguy hiểm.
- **Cách sửa:** hộp thoại riêng "Thu hồi vai trò <tên vai trò> ở <chi nhánh>?" nêu quyền sẽ mất (phần hợp còn lại), lý do bắt buộc, nhập lại mật khẩu; ngăn tự thu hồi quyền của chính mình.

### F6-09 · Major · SYS-06: trường có ngày hiệu lực sửa trực tiếp, hiệu lực ngay
- **Vị trí:** `g4-sys-06.html:41–42` (Bảng giá áp dụng, Đơn giá giờ công `180.000`), `:54` ("Thay đổi có hiệu lực ngay"), `:39–40`; mô tả `:18`.
- **Vấn đề:** đơn giá giờ công và bảng giá là cấu hình có ngày hiệu lực + duyệt (SYS-07/FR-SYS-006, NFR-MNT-01), nhưng ở đây là ô nhập thường, nút Lưu hiệu lực ngay, và **CH được sửa** (`data-edit-roles="AD CH"`) trong khi mô tả nói AD/CH "duyệt". Mâu thuẫn trong cùng trang và với SYS-07.
- **Cách sửa:** nhóm "Tài chính và pháp lý" chỉ **hiển thị** giá trị hiện hành + phiên bản sắp hiệu lực, nút "Đổi…" mở drawer có ngày hiệu lực, lý do, Chờ duyệt (CH chỉ duyệt, không sửa); đơn vị phát hành và kho cũng đi qua drawer. Sửa dòng chân trang.

### F6-10 · Major · SYS-09: QL tự nâng hạn mức giảm giá của chi nhánh mình
- **Vị trí:** `g4-sys-09.html:21, 37–41` (`data-edit-roles="QV QL"`), `:43` ("QL chỉ sửa dòng chi nhánh mình; vượt mức công ty mới cần CH duyệt"), `:63`; `g4-sys-19.html:56` (QL "Duyệt giảm giá vượt hạn mức").
- **Vấn đề:** FR-INV-025: giảm quá hạn mức bị chặn đến khi **quản lý khu vực hoặc chủ** duyệt. Cho QL nâng hạn mức của chính mình (đến mức công ty không cần duyệt) và để QL duyệt giảm vượt hạn mức là tự cấp quyền, vô hiệu hóa kiểm soát. Chương trình giảm (`:65–66`) cũng không có kiểm tra "trong hạn mức" hoặc duyệt.
- **Cách sửa:** BA-06 Phụ lục A.2: QL chỉ tạo chương trình trong hạn mức; hạn mức do QV đề xuất, CH duyệt; mẫu nhật ký SYS-19 đổi người duyệt thành QV/CH; thêm kiểm tra mức giảm của chương trình ≤ hạn mức.

### F6-11 · Major · SYS-05: logic khóa chi nhánh tự mâu thuẫn; hộp thoại dùng chung cho mọi chi nhánh
- **Vị trí:** `g4-sys-05.html:37–41, 50` (bốn nút "Khóa chi nhánh…" mở cùng `dlg-lockbr` ghi Quận 7, gõ `Q7`).
- **Vấn đề:** (a) hộp thoại nói "không tạo được phiếu thu, hóa đơn, phiếu kho mới" **và** "còn 12 lệnh đang xử lý, 1 phiếu thu chưa chốt ca: cần xử lý trước khi khóa" nhưng vẫn cho gõ mã để khóa → 12 lệnh đang mở không thể thu tiền/xuất hóa đơn/xuất kho (vi phạm RULE-007: hoàn tất lệnh cần các chứng từ này). (b) Khóa Quận 1, Thủ Đức, Biên Hòa vẫn hỏi "Khóa Chi nhánh Quận 7?".
- **Cách sửa:** BA-06 Phụ lục A.1 (khóa hai bước, chặn khi còn mục treo, liệt kê mục chặn); tham số hóa tên/mã/số liệu theo dòng.

### F6-12 · Major · SYS-13: tắt được cờ "Bắt buộc"/cổng QC của bước gắn với quy tắc
- **Vị trí:** `g4-sys-13.html:42–44, 50–53` (công tắc Bắt buộc cho "Lập báo giá và khách duyệt", "Kiểm tra chất lượng", "Thu tiền, hóa đơn và bàn giao"; "Đặt lịch bảo dưỡng kế tiếp" bắt buộc=0).
- **Vấn đề:** RULE-005/006 (chỉ làm hạng mục đã duyệt), FR-REC-016 (lệnh chưa đạt QC không sang thu tiền), RULE-007 là quy tắc cố định; giao diện cho AD tắt chúng bằng cấu hình.
- **Cách sửa:** BA-06 Phụ lục A.4: khóa các công tắc này (ô disabled kèm dòng lý do "bước bắt buộc theo quy tắc nghiệp vụ"), chỉ cho đổi tên, người phụ trách, thứ tự, yêu cầu ảnh.

### F6-13 · Major · SYS-20: quyền theo loại dữ liệu chưa đúng FRD §2/PII; giá thiếu ngày hiệu lực; ghi lô thật không duyệt
- **Vị trí:** `g4-sys-20.html:46` (AD, QL nhập "Khách và xe" với xem trước đầy đủ `:113–116`, bảng lỗi hiện giá trị gốc `:94–98`), `:47` (`data-edit-roles="AD KT TK"` cho Tồn kho đầu kỳ), `:45, 78, 114` (giá niêm yết không có ngày hiệu lực), `:54, 124, 142` (chọn môi trường "Thật" nhưng văn bản vẫn "môi trường thử"; không bước duyệt cho loại tài chính).
- **Vấn đề:** AD không được xem dữ liệu nhạy cảm của khách (FRD §2 ghi chú) nhưng xem trước/lỗi hiện nguyên giá trị; KT chỉ có X ở kho nhưng được nhập tồn đầu kỳ; giá/giờ chuẩn là cấu hình có hiệu lực theo ngày; ghi lô thật của tồn/công nợ đầu kỳ là thao tác nguy hiểm không có duyệt.
- **Cách sửa:** BA-06 Câu 11: che PII cho AD ở ánh xạ/lỗi/xem trước; bỏ KT khỏi tồn đầu kỳ (TK nhập, QL duyệt); thêm trường Ngày hiệu lực cho loại có giá; đổi văn bản theo môi trường; thêm duyệt cho lô thật loại tài chính.

### F6-14 · Major · SYS-22: khôi phục không chọn được "theo thời điểm"; hộp thoại một mẫu cho mọi dòng
- **Vị trí:** `g4-sys-22.html:42–44, 51` (`dlg-real` cố định 30/10/2026 02:00 cho cả ba bản; `dlg-trial` chỉ liệt kê ba mốc 02:00).
- **Vấn đề:** FR-SYS-010 yêu cầu "khôi phục theo thời điểm"; NFR-AVA-02 yêu cầu mất tối đa 1 giờ dữ liệu; giao diện chỉ khôi phục theo bản hằng ngày (mất đến 24 giờ). Hộp thoại khôi phục thật ghi sẵn "47 lệnh, 31 phiếu thu, 2 hóa đơn" không đổi theo bản chọn, không nêu số chi nhánh bị ảnh hưởng, và CH không có hàng chờ duyệt (F6-07).
- **Cách sửa:** chọn ngày + giờ (kèm khoảng khả dụng), tính số liệu mất theo thời điểm chọn và liệt kê theo chi nhánh; truyền tham số bản/thời điểm vào hộp thoại.

### F6-15 · Major · RPT-01: liên kết dẫn vai trò vào màn "Không có quyền"
- **Vị trí:** `g4-rpt-01.html:27–31` (Thường dùng cho CH QV QL **KT** gồm "Báo cáo lệnh sửa chữa"), `:32` ("Lệnh sửa chữa của tôi" cho CV QĐ **TH TK TN**); `g4-rpt-04.html:13` (`data-allow="CH QV QL CV QD"`).
- **Vấn đề:** KT, TH, TK, TN bấm vào RPT-04 ở chính trang chủ báo cáo của họ sẽ gặp "Không có quyền". TH/TN không có báo cáo nào mở được (các thẻ "Năng suất" là `#`); TK có RPT-06 nhưng không có lối vào. Khi mọi nhóm rỗng, trang chỉ còn "Thường dùng" thay vì trạng thái rỗng.
- **Cách sửa:** BA-06 Phụ lục A.5: lối tắt theo từng vai trò (TK → RPT-06 phần số lượng; CV/QĐ → RPT-04 "của tôi"; KT bỏ RPT-04); TH/TN hiện trạng thái rỗng giải thích và liên kết dashboard; bỏ thẻ `#`.

### F6-16 · Major · Điều hướng cài đặt liệt kê mọi màn cho mọi vai trò
- **Vị trí:** `pack.js:148–163` (`subnav()` không lọc theo `data-allow`), `pack.js:414–416` (mở mục Cài đặt bằng `gate()`).
- **Vấn đề:** KT/CV/QĐ/TK thấy cả 24 mục và vào ngõ cụt "Không có quyền"; cơ chế mở menu bằng mã prototype không phản ánh `ROLE_MENU` của foundation.
- **Cách sửa:** BA-06 Câu 1: lọc thanh điều hướng theo quyền của vai trò, ẩn nhóm rỗng; cập nhật `00-foundation.md` §7 và `ROLE_MENU`.

### F6-17 · Major · Công thức chỉ số và nhãn không nhất quán giữa các màn
- **Vị trí:** `g4-rpt-03.html:67` và `g4-rpt-02.html:50` ("Số lệnh = lệnh mở trong kỳ") so với `g4-rpt-08.html:31` ("÷ số lệnh hoàn tất", 612,4 tr ÷ 214); `g4-rpt-08.html:33` (nhãn "Tỷ lệ **lệnh** làm lại" nhưng công thức theo **hạng mục**); `g4-rpt-04.html:28` (mốc "đến Hoàn tất"); `g4-rpt-08.html:35` (DSO "× 30", 19 ngày không suy ra được từ công nợ 37,5 tr / doanh thu 612,4 tr = ~1,8 ngày); `g4-rpt-07.html:31` ("Công thức do BA xác nhận" nằm trong giao diện).
- **Vấn đề:** cùng một số (214) được gọi là "lệnh mở" và "lệnh hoàn tất"; nhãn/đơn vị lệch; DSO cố định 30 ngày; ghi chú nội bộ lộ ra giao diện.
- **Cách sửa:** áp bảng BA-06 Câu 4 (đặt tên "Số lệnh mở" và "Số lệnh hoàn tất", đổi mốc thời gian hoàn thành sang Sẵn sàng bàn giao, tách hai chỉ số làm lại, DSO theo số ngày thực của kỳ); bỏ dòng "do BA xác nhận"; thêm công thức hiển thị cho mọi KPI.

### F6-18 · Major · RPT-05: thiếu trạng thái "Không áp dụng" và chưa xét trạng thái hóa đơn
- **Vị trí:** `g4-rpt-05.html:43–72` (cột Phiếu xuất kho, Hóa đơn), `:81`.
- **Vấn đề:** lệnh chỉ có nhân công không có phiếu xuất kho sẽ bị báo "Thiếu phiếu xuất kho" sai; cột Hóa đơn chỉ có số hóa đơn, không xét trạng thái (Hủy/lỗi vẫn có thể bị coi là "có"). Làm giảm độ tin cậy của báo cáo Must FR-RPT-004.
- **Cách sửa:** BA-06 Câu 6: thêm "Không áp dụng", hiển thị trạng thái hóa đơn do nhà cung cấp trả về, nêu quy tắc "thiếu" trong chân bảng.

---

## Minor

### F6-19 · Minor · SYS-24: nhận diện "hạ mức bảo mật" thiếu
- `g4-sys-24.html:78–89` chỉ xét checkbox bỏ chọn, `data-up` tăng, và `pw-l` giảm. Các ô đánh dấu `data-sec` còn lại (`pw-h`, `lk-n` số lần sai, `lk-m` thời gian khóa, `lk-l`, `lk-i` hiệu lực liên kết, `mf-t` tin cậy thiết bị) đổi theo hướng yếu đi vẫn không bật cảnh báo/"Gửi Chủ garage duyệt". **Sửa:** khai báo hướng "yếu đi" cho từng ô (`data-weaker="up|down"`).

### F6-20 · Minor · `data-edit-roles` ghi đè trạng thái disabled ban đầu
- `pack.js:409–412` đặt `el.disabled = !can`; `g4-sys-13.html:54` và `g4-sys-14.html:36, 40` có nút lên/xuống `disabled` ở mục đầu/cuối **đồng thời** có `data-edit-roles` → AD/QĐ thấy nút "Chuyển bước đầu lên" được bật. **Sửa:** chỉ ghi đè khi phần tử chưa bị khóa bởi logic khác (dùng thuộc tính riêng `data-locked`), hoặc tính lại trạng thái đầu/cuối sau khi gate.

### F6-21 · Minor · Touch target và lý do khóa chỉ nằm ở `title`
- Nhãn checkbox ma trận đặt `min-height:44px` nhưng rộng ~20px (`g4-sys-04.html:91`, `g4-rpt-09.html:43–48`, `g4-sys-13.html:51–53`) → vùng bấm 20×44. Hàng hbar có `tabindex=0` cao 36px (`pack.css:60`). Nhiều nút khóa chỉ có `title` (tự nhận ở `06` §8): không hiện trên cảm ứng, và Firefox không hiện tooltip cho nút `disabled`. **Sửa:** `min-width:44px` cho nhãn; dòng giải thích hiển thị hoặc `aria-disabled` thay `disabled` kèm văn bản lý do; ưu tiên dòng chữ nhìn thấy cho: nút Xuất (`pack.js:422`), Sửa trong bảng SYS-07/09/11, radio ở SYS-20 (`:53` nói "hover vào mục" nhưng radio không có `title`).

### F6-22 · Minor · Dùng màu ngữ nghĩa sai chỗ
- Thẻ đỏ `tag--danger` cho thuộc tính "Bắt buộc" (`g4-sys-14.html:36–39`, `g4-sys-20.html:75–77`) và `g4r-miss` (đỏ, icon cảnh báo) cho "Chưa bật (không bắt buộc)" MFA (`g4-sys-01.html:50`) trái design-system §9 (không dùng đỏ làm màu trang trí) và làm loãng ý nghĩa cảnh báo. **Sửa:** "Bắt buộc" dùng tag Neutral/Info; MFA không bắt buộc dùng chữ trung tính.

### F6-23 · Minor · Dữ liệu mẫu mâu thuẫn giữa các màn
- Đà Nẵng bị **khóa từ 01/10/2026** (`g4-sys-05.html:41`, `g4-sys-15.html:31`) nhưng có doanh thu tháng 10, lệnh đang sửa, đơn giá giờ công và hạn mức đang dùng (RPT-02/04/08, SYS-07/09).
- "3 tài khoản đã khóa trên 12 tháng" (`g4-sys-23.html:47`) trong khi SYS-01 chỉ có 10 người dùng, 1 người bị khóa 4 ngày.
- Pháp nhân 1 "4 chi nhánh" (`g4-sys-05.html:35`) so với 5 chi nhánh.
- Đặng Thị Lan là "Thu ngân" ở RPT-09 (`:46`) nhưng là người phụ trách lệnh ở RPT-04 (`:53`); "Đặt lại PIN" thiết bị xưởng cho Lê Minh Quân là QL (`g4-sys-03.html:56`) trong khi PIN chỉ cho TH/QĐ (D-04).
- RPT-04 hiển thị tỷ lệ đúng hạn 87,5% (toàn chuỗi) dưới KPI của vai trò mặc định QL (Quận 7 = 91,6% ở RPT-02).
- **Sửa:** chọn một chi nhánh khóa/mở nhất quán (hoặc đổi chi nhánh khóa thành chi nhánh không dùng ở báo cáo), đồng bộ số liệu giữa SYS-01/23 và các báo cáo.

### F6-24 · Minor · SYS-02: minh họa quyền của QL và rò rỉ thông tin
- `:45, 54–55`: khi vào bằng QL, dòng mặc định chọn "Kế toán" (vai trò QL không được gán) và `select` không bị khóa; chỉ có thẻ ghi chú. Danh sách vai trò thiếu Chủ garage, Quản trị hệ thống và các vai trò bổ sung bản 0.2 (mua hàng, nhân sự, QC). `:61`: lựa chọn "Đầy đủ (cần CH duyệt)" **theo người** trái BA-06 Câu 10. `:75`: lỗi email trùng nêu tên và chi nhánh tài khoản đã có, lộ thông tin ngoài chi nhánh cho QL. **Sửa:** khóa option vượt quyền kèm lý do khi vai trò là QL, đặt dòng mặc định theo vai trò, bỏ lựa chọn theo người, thông báo trung lập cho QL ("Email đã có tài khoản; nhờ Chủ garage/Quản trị xử lý").

### F6-25 · Minor · SYS-01
- Bộ lọc vai trò thiếu Quản lý vùng, Quản đốc (`:36`); QL chỉ thấy người có vai trò ở Quận 7 nhưng ẩn Phạm Thu Hà (KT có vai trò Quận 7 và Thủ Đức, `:54`); bộ lọc/nút Áp dụng không gắn `data-toast` hay hành vi (nhất quán với các màn khác thì chấp nhận). **Sửa:** bổ sung lựa chọn; xác định rõ người có vai trò ở nhiều chi nhánh hiển thị với QL ra sao (đề xuất: hiện, vai trò ngoài chi nhánh mình ẩn).

### F6-26 · Minor · SYS-10: thiếu lịch sử trong màn, thiếu quy tắc làm tròn, lệch FR-ACC-009
- FR-SYS-006 yêu cầu lịch sử thay đổi cho mỗi danh mục; SYS-07 có tab Lịch sử, SYS-10 chỉ nhắc nhật ký (`:41`). Ví dụ kiểm thử chưa có quy tắc làm tròn (theo dòng hay theo hóa đơn) — điểm kế toán cần ký. `:58` "Chưa có giá trị mặc định" khác FR-ACC-009 "mặc định theo chính sách hiện hành" (xem BA-06 Phụ lục B). **Sửa:** thêm tab lịch sử; thêm ví dụ làm tròn; ghi chú tài liệu.

### F6-27 · Minor · Vai trò và điều khiển còn thiếu ở nhóm danh mục/tích hợp
- Cuối SYS-07/09/10 nói "Ngưng áp dụng" nhưng không có nút (`g4-sys-07.html:55`). SYS-12 `data-allow="AD KT"` (`:22`) loại CH, QL dù matrix cho CH (D) và QL dùng mẫu in; nút "Sửa" của KT không bị khóa (`:46–51`). SYS-17/18 loại CH (`g4-sys-17.html:13`, `g4-sys-18.html:13`); "Bật gửi tin cho khách" chỉ AD + lý do (`g4-sys-17.html:39`) trong khi liên quan đồng ý của khách (FR-CRM-010). SYS-18 tái tạo khóa đóng ngay mà **không hiện khóa mới một lần** (`:60`; tài liệu nói hộp thoại 2 pha). SYS-21 loại QL dù QL nhập lô (`g4-sys-21.html:13`). SYS-15 phát hành không có ngày hiệu lực/duyệt (`:40`). **Sửa:** theo từng ý nêu trên; đồng bộ với BA-06 Phụ lục B.

### F6-28 · Minor · SYS-23: thiếu dòng chính sách; lộ tham chiếu nội bộ trong giao diện
- Thiếu dòng cho nhật ký thao tác, tệp XML/PDF hóa đơn, ảnh/tệp đính kèm, bản sao lưu (BA-06 Câu 13); hộp thoại ẩn danh không liệt kê loại trừ (khách còn công nợ/bảo hành/lệnh mở) `:50`; ô "Căn cứ" ghi "Đề xuất BA (ba-decisions câu 15)" `:37` — tham chiếu tài liệu nội bộ lộ ra giao diện người dùng. **Sửa:** thêm dòng và quy tắc loại trừ; thay bằng "Đề xuất, chờ xác nhận".

### F6-29 · Minor · SYS-20: chi tiết nhỏ
- Bảng lỗi ghi "lọc theo loại lỗi" (`:90`) nhưng không có điều khiển lọc; chưa nêu giới hạn số dòng (chỉ 20 MB `:69`). **Sửa:** thêm lọc hoặc bỏ chữ; nêu "20 MB / 50.000 dòng" (BA-06 Câu 11).

### F6-30 · Minor · Hộp thoại xuất (RPT-11)
- `pack.js:418` cho AD quyền xuất báo cáo; tài liệu `06` §5/§9.5 cũng ghi AD — trái FRD §2 (AD "–" ở báo cáo) và BA-06 Câu 3. Chọn cột cá nhân chưa yêu cầu **nhập lại mật khẩu** (`ba-decisions.md` D-02: xuất danh sách khách) (`pack.js:222`). Hộp thoại không nêu số dòng ước tính/giới hạn; cột cố định "tên khách" dù xuất nhật ký. `g4-rpt-11.html:42–43` ghi tệp lưu 7 ngày nhưng lịch sử lưu 12 tháng (`:37`) — chưa nói rõ lịch sử và tệp là hai thời hạn khác nhau. **Sửa:** theo BA-06 Câu 3; thêm bước mật khẩu; làm rõ hai thời hạn.

### F6-31 · Minor · Biểu đồ và tiện ích
- Hàm `nice()` (`pack.js:257`) chọn 5×10^k cho f∈(2,5;5], nên RPT-03 có max 26,4 nhưng trục lên **50** (biểu đồ chiếm nửa khung). Mỗi điểm line chart là một điểm dừng Tab (14–30 điểm/biểu đồ) — nên dùng một điểm dừng + phím mũi tên (tự nhận ở `06` §11 chỉ với ma trận). Lớp `.s1…s5`, `.f1…f5`, `.b1…b5` (`pack.css:49–51`) không có tiền tố `g4r-` dễ trùng với gói khác. Tab ở RPT-09 (`g4-rpt-09.html:27–31`) cùng trỏ một panel và không lọc. Nút "Ghim" ở RPT-01 là `aria-pressed="false"` cố định. **Sửa:** theo từng ý.

### F6-32 · Minor · Ô "Nhập lại mật khẩu" không được bắt buộc
- `data-confirm-guard` (`app.js:159–169`) chỉ kiểm lý do và từ khóa; ô mật khẩu ở `g4-sys-03.html:74` (`lk-p`, `ss-p`), `g4-sys-18.html:60` (`rg-p`) là ô trang trí, nút xác nhận vẫn bật khi để trống. **Sửa:** mở rộng guard (`data-confirm-secret`) hoặc ghi chú là prototype; tài liệu dev nêu bắt buộc xác thực lại.

### F6-33 · Minor · Rủi ro khi dựng khung bằng `document.write` (đánh giá theo yêu cầu)
- **Hiện trạng:** `pack.js:116–117, 145, 179–180` dùng `document.write` để chèn CSS, toàn bộ shell, phần đầu/đuôi trang và cả `app.js`; mọi trang dùng thêm script nội tuyến (`g4rPage`, `g4rChart`, `g4rEnd`).
- **Rủi ro:** (1) **Không có JavaScript hoặc lỗi giữa chừng → trang trắng/thiếu thẻ đóng** (không `<noscript>`), kể cả nội dung nghiệp vụ; (2) chặn phân tích HTML, chậm trên mạng yếu, dễ nhấp nháy; (3) không dùng được CSP chặt (`script-src` không có `'unsafe-inline'`) vì mọi trang có script nội tuyến; (4) `document.write` đã lỗi thời, lỗi nếu gọi sau khi tải xong, một số trình duyệt/chế độ có thể chặn; (5) cấu trúc shell bị lặp lại với `design/foundation/shell.html` (menu, nhãn) → dễ lệch; (6) trợ năng: skip link, landmark chỉ có sau khi chạy script; công cụ đọc màn hình/crawler không thấy gì khi JS lỗi.
- **Đánh giá:** chấp nhận được **chỉ cho prototype xem nội bộ qua `file://`** vì dev sẽ dựng bằng component thật. **Không** được coi là mẫu hiện thực. **Sửa nhẹ:** thêm `<noscript>` ở mọi trang ("Bản prototype cần bật JavaScript"); handoff ghi rõ "không sao chép kỹ thuật ghép này"; khi chuyển sang dev, tách shell thành component dùng chung.

### F6-34 · Minor · RPT-02: phạm vi theo quyền và so sánh kỳ
- KT (phạm vi `pick`) và QV (nhóm được giao) vào RPT-02 phải chỉ thấy chi nhánh được giao; hàng tổng đang ghi "Toàn chuỗi (5 chi nhánh)" (`g4-rpt-02.html:74`) → đổi "Tổng các chi nhánh trong phạm vi". Chỉ số "so với tháng 09" chưa ghi "cùng số ngày" (tháng 10 chưa kết thúc, `:32, 69–73`); chi nhánh khóa vẫn xếp hạng (F6-23).

### F6-35 · Minor · Tài liệu `06-reports-system.md` có điểm chưa chính xác
- §6 và §8 (chữ trục ≥ 12px) sai (F6-01); §5 và §9.5 ghi AD có quyền xuất (F6-30); §9.3 coi công thức là đề xuất của designer — nay thay bằng BA-06; §10 cần cập nhật "đã trả lời" kèm tham chiếu `ba-answers-06.md`; §2.2 ghi SYS-09 "CH (D) QV QL" và SYS-06 "QL (giới hạn)" cần sửa theo BA-06 Phụ lục A.2/B; §9.4 ("mọi thay đổi cấu hình qua CH duyệt") mâu thuẫn BA-06 Câu 2 (ba nhóm). **Sửa:** designer cập nhật khi chỉnh prototype.

---

## Việc cần cập nhật ở tài liệu khác (không thực hiện trong lượt này)

| Tài liệu | Nội dung | Liên quan finding |
| --- | --- | --- |
| `docs/functional-requirements.md` | Tách hàng "Danh mục và cấu hình nghiệp vụ" ở §2; làm rõ FR-SYS-010 (khôi phục theo thời điểm); FR-RPT-010, 012, 016 (định nghĩa chỉ số, câu 5); FR-ACC-009 (mặc định); thêm UAT khớp số liệu RPT-03/05 | F6-06, F6-14, F6-17, F6-26 |
| `docs/ui-ux/screen-inventory.md` §8.5 | SYS-09, SYS-20, SYS-21 theo BA-06 Phụ lục B | F6-10, F6-13, F6-27 |
| `docs/ui-ux/00-foundation.md` §7 | Chế độ menu "Cài đặt" giới hạn | F6-16 |
| `docs/user-journey-business-workflow.md` §8 | Khóa chi nhánh hai bước; luồng duyệt cấu hình ba nhóm | F6-07, F6-11 |
| `docs/ui-ux/06-reports-system.md` | Các điểm ở F6-35 | F6-35 |
| `docs/design-system.md` | Không đổi. Ghi nhận phụ lục: màu biểu đồ có thứ tự cố định theo quy trình (BA-06 Câu 14) | — |

## Thứ tự sửa đề xuất cho designer

1. Nhóm sai logic/quyền: F6-02, F6-04, F6-05, F6-06, F6-08, F6-09, F6-10, F6-11, F6-12, F6-13.
2. Nhóm luồng duyệt và điều hướng: F6-07, F6-14, F6-15, F6-16, F6-18.
3. Nhóm chữ và chỉ số: F6-01, F6-17, F6-03.
4. Nhóm Minor còn lại; F6-33 làm sau cùng (thêm `<noscript>` và ghi chú handoff).

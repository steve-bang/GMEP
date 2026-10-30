# BA Review vòng 2 – Gói G3 (Kho, Mua hàng, Nhân sự)

Ngày 30/10/2026 · Người review: BA · Đối chiếu: `design/g3-inventory-hr/*` (đọc mã thực tế), `docs/ui-ux/04-inventory-purchasing-hr.md` mục 12–15, `ba-answers-04.md`, `review-04-inventory-purchasing-hr-ba.md`. Không có Bash/Playwright trong phiên này nên **kiểm bằng đọc mã**, không chụp ảnh. Không tin bảng tự khai mục 13: mỗi dòng dưới đây tôi đã mở file kiểm. Các màn vòng 1 chỉ rà mẫu nay đã đọc: INV-01 (vai trò, cột), INV-08, 11, 12, 15 (badge), 19 (vai trò, cờ giá), PUR-01, 04, 09, 10 (vai trò, badge), HRM-01, 02, 03, 05 (vai trò, PII). Chưa đọc từng dòng nội dung INV-02, INV-08/11/12/15 phần form, PUR-09/10 các tab, HRM-03/05 phần lưới.

## Kết luận: CHƯA ĐẠT (sửa nhỏ rồi đóng, không cần review lại toàn gói)

Hai Blocker cũ và nguyên tắc bốn số đã đạt. Còn **0 Blocker, 3 Major, 7 Minor** mở. Ba Major là lỗi luồng/vai trò do chỉnh sửa hoặc do chốt thiếu, sửa nhanh.

| Mức | Số còn mở | Mã |
| --- | --- | --- |
| Blocker | 0 | – |
| Major | 3 | F4R2-01, F4R2-02, F4R2-03 |
| Minor | 7 | F4R2-04…F4R2-08, F4-08 (phần còn lại), F4-16 (phần còn lại) |
| Chuyển dev, không chặn | 8 | mục 5 |

## 1. Kiểm từng finding vòng 1

Đạt = đúng trong code. Một phần = đã sửa nhưng còn thiếu, ghi lý do.

| Mã | Mức cũ | Kết quả | Bằng chứng (file:vị trí) |
| --- | --- | --- | --- |
| F4-01 tab Chi nhánh khác | Blocker | **Đạt** | `g3-inv-03.html:70-78`: chỉ cột Khả dụng, Số có thể cho, Tính đến; không Thực tế/Giữ chỗ/giá; không còn dòng chi nhánh ngoài phạm vi; có ghi cấu hình `xem_khả_dụng_liên_chi_nhánh`. `g3-inv-05.html:42-44` chỉ nói "có thể cho N" |
| F4-02 thẻ mobile 4 số | Blocker | **Đạt** | `g3-inv-04.html:53` cột đầu có `data-card="stock4"`; `pack.js:305` vẽ `stock4HTML` đủ Thực tế · Giữ chỗ · Đang vận chuyển · Khả dụng, cùng hàm với bảng (`pack.js:269-272`). Tác dụng phụ với MH: xem F4R2-08 |
| F4-03 Đang vận chuyển vs Đã đặt | Major | **Đạt** | `pack.js:257-266` tag "Đang về N" (Info) tách "Đã đặt N" (Neutral) từ `data-ordered`; `g3-inv-04.html:57` PT-0002 (5,2,4) + ordered 10; tfoot 10 = 6+0+4; KPI `:36` ghi 10 và "18 Đã đặt" (10+8) khớp PUR-06 còn lại 18; `g3-inv-05.html:39-43` có cột riêng "Đã đặt – chờ giao" |
| F4-04 MH, NS | Major | **Đạt (có lưu ý)** | `pack.js:9, 68-71` thêm vai trò vào registry; `design/assets/app.js:343-350` có `MH`, `NS`, `SCOPE_TYPE` (app.js đã bị vá, trái dòng "không sửa design/assets" ở đầu tài liệu 04: cần chủ Phase 0 xác nhận đã nhận bản vá). Nút PUR-02/05/09/10 có MH; còn sót PUR-03, PUR-04: **F4R2-01** |
| F4-05 hai cờ giá | Major | **Đạt** | `pack.js:11-12, 243-247` `data-g3-cost` (CH QV QL KT) và `data-g3-buy` (thêm TK MH); INV-03 `:81` giá NCC dùng `buy`; INV-13 `:47-48` TK thấy "vượt hạn mức cấp bạn" |
| F4-06 CV INV-01/19 | Major | **Đạt** | `pack.js:68` thêm CV vào INV-01, INV-19, không INV-04; `g3-inv-01.html:33, 53` ghi chú chế độ chỉ xem, ẩn Thực tế/Giữ chỗ/Đang vận chuyển cho CV; INV-19 `:41-45` giá vốn che qua cờ cost |
| F4-07 giữ chỗ chính lệnh | Major | **Đạt** | `g3-inv-06.html:34, 41, 49`: "Giữ chỗ cho lệnh này", "Xuất tối đa = giữ chỗ + Khả dụng"; thẻ 2 (0 giữ chỗ nên tối đa 0), thẻ 3 (giữ 2, sau xuất Thực tế 3, Giữ 0, Khả dụng 3) tính đúng; INV-07 `:46, 50-54` |
| F4-08 phát sinh lúc đếm | Major | **Một phần** | Đạt: `g3-inv-17.html:39-42` cột Sổ sách lúc chụp, Phát sinh trong lúc đếm (PT-0001 −2, PX-181 16:05), Sổ sách lúc đếm; "11 mã còn lại khớp" (1+11=12) đúng; `g3-inv-16.html:38-40` có thời điểm đếm. Còn thiếu: cảnh báo "mã đang trong đợt đếm" chỉ ở INV-13 (`:47`), chưa ở INV-07/09 (nơi phát sinh) và chưa có tùy chọn đóng băng. Minor còn mở |
| F4-09 dòng chưa đếm | Major | **Đạt** | `g3-inv-16.html:41-42` ô trống "–", `:49` giải thích, `:65-68` hộp thoại bắt lý do loại mã + gõ mã |
| F4-10 PUR-03 thiếu Duyệt | Major | **Đạt** | `g3-pur-03.html:63-69` thêm trạng thái `inlimit` (QL, khác người lập) và `upper` (CH, QV: Duyệt, Từ chối), dialog `:82-84`. Nút "Lập đơn mua từ yêu cầu" `:61` thiếu MH: F4R2-01 |
| F4-11 đối chiếu 1:1 | Major | **Đạt** | `g3-pur-07.html:36-40` chọn PN, PN-00034 chưa ghi sổ bị khóa; `:41` dung sai mẫu 1.000 ₫; `:60` mở phiếu trả điền sẵn |
| F4-12 thẻ INV-05 | Major | **Đạt** | `g3-inv-05.html:39` mọi cột có `data-card="meta"`; `:36` `data-g3-card-actions` hai nút; `pack.js:309`. Lưu ý dev: nút trên thẻ chưa gắn mã hàng của thẻ (mục 5) |
| F4-13 HRM-09 trộn công khoán | Major | **Đạt** | `g3-hrm-09.html:30` ghi rõ chỉ hoa hồng; dòng Lê Minh Tuấn khoán đã bỏ; `g3-hrm-06.html:38-41` cột "Điều kiện ghi nhận" (Công: đạt QC; Hoa hồng: thu đủ) |
| F4-14 HRM-08 ≠ HRM-09 | Major | **Đạt** | `g3-hrm-08.html:37-45`: hai cột Tiền công và Hoa hồng; hoa hồng Yến 271.500 khớp HRM-09 `:32, 41-42` (114.000+157.500); Bảo 0 vì 297.000 chưa ghi nhận (`:40`); tiền công kiểm tay đúng (76,2×90.000=6.858.000; 69,5×85.000; 55×80.000; 30×50.000; tổng 18.665.500). Mâu thuẫn dữ liệu khác: F4R2-04 |
| F4-15 khóa kỳ sớm | Major | **Đạt** | `g3-hrm-08.html:25-26` `data-g3-block` có lý do; `pack.js:248, 419-423` chặn click ở pha capture; `:34` điều kiện khóa; trạng thái `locked` `:50-55` hiện bảng chỉ đọc. Là khóa tĩnh (xem mục 5) |
| F4-16 HRM-06 v1 sửa tại chỗ | Minor | **Một phần** | Đạt: `g3-hrm-06.html:35, 84-89` v1 `disabled` cho đến khi "Soạn nháp", cảnh báo xung đột v2 `:36`, ghi đè có hiệu lực riêng `:39`. Còn thiếu: chưa so sánh nháp với bản hiện hành; mục "Hoa hồng cố vấn" (`:44-46`) chưa có phiên bản/hiệu lực. Minor còn mở |
| F4-17 PII | Minor | **Đạt** | `pack.js:365-373` đúng Phụ lục D (NS đầy; QL CCCD "Hiện"; CH/QV Hiện; KT SĐT che còn lại ẩn; NCC: TK MH QL đầy, CH QV KT Hiện). (a) giá trị đầy đủ trong `PIID` ghi vào handoff `04 §15`. (c) TH xem hồ sơ qua G1-PRF: ngoài gói, chấp nhận |
| F4-18 thẻ JS | Minor | **Đạt** | `pack.js:295` bỏ `<a>` lồng khi thẻ là `<a>`; `:296, 310` mang `data-g3-hide/roles` sang thẻ |
| F4-19 document.write | Minor | **Đạt** | `<noscript>` có ở 39/39 file; ghi chú handoff `04 §15` |
| F4-20 trạng thái | Minor | **Đạt** | `notfound` có ở INV-07, 09, 10, 11, 13, 16, 18, PUR-02, 05, 08 (`data-g3-states`); `g3-hrm-04.html:30` `data-g3-needs-net`; `pack.js:249-252` khóa khi mất mạng |
| F4-21 nút khóa | Minor | **Đạt** | `pack.js:229` `aria-disabled` thay `disabled`, `:419-423` chặn click + toast lý do; `data-g3-edit` vẫn dùng `disabled` thật cho ô nhập form chỉ đọc (chấp nhận) |
| F4-22 badge | Minor | **Đạt (còn lệch nhỏ)** | `g3-inv-03.html:57-61` tag Neutral; INV-09 `:51` "Nhận một phần"; INV-12 `:40` "Đã nhận" không còn tag "Đã đóng"; INV-16 "Đã đếm" Info. Còn lệch bảng A: F4R2-07 |
| F4-23 dữ liệu mẫu | Minor | **Đạt** | `g3-pur-05.html:67` PN-00031; INV-17 11 mã; RO-126 và kỳ công thống nhất (HRM-08/10 cùng 16–31/10 theo mẫu). Còn một mâu thuẫn mới: F4R2-04 |
| F4-24 in ấn | Minor | **Đạt (xem mục 5)** | `pack.css:111-118` chỉ in `.g3-paper`; `g3-inv-18.html:23, 65-66` mẫu nhiệt 80 mm |
| F4-25 mã PT | Minor | **Đóng bằng quyết định** | Xem mục 4.4: không đổi 39 file |
| F4-26 CSS | Minor | **Đạt** | `pack.js:263` tag "Dữ liệu tồn lệch"; bottom nav Nhân sự (`app.js:387`); các mục CSS đã sửa |
| F4-27 HRM-10 | Minor | **Đạt** | Đã đổi câu, thêm định nghĩa (kiểm bằng `04 §13`; số vẫn khớp công thức vòng 1) |
| F4-28 INV-10, INV-09 | Minor | **Đạt (xem F4R2-02)** | `g3-inv-10.html:52-54, 67` hai nhãn theo điều kiện duyệt; `g3-inv-09.html:49-52` cột Chất lượng |
| F4-29 BS-2, HRM-07 CV | Minor | **Đạt** | `g3-inv-06.html:63` "sự kiện hệ thống"; `pack.js:72` bỏ CV khỏi HRM-07 |
| F4-30 tài liệu 04 | Minor | **Một phần** | Mục 12–15 đã có; mục 3 (bảng màn hình) và 4/10 còn nội dung cũ (coordinator đã nêu) → chuyển designer dọn, không chặn |
| F4-31 phân tách nhiệm vụ | Minor | **Đạt** | Ghi chú ở `g3-inv-16.html:49`, `g3-inv-17.html:48`, PUR-03 `:65` ("khác người lập") |

## 2. Finding mới do chỉnh sửa (F4R2)

**F4R2-01 · Major · Nhân viên mua hàng không làm được việc chính của mình**
`g3-pur-04.html:23` ("+ Lập đơn mua") và `g3-pur-03.html:61` ("Lập đơn mua từ yêu cầu") chỉ cho `TK QL`. Journey §4 bước 3 và FRD §2 gán việc lập đơn mua cho MH. Hệ quả: MH vào được PUR-04/05 nhưng mất lối vào, không có nút ở PUR-03 sau khi yêu cầu được duyệt.
Sửa: thêm `MH` vào hai nút (và rà `data-g3-need`/`edit` còn thiếu MH ở PUR-01, 06). Nhận hàng PUR-06 giữ `TK` (tách nhiệm vụ).

**F4R2-02 · Major · Luồng "Mua gấp" không khép kín ở phiếu nhập**
Quyết định câu 8: PN lấy **YM mua gấp** làm chứng từ gốc. `g3-inv-09.html:40-45` chỉ có nguồn đơn mua hoặc "Nhập không có đơn mua", và còn ví dụ ngược lại ("mua gấp tại cửa hàng cho lệnh RO…" như lý do nhập không có đơn). Người dùng không chọn được YM làm nguồn nên phải đi nhánh ngoại lệ cần QL duyệt, trái RULE-007/011 đã chốt.
Sửa: ô "Chứng từ gốc" của INV-09 chọn DM hoặc YM (cờ Mua gấp, có hiện trạng thái hậu duyệt và hạn); "không có đơn mua" chỉ cho trường hợp hiếm, bỏ ví dụ mua gấp; đính kèm ảnh hóa đơn/biên lai.

**F4R2-03 · Major · Đề xuất đặt hàng bỏ qua hàng đã về (lỗi của thiết kế quyết định)**
`g3-inv-05.html:43`: PT-0002 Khả dụng 3 + Đang vận chuyển 4 + Đã đặt 10 = 17 ≥ Tối thiểu 6, nhưng vẫn đề xuất mua 7 ("theo công thức Tối đa − …"). Câu 7 của tôi chỉ nêu công thức số lượng, chưa nêu điều kiện kích hoạt, nên sinh gợi ý đặt thừa dù hàng đang về (đơn trễ 1 ngày).
Quyết định bổ sung R2-D1 (BA đề xuất — chờ xác nhận): cảnh báo giữ nguyên theo Khả dụng (RULE-008); **số lượng đề xuất chỉ tính khi `Khả dụng + Đang vận chuyển + Đã đặt ≤ Tối thiểu`**; nếu hàng sắp về đã vượt Tối thiểu, mặc định đề xuất 0 và hiện dòng "Đã có hàng về (4 đang vận chuyển, 10 đã đặt, trễ 1 ngày): theo dõi nhà cung cấp". Cấu hình được (có thể bật chế độ "luôn về mức tối đa").
Sửa: INV-05 hàng PT-0002 đặt 0 + dòng theo dõi; cập nhật chân bảng; bổ sung vào `ba-answers-04.md` câu 7 (BA sẽ cập nhật khi chủ dự án xác nhận).

**F4R2-04 · Minor · Một việc, hai phương pháp công**
Lệnh RO-Q7-2610-00126 (gò đồng): `g3-hrm-07.html:41` ghi công theo giờ chuẩn (2,50) và HRM-08 tính tiền công theo giờ chuẩn cho Phạm Quốc Bảo, trong khi `g3-hrm-09.html:44` và `g3-hrm-06.html:41` cho cùng loại việc đồng sơn hoa hồng 18% (297.000). Trái quyết định "một phương pháp cho mỗi tổ hợp loại việc × chức danh × chi nhánh" (câu 14); nhìn như trả hai lần cho một việc.
Sửa: chọn một: gò đồng là việc giờ chuẩn (bỏ dòng 18%) hoặc đổi dòng HRM-07/08 sang phương pháp %, và đồng bộ số HRM-08.

**F4R2-05 · Minor · Đơn giá giờ công chưa có chỗ cấu hình**
`g3-hrm-08.html:46` dẫn đơn giá mẫu theo bậc (90.000/85.000/80.000/50.000) nhưng HRM-06 chỉ có "hệ số theo chức danh" (`:42`), không có bảng đơn giá. Tiền công không truy được nguồn.
Sửa: thêm mục "Đơn giá giờ công theo chức danh" ở HRM-06 cùng cơ chế phiên bản/hiệu lực; tiền công lưu **đơn giá tại thời điểm ghi** (đổi đơn giá không đổi công đã ghi).

**F4R2-06 · Minor · "Làm tròn theo quy cách NCC" chưa có dữ liệu**
`g3-inv-05.html:46` nói làm tròn theo quy cách nhà cung cấp, nhưng PUR-10 không có trường quy cách/bội số/số lượng tối thiểu.
Sửa: thêm vào bảng giá NCC ở PUR-10 cột "Đơn vị đặt (bội số)" và "SL tối thiểu"; mặc định 1.

**F4R2-07 · Minor · Badge lệch bảng Phụ lục A**
`g3-pur-04.html:37` "Trễ 1 ngày" là `tag--warning` (bảng A: Danger); `g3-inv-11.html:49` badge "Chờ gửi" Warning không thuộc bộ chứng từ kho (dùng "Chờ duyệt"/"Nháp"). Phần còn lại khớp.

**F4R2-08 · Minor · Thẻ mobile INV-04 với MH mất cả bốn số**
`g3-inv-04.html:53` đặt `data-g3-hide="CV MH"` trên th `stock4`; `pack.js:305` mang thuộc tính đó sang cả khối stock4 nên thẻ của MH không còn Khả dụng và Đang vận chuyển, trong khi bảng desktop vẫn hiện hai số này cho MH (Phụ lục C).
Sửa: thẻ stock4 theo vai trò: MH chỉ hai ô Đang vận chuyển và Khả dụng; không ẩn cả khối.

Các finding vòng 1 còn mở (Minor): **F4-08** (cảnh báo mã đang đếm ở INV-07/09, tùy chọn đóng băng), **F4-16** (so sánh nháp, phiên bản hoa hồng cố vấn).

## 3. Kiểm trọng điểm theo yêu cầu

- **Tab Chi nhánh khác:** không lộ tồn thực tế/giữ chỗ/giá. Đạt. INV-01 và INV-05 cũng không có.
- **Thẻ mobile bốn số:** đủ bốn số, đúng thứ tự, Khả dụng nhấn mạnh, dùng chung `stock4HTML`; bảng nhắc lại tổng bằng cộng tay đúng (76/11/10/65). Đạt, trừ F4R2-08.
- **Đang về vs Đã đặt – chờ giao:** tách đúng ở INV-01/04/05, PUR-02, PUR-06; dữ liệu mẫu nhất quán (PT-0002: 4 vận chuyển theo CK-TD-2610-00014, 10 đã đặt theo DM-Q7-2610-00014; PT-0004: 8 đã đặt). Công thức Khả dụng không cộng hai số này. Đạt.
- **Kiểm tay số mới:** HRM-08 (tiền công, 271.500), INV-17 (11 mã, 27 sau PX-181), INV-04 tổng, INV-06 thẻ 3 đúng.

## 4. Trả lời các câu hỏi còn lại (BA đề xuất — chờ xác nhận)

**4.1 Đơn giá giờ công theo cấp bậc.** Cần một bảng cấu hình "Đơn giá giờ công" theo chức danh/cấp bậc × chi nhánh, có phiên bản và ngày hiệu lực (cùng cơ chế FR-HRM-015). Tiền công (₫) = giờ công × đơn giá hiệu lực tại thời điểm ghi công, **snapshot** vào dòng công; đổi đơn giá không đổi công đã ghi, không đảo công cũ. Giá trị trong prototype (90.000/85.000/80.000/50.000) là giá trị mẫu, nhãn "giá trị mẫu"; **khách phải cung cấp bảng đơn giá thật** để vào ví dụ UAT-11. Khoán, %, cố định cộng thưởng không dùng đơn giá giờ. Đơn giá giờ công này là dữ liệu cho bảng công, không phải lương (ngoài phạm vi).

**4.2 Hạn hậu duyệt Mua gấp.** Mặc định **24 giờ** (giờ làm việc quy đổi: hết ngày làm việc kế tiếp), cấu hình theo chi nhánh. Quá hạn: nhắc người lập và QL, sau thêm 1 ngày chuyển cấp trên (FR-SYS-015); khoản chưa hậu duyệt gắn cờ cho KT, không chặn nhập kho (hàng đã về). Mua gấp có giá trị trên hạn mức tự quyết (mẫu 2.000.000 ₫, Phụ lục E #5) phải **duyệt trước**. Chi nhánh có thể đặt hạn riêng nhưng không tắt hậu duyệt.

**4.3 Quy cách đóng gói NCC.** Mặc định bội số = 1 và SL tối thiểu = 0 (không làm tròn) cho đến khi PUR-10 có dữ liệu. Làm tròn **lên** đến bội số gần nhất, không vượt Tối đa quá một bội số (cảnh báo thay vì chặn). SL tối thiểu của NCC chỉ cảnh báo ("dưới mức NCC nhận đơn"), người mua quyết định. Đây là cấu hình theo cặp NCC × phụ tùng trong bảng giá NCC.

**4.4 F4-25 mã phụ tùng `PT-xxxx` trùng chữ với tiền tố phiếu thu `PT`.** **Không đổi 39 file.** Mã phụ tùng do khách quy ước (có thể là mã hãng) và có định dạng khác `LOẠI-MÃCN-YYMM-STT`. Quy tắc: không cấm khách dùng chữ "PT"; tìm kiếm toàn cục nhận dạng theo mẫu định dạng và **nhóm kết quả theo loại** (Phụ tùng / Chứng từ); mã phụ tùng duy nhất toàn chuỗi (FR-INV-002) đã đủ. Prototype giữ `PT-0001` và dòng ghi chú ở INV-01. Việc cần làm: khi khách chốt quy ước mã thì thay bằng mã thật.

**4.5 F4-16 còn dở.** Chấp nhận để Phase 2: (a) so sánh nháp với bản hiện hành là tiện ích, đưa vào backlog; (b) **hoa hồng cố vấn phải có phiên bản/hiệu lực** (FR-HRM-015 áp dụng cho mọi quy tắc công/hoa hồng) – thêm vào HRM-06 cùng lượt sửa F4R2-05.

**4.6 F4-08 còn dở.** Cảnh báo "mã đang trong đợt đếm" thêm ở INV-07/09 (chỉ cảnh báo, không chặn). Màn cấu hình "đóng băng nhóm hàng" **không thiết kế ở G3**: thuộc G4-SYS (cấu hình), ghi là yêu cầu cho G4. Không chặn bàn giao.

**4.7 F4-17(c).** Thợ xem hồ sơ của mình qua Hồ sơ cá nhân (G1-PRF); không thêm vào G3. Cần kiểm G1-PRF có hiển thị SĐT/CCCD đầy đủ cho chính chủ và ghi nhật ký.

## 5. Chuyển cho dev (không chặn)

1. **Khóa kỳ công tĩnh:** `data-g3-block` luôn khóa; production tính theo ngày kết thúc kỳ, điều chỉnh chờ duyệt (API).
2. **Thẻ mobile:** thẻ vẫn sinh từ DOM một lần (`pack.js:288-318`), không cập nhật khi lọc/sắp xếp/phân trang; nút trên thẻ INV-05 (`data-g3-card-actions`) chưa mang mã hàng của thẻ. Production: một component dữ liệu, hai bố cục.
3. **In ấn:** `@media print` chỉ kiểm bằng đọc mã (`pack.css:111-118`); cần thử trên trình duyệt/máy in thật, đặc biệt khổ A5 và nhiệt 80 mm.
4. **Chưa chạy trình duyệt:** `cards()` stock4, chặn click capture, `data-g3-block`, `data-g3-needs-net`, khóa/mở ô trong HRM-06 chỉ rà bằng đọc mã. Cần Playwright 375 px và 1280 px trên INV-04/05, PUR-03, HRM-08, và đổi vai trò MH/NS/CV.
5. **`document.write` shell:** vẫn như vòng 1, đã có `<noscript>` và ghi chú; dev lấy shell từ `foundation/shell.html`.
6. **PII:** `PIID` chứa dữ liệu mô phỏng trong JS; production không gửi giá trị đầy đủ trước khi Hiện.
7. **`design/assets/app.js` đã vá** MH, NS và ẩn mục menu: đề nghị chủ Phase 0 hợp nhất vào `00-foundation.md` §7 và bỏ hàm dự phòng `applyExtraRole` trong `pack.js` (`:395-415`, chỉ gọi khi thiếu `[data-role-label]`).
8. **Dọn tài liệu 04:** mục 3, 4, 10 còn nội dung bản 0.1 (A-01, A-02, A-03, A-13 sai so với quyết định); mục 14 nêu "câu hỏi mới" nay đã được trả lời ở mục 4 trên đây.

## 6. Điều kiện để chuyển thành ĐẠT

Sửa F4R2-01, F4R2-02, F4R2-03 (ba việc nhỏ, không đụng cấu trúc); sửa Minor F4R2-04…08 cùng lượt nếu được; BA kiểm lại bằng đọc mã đúng các vị trí đã nêu, không cần đọc lại toàn gói.

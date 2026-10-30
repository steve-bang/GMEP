# BA Review vòng 2 – Gói 3 "Báo giá, Thợ tablet, Giao xe, In ấn"

Phiên bản 0.1 · Ngày 30/10/2026 · Người review: BA · Đối tượng: `design/g2-quote-delivery/*` và `docs/ui-ux/03-quote-technician-delivery.md` v0.2. Vòng 1: `review-03-quote-technician-delivery-ba.md`. Câu trả lời: `ba-answers-03.md`.

Phương pháp và giới hạn: môi trường review này **không có Bash/Playwright**, nên kiểm bằng **đọc mã thực tế** (đọc kỹ QUO-03, 04, 05, 06, 07, 08, TEC-01, 04, DLV-01, 03, 04, 05, PRT-01, `pack.js`, `pack.css`; kiểm bằng tìm kiếm các màn còn lại: QUO-01, 02, 09, TEC-02, 03, 05, DLV-02, 06). Không dựa bảng tự khai §9 của designer. Phần hiển thị trực quan dựa vào ảnh chụp Chromium mà coordinator nêu, tôi chưa tự xem.

## 1. Kết luận

**CHƯA ĐẠT (nhẹ).** 35 trên 36 finding vòng 1 đã xử lý đúng trong mã (F3-26 chưa đạt). Còn **1 Major** mới (F3R2-01) và **8 Minor** (1 từ vòng 1, 7 mới). Sửa F3R2-01 và F3-26 là có thể chuyển **ĐẠT** mà không cần review lại toàn gói; các Minor còn lại sửa cùng đợt.

| Mức | Còn mở |
| --- | --- |
| Blocker | 0 |
| Major | 1 (F3R2-01) |
| Minor | 8 (F3-26, F3R2-02 đến 08) |

## 2. Kiểm từng finding vòng 1

| # | Kết quả | Căn cứ trong mã |
| --- | --- | --- |
| F3-01 Bắt buộc khóa cứng | Đạt | QUO-06:75 nhãn tư vấn, bỏ tick mở `dlg-req` (dòng 183–188) hỏi lý do, ghi lưu nhắc; biến thể `lockreq` (dòng 30, 76) khóa theo cấu hình; QUO-05:41–48 cảnh báo + chọn lý do bắt buộc (JS `gate1`, dòng 112–116); tick sẵn Tùy chọn chỉ với "Khách đã yêu cầu" (QUO-05:43, QUO-06:96, QUO-02:64). Câu hỏi còn lại: §4 câu 4 |
| F3-02 Phiên bản mới sau duyệt | Đạt | QUO-03:52 nút "Tạo phiên bản mới" chỉ ở `sent rejected expired`; 53 "Lập báo giá bổ sung" ở `partial full`; 54 nút khóa có lý do |
| F3-03 Phát sinh trên trang khách | Đạt | QUO-06:133 mở `dlg-xconfirm` (201), màn `extra-ok` (136), `extra-no` (137), `extra-expired` (138); thông điệp đúng 324.000 ₫ |
| F3-04 "Từ chối" | Đạt | QUO-06:120 "Từ chối toàn bộ báo giá"; `dlg-reject` (191–195) nêu hậu quả; chuyển `rejected` (151–156) khóa duyệt |
| F3-05 QUO-04 `nochannel` | Đạt | QUO-04:44 Zalo ẩn bằng `data-vx="nochannel"`, 49 thẻ khóa; JS 78–80 chọn sẵn liên kết và khóa nút Gửi khi kênh chọn bị `disabled` |
| F3-06 Tự chuyển Chờ QC | Đạt | pack.js:154 "nhắc quản đốc… lệnh không tự chuyển"; DLV-01:39 nút "Chuyển sang Chờ QC" cho QĐ, QL, CV |
| F3-07 Điều kiện phát sinh | Đạt | DLV-02 biến thể `extra` (dòng 23–24) và JS 118 khóa "Đạt"; DLV-03:79–83 dòng điều kiện + "Xử lý phát sinh" / "Chốt không làm" |
| F3-08 Thu tiền | Đạt | DLV-03:63 `data-show-roles="TN"`; vai trò khác thấy ghi chú chờ Thu ngân |
| F3-09 Người ủy quyền | Đạt | DLV-04:54–57 khối xác minh; JS 98–100 khóa nút nếu thiếu tên, SĐT, quan hệ, ảnh |
| F3-10 `@page` nhiệt | Đạt (thiết kế) | PRT-01:126 `80mm 297mm`; HINT 123 cảnh báo không trộn `auto`. Kiểm máy thật: §5 |
| F3-11 Shell cho thợ | Đạt | pack.js:30–43 `techShell` bỏ tìm kiếm, chọn chi nhánh, menu Khách/Báo cáo/Cài đặt, thông báo báo giá, "xem thử theo vai trò"; `g.end` (111–113) thanh dưới chỉ 2 mục |
| F3-12 Bảo hành liên chi nhánh | Đạt | DLV-05:50, 55 "Không hiển thị" thợ, không tên khách; chân bảng 59; nhãn "Vô hiệu" dòng 56; DLV-06:38 thợ "Không hiển thị (gắn bằng mã nội bộ)" |
| F3-13 Mất mạng báo phát sinh | Đạt | TEC-04:32–33, 52–53: chặn gửi, "Lưu nháp trên máy" → trạng thái "CHƯA gửi tới cố vấn" với `sync--wait`; không còn "Đã gửi" giả. Chấp nhận phương án chặn: §4 câu 1 |
| F3-14 Token liên kết | Đạt | QUO-04:73 ghi chú handoff (≥ 128 bit, no-store, no-referrer); không còn token ngắn trong ví dụ |
| F3-15 Mã báo giá, bỏ "số mẫu" | Đạt | QUO-06:57 "Báo giá số BG-… (bản 2)"; dòng thuế 110 không còn tag "số mẫu" |
| F3-16 Tên truy cập, OTP, trạng thái | Đạt | QUO-06:79 `aria-label` đặt trên `<input>`; 178 `autocomplete="one-time-code"`; `cancelled` (166), `rejected` (151); QUO-09:30, 69 `notfound`; QUO-03:22–23 `error` |
| F3-17 Hiển thị giá/thuế | Đạt | QUO-06:82–110, QUO-05:41–45: giá hạng mục gồm thuế, "Trong đó thuế GTGT"; kiểm cộng: 126.800 / 85.600 / 24.000 / 52.000 đúng 8%; 1.711.800 + 1.155.600 + 324.000 = 3.191.400 |
| F3-18 QUO-05 ghi chú, hậu quả | Đạt (xem F3R2-08) | QUO-05:61–62, JS 129 (≥ 10 ký tự + tick đọc lại); hậu quả dòng 70 nêu lệnh vẫn Đang sửa chữa |
| F3-19 Điều khiển Bắt buộc/Tùy chọn | Đạt | QUO-02:53, 60 `<select>` có nhãn; cờ "Khách đã yêu cầu" dòng 64 |
| F3-20 Mục tiêu < 44 px | Đạt | pack.css:56–58 chỉ ép 36 px khi `pointer: fine` và ≥ 1024 px; nút thông tin dùng `btn-icon` chuẩn (QUO-02:62) |
| F3-21 Giá vốn | Đạt | QUO-02:51, 53… `data-show-roles="CH QV QL KT"` |
| F3-22 Dữ liệu QUO-01 | Đạt | QUO-01:76 biển 36A-612.09, khách Mai Văn Lộc |
| F3-23 QUO-07 | Đạt | QUO-07:58–61 `data-vx="proposal"` ẩn báo giá và báo giá gốc với thợ; "P1"; hạn 16:00 (dòng 67); biến thể `expired` + Gia hạn (79–82) |
| F3-24 blocked-parts | Đạt | TEC-02:29–30 badge "Tạm dừng" + tag "Chờ phụ tùng" cho `paused blocked-parts` |
| F3-25 Nhật ký "quên kết thúc" | Đạt | TEC-02:53 và 104 cùng 05:45 |
| **F3-26 Hoàn tác** | **Chưa đạt** | pack.js:184–194 thêm nút "Hoàn tác" vào toast, hẹn 10 giây (`setTimeout` 10000), nhưng `toast()` dùng chung tự xóa sau **5 giây** (`app.js:297`), nên nút biến mất ở giây thứ 5 trong khi chữ ghi "10 giây". Xem F3-26 dưới |
| F3-27 `aria-describedby` | Đạt | TEC-01:79 `j4-why`, 87 `j5-why` |
| F3-28 DLV-02 | Đạt | DLV-02:110 chỉ đọc đặt 11/11 và `disabled`; trạng thái `empty`, `error`; DLV-01:59, DLV-02:89 cấu hình QC khác người làm |
| F3-29 DLV-03 | Đạt (xem F3R2-04, 05) | Dòng 89, 94, 98 có chữ trạng thái; 39 badge `debt-ok` là "Thanh toán một phần"; 33–34 khách DN thật (Cty Phú Gia, RO-…118); trạng thái `error`, `noperm` |
| F3-30 DLV-04 | Đạt | DLV-04:48–50 ô xác nhận không tick sẵn; mã `BB-Q7-2610-00041` (dòng 77); `error`, `noperm` |
| F3-31 Chú thích lọt UI | Đạt | Không còn chuỗi "Cùng số với…" |
| F3-32 Cơ chế in | Đạt (thiết kế) | pack.css:17–18, 228–229 (296/209 mm); PRT-01:32, 36 ô in SĐT theo quyền; 148 khổ mặc định theo chứng từ; 43 trạng thái lỗi; 42 lý do in lại. "Trang x/y": §5 |
| F3-33 Nội dung mẫu in | Đạt | PRT-01 cột "Đồng ý" (60–73), không còn QR bảo hành ở phiếu giao nhận, "(số mẫu)" cho hóa đơn (108) và MST (52) |
| F3-34 Tài liệu | Đạt | Tài liệu v0.2 có §8 đến §11 khớp mã |
| F3-35 Kích thước cứng | Đạt | pack.css:10–18 token `--g2q-*`; `!important` chỉ còn `[hidden]` và `@media print` (hợp lý) |
| F3-36 `document.write` | Đạt (ghi handoff) | `<noscript>` ở 22/22 tệp; ghi chú pack.js:26 |

**F3-26 (Minor, chưa đạt).** Vị trí: `pack.js:184–194`, `app.js:297`. Hoàn tác là cách duy nhất sửa bấm nhầm "Bắt đầu" mà không làm sai giờ công (FR-HRM-005); nút biến mất sau 5 giây trên màn tablet trong xưởng, lúc thợ thường chưa kịp nhìn. Cách sửa: đặt thanh "Hoàn tác" ngay trên thẻ việc hoặc đồng hồ trong 10 giây (không dùng toast chung), hoặc đổi chữ thành 5 giây; mốc "hủy bắt đầu" vẫn ghi vết như quy tắc câu 8.

## 3. Finding mới

**F3R2-01 · Major · QUO-08: nút hàng loạt "Đưa vào báo giá mới" đi vòng qua quy tắc báo giá bổ sung.**
Vị trí: `g2-quo-08.html:42, 82`; dòng 51 và 53 đã chặn từng dòng (chỉ "Lập báo giá bổ sung", có ghi chú "dùng báo giá bổ sung, không tạo báo giá mới") cho xe 51H-123.45 và 51K-987.65 vì đang có lệnh mở. Nhưng nút hàng loạt chỉ bị khóa khi chọn nhiều xe; chọn hạng mục của **một** xe đang có lệnh mở thì vẫn đi tới `g2-quo-02.html` (báo giá mới). Việc mới cho xe đã có lệnh mở phải vào lệnh đó qua báo giá bổ sung (RULE-006, lệnh là chứng từ gốc RULE-007), nếu không sẽ có hai báo giá/lệnh song song cho một lượt xe. Căn cứ: RULE-006, WF-03, câu 3 `ba-answers-03`.
Cách sửa: thêm thuộc tính `data-open-ro` cho dòng xe có lệnh mở; khi tất cả hàng chọn thuộc một xe có lệnh mở, đổi nhãn nút thành "Lập báo giá bổ sung" và trỏ `g2-quo-07.html`; hoặc khóa nút kèm lý do bằng chữ.

**F3R2-02 · Minor · QUO-07: "Hủy phát sinh" của cố vấn hiện thành "Khách từ chối".**
Vị trí: `g2-quo-07.html:77` (`data-set="rejected"`). Cố vấn hủy khác với khách từ chối; nhật ký và báo cáo "hạng mục khách từ chối" (lưu nhắc, cờ An toàn) bị lẫn. Sửa: biến thể `cancelled` với badge "Đã hủy" (đối tượng báo giá bổ sung dùng trạng thái Từ chối chỉ khi khách từ chối; hủy ghi lý do ở lịch sử, hạng mục vào "Không thực hiện" với tag "Đã hủy"); không tạo lưu nhắc trừ khi cố vấn chọn.

**F3R2-03 · Minor · QUO-08: cột "Giá cũ (đã gồm thuế)" sai số.**
Vị trí: `g2-quo-08.html:47, 51`. Vệ sinh buồng đốt hiện 650.000 ₫ dưới tiêu đề "đã gồm thuế", trong khi giá gồm thuế là 702.000 ₫ (cùng báo giá, QUO-06:106). Các dòng khác chưa kiểm được nguồn. Sửa: dùng cùng nguồn số với QUO-06 và cập nhật tổng ở dòng 39 (9.740.000 ₫ sẽ đổi); nếu giữ chưa thuế thì đổi tiêu đề.

**F3R2-04 · Minor · DLV-03 biến thể `extra`: tiêu đề đếm sai.**
Vị trí: `g2-dlv-03.html:51, 56, 62, 103`. Tiêu đề "Còn 1 điều kiện" và chân trang chỉ nêu phát sinh, nhưng điều kiện "Đã thu đủ tiền" cũng "Chưa đạt" (badge Thanh toán một phần). Cố vấn đọc chân trang sẽ nghĩ chỉ cần chốt phát sinh. Sửa: biến thể `extra` cho thu đủ tiền ở "Đạt" (đổi badge Thanh toán thành Đã thanh toán) hoặc cập nhật số đếm và chân trang thành "2 điều kiện".

**F3R2-05 · Minor · DLV-03: khách cá nhân còn nợ không có đường "Đề nghị duyệt giao xe còn nợ".**
Vị trí: `g2-dlv-03.html:62–64`. Theo câu 14, cá nhân hạn mức 0 nhưng vẫn xin được ngoại lệ có duyệt; nút chỉ có ở `debt-over` (khách DN). Ở `pending` cố vấn chỉ thấy "Chờ Thu ngân". Sửa: thêm liên kết phụ "Đề nghị duyệt giao xe còn nợ (ngoại lệ)" cho CV, QL ở `pending`, cùng hộp thoại `dlg-debt` (lý do bắt buộc, so với hạn mức 0).

**F3R2-06 · Minor · TEC-01: nháp "báo phát sinh" chưa gửi không có dấu hiệu nào sau khi đóng hộp thoại.**
Vị trí: `g2-tec-04.html:53` ("Đóng" khi `draftlocal`), `g2-tec-01.html` không có chip hay thẻ nháp. Thợ phát hiện hư hỏng mà quên gửi thì việc phát sinh không tới cố vấn (RULE-006), khách không được hỏi. Sửa: thẻ hoặc chip "1 báo phát sinh chưa gửi" nổi bật ở đầu TEC-01, nhắc lại khi có mạng và khi khóa/mở lại màn hình.

**F3R2-07 · Minor · Dữ liệu mẫu: RO-Q7-2610-00126 mâu thuẫn giữa DLV-01 và TEC-01.**
Vị trí: `g2-dlv-01.html:39` nói đã xong hạng mục cuối, chờ chuyển Chờ QC; `g2-tec-01.html:66–71` cùng lệnh, hạng mục "Thay bugi" còn **Chưa làm**. Sửa: dùng lệnh khác ở DLV-01 hoặc đổi trạng thái việc trên TEC-01.

**F3R2-08 · Minor · QUO-05 bước 3: câu hậu quả cứng không đổi theo lựa chọn.**
Vị trí: `g2-quo-05.html:70`. "Hạng mục 2 dùng má phanh Vios khả dụng 0… bị khóa" vẫn hiện khi người dùng bỏ hạng mục 2 ở bước 1. Sửa: sinh theo hạng mục đang chọn.

## 4. Trả lời 10 câu hỏi §11 (BA đề xuất — chờ xác nhận)

**1. Mất kết nối giai đoạn 1 cho báo phát sinh và yêu cầu phụ tùng: chấp nhận bản chặn.** Rút lại đề xuất "tự gửi khi có mạng" (F3-13, câu 5): CLAUDE.md giới hạn offline ở cảnh báo và lưu nháp, tự gửi nền là phạm vi offline riêng (NFR-OFF-01 giai đoạn 2). Quy tắc: nháp lưu trên máy tới hết ca; thợ bấm Gửi khi có mạng; có chỉ báo "chưa gửi" nổi bật (F3R2-06); nhắc báo trực tiếp cố vấn hoặc phiếu giấy. Riêng mốc giờ bắt đầu, tạm dừng, kết thúc giữ thiết kế hiện tại (ghi trên máy, đồng bộ khi có mạng, nhãn "nhập bù", cờ lệch giờ máy chủ theo câu 8) vì chỉ là ghi giờ, không phải giao dịch. Căn cứ: NFR-OFF-01, RULE-006, FR-HRM-005.

**2. Trạng thái yêu cầu phụ tùng (đối tượng phụ, ghi vào ba-decisions A.2 thành một dòng riêng, không thuộc năm đối tượng chính).**

| Trạng thái | Màu | Chữ trên badge |
| --- | --- | --- |
| Đã gửi | Info | Đã gửi |
| Thủ kho đã nhận | Info | Thủ kho đã nhận |
| Đã xuất một phần | Warning | Xuất một phần |
| Đã xuất đủ | Success | Đã xuất đủ |
| Thiếu hàng | Warning | Thiếu hàng, chờ hàng về (kèm ngày dự kiến nếu có) |
| Đã hủy | Neutral | Đã hủy (kèm lý do) |

TEC-03 đổi từ tag sang badge, nhãn "Đã gửi, chờ thủ kho" thành "Đã gửi". Căn cứ: FR-INV-007, FR-INV-020, RULE-008; đề xuất FR-INV-029.

**3. Nhóm "Không thực hiện" ở G2-REC-04.** Hiện G2-REC-04 chưa có nhóm này (tìm không thấy trong `design/g2-workshop`). Người cập nhật: **designer, ở lượt sửa gói 2 kế tiếp**; BA cập nhật Journey §7 (thuộc tính duyệt gồm Từ chối, Hết hạn, Đã hủy) và UAT-03. Yêu cầu: nhóm hiển thị hạng mục phát sinh/bị từ chối/hết hạn/hủy, không tính tiền, không vào việc của thợ. Không chặn gói 3.

**4. "Khách đã yêu cầu": có, lưu bằng chứng nhẹ.** Cờ này quyết định hạng mục Tùy chọn được tick sẵn và hiển thị câu "Anh đã yêu cầu" cho khách, nên phải có căn cứ. Bắt buộc ghi: kênh khách yêu cầu (gọi điện, tin nhắn, tại quầy), thời điểm, ghi chú ngắn, người đặt cờ (ghi nhật ký FR-SYS-003). Không bắt buộc đính ghi âm hay ảnh tin nhắn (có thể đính ảnh chụp tin nhắn nếu muốn). Khách thấy cờ trên trang duyệt nhưng bỏ tick tự do.

**5. Biên bản giao xe điều chỉnh: dùng hộp thoại từ DLV-04 đã giao ở giai đoạn đầu, chưa cần màn G2-DLV-07.** Hộp thoại: chọn trường cần sửa (km, đồ đạc, người nhận, tình trạng), giá trị cũ và mới, lý do ≥ 10 ký tự, ảnh nếu cần; **Quản lý chi nhánh duyệt, người đề xuất không tự duyệt**; sinh mã BB mới liên kết biên bản gốc, bản gốc và chữ ký gốc giữ nguyên; khách ký lại nếu thay đổi liên quan quyền lợi của khách (người nhận, đồ đạc). DLV-04 `done` cần nút "Đề nghị điều chỉnh" và danh sách các biên bản liên kết. Màn riêng chỉ khi khối lượng điều chỉnh cao ở pilot. Căn cứ: RULE-010, FR-REC-017, đề xuất FR-REC-039.

**6. Cờ "An toàn" của hạng mục lưu nhắc.** Giữ đến khi (a) hạng mục được thực hiện ở lệnh sau, (b) cố vấn/QL bỏ nhắc có lý do (đã bắt buộc ở QUO-08), hoặc (c) hết thời hạn lưu cấu hình (khởi tạo 12 tháng, sau đó lưu chỉ-đọc để giải quyết tranh chấp; thời hạn lưu cuối cùng theo quyết định retention của khách). **Có báo cáo cho Quản lý chi nhánh:** danh sách và tỷ lệ hạng mục an toàn khách từ chối theo cố vấn và kỳ, để kiểm soát chất lượng tư vấn và làm bằng chứng khi tranh chấp; không mở rộng dữ liệu cá nhân (theo ma trận quyền). Căn cứ: BR-REC-11, FR-REC-024, FR-RPT, NFR-SEC-03.

**7. Hiển thị giá và làm tròn thuế.** Giữ cấu hình hiển thị đã nêu ở câu 11. **Làm tròn (đề xuất cho kế toán xác nhận):** thuế tính ở **cấp hạng mục** trên tổng trước thuế của hạng mục, làm tròn về 1 đồng (VND không thập phân, half-up); tổng thuế báo giá bằng tổng thuế các hạng mục; tổng khách chọn bằng đúng tổng các giá hiển thị nên không lệch đồng khi khách bỏ/chọn hạng mục. Hóa đơn tính theo dữ liệu hóa đơn (FR-EIN); nếu chênh vài đồng so với báo giá thì theo quy tắc kế toán chốt, kèm ví dụ kiểm thử có chữ ký kế toán (NFR-MNT-01). Mọi thuế suất lấy từ cấu hình có ngày hiệu lực. Phần pháp chế về cách hiển thị với người tiêu dùng vẫn `[Cần xác nhận]`.

**8. Phát sinh duyệt tại quầy hoặc liên kết: áp cùng cơ chế OTP và ngưỡng như báo giá thường.** Ngưỡng so với giá trị của báo giá bổ sung; thêm tùy chọn cấu hình (mặc định tắt) cộng dồn phát sinh của cùng lệnh để chạm ngưỡng. Với phát sinh, khách thường đang ở xa nên **xác nhận bằng lời qua điện thoại** là tình huống chính: cho phép như ngoại lệ có rà soát, bắt buộc ghi giờ gọi, số gọi, người nghe, tick đã đọc lại việc và giá, và vào danh sách "Ngoại lệ cần rà soát". Hạn duyệt theo câu 3.

**9. Báo giá nhiều trang khi in.** Yêu cầu: có "Trang x/y" thật và **lặp tiêu đề bảng** ở mỗi trang; không đặt giới hạn cứng số dòng; báo giá mặc định A4, không dùng A5/nhiệt cho báo giá dài (nhiệt chỉ in nhanh). Đây là yêu cầu cho dev, không chặn thiết kế (xem §5).

**10. Giao xe cho người ủy quyền.** Mặc định **bắt buộc** ảnh giấy ủy quyền hoặc giấy tờ tùy thân của người nhận, cấu hình theo chi nhánh (không cho tắt hoàn toàn nếu người nhận khác chủ xe cá nhân). Miễn khi người nhận là người liên hệ đã ghi trong hồ sơ doanh nghiệp (FR-CRM-018). Ảnh giấy tờ là dữ liệu cá nhân nhạy cảm: lưu tối thiểu, mã hóa, che mặc định, chỉ người giao và Quản lý chi nhánh xem, ghi nhật ký truy cập. **Thời hạn lưu: theo retention cấu hình, đề xuất khởi tạo bằng thời hạn bảo hành dài nhất của biên bản cộng 3 tháng**; con số cuối `[Cần xác nhận]` với pháp chế theo Luật Bảo vệ dữ liệu cá nhân 2025.

## 5. Chuyển cho dev (không chặn)

- **Chromium và trình duyệt khác:** ảnh chụp Chromium báo hiển thị tốt; chưa kiểm Safari/Firefox, tablet cảm ứng thật (nút 52–64 px, `pointer: coarse`), thiết bị xưởng.
- **In:** `@page size: 80mm 297mm` là giá trị mẫu, chiều dài theo máy in `[Cần xác nhận]`; kiểm in A4/A5/nhiệt 80 mm thật (độ rộng in được thường ~72 mm); "Trang x/y" và lặp tiêu đề bảng cho báo giá nhiều trang cần CSS paged media hoặc tạo PDF phía máy chủ; ngắt trang `break-inside`.
- **Shell prototype:** `document.write` và regex thay HTML trong `techShell` (pack.js) mong manh; thay bằng component khi chọn stack, không sao chép sang sản phẩm; sản phẩm thật nên chạy với CSP không có script inline.
- **Số điện thoại đầy đủ trong mã PRT-01** (`0903 456 321`): chỉ mô phỏng; bản thật tải khi có quyền, ghi nhật ký.
- **Liên kết khách:** token ≥ 128 bit, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, giới hạn tần suất, thu hồi khi thay/hủy/hết hạn.
- **Giờ máy:** mốc giờ nhập bù lệch giờ máy chủ quá ngưỡng gắn cờ (câu 8).
- **Gói 2:** G2-REC-04 thêm nhóm "Không thực hiện" (câu 3); đồng bộ lệnh chỉ Tạm dừng khi không còn việc làm tiếp (câu 5).
- **Chưa có màn cấu hình** (cho phép bỏ hạng mục bắt buộc, OTP ba mức, chế độ hiển thị giá, ngưỡng, thời hạn duyệt phát sinh): thuộc G4-SYS.

## 6. Việc cần làm

1. Sửa F3R2-01 và F3-26 (đủ để chuyển ĐẠT).
2. Sửa Minor F3R2-02 đến 08 cùng đợt.
3. Cập nhật tài liệu 03 §11 theo §4 ở trên; BA ghi các quyết định vào `ba-decisions.md` (A.2 dòng yêu cầu phụ tùng), Journey §7, FRD (FR mới đề xuất ở `ba-answers-03.md`) khi chủ dự án xác nhận.

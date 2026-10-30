# BA Review – Gói 3 "Báo giá, Thợ tablet, Giao xe, In ấn" (G2-QUO, G2-TEC, G2-DLV, G2-PRT)

Phiên bản 0.1 · Ngày 30/10/2026 · Người review: BA · Đối tượng: `design/g2-quote-delivery/` (21 màn hình, `pack.css`, `pack.js`, `index.html`) và `docs/ui-ux/03-quote-technician-delivery.md`. Trả lời 14 câu hỏi §9: `docs/ui-ux/ba-answers-03.md`.

Phạm vi và giới hạn: đọc mã HTML/CSS/JS và đối chiếu tài liệu; **không mở trình duyệt, không in thử**, nên chưa kiểm hiển thị thật (1440/768/375 px), chưa đo tương phản, chưa kiểm `@page` trên trình duyệt hay máy in. Đã đọc kỹ toàn bộ `pack.css`, `pack.js`, QUO-01, 02, 03, 04, 05, 06, 07, 09; TEC-01 đến 05; DLV-01 đến 06; PRT-01; `index.html` kiểm bằng tìm kiếm. QUO-08 chỉ rà theo mẫu (trạng thái, nút), chưa đọc từng dòng. Đã quét toàn gói bằng tìm kiếm cho hex màu, biểu tượng, class, `₫`/SĐT trong màn thợ.

## 1. Tóm tắt

| Mức | Số lượng |
| --- | --- |
| Blocker | 0 |
| Major | 13 |
| Minor | 23 |
| Tổng | 36 |

Kết luận: gói **đạt về cấu trúc** (đủ 21 màn hình, không hex, sáu trạng thái Báo giá đúng A.2, số tiền khớp G2-REC-04 và tự cộng đúng, màn thợ không lộ giá/thanh toán/SĐT, nút thợ 52 đến 64 px, bắt đầu 1 chạm và kết thúc 2 chạm, trang khách QUO-06 không có shell). Các lỗi Major tập trung ở bốn nhóm: **(1)** quy tắc duyệt báo giá (hạng mục Bắt buộc khóa cứng, tạo phiên bản mới sau khi đã duyệt, hai nút "Từ chối" và "Đồng ý làm" trên trang khách thiếu xác nhận hoặc sai thông điệp); **(2)** mâu thuẫn với `ba-answers-02` A.1 (tự chuyển Chờ QC, thiếu điều kiện phát sinh đã có quyết định cuối) và FRD §2 (cố vấn bấm Thu tiền); **(3)** rò thông tin và che dữ liệu (shell nhân viên đầy đủ trên màn thợ, bảo hành liên chi nhánh lộ tên khách và thợ); **(4)** in nhiệt `@page 80mm auto` có nguy cơ không hợp lệ. Không có Blocker vì không vi phạm RULE-007/010 ở đường chính. Có thể cho designer đi tiếp sau khi sửa Major.

## 2. Kết quả đối chiếu theo hạng mục yêu cầu

| Hạng mục | Kết quả | Ghi chú |
| --- | --- | --- |
| Đủ màn hình | Đạt | 21 tệp: QUO-01 đến 09, TEC-01 đến 05, DLV-01 đến 06, PRT-01; `index.html` liên kết đủ 21 và các biến thể in |
| Token và class | Đạt (màu), Đạt có ghi chú (kích thước) | Không có hex hay `rgb()/hsl()` trong HTML/CSS/JS của gói. Mọi `var(--…)` trong `pack.css` có trong `tokens.css`. Mọi biểu tượng `<use href="#…">` có trong `icons.svg`. Các class của `base.css`/`components.css` đã kiểm (`stack-*`, `row--between`, `grid--4`, `rating__opt--ok/--bad`, `tag--reason`, `approval__*`, `pii`, `otp`, `qty`, `upload`, `table-wrap--responsive`…) đều có định nghĩa; class `g2q-*` dùng trong HTML đều có trong `pack.css` (trừ `g2q-reprint`, `g2q-copy` là móc JS). Kích thước cứng và `!important`: F3-35 |
| Badge luôn có chữ | Đạt | Mọi `badge`/`tag` có chữ; QC "Đạt/Không đạt" có biểu tượng và chữ; kiểm tra xe xanh/vàng/đỏ có chữ. Còn 3 dòng điều kiện bàn giao chỉ có biểu tượng (F3-29) |
| Trạng thái Báo giá (ba-decisions A.2) | Đạt | Đủ 6 trạng thái, đúng màu và nhãn (Đã gửi = "Chờ khách duyệt" Warning). Phiên bản cũ là tag, không phải trạng thái thứ 7 (đúng ba-answers-03 câu 1). Lệnh/Hạng mục/Thanh toán/Hóa đơn đúng A.2; thuộc tính "Chờ khách duyệt (phát sinh)" là tag (A.3). Lỗi dữ liệu nhỏ: F3-29 (Thanh toán), F3-24 |
| Khớp tổng với G2-REC-04 (RO-Q7-2610-00128) | Đạt | v2: 1.585.000 + 1.070.000 + 300.000 + 650.000 = 3.605.000; thuế 8% = 288.400; tổng 3.893.400. Được duyệt 3/4: 2.955.000 + 236.400 = 3.191.400 (khớp REC-04 dòng 62, 194, 396). Không duyệt 702.000. v1: 3.305.000, gồm thuế 3.569.400. Từng hạng mục cộng đúng (1.250.000 + 185.000 + 150.000…). QUO-06 `data-c/data-p`, QUO-05 `data-amt`, QUO-02 (công 1.300.000, phụ tùng 2.305.000, giảm 8% ra 3.581.928), QUO-01 chân bảng (44.367.500 / 7.551.500), TEC-05 (6,3 / 5,5 / 3,5 / 1,0) đều cộng đúng |
| RULE-005 / RULE-006 | Đạt một phần | Đúng: nút Bắt đầu của phát sinh khóa kèm lý do bằng chữ trên thẻ (TEC-01, TEC-02, QUO-07); TEC-03 chỉ chọn phụ tùng trong lệnh; bản in lệnh ghi "KHÔNG làm" cho phát sinh chưa duyệt. Lỗi: F3-01, F3-02, F3-03, F3-07 |
| Trang khách QUO-06 | Đạt có Major | Điện thoại, không shell/menu/đăng nhập, cột 480 px, chữ 16 px, nút 52 px, thanh đáy cố định, `noindex`, liên kết riêng theo phiên bản (trạng thái "Có bản mới"), SĐT che `09•• ••• 321`, OTP tùy cấu hình, không lộ giá vốn/thợ/ghi chú nội bộ. Lỗi: F3-01, 03, 04, 14, 15, 16, 17 |
| Màn thợ (nút, chạm, PIN, quyền, offline) | Đạt có Major | Nút `btn--xl` 52 px, nút chính 64 px, chip 48 px, ô tick 56 px. Bắt đầu 1 chạm từ thẻ, kết thúc 2 chạm, tạm dừng 2 chạm: đạt NFR-USA-01. PIN chỉ dẫn tới G1-AUT-10 (nút "Khóa màn hình", tự khóa 3 phút, D-04). Không có `₫`, đơn giá, SĐT, địa chỉ, tên khách trên TEC-01 đến 04 (quét bằng tìm kiếm). Lỗi: F3-11, F3-13, F3-26, F3-27 |
| QC, giao xe (điều kiện, thanh toán, hóa đơn) | Chưa đạt toàn bộ | Có QC → thanh toán → hóa đơn → bàn giao, chặn kèm lý do, công nợ trong/vượt hạn mức, "khách không lấy hóa đơn" không mở (đúng ba-answers-05 câu 3). Lỗi: F3-06, 07, 08, 09, 29, 30 |
| Bảo hành | Đạt có Major | Có danh sách, tạo lệnh, ngoại lệ ngoài hạn, bảo hành chéo `[Cần xác nhận]` cấu hình. Lỗi: F3-12 |
| Mẫu in A4/A5/nhiệt, `@page`, `@media print`, in lại | Đạt một phần | Có `@page` đổi theo khổ, `@media print` ẩn shell/điều khiển/overlay, ép màu về đen, nhãn "BẢN IN LẠI (lần 2)", SĐT che mặc định. Lỗi: F3-10, 32, 33 |
| Che dữ liệu cá nhân | Đạt một phần | `.pii` cho SĐT/email; in lệnh bản xưởng không SĐT/địa chỉ. Lỗi: F3-11 (thông báo, tìm kiếm), F3-12, F3-32 (số thật trong mã) |
| Loading/empty/error/no-permission/offline | Đạt có thiếu sót | QUO-01, 08, DLV-01, 05, TEC-05 đủ cả sáu; QUO-03 thiếu empty/error; TEC-01 thiếu no-permission; DLV-02 thiếu empty/error; DLV-03, 04, PRT-01, QUO-06/09 thiếu một số (F3-16, 29, 30, 32). Offline dùng banner chung và nút "Thử: mất kết nối" |
| Rủi ro `document.write` shell | Có rủi ro | F3-36 |

## 3. Finding

Quy ước: Blocker = chặn tiến độ hoặc vi phạm RULE; Major = sai nghiệp vụ, quyền hoặc bằng chứng, cần sửa trước khi designer đi tiếp; Minor = chỉnh sửa, nhất quán, tiện dùng. Số dòng theo tệp hiện tại.

### Major

**F3-01 · Major · Hạng mục "Bắt buộc" bị khóa cứng, khách không có đường từ chối riêng.**
Vị trí: `g2-quo-05.html:37, 39–40` (ô tick `disabled`, câu "không bỏ từng phần được"); `g2-quo-06.html:63, 66, 73` (ô `checked disabled`) và thanh đáy dòng 102–107; `03-…md` §8 giả định 2. Mâu thuẫn với Journey (ví dụ duyệt một phần: má phanh bị từ chối) và UAT-17, trong khi chính dữ liệu mẫu gán "Bắt buộc" cho **má phanh trước**. Khách chỉ còn "Từ chối" cả báo giá hoặc gọi điện. Căn cứ: FR-REC-007, 026, RULE-005, BR-REC-03.
Cách sửa: theo `ba-answers-03` câu 2: bỏ tick hạng mục Bắt buộc mở bước xác nhận riêng (cảnh báo an toàn, chọn lý do, ghi "Từ chối hạng mục bắt buộc" vào bằng chứng, đưa vào lưu nhắc cờ "An toàn"); thêm cấu hình "Cho phép khách bỏ hạng mục bắt buộc" (mặc định Có, tắt thì khóa như hiện tại kèm lý do bằng chữ); thêm cờ "Khách đã yêu cầu" để tick sẵn hạng mục Tùy chọn.

**F3-02 · Major · Cho "Tạo phiên bản mới" sau khi báo giá đã được duyệt.**
Vị trí: `g2-quo-03.html:49` (nút hiện ở các biến thể `partial full sent rejected expired draft`) và alert dòng 57 ("tạo phiên bản mới hoặc báo giá bổ sung"); `g2-quo-02.html:29` (sửa bản đã gửi tạo v3 mà không xét đã duyệt hay chưa). Phiên bản thay thế một phiên bản đã duyệt làm lệnh đang chạy mất cơ sở và trái FR-REC-009 (không sửa nội dung đã duyệt), RULE-005. Ở biến thể Nháp thì nút "Tạo phiên bản mới" vô nghĩa (sửa nháp trực tiếp).
Cách sửa: theo câu 1: ẩn/khóa "Tạo phiên bản mới" khi báo giá Duyệt toàn phần hoặc Duyệt một phần, thay bằng "Lập báo giá bổ sung" (G2-QUO-07), có tooltip lý do; ẩn ở Nháp; chỉ còn ở Đã gửi, Từ chối, Hết hạn.

**F3-03 · Major · Phát sinh trên trang khách: "Đồng ý làm" chốt ngay, không xác nhận/OTP và hiện sai thông điệp.**
Vị trí: `g2-quo-06.html:119` (`data-set="success"`) và 129–134 (thông điệp "sẽ sửa **3 hạng mục** … **3.191.400 ₫**" của luồng báo giá, trong khi việc phát sinh là **1 việc, 324.000 ₫**). Một chạm đồng ý chi 324.000 ₫ mà luồng báo giá thường lại có bottom sheet xác nhận (và OTP nếu cấu hình): bằng chứng duyệt yếu hơn và dễ bấm nhầm. Căn cứ: BR-REC-04, RULE-006, WF-03.
Cách sửa: "Đồng ý làm" mở cùng bottom sheet xác nhận (hậu quả: giá, thời gian, hạn trả lời; OTP theo cấu hình); thêm biến thể thành công riêng cho phát sinh ("Garage sẽ làm Thay lọc gió điều hòa, 324.000 ₫") và cho "Không làm".

**F3-04 · Major · Nút "Từ chối" trên trang khách mơ hồ phạm vi và không đổi trạng thái trang.**
Vị trí: `g2-quo-06.html:106, 164–168`. Hộp thoại hỏi "Anh không đồng ý làm?… Garage sẽ không sửa" không nói là từ chối **toàn bộ báo giá** (chuyển Từ chối, không tạo lệnh); xác nhận chỉ đóng hộp thoại và hiện toast, trang vẫn ở trạng thái duyệt nên khách có thể bấm "Duyệt" ngay sau đó. Thiếu trạng thái cuối "Anh đã từ chối báo giá này". Căn cứ: FR-REC-009, BR-REC-12.
Cách sửa: đổi nhãn "Từ chối toàn bộ báo giá", hộp thoại nêu hậu quả (không tạo lệnh, garage sẽ liên hệ); sau xác nhận chuyển sang trạng thái "Đã ghi nhận từ chối" (kèm "Gọi chi nhánh"), khóa duyệt; link vẫn mở để xem.

**F3-05 · Major · Biến thể "Chưa cấu hình Zalo/SMS" của QUO-04 sai: kênh bị khóa vẫn chọn và gửi được.**
Vị trí: `g2-quo-04.html:43` (radio Zalo `checked` và còn bật), dòng 48 (thẻ Zalo "Chưa kích hoạt" thêm vào thành bản sao), dòng 65 (nút "Gửi báo giá" bật cho `nochannel`). Vi phạm D-13 (kênh chưa cấu hình: khóa, nêu lý do, nút gửi không trỏ vào kênh khóa). Căn cứ: D-13 mục 2, FR-REC-034.
Cách sửa: ở `nochannel`: thẻ Zalo duy nhất, `disabled`, tag "Chưa kích hoạt"; mặc định chọn "Sao chép liên kết" hoặc Email; nút Gửi chỉ bật khi có kênh hợp lệ được chọn.

**F3-06 · Major · Tự chuyển lệnh sang Chờ QC khi hết hạng mục, trái bảng chuyển trạng thái đã chốt.**
Vị trí: `pack.js:128` ("Khi tất cả hạng mục xong, lệnh chuyển sang **Chờ QC**"), `g2-dlv-01.html:16` ("Lệnh có tất cả hạng mục đã Hoàn thành thì vào hàng chờ này"), `03-…md` §4.1 bước 7. `ba-answers-02` A.1: Đang sửa → Chờ QC do **CV, QĐ hoặc QL bấm**, hệ thống chỉ **nhắc** (vì có thể còn thêm việc). Căn cứ: FR-REC-015, WF-04, ba-answers-02 A.1.
Cách sửa: đổi câu ở hộp thoại Kết thúc ("Khi tất cả hạng mục xong, hệ thống nhắc quản đốc chuyển Chờ QC"); DLV-01 mô tả lệnh vào hàng chờ sau khi được chuyển; thêm nút/nhắc "Chuyển sang Chờ QC" cho QĐ ở TEC-01 hoặc G2-REC-04.

**F3-07 · Major · Thiếu điều kiện "phát sinh đã có quyết định cuối" khi QC đạt và khi bàn giao.**
Vị trí: `g2-dlv-02.html:64–69, 111` (nút "Đạt" chỉ cần đủ 11/11 mục); `g2-dlv-03.html:47–87` (danh sách điều kiện không có dòng phát sinh). `ba-answers-02` A.1 (dòng Chờ QC → Sẵn sàng bàn giao): mọi phát sinh phải ở Đã duyệt và Hoàn thành, Từ chối hoặc Hết hạn. Căn cứ: RULE-006, WF-03, WF-09.
Cách sửa: DLV-03 thêm dòng "Không còn hạng mục phát sinh chờ khách duyệt" (nút xử lý: mở QUO-07, "Chốt không làm" → Hết hạn, lưu nhắc); DLV-02 khóa "Đạt, chuyển sẵn sàng giao" kèm lý do khi còn phát sinh Chờ; thêm biến thể mẫu.

**F3-08 · Major · Cố vấn (và Quản lý) có nút "Thu tiền", trái FRD §2 và trái chính dòng chữ của màn.**
Vị trí: `g2-dlv-03.html:60` (`data-show-roles="CV QL TN"` tới G4-ACC-01) trong khi ghi chú cùng dòng nói "Chỉ Thu ngân thu tiền". FRD §2 "Thu tiền và sổ quỹ": CV = X, QL = D, TN = S. Căn cứ: FRD §2, FR-ACC-001.
Cách sửa: chỉ Thu ngân (hoặc người kiêm vai trò Thu ngân, FR-SYS-012) thấy nút; CV, QL thấy ghi chú "Chờ Thu ngân thu tiền" và liên kết xem phiếu thu.

**F3-09 · Major · Giao xe cho "người được ủy quyền" thiếu thông tin xác minh.**
Vị trí: `g2-dlv-04.html:51` (chọn "Người khác được chủ xe ủy quyền" nhưng không có trường nào). Giao nhầm xe là rủi ro chính ở bước bàn giao; bằng chứng biên bản phải ghi ai nhận. Căn cứ: FR-REC-017, BR-REC-07.
Cách sửa: khi chọn người khác: bắt buộc họ tên, SĐT (che theo vai trò), quan hệ với chủ xe, ảnh giấy ủy quyền/giấy tờ (theo cấu hình chi nhánh); hiển thị trong biên bản và bản in (đề xuất FR-REC-039).

**F3-10 · Major · `@page { size: 80mm auto }` có thể không hợp lệ, in nhiệt có thể ra khổ A4. (chưa kiểm được trên máy)**
Vị trí: `g2-prt-01.html:123` (`'80mm auto'`). Theo CSS Paged Media, `size` nhận hai độ dài hoặc `auto` cho **cả** trang; trộn `80mm auto` không hợp lệ nên bị bỏ qua và trình duyệt dùng khổ mặc định. Lưu ý đây là kết luận từ đặc tả, chưa thử in. Căn cứ: NFR-PRT-01, NFR-COM-01.
Cách sửa: dùng kích thước cố định (ví dụ `80mm 297mm`) hoặc khổ giấy tùy chỉnh theo máy; để cấu hình chiều cao theo máy in; kiểm thử trên máy nhiệt thật và trình duyệt Chrome/Edge/Safari trước pilot; ghi vào handoff.

**F3-11 · Major · Màn thợ dùng Application Shell nhân viên đầy đủ, lộ tìm kiếm toàn hệ thống, thông báo báo giá và menu khách/báo cáo.**
Vị trí: `pack.js:58` (ô "Tìm phiếu, biển số, khách, phụ tùng…"), `pack.js:62–63` (thông báo cứng "Báo giá BG-…-v2 được khách duyệt một phần" liên kết `g2-quo-03.html` cho mọi vai trò), `app.js:338` (TH có menu `cust`, `hr`, `rpt`); TEC-01 đến 05 đều gọi `g2q.begin('TH', …)`. Thợ chỉ thấy việc của mình; không được thấy báo giá/khách. Căn cứ: WF-08, FRD §2, FR-REC-013, ba-answers-02 (thợ không thấy báo giá).
Cách sửa: thêm chế độ thiết bị xưởng: ẩn tìm kiếm toàn hệ thống, thông báo lọc theo vai trò (thợ chỉ nhận: việc mới, QC trả lại, phát sinh được duyệt, phụ tùng sẵn sàng), menu chỉ "Việc của tôi", "Công của tôi"; bỏ menu "Xem thử theo vai trò" khỏi chế độ thợ; ghi rõ ở handoff đây là hạn chế của shell prototype.

**F3-12 · Major · Bảo hành liên chi nhánh che dữ liệu không nhất quán, trái chính chú thích của màn.**
Vị trí: `g2-dlv-05.html:48` (dòng Thủ Đức: lộ tên khách "Lê Quốc Huy" và thợ gốc "Võ Minh Phát"), `53` (dòng Quận 1: lộ tên khách "Hoàng Gia Bảo"), `56` (chú thích nói "không thấy thợ, giá, hay chi tiết khách"); `g2-dlv-06.html:37` (thợ gốc tên đầy đủ ở chi nhánh khác). Căn cứ: NFR-ISO-01, FR-REC-036, ba-answers-03 câu 4.
Cách sửa: dòng của chi nhánh khác chỉ hiện biển số, hạng mục, hạn, điều kiện, chi nhánh gốc, mã lệnh gốc; tên khách và tên thợ không hiện (liên kết thợ gốc bằng mã nội bộ); biểu tượng khóa nhất quán; nhãn "Vô hiệu" cho bảo hành bị Quản lý hủy hiệu lực.

**F3-13 · Major · Chính sách mất mạng của "Báo hư hỏng phát sinh" mâu thuẫn và báo sai "Đã gửi".**
Vị trí: `g2-tec-04.html:50` (nút offline "Lưu nháp, tự gửi khi có mạng" đặt `data-set="sent"`, màn hiện "Đã gửi cố vấn … lúc 09:05"); `g2-tec-01.html:29` (nói báo phát sinh "chỉ gửi khi có mạng"); `g2-tec-04.html:31` (nói tự gửi khi có mạng). Thợ tin cố vấn đã nhận, hạng mục phát sinh chưa vào báo giá. Căn cứ: NFR-OFF-01, RULE-006.
Cách sửa: chốt: **báo phát sinh lưu nháp và tự gửi khi có mạng**, màn hiển thị "Đã lưu trên máy, chờ gửi (chưa tới cố vấn)" với `sync--wait`, và thông báo "Đã gửi" chỉ khi máy chủ nhận; **yêu cầu phụ tùng cần mạng** (như TEC-03). Sửa lại câu ở TEC-01.

### Minor

**F3-14 · Minor · Liên kết khách: token ngắn, chưa có quy tắc bảo mật.** `g2-quo-04.html:57, 62` (`/b/Xk7p-93aQ`, 8 ký tự). Liên kết cho phép xem tên, xe, giá và duyệt nên là bí mật mang theo người; cần ngẫu nhiên ≥ 128 bit, không nhúng biển số/tên vào URL, thu hồi khi bị thay hoặc hủy, hết hạn theo hiệu lực, giới hạn tần suất, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`. Căn cứ: NFR-SEC-03, FR-REC-008. Sửa: ghi vào handoff và đổi ví dụ token dài hơn.

**F3-15 · Minor · Trang khách có nhãn "số mẫu" và không hiện mã báo giá/phiên bản.** `g2-quo-06.html:96, 116` (tag "số mẫu" ở dòng thuế); `19–52` không có `BG-Q7-2610-00231` và "bản 2", trong khi liên kết là theo phiên bản và khách cần nêu mã khi gọi chi nhánh. Sửa: bỏ nhãn "số mẫu" khỏi trang khách (chỉ giữ trong chú thích prototype); thêm dòng "Báo giá số … (bản 2)" dưới tiêu đề.

**F3-16 · Minor · Trang khách: tên truy cập, OTP và thiếu trạng thái.** `g2-quo-06.html:66, 73, 81, 88` dùng `aria-label` trên `<label>` thay vì đặt tên cho `<input>` (đọc màn hình không chắc đọc được); `159` ô OTP thiếu `autocomplete="one-time-code"`; thiếu trạng thái "Báo giá đã bị hủy / liên kết không hợp lệ" (hộp thoại hủy ở QUO-03 nói liên kết ngừng hoạt động nhưng trang khách không có biến thể tương ứng) và "Đã từ chối" (F3-04). QUO-09 thiếu biến thể "Không tìm thấy". Sửa theo đó.

**F3-17 · Minor · Cách hiển thị giá/thuế cho khách cần cấu hình.** `g2-quo-06.html:62–97`, `g2-prt-01.html:57–69`: giá từng hạng mục chưa thuế, thuế ở tổng; khách bỏ/chọn hạng mục thấy tổng đổi nhiều hơn giá hạng mục. Theo `ba-answers-03` câu 11 (khách cá nhân: giá đã gồm thuế; doanh nghiệp: chưa thuế). Sửa: thêm cấu hình "Chế độ hiển thị giá cho khách" và dữ liệu mẫu theo đó (1.711.800 / 1.155.600 / 324.000 / 702.000). Giữ `[Cần xác nhận]` kế toán.

**F3-18 · Minor · QUO-05: ngưỡng ghi chú và câu hậu quả cứng.** `g2-quo-05.html:57` (gợi ý "tối thiểu 5 ký tự"; JS dòng 105 kiểm `>= 5`) thấp hơn quyết định ≥ 10 ký tự và thiếu ô tick "đã đọc lại hạng mục và tổng tiền"; dòng 65 hậu quả "Phụ tùng thiếu hàng (má phanh trước Vios) sẽ khiến lệnh Tạm dừng" là chuỗi cứng, trong khi theo câu 5 lệnh chỉ Tạm dừng khi không còn hạng mục làm tiếp. Sửa: hậu quả sinh động theo tồn khả dụng và hạng mục khác; thêm tick và nhãn "vào danh sách rà soát".

**F3-19 · Minor · QUO-02 không có điều khiển chọn Bắt buộc/Tùy chọn.** `g2-quo-02.html:52, 59, 63, 66` chỉ là tag tĩnh, trong khi §5.1 của tài liệu và FR-REC-007 nói chọn ở hạng mục. Sửa: thêm công tắc/đoạn chọn "Bắt buộc | Tùy chọn" ở dòng hạng mục và cờ "Khách đã yêu cầu" (câu 2).

**F3-20 · Minor · QUO-02 có mục tiêu cảm ứng dưới 44 px (thiết bị D, T).** `pack.css:40–42` (`.g2q-lines .input/.select` 36 px, `.qty__btn` 32 × 36) ghi đè quy tắc 44 px của `components.css`; `g2-quo-02.html:61` nút biểu tượng thông tin 24 × 24 px. Căn cứ: design-system §11, ba-decisions C(v). Sửa: chỉ giữ 36 px khi `pointer: fine` và ≥ 1024 px; tăng vùng bấm biểu tượng.

**F3-21 · Minor · QUO-02 ẩn giá vốn quá chặt.** `g2-quo-02.html:50, 52–70, 96` dùng `data-show-roles="QL CH"`; FRD §2 "Công nợ và giá vốn" cho CH, QV, QL xem và KT sửa. QV và KT thiếu. Sửa: `CH QV QL KT`; CV vẫn thấy lời giải thích.

**F3-22 · Minor · Dữ liệu mẫu QUO-01 trái WF-01.** `g2-quo-01.html:75`: báo giá `BG-Q7-2610-00224-v3` của biển 29A-345.67 "Chờ khách duyệt" 5.560.000 ₫ trong khi lệnh `RO-Q7-2610-00123` của cùng xe/khách (2.916.000 ₫) đã ở QC. Lệnh chỉ mở khi báo giá đã duyệt. Sửa: đổi biển/khách hoặc đổi trạng thái thành Duyệt toàn phần và tổng 2.916.000 ₫.

**F3-23 · Minor · QUO-07: biến thể thợ chạy trong shell cố vấn; hạn duyệt và số hạng mục lệch.** `g2-quo-07.html:15` (`begin('CV')`), 59 (biến thể "Thợ xem" vẫn có liên kết "Báo giá gốc" và mã báo giá); 31, 35, 39 (phát sinh là "hạng mục 4 của lệnh" trùng số 4 của báo giá gốc là Vệ sinh buồng đốt đã từ chối); hạn 02/11/2026 (`03-…md` §3) sau giờ hẹn giao 30/10. Sửa: ẩn liên kết báo giá gốc với TH; đánh số lệnh khác số báo giá (ví dụ "P1"); đặt hạn theo câu 3 (24 giờ, không quá giờ hẹn giao); thêm biến thể Hết hạn và nút Gia hạn.

**F3-24 · Minor · TEC-02 `blocked-parts` mâu thuẫn với TEC-01.** `g2-tec-02.html:28` (badge "Chưa làm") và 62 (nút "Tiếp tục") cho cùng việc TEC-01 hiện "Tạm dừng" kèm "Chờ phụ tùng" (`g2-tec-01.html:83, 86`, liên kết `?v=blocked-parts`). Theo câu 5: đã làm một phần thì Tạm dừng, chưa bắt đầu thì Chưa làm có tag "Thiếu phụ tùng" và nút "Bắt đầu" khóa. Sửa: tách hai biến thể hoặc đổi badge sang Tạm dừng.

**F3-25 · Minor · TEC-02 `forgot`: nhật ký giờ không khớp.** `g2-tec-02.html:52` ghi bắt đầu 05:45 (4,34 giờ), nhưng dòng 103 (`data-v="running forgot queued paused"`) hiện "Bắt đầu 09:25". Sửa: tách dòng nhật ký riêng cho `forgot`.

**F3-26 · Minor · Toast hứa "hoàn tác" nhưng không có điều khiển.** `g2-tec-01.html:53` ("Mở chi tiết để hoàn tác trong 10 giây"), `g2-tec-02.html:59` ("Tạm dừng ngay trong 10 giây"). Chưa có quy tắc: sửa nhầm bằng tạm dừng làm sai giờ thực. Sửa (đề xuất): nút "Hoàn tác" 10 giây trên toast (cạnh biểu tượng `undo`), tạo mốc "hủy bắt đầu" ghi vết, không xóa mốc, không tính giờ; hoặc bỏ lời hứa. Căn cứ: FR-HRM-005, FR-SYS-003.

**F3-27 · Minor · TEC-01: `aria-describedby` trỏ sai.** `g2-tec-01.html:78` trỏ `j4` (tên việc) thay vì lý do khóa; nút "Tiếp tục" dòng 86 không có `aria-describedby`. Sửa: gán id cho khối lý do và liên kết.

**F3-28 · Minor · DLV-02: biến thể chỉ đọc, vai trò QC và kiểm soát tách nhiệm.** `g2-dlv-02.html:25` ghi "11/11 mục đạt" nhưng checklist (dòng 49 `ok = n <= 8`) hiện 8/11 và vẫn bấm được; "nhân viên QC" (dòng 27, `g2-dlv-01.html:57`) không có trong FRD §2 (QĐ = S, QL = D); chưa có quy tắc người QC khác thợ làm. Thiếu empty/error. Sửa: biến thể chỉ đọc đặt cả 11 mục Đạt và `disabled`; dùng "Quản đốc" thay "nhân viên QC" (hoặc xác nhận vai trò cấu hình); thêm cấu hình "QC khác người làm" (cảnh báo khi trùng).

**F3-29 · Minor · DLV-03: dữ liệu và trạng thái.** `g2-dlv-03.html:74–86` ba dòng (đồ đạc, lưu nhắc, lịch nhắc) chỉ có biểu tượng cảnh báo, không chữ trạng thái; `36` biến thể `debt-ok` hiện Thanh toán "Chưa thanh toán" dù đã cọc 500.000 ₫ (đúng là "Thanh toán một phần", ba-answers-05 câu 4); `30` nhãn "Ví dụ khách doanh nghiệp" gắn khách cá nhân Đinh Thị Hạnh (câu 14); `22–25` chỉ có loading/not found, thiếu error, no-permission. Sửa theo đó.

**F3-30 · Minor · DLV-04: ô xác nhận tick sẵn, mã BB trùng STT lệnh, thiếu trạng thái.** `g2-dlv-04.html:45–47` ba ô `checked`: xác nhận mặc định đã tick làm yếu bằng chứng; `70` và `g2-prt-01.html:96` `BB-Q7-2610-00123` trùng STT với `RO-…-00123` (câu 9: STT riêng); `22` thiếu error/no-permission. Sửa: để trống, bắt buộc tick; đổi ví dụ STT; thêm trạng thái.

**F3-31 · Minor · Chú thích thiết kế lọt vào giao diện.** `g2-dlv-01.html:26`: "Cùng số với 'Chờ kiểm tra QC' trên tổng quan". Sửa: chuyển vào ghi chú handoff.

**F3-32 · Minor · Cơ chế in và quyền in SĐT.** `pack.css:212, 277` (`min-height: 297mm` + `@page margin: 0` + `break-inside: avoid-page` dễ sinh trang trắng; nên 296mm); `g2-prt-01.html:72, 90, 110` "Trang 1/1" cố định (báo giá dài nhiều trang cần đếm trang và lặp tiêu đề); `31, 141` ô tick in SĐT đầy đủ luôn bật (mô tả nói bị khóa nếu không có quyền nhưng không có biến thể) và số thật `0903 456 321` nằm trong mã (ba-decisions câu 8: không đưa giá trị đầy đủ xuống trình duyệt tới khi "Hiện"); khổ mặc định luôn A4 không đổi theo loại chứng từ (lệnh A5, giao nhận A5/nhiệt); không có trạng thái lỗi tạo bản in. Sửa theo đó; in thử trên máy thật.

**F3-33 · Minor · Nội dung mẫu in.** `g2-prt-01.html:71` ký "đồng ý các hạng mục đã khoanh" nhưng không có ô "Đồng ý" từng hạng mục; `95` QR "tra cứu bảo hành" trên phiếu giao nhận không có màn hình hay FR đỡ; `105` số hóa đơn `C26TAA-0001302` và `49` "MST … (số mẫu)" in thẳng lên mẫu mà không đánh dấu mẫu; thiếu điều khoản bảo hành tóm tắt. Căn cứ: ba-answers-03 câu 10. Sửa: thêm cột/ô "Đồng ý", bỏ QR bảo hành ở giai đoạn đầu, đánh dấu dữ liệu mẫu trong ghi chú handoff.

**F3-34 · Minor · Tài liệu `03-…md` cần cập nhật.** (a) §5.4 và §6 dòng PRT-01 trích FR-ACC-014 cho nhật ký in lại: FR-ACC-014 chỉ nói mẫu chứng từ kế toán, nhật ký in chưa có FR (đề xuất FR-SYS-019); (b) §8 giả định 1, 2, 3, 6, 8, 9, 10, 11, 13 và §9 đã được trả lời trong `ba-answers-03.md` (đặc biệt giả định 2 sai, xem F3-01; giả định 9 thay theo câu 11; giả định 10 thay theo câu 9); (c) §4.1 bước 7 và §5.3 sai theo F3-06; (d) §5.3 DLV-03 thiếu điều kiện phát sinh (F3-07); (e) §6 nên map RULE-005/006 cho QUO-05/06 và WF-03/04/05 cho DLV; (f) §7 mục "Chưa kiểm" đúng, nên thêm: `@page` nhiệt, chữ ký canvas, OTP thật.

**F3-35 · Minor · "Chỉ dùng token" đúng với màu, chưa đúng với kích thước.** `pack.css:98` (`min-height: 64px !important`), `120` (`3rem`), `169` (`padding-bottom: 200px`), `106` (`border-left: 8px`), `14` (`340px`), `126` (`72px`). Không vi phạm màu, nhưng khó bảo trì và `!important` cản ghi đè. Sửa: đặt token component mức pack (ví dụ `--g2q-tech-btn-primary: 64px`) hoặc ghi rõ ngoại lệ; không sửa `design-system.md`.

**F3-36 · Minor · Rủi ro `document.write` và script inline.** `pack.js:29–94` dựng shell bằng `document.write` (mở `<div class="app">`, `<main>` ở `g.begin`, đóng ở `g.end`): nếu một script giữa chừng lỗi hoặc thiếu `g2q.end()` thì cấu trúc HTML sai; `g2-dlv-02.html:58` cũng `document.write` danh sách QC; không có `<noscript>`; toàn bộ trang dùng script inline nên sẽ bị chặn nếu sau này bật CSP nghiêm ngặt. Chỉ chấp nhận ở prototype. Cách sửa: giữ nguyên class/cấu trúc, ghi vào handoff để thay bằng component của framework; thêm `<noscript>`; không sao chép `document.write` sang sản phẩm.

## 4. Việc cần làm theo thứ tự ưu tiên

1. Sửa nhóm **duyệt báo giá**: F3-01, 02, 03, 04, 05 (và 15, 16, 17, 18, 19).
2. Sửa nhóm **trạng thái và quyền**: F3-06, 07, 08, 09, 11, 12, 13.
3. Kiểm **in thật**: F3-10, 32, 33 (bắt buộc thử trên máy nhiệt/A4/A5 trước pilot).
4. Dọn Minor còn lại; cập nhật `03-quote-technician-delivery.md` theo F3-34.

## 5. Tác động tài liệu và yêu cầu (đề nghị, chưa thực hiện)

| Tài liệu | Nội dung |
| --- | --- |
| `docs/ui-ux/03-quote-technician-delivery.md` | Sửa theo F3-34; designer đọc `ba-answers-03.md` |
| `docs/functional-requirements.md` | FR mới đề xuất ở `ba-answers-03.md` (FR-REC-037, 038, 039; FR-INV-029; FR-SYS-019); làm rõ FR-REC-007, 023, 026, 034; UAT-03, 17, 24 bổ sung; ma trận truy vết |
| `docs/user-journey-business-workflow.md` | §7 phiên bản cũ là thuộc tính, thuộc tính duyệt có "Hết hạn", bảo hành tính toán; §8 từ chối hạng mục bắt buộc, giao xe cho người ủy quyền, phát sinh hết hạn |
| `docs/business-requirements.md` | Câu mở: giá trị pháp lý chữ ký màn hình, chế độ hiển thị giá/thuế, OTP; không đổi số RULE |
| `docs/ui-ux/ba-decisions.md` | Câu 11 thêm tiền tố BB |
| `docs/ui-ux/screen-inventory.md` | QUO-05 "từng hạng mục", DLV-03 điều kiện phát sinh, DLV-05 nhãn Vô hiệu |
| `docs/design-system.md` | Không đổi |

## 6. Điểm tốt cần giữ

Số liệu nhất quán giữa QUO-01/03/05/06, PRT-01 và G2-REC-04; thẻ việc của thợ nêu lý do khóa bằng chữ ngay trên thẻ (tablet không có hover); QC có hộp thoại hậu quả và lý do bắt buộc khi trả thợ; hóa đơn không mở lựa chọn "khách không lấy" (đúng D-13); bản in lệnh xưởng không đơn giá, không SĐT và in rõ "KHÔNG làm" cho phát sinh chưa duyệt; không có nút "Xóa" cho chứng từ đã ghi sổ (dùng Hủy, Trả thợ làm lại, biên bản điều chỉnh, đúng RULE-010); kênh SMS "Chưa kích hoạt" kèm lý do (đúng D-13); biến thể mất mạng của TEC-02 có nhãn "nhập bù" và `sync--wait`.

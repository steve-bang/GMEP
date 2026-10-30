# BA Review vòng 3 (kiểm tra cuối) – Gói 3 "Báo giá, Thợ tablet, Giao xe, In ấn"

Phiên bản 0.1 · Ngày 30/10/2026 · Người review: BA · Đối tượng: `design/g2-quote-delivery/*`, `docs/ui-ux/03-quote-technician-delivery.md` (§12 bảng vòng 2, §13, §14). Vòng trước: `review-03-round2-ba.md`.

Phương pháp: môi trường này không có Bash/Playwright nên kiểm bằng **đọc mã thực tế** (đọc QUO-08, `pack.js` phần hoàn tác, `pack.css` `.g2q-undo`, DLV-03, QUO-05 phần JS, TEC-01; tìm kiếm QUO-07, DLV-01), không dựa bảng tự khai. Chưa xem ảnh chụp thật.

## 1. Kết luận

**ĐẠT** (có 3 Minor còn mở, không chặn). 9/9 finding vòng 2 đã xử lý đúng trong mã. Việc chỉnh sửa sinh ra 3 Minor mới; không có Major hay Blocker.

| Mức | Còn mở |
| --- | --- |
| Blocker | 0 |
| Major | 0 |
| Minor | 3 (F3R3-01, 02, 03) |

## 2. Kiểm finding vòng 2

| # | Kết quả | Căn cứ trong mã |
| --- | --- | --- |
| F3R2-01 QUO-08 hàng loạt | Đạt | Dòng xe có lệnh mở gắn `data-open-ro` (QUO-08:51, 53). JS 84–86: chọn một xe có lệnh mở thì nút đổi nhãn "Lập báo giá bổ sung" và `data-href` thành `g2-quo-07.html`; chọn nhiều xe thì `disabled` + `aria-disabled` + tag "Chọn hạng mục của cùng một xe" (dòng 82). Nút điều hướng bằng `data-href` nên khi `disabled` không đi được. Còn một khe nhỏ: F3R3-03 |
| F3-26 Hoàn tác 10 giây | Đạt | pack.js:188–196: thanh riêng `#g2q-undo` đếm ngược thật 10 giây (`setInterval` 1 giây, `Hoàn tác (n)`), không dùng toast 5 giây; bấm Hoàn tác ghi toast "hủy bắt đầu có ghi vết"; thanh cũ bị thay khi bấm lần nữa. Nút `btn--xl` 52 px. Chạm vùng phủ: F3R3-01 |
| F3R2-02 Hủy phát sinh | Đạt | QUO-07:78 `data-set="cancelled"`; biến thể "Cố vấn đã hủy" (dòng 22, 27) nêu rõ "không phải khách từ chối", tag "Đã hủy", không tự lưu nhắc. Câu hỏi trạng thái trong bộ 6: §3 câu 2 |
| F3R2-03 Giá cũ gồm thuế | Đạt | QUO-08:51 702.000 ₫ cả hai cột; tổng dòng 39 là 9.792.000 ₫ (3.200.000 + 480.000 + 702.000 + 2.640.000 + 1.520.000 + 1.250.000 = 9.792.000, đúng) |
| F3R2-04 DLV-03 `extra` | Đạt | DLV-03:39 Đã thanh toán, 56 và 62 thu đủ tiền "Đạt", 51 "Còn 1 điều kiện: phát sinh chờ quyết định"; chân trang dòng 103 nhất quán |
| F3R2-05 Nợ khách cá nhân | Đạt | DLV-03:64 ở `pending` cho CV, QL nút "Đề nghị duyệt giao xe còn nợ (ngoại lệ)" mở `dlg-debt` (lý do bắt buộc, nêu hạn mức 0 và người đề xuất không tự duyệt, dòng 129); vai trò khác không thấy nút. Bàn giao vẫn khóa tới khi duyệt |
| F3R2-06 Nháp chưa gửi | Đạt | TEC-01:32 cảnh báo nổi bật `list offline` "CHƯA gửi tới cố vấn" + "Nhắc lại mỗi lần mở lại màn hình" + nút lớn "Mở nháp và gửi" (`btn--xl`) tới TEC-04 `?v=draftlocal` |
| F3R2-07 RO-00126 | Đạt | DLV-01:39 dùng RO-…00114 và 00110; không còn 00126 |
| F3R2-08 Hậu quả QUO-05 | Đạt (xem F3R3-02) | QUO-05:109–113 sinh theo hạng mục đang chọn: có/không hạng mục 2, và trường hợp hạng mục duy nhất |

Quyết định BA vòng 2 §12 đoạn "đã áp dụng": các mục (1) đến (8) khớp với nội dung tôi đã đề xuất; mục nào tôi thấy trong mã (mất mạng TEC-01/04, trạng thái yêu cầu phụ tùng ở TEC-03, nút "Ghi nhận duyệt (quầy hoặc điện thoại)" ở QUO-07:70, ghi chú người ủy quyền ở DLV-04) đúng. Chưa mở lại QUO-02 (ghi chú làm tròn thuế, kênh khách yêu cầu), DLV-04 hộp thoại điều chỉnh và QUO-08 cờ An toàn/báo cáo để kiểm mã từng dòng; nếu coordinator muốn xác nhận cụ thể, đó là phạm vi bổ sung.

## 3. Finding mới do chỉnh sửa gây ra

**F3R3-01 · Minor · Thanh Hoàn tác che nút hành động của chính thẻ vừa bấm.**
Vị trí: `pack.css:144` (`.g2q-undo` `position: fixed; bottom: var(--space-4); z-index: var(--z-toast)` > `bottom-nav` z-topbar), `pack.js:194` (nối vào `body`), không có chừa chỗ ở `.g2q-tec`. Thanh cao khoảng 90 px, chiếm đáy màn hình 10 giây và phủ cả thanh điều hướng dưới (dưới 1024 px). Ở TEC-01, thẻ vừa bấm "Bắt đầu" sẽ đổi thành "Tạm dừng / Kết thúc" (nút ở đáy thẻ); nếu thẻ nằm ở cuối vùng nhìn thì chính hai nút đó bị thanh che trong lúc thợ cần tiếp tục thao tác. Kích thước nút Hoàn tác (52 px) đạt, không vi phạm vùng chạm của nó. Tác động nghiệp vụ nhỏ (chờ 10 giây hoặc cuộn), nhưng ảnh hưởng NFR-USA-01 (≤ 2 chạm) khi bị che. Sửa: thêm `padding-bottom` cho trang thợ trong lúc thanh hiển thị (hoặc cuộn thẻ vừa bấm vào giữa vùng nhìn), và đặt thanh trên `bottom-nav` ở màn nhỏ.

**F3R3-02 · Minor · QUO-05 bước 3: nêu trạng thái lệnh sai thời điểm.**
Vị trí: `g2-quo-05.html:70, 112–113`. Câu "lệnh vẫn Đang sửa chữa" và "lệnh Tạm dừng (lý do Chờ phụ tùng)" mô tả trạng thái ngay lúc khách duyệt, nhưng theo `ba-answers-02` A.1 lệnh mới mở ở **Đã duyệt**, tự chuyển Đang sửa khi hạng mục đầu tiên chuyển Đang làm, và Tạm dừng chỉ chuyển từ Đang sửa. Căn cứ: FR-REC-015, ba-answers-02 A.1. Sửa: "lệnh ở Đã duyệt; hạng mục 2 bị khóa 'Thiếu phụ tùng'; hạng mục 1, 3 làm được nên lệnh sẽ chuyển Đang sửa khi thợ bắt đầu"; trường hợp hạng mục duy nhất: "lệnh giữ Đã duyệt, chưa thể bắt đầu cho tới khi có phụ tùng" (không phải Tạm dừng).

**F3R3-03 · Minor · QUO-08: nút hàng loạt bật khi chưa chọn dòng nào.**
Vị trí: `g2-quo-08.html:42, 78–87`. Trạng thái mặc định (0 dòng chọn) nút "Đưa vào báo giá mới" vẫn bật và đi tới `g2-quo-02.html` với báo giá trống (JS chỉ chạy sau sự kiện `change`). Cố vấn có thể tạo báo giá mới cho xe không rõ, hoặc, nếu sau đó bỏ chọn hết, nút lại bật. Sửa: `disabled` khi 0 dòng chọn (kèm chữ "Chọn ít nhất một hạng mục").

## 4. Trả lời 3 câu hỏi §14 (BA đề xuất — chờ xác nhận)

**1. Làm tròn thuế cấp hạng mục: kế toán chốt ví dụ kiểm thử có chữ ký trước khi đóng cứng hiển thị? Có.** Quy tắc (cấp hạng mục, làm tròn 1 đồng half-up) và chế độ "giá gồm thuế cho khách cá nhân" **vẫn là cấu hình**, không đóng cứng. Điều kiện: **không bật chế độ gồm thuế cho pilot cho tới khi kế toán ký bộ ví dụ kiểm thử** (NFR-MNT-01); tới lúc đó mặc định an toàn là "chưa thuế + thuế ở tổng". Bộ ví dụ BA đề xuất cho kế toán ký: (a) ba hạng mục mẫu hiện có, thuế 126.800 / 85.600 / 24.000 / 52.000, tổng được duyệt 3.191.400 ₫; (b) ca lệch làm tròn: hai hạng mục 333.333 ₫, thuế theo hạng mục 26.667 × 2 = 53.334 ₫, thuế theo tổng (666.666 × 8% = 53.333,28 làm tròn 53.333 ₫): chênh 1 đồng, kế toán chọn cách nào được phép và cách xử lý chênh lệch với hóa đơn; (c) khách bỏ một hạng mục, tổng giảm đúng giá hạng mục đó; (d) thuế suất đổi theo ngày hiệu lực, báo giá đã gửi giữ thuế cũ. Căn cứ: NFR-MNT-01, FR-REC-004, FR-REC-031, FR-ACC-009.

**2. Báo giá bổ sung bị cố vấn hủy dùng trạng thái nào trong bộ 6? Không đúng trạng thái nào: đề xuất thêm "Đã hủy" làm trạng thái thứ 7 của Báo giá.** Lý do: "Từ chối" là quyết định của khách, "Hết hạn" là hết thời hiệu; dùng một trong hai làm sai báo cáo lưu nhắc và bằng chứng. FR-REC-021 ("Hủy báo giá hoặc lệnh có lý do") và QUO-03 (nút "Hủy báo giá", dialog nói chuyển trạng thái hủy) đã ngầm có kết quả hủy, trong khi Journey §7 và ba-decisions A.2 chỉ liệt kê 6 trạng thái, nên **tài liệu hiện mâu thuẫn**. Đề xuất: thêm "Đã hủy" (Neutral, chữ "Đã hủy", kèm lý do và người hủy) vào Journey §7 và A.2 cho đối tượng Báo giá, áp dụng cả báo giá thường và báo giá bổ sung; chỉ từ Nháp, Đã gửi (chưa có hạng mục được duyệt); báo giá đã Duyệt thì không hủy, thay đổi bằng báo giá bổ sung hoặc hủy hạng mục qua lệnh. Điều này **không** làm "phiên bản bị thay thế" thành trạng thái (câu 1 `ba-answers-03` giữ nguyên). Cần chủ dự án xác nhận vì đổi A.2; tới lúc đó giữ badge hiện tại của designer là chấp nhận được. Đồng bộ: Journey §7, `ba-decisions.md` A.2, QUO-01 (bộ lọc trạng thái), QUO-03, QUO-07, UAT hủy báo giá.

**3. Thời hạn nháp "chưa gửi" của báo phát sinh trên máy: giữ tới khi gửi được hoặc thợ hủy, tối đa hết ca (cấu hình, mặc định 24 giờ); không phụ thuộc phiên khóa 3 phút.** Khóa màn hình (D-04) chỉ là khóa giao diện; nháp lưu trên thiết bị (mã hóa) và gắn với thợ tạo, hiện lại khi thợ đó đăng nhập PIN. Thiết bị xưởng dùng chung nên: (a) nháp chỉ thấy bởi thợ tạo và Quản đốc; (b) Quản đốc có danh sách "nháp báo phát sinh chưa gửi" của chi nhánh để chống quên (RULE-006); (c) cuối ca còn nháp thì nhắc thợ và Quản đốc; (d) hết hạn không xóa im lặng: chuyển Quản đốc xử lý (gửi thay hoặc bỏ có lý do, ghi nhật ký). Ảnh/video trong nháp là dữ liệu của lệnh, xóa khỏi thiết bị sau khi gửi thành công. Căn cứ: NFR-OFF-01, D-04, D-05, RULE-006, FR-SYS-003.

## 5. Chuyển cho dev (không chặn)

- **Chạm và hiển thị thật:** thanh Hoàn tác (F3R3-01), vùng chạm 52–64 px, `pointer: coarse`, tablet cảm ứng thật, Safari/Firefox chưa kiểm; thanh hoàn tác cần thử với bàn phím ảo và chế độ ngang/dọc.
- **In:** `@page 80mm 297mm` là giá trị mẫu (chiều dài theo máy `[Cần xác nhận]`); "Trang x/y" thật và lặp tiêu đề bảng cho báo giá nhiều trang; máy in thật.
- **Hoàn tác thật:** mốc "hủy bắt đầu" cần lưu vết ở máy chủ; prototype chỉ hiện toast, không hoàn lại giao diện thẻ.
- **Nháp trên thiết bị:** mã hóa, gắn thợ, dọn sau khi gửi (câu 3 §4).
- **Shell prototype:** `document.write`, regex `techShell`, CSP không script inline; số điện thoại mô phỏng trong PRT-01.
- **Gói 2:** nhóm "Không thực hiện" ở G2-REC-04; đồng bộ lệnh Đã duyệt/Đang sửa/Tạm dừng như F3R3-02.
- **G4-SYS:** cấu hình cho phép bỏ hạng mục bắt buộc, OTP ba mức, chế độ hiển thị giá, ngưỡng, hạn duyệt phát sinh, thời hạn nháp.

## 6. Việc cần làm

1. Sửa F3R3-01 đến 03 (Minor) cùng lượt cập nhật tiếp theo; không cần review lại toàn gói.
2. Chủ dự án xác nhận câu 2 §4 (thêm "Đã hủy" cho Báo giá) để BA cập nhật Journey §7 và `ba-decisions.md` A.2.
3. Kế toán ký bộ ví dụ thuế (câu 1) trước khi bật chế độ gồm thuế ở pilot.

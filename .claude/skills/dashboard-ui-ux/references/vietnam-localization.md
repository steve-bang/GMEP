# Bản địa hóa cho dashboard tiếng Việt

Phần này dành cho sản phẩm phục vụ người dùng Việt Nam. Nhiều lỗi giao diện chỉ lộ ra khi gặp dữ liệu và chữ tiếng Việt thật.

## Mục lục
1. Font và hiển thị dấu
2. Định dạng số, tiền tệ, phần trăm
3. Ngày giờ và múi giờ
4. Độ dài chuỗi và layout
5. Tìm kiếm, sắp xếp, lọc tiếng Việt
6. Văn phong giao diện
7. Đa ngôn ngữ (vi/en)
8. Dữ liệu mẫu thực tế

## 1. Font và hiển thị dấu

- Chọn font **hỗ trợ đầy đủ bộ ký tự Latin mở rộng của tiếng Việt** (Vietnamese subset): ví dụ Inter, Be Vietnam Pro, Roboto, Noto Sans, Open Sans, Source Sans 3. Khi tự host/Google Fonts, bật subset `vietnamese` (cùng `latin`, `latin-ext`) để dấu không rơi về font dự phòng gây lệch nét.
- Khai báo chuỗi dự phòng (`system-ui, "Segoe UI", Roboto, sans-serif`) có hỗ trợ dấu tiếng Việt.
- **Line-height rộng hơn** vì dấu chồng: body >= 1.5; tiêu đề không dưới ~1.25. Chữ HOA có dấu (Ế, Ộ, Ữ) dễ bị cắt khi `line-height` thấp hoặc `overflow: hidden`; kiểm tra badge, nút, ô bảng có chiều cao cố định.
- Cỡ chữ quá nhỏ làm dấu thanh và dấu phụ khó phân biệt (ă, â, ê, ô, ơ, ư); giữ nội dung chính từ 14px trở lên khi có thể.
- Hạn chế chữ viết hoa toàn bộ và `letter-spacing` lớn cho đoạn tiếng Việt; dùng `text-transform: uppercase` cẩn thận vì ảnh hưởng dấu.
- Tên riêng, tên sản phẩm, địa chỉ có thể rất dài: cắt bằng ellipsis và tooltip, không vỡ layout.
- Chuẩn hóa Unicode: dữ liệu có thể ở dạng NFC hoặc NFD (dấu tổ hợp), gây so sánh/tìm kiếm không khớp. Chuẩn hóa (NFC) khi lưu và so sánh.

## 2. Định dạng số, tiền tệ, phần trăm

Theo locale `vi-VN`: dấu **chấm** phân tách hàng nghìn, dấu **phẩy** phân tách thập phân.

- Số: `1.234.567,89`
- Tiền VND: không có phần thập phân, ký hiệu ₫ đặt sau: `1.250.000 ₫` (hoặc "đ"/"VND" theo quy ước sản phẩm; chọn một cách và dùng nhất quán).
- Phần trăm: `12,4%`.
- Dùng API chuẩn thay vì tự ghép chuỗi:

```js
new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(1250000); // "1.250.000 ₫"
new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(12.4);              // "12,4"
new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(1250000000);             // rút gọn có kiểm soát
```

- Số lớn rút gọn: người Việt quen "nghìn / triệu / tỷ" (k, tr, tỷ). Nếu rút gọn, dùng quy ước đó (1,25 tỷ; 350 tr) thay vì "M/B" của tiếng Anh, và luôn cho xem giá trị đầy đủ ở tooltip/chi tiết. Chọn kiểu rút gọn nhất quán cho toàn dashboard.
- Bảng tiền: căn phải, cùng định dạng, tabular-nums; cột "Thành tiền" không dùng chữ viết tắt khác nhau giữa các màn.
- Số đơn vị đếm (cái, thùng, kg): ghi đơn vị ở tiêu đề cột hoặc cạnh số; xử lý số nguyên và số thập phân theo đặc thù hàng hóa (cái = nguyên; kg có thể 0,5).
- Quy đổi ngoại tệ: ghi rõ đồng tiền, tỷ giá và thời điểm.

## 3. Ngày giờ và múi giờ

- Định dạng ngày hiển thị: **dd/MM/yyyy** (15/10/2026); giờ 24h `HH:mm`. Tránh định dạng mơ hồ kiểu `10/15/2026` hoặc `03/04` không rõ tháng-ngày.
- Tên tháng/thứ: "Tháng 10", "T10", "Thứ hai"/"T2"; tuần bắt đầu từ **thứ Hai** theo thông lệ địa phương (cấu hình được cho date picker).
- Múi giờ mặc định `Asia/Ho_Chi_Minh` (UTC+7), không có giờ mùa hè. Lưu UTC ở backend, hiển thị theo múi giờ người dùng/chi nhánh; ghi rõ múi giờ khi dữ liệu liên quan nhiều quốc gia.
- Preset khoảng thời gian bằng tiếng Việt tự nhiên: Hôm nay, Hôm qua, 7 ngày qua, 30 ngày qua, Tháng này, Tháng trước, Quý này, Năm nay, Tùy chọn.
- Kỳ báo cáo: ngày, tuần, tháng, quý, năm tài chính (xác nhận năm tài chính của doanh nghiệp, thường theo năm dương lịch nhưng không phải luôn vậy).
- Ngày lễ/Tết ảnh hưởng xu hướng (doanh số, lượng hàng); với biểu đồ so sánh kỳ, cân nhắc đánh dấu sự kiện Tết/lễ để tránh hiểu sai biến động.
- Hiển thị thời gian tương đối ("5 phút trước") kèm thời gian tuyệt đối ở tooltip.

## 4. Độ dài chuỗi và layout

- Tiếng Việt thường dài hơn tiếng Anh, và từ ghép nhiều âm tiết: chừa chỗ cho nhãn nút, tab, tiêu đề cột. Kiểm tra với bản dịch thực tế, không chỉ chuỗi mẫu tiếng Anh.
- Tránh nhãn nút chỉ vài chữ cố định chiều rộng; cho co giãn hoặc ellipsis kèm tooltip.
- Tên tiếng Việt thường có 3-4 âm tiết, họ tên đầy đủ khá dài: cột "Họ tên" không đặt quá hẹp; cân nhắc hiển thị tên + avatar viết tắt (ghép từ chữ cái đầu của họ-tên theo quy ước, chú ý tên có dấu).
- Địa chỉ gồm nhiều cấp (số nhà, đường, phường/xã, quận/huyện, tỉnh/thành): hiển thị rút gọn trong bảng, đầy đủ ở chi tiết; dùng danh mục hành chính hiện hành và cho phép tìm kiếm. Lưu ý sáp nhập/đổi tên đơn vị hành chính có thể xảy ra, cần có cách cập nhật danh mục.
- Biển số xe, mã vận đơn, mã sản phẩm: dùng font mono hoặc tabular, cho sao chép nhanh.

## 5. Tìm kiếm, sắp xếp, lọc tiếng Việt

- **Tìm không phân biệt dấu và hoa thường**: gõ "nguyen van a" tìm được "Nguyễn Văn A"; gõ có dấu thì ưu tiên khớp có dấu. Làm ở backend (cột chuẩn hóa/collation phù hợp, hoặc tìm kiếm văn bản đầy đủ) thay vì chỉ lọc ở client với dữ liệu lớn.
- Chữ "đ/Đ" không tự bỏ dấu bằng phép chuẩn hóa NFD thông thường; xử lý riêng ("đ" -> "d").
- **Sắp xếp** theo collation tiếng Việt (`localeCompare('vi')` / `Intl.Collator('vi')`) để thứ tự chữ cái và dấu đúng; không sắp xếp theo mã Unicode thô.
- Ô tìm kiếm hiểu cả mã, số điện thoại (có/không số 0 đầu, +84), tên, biển số; chuẩn hóa dấu cách, gạch.
- Highlight phần khớp phải xử lý cả khi khớp không dấu.

## 6. Văn phong giao diện

- Dùng ngôi và giọng điệu nhất quán, lịch sự nhưng ngắn gọn; thường dùng "bạn" hoặc câu không chủ ngữ cho thao tác ("Lưu thay đổi", "Bạn chưa có đơn hàng nào"). Chọn một cách xưng hô và giữ xuyên suốt; tránh trộn "quý khách/bạn/anh chị".
- Tránh dịch máy từng chữ ("Submit" -> "Nộp"?). Dùng từ nghiệp vụ người dùng thực sự dùng ("Xác nhận đơn", "Nhập kho", "Xuất kho", "Kiểm kê", "Công nợ").
- Thống nhất thuật ngữ trong từ điển giao diện (glossary) cho cả sản phẩm: "Đơn hàng" hay "Phiếu"? "Khách hàng" hay "Đối tác"? "Tồn kho" hay "Hàng tồn"?
- Nút hành động bằng động từ cụ thể: "Tạo phiếu nhập", "Xuất Excel", "Duyệt đơn". Thông báo lỗi: nói gì xảy ra + cách khắc phục.
- Từ mượn: giữ thuật ngữ quen thuộc ở ngành (SKU, KPI, dashboard) khi người dùng đã quen; nếu đối tượng là người không chuyên kỹ thuật, ưu tiên từ tiếng Việt dễ hiểu và có chú thích cho chỉ số phức tạp.

## 7. Đa ngôn ngữ (vi/en)

- Tách toàn bộ chuỗi ra file ngôn ngữ (i18n), dùng khóa ổn định; không ghép câu từ nhiều mảnh chuỗi (cấu trúc câu khác nhau giữa các ngôn ngữ). Dùng ICU MessageFormat cho số nhiều/biến.
- Tiếng Việt không chia số nhiều theo danh từ như tiếng Anh, nhưng vẫn cần xử lý "0 / 1 / nhiều" trong câu hợp lý.
- Định dạng số/ngày/tiền theo locale đang chọn qua `Intl`, không hard-code.
- Kiểm tra layout ở cả hai ngôn ngữ; bố cục phải chịu được chuỗi dài nhất.
- Công tắc ngôn ngữ ở vị trí dễ tìm, nhớ lựa chọn theo tài khoản.

## 8. Dữ liệu mẫu thực tế

Khi dựng mockup hoặc demo, dùng dữ liệu giống thật để lộ vấn đề sớm:

- Họ tên đa dạng, có tên dài ("Nguyễn Thị Phương Anh"), có dấu; tên công ty dài.
- Số tiền VND từ vài chục nghìn tới hàng tỷ; số lượng nguyên và thập phân; giá trị 0 và trống.
- Ngày dd/MM/yyyy trải nhiều tháng; có ngày Tết/lễ; trạng thái đa dạng (mới, đang xử lý, hoàn thành, hủy, quá hạn).
- Địa chỉ nhiều cấp, nhiều chi nhánh ở các tỉnh/thành khác nhau; mã/biển số/số điện thoại thật dạng.
- Vài bản ghi cực đoan: chuỗi rất dài, thiếu trường tùy chọn, không có ảnh.

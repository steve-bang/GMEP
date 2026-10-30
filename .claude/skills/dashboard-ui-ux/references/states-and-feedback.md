# Trạng thái và phản hồi

Dữ liệu thật đôi khi thiếu, đang tải, ít, quá nhiều hoặc sai. Một màn hình chỉ thiết kế cho trạng thái hoàn hảo sẽ hỏng ở mọi trạng thái còn lại. **Liệt kê toàn bộ trạng thái trước khi viết UI.**

## Mục lục
1. Bảng kiểm kê trạng thái
2. Loading
3. Empty
4. Error
5. Partial, stale, offline, real-time
6. No-permission và giới hạn gói
7. Thành công và xác nhận
8. Microcopy

## 1. Bảng kiểm kê trạng thái (cho mỗi khối/màn hình)

| Trạng thái | Khi nào | Cần có |
|---|---|---|
| Loading | Đang lấy dữ liệu | Skeleton đúng hình, giữ layout |
| Empty - lần đầu | Chưa có dữ liệu nào | Giải thích giá trị + 1 nút hành động |
| Empty - do lọc/tìm | Có dữ liệu nhưng bộ lọc loại hết | Nói rõ + "Xóa bộ lọc" |
| Empty - đã hoàn thành | Hết việc cần làm | Xác nhận tích cực ("Không còn đơn chờ duyệt") |
| Error | Tải/hành động thất bại | Nguyên nhân + cách khắc phục + Thử lại |
| Partial | Một phần dữ liệu lỗi/trễ | Hiện phần có; đánh dấu phần thiếu |
| Stale | Dữ liệu cũ | "Cập nhật lúc ..." nổi bật khi quá cũ |
| Offline | Mất kết nối | Dữ liệu cache + chỉ báo offline, không coi là lỗi |
| No-permission | Thiếu quyền | Lý do + cách xin quyền |
| Limit | Hết hạn mức gói | Nói rõ giới hạn + nâng cấp đúng ngữ cảnh |
| Extreme | 1 mục / hàng triệu / chuỗi cực dài / thiếu ảnh | Layout chịu được |
| Disabled / read-only | Không được thao tác | Lý do hiển thị |

## 2. Loading

Hai câu hỏi quyết định: **kéo dài bao lâu** và **có biết hình dạng nội dung không**.

| Thời gian | Gợi ý |
|---|---|
| < ~100ms | Không cần chỉ báo |
| ~100ms - 1s | Skeleton (nếu biết layout) hoặc chỉ báo nhẹ |
| 1 - 10s | Skeleton + chỉ báo tiến trình/nhãn ("Đang tải báo cáo...") |
| > 10s | Tiến trình có ước lượng thời gian + cho hủy; cân nhắc chạy nền và thông báo khi xong |

Quy tắc:
- **Skeleton khớp hình dạng nội dung thật** (số cột bảng, hình thẻ KPI, khung biểu đồ) để layout không nhảy khi dữ liệu về. Spinner chung chung không cho biết gì.
- **Chỉ hiện loading khi chưa có dữ liệu để hiển thị.** Nếu đã có dữ liệu (làm mới nền), giữ dữ liệu cũ + chỉ báo nhỏ "đang cập nhật" thay vì xóa trắng.
- **Tải theo từng khối** (progressive loading): khối nào xong hiện khối đó; không chặn toàn trang bằng overlay khi chỉ một khối chậm.
- Không trộn skeleton và spinner ở các khối kề nhau trong cùng ngữ cảnh.
- Chiều rộng/chiều cao dành sẵn cho hình ảnh, biểu đồ để không gây layout shift (CLS).
- Nút đang xử lý: vô hiệu hóa + spinner nhỏ + nhãn "Đang lưu...", ngăn bấm đúp.
- Không dùng skeleton cho modal, toast, dropdown (cần tức thì hoặc chỉ báo bên trong).
- Skeleton animation nhẹ; tôn trọng `prefers-reduced-motion`; báo cho trình đọc màn hình ("Đang tải") bằng vùng live/văn bản ẩn.

## 3. Empty

Phân biệt ba loại, vì mỗi loại cần câu trả lời khác:

1. **Lần đầu (chưa có dữ liệu)**: một cơ hội onboarding. Minh họa/icon nhỏ + 1-2 câu nói giá trị + nút hành động chính ("Tạo kho đầu tiên", "Nhập sản phẩm từ Excel"). Có thể thêm liên kết tài liệu.
2. **Không có kết quả do lọc/tìm kiếm**: nói rõ nguyên nhân + "Xóa bộ lọc" + gợi ý (kiểm tra chính tả, nới khoảng thời gian). Không dùng minh họa lớn gây sai lệch cảm giác.
3. **Đã xong / không còn việc**: phản hồi tích cực ngắn gọn.

Với KPI/biểu đồ: phân biệt "0" (có dữ liệu, giá trị bằng 0) với "chưa có dữ liệu" (—). Biểu đồ rỗng vẫn giữ trục/khung và thông báo thay vì biến mất.

## 4. Error

- **Lỗi là lỗi, không giả làm empty**: nếu request thất bại, hiện error + retry; đừng hiện "Không có dữ liệu".
- Hiện ngay trong khối bị lỗi (không làm hỏng toàn trang). Lỗi toàn trang (500, mất phiên) dùng trang lỗi riêng có hướng đi tiếp.
- Công thức thông báo: **điều gì xảy ra + vì sao (nếu biết) + cách khắc phục**. Không đổ lỗi cho người dùng, không hiện stack trace/mã kỹ thuật cho người dùng cuối (cho phép sao chép mã tham chiếu để gửi hỗ trợ).
  - Tốt: "Không tải được báo cáo doanh thu. Kết nối đến máy chủ bị gián đoạn. Thử lại hoặc kiểm tra mạng."
  - Kém: "Lỗi 500", "Đã xảy ra lỗi."
- Lỗi form: ngay cạnh trường, mô tả cách sửa; tóm tắt ở đầu form nếu nhiều lỗi, focus vào lỗi đầu tiên; không xóa dữ liệu đã nhập.
- Lỗi nghiệp vụ (ví dụ "Tồn kho không đủ") khác lỗi kỹ thuật; nêu số liệu và lối ra.
- Tự retry có giới hạn cho lỗi tạm thời; báo cho người dùng khi thất bại liên tiếp.

## 5. Partial, stale, offline, real-time

- **Dữ liệu một phần**: hiện phần có và đánh dấu rõ phần thiếu ("Không tải được dữ liệu chi nhánh Đà Nẵng") thay vì hiện tổng sai một cách im lặng. Dữ liệu một phần dễ hơn không có gì, nhưng con số tổng bị thiếu phải được cảnh báo.
- **Độ tươi dữ liệu**: luôn cho biết dữ liệu cập nhật lúc nào. "Cập nhật 5 phút trước" ổn; "3 ngày trước" phải nổi bật cảnh báo. Với dữ liệu tính theo lô (cuối ngày), ghi rõ lịch cập nhật.
- **Offline không phải lỗi**: hiển thị dữ liệu cache cùng banner nhẹ ("Bạn đang offline - dữ liệu cập nhật lúc ..."), tắt các hành động cần mạng kèm lý do, đồng bộ lại khi có mạng, xử lý xung đột.
- **Real-time**: cập nhật mượt, không làm nhảy layout đang đọc; với bảng đang xem thì hiện "Có 5 bản ghi mới - Tải lại" thay vì chèn ngay; cho phép tạm dừng cập nhật. Dashboard vận hành cần phản ánh sự cố trong vài giây-phút; dữ liệu trễ làm chậm phản ứng.
- Cảnh báo/alert: phân mức (thông tin/cảnh báo/nghiêm trọng), có hành động đi kèm, có cách xác nhận/tắt tiếng, không spam.

## 6. No-permission và giới hạn gói

- Không có quyền xem trang: màn "Bạn không có quyền truy cập" + vì sao + cách xin quyền (liên hệ quản trị viên, nút gửi yêu cầu). Không để người dùng đối mặt với trang trắng hay lỗi 403 chung chung.
- Chức năng vô hiệu theo quyền: tooltip/chú thích lý do ("Chỉ quản lý kho mới được điều chỉnh tồn kho").
- Dữ liệu một phần theo quyền (che số liệu nhạy cảm): hiển thị rõ là bị che, không để trống khó hiểu.
- Hạn mức gói (multi-tenant SaaS): hiển thị mức dùng/hạn mức, nâng cấp đúng ngữ cảnh, không chặn đột ngột luồng chính.

## 7. Thành công và xác nhận

- Phản hồi mọi hành động: toast/snackbar ngắn ("Đã lưu thay đổi"), vị trí nhất quán, tự ẩn sau vài giây, có hành động **Hoàn tác** khi có thể; thông báo quan trọng không tự ẩn.
- Với hành động hàng loạt: nêu kết quả cụ thể ("Đã duyệt 18/20 đơn. 2 đơn lỗi - xem chi tiết").
- Hành động phá hủy: xác nhận nêu rõ đối tượng và hậu quả, nút xác nhận mô tả đúng hành động ("Xóa 12 sản phẩm"), không dùng "OK/Có".
- Cập nhật lạc quan (optimistic UI) khi an toàn; hoàn lại và báo lỗi nếu thất bại.
- Thông báo cho trình đọc màn hình bằng vùng live (`role="status"` / `aria-live="polite"`; `role="alert"` cho lỗi khẩn).

## 8. Microcopy

- Nút bắt đầu bằng động từ cụ thể: "Lưu đơn hàng", "Mời thành viên", "Xuất Excel" (tránh "OK", "Gửi", "Submit").
- Empty state: giải thích giá trị + một nút hành động.
- Thuật ngữ nhất quán toàn hệ thống (lập bảng thuật ngữ nếu nhiều role/module: "Đơn hàng" hay "Phiếu bán"?).
- Nhãn bộ lọc, đơn vị, kỳ luôn rõ; tooltip giải thích chỉ số/cách tính bằng ngôn ngữ đời thường.
- Giọng điệu bình tĩnh, tập trung vào giải pháp, không đổ lỗi, không dùng từ viết hoa/dấu chấm than tràn lan.
- Chừa chỗ cho chuỗi dài hơn (tiếng Việt thường dài hơn tiếng Anh) trong nút, tab, cột.

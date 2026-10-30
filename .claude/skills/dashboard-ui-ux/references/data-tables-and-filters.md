# Bảng dữ liệu, bộ lọc và tìm kiếm

## Mục lục
1. Hỏi trước khi thiết kế bảng
2. Căn lề, kiểu chữ và định dạng
3. Hàng, cột, density
4. Điều hướng trong bảng (sticky, cuộn, cột)
5. Sắp xếp, lọc, tìm kiếm
6. Phân trang vs cuộn vô hạn vs virtualization
7. Chọn nhiều và bulk action
8. Hành động trên hàng, xem chi tiết, sửa tại chỗ
9. Bảng rỗng, lỗi, tải
10. Checklist bảng

## 1. Hỏi trước khi thiết kế bảng

- Dữ liệu trong ô là gì: số/ngày ngắn hay văn bản dài, liên kết, tệp, avatar?
- Người dùng **đọc để so sánh** hay **làm việc để hành động** (sửa, đổi trạng thái, gán người)? Bảng đọc ưu tiên mật độ và so sánh; bảng thao tác ưu tiên hành động rõ.
- Thiết bị chính? Có cần sửa tại chỗ? Có nhiều role với quyền khác nhau?
- Mặc định hiển thị cột nào khi mở trang? Đây là quyết định quan trọng: chọn bằng nhu cầu thật của role, đừng nhét hết mọi cột.

## 2. Căn lề, kiểu chữ và định dạng

- **Văn bản căn trái. Số căn phải. Không bao giờ căn giữa** cột dữ liệu (căn giữa làm mắt nhảy và không so sánh được).
- Tiêu đề cột căn theo nội dung cột; icon sắp xếp không được làm lệch căn lề tiêu đề.
- Số lượng/tiền/đo lường/phần trăm: căn phải, cùng số chữ số thập phân, dùng **tabular figures** (`font-variant-numeric: tabular-nums`) để các chữ số thẳng hàng và `1.111,11` không trông nhỏ hơn `999,99`.
- Ngày, mã bưu chính, số điện thoại là "số định tính", có thể căn trái.
- Tránh lặp từ khóa ở mọi ô (ghi "Đã duyệt" thay vì "Đơn hàng đã duyệt" khi cột đã là "Đơn hàng"). Giảm nhiễu.
- Trạng thái dùng badge/chip có **icon hoặc nhãn chữ** chứ không chỉ chấm màu.
- Văn bản dài: cắt bằng ellipsis một dòng và hiện đầy đủ ở tooltip/khung chi tiết; nếu cần nhiều dòng thì giới hạn (2-3 dòng) và căn trên (top-align). Quy tắc căn dọc: chiều cao hàng chênh ít (tới ~3 dòng) thì căn giữa dọc; chênh nhiều hơn thì căn trên.
- Đơn vị đặt ở tiêu đề cột thay vì lặp ở mỗi ô khi có thể (ví dụ "Doanh thu (₫)").
- Giá trị trống hiển thị nhất quán ("—"), không để ô trống khó phân biệt với lỗi tải.

## 3. Hàng, cột, density

- Phân tách hàng: đường kẻ ngang mảnh màu rất nhạt (hòa vào nền) là lựa chọn an toàn. **Tránh zebra stripe** khi bảng có hover/selected/disabled/focus, vì số sắc xám chồng lên nhau gây rối. Dạng "card row" hợp khi nền trang đã có màu.
- Vạch dọc giữa cột: tùy chọn, nếu dùng thì 1px, nhạt.
- Chiều cao hàng gợi ý: **Condensed ~40px, Regular ~48px, Relaxed ~56px**. Cho phép người dùng chuyển density (đặt nút ngoài bảng) và nhớ lựa chọn. Mặc định Regular; bảng dày cho người dùng chuyên nghiệp có thể Condensed.
- Giữ chiều cao hàng và độ rộng cột nhất quán; cột có giới hạn min/max width.
- Vô hiệu hóa/bị khóa hàng: dùng chữ nhạt + icon/ghi chú lý do, không chỉ làm mờ.

## 4. Điều hướng trong bảng (sticky, cuộn, cột)

- **Sticky header** khi cuộn dọc; nếu có thanh công cụ của bảng thì cũng nằm trong vùng cố định.
- **Freeze cột đầu** (định danh: tên/mã) khi cuộn ngang; đôi khi freeze cột cuối (tổng, hành động).
- Cuộn mượt hai chiều; chỉ báo rõ rằng còn nội dung bên phải (bóng mờ ở mép).
- **Quản lý cột**: hiện/ẩn, sắp xếp lại, đổi độ rộng (kéo ở viền tiêu đề). Luôn có "Đặt lại cột về mặc định". Lưu theo tài khoản.
- Quá nhiều cột? Ưu tiên: (1) cải thiện bộ cột mặc định theo nhu cầu thật, (2) cho ẩn/hiện, (3) freeze cột đầu, (4) gộp thông tin liên quan trong một ô (tên + mã nhỏ bên dưới). Nếu vẫn nhồi nhét, bảng đang cố làm quá nhiều việc: tách chế độ xem.

## 5. Sắp xếp, lọc, tìm kiếm

**Sắp xếp**
- Click tiêu đề cột để sắp xếp; hiển thị mũi tên chiều rõ ràng; chỉ cho sắp xếp cột có ý nghĩa.
- Mặc định có chủ đích: thường là **mới nhất lên đầu** hoặc **cần xử lý nhất lên đầu** (tồn kho thấp nhất, ưu tiên cao nhất, quá hạn nhất).
- Sắp xếp ổn định (stable): khi giá trị bằng nhau, giữ thứ tự theo tiêu chí phụ (thường mã/ngày), tránh hàng "nhảy".

**Lọc**
- Công việc chính của bảng thường là "cho tôi thấy tập con tôi quan tâm". Làm lọc thành tương tác hàng đầu, không đẩy vào menu ẩn.
- Mẫu hiệu quả: ô tìm kiếm + nút "Bộ lọc" mở panel (hoặc bộ lọc nội tuyến cho 2-4 trường phổ biến) + chip hiển thị bộ lọc đang áp dụng + "Xóa tất cả".
- Kiểu điều khiển theo kiểu dữ liệu: enum -> multi-select/checkbox; ngày -> date range có preset; số -> khoảng min-max; văn bản -> chứa/bắt đầu bằng. Có tìm kiếm trong danh sách dài.
- Hiển thị **số kết quả** ("Hiển thị 24 / 1.280 đơn hàng") và cập nhật ngay khi lọc.
- Bộ lọc đồng bộ URL; hỗ trợ **saved view** (đặt tên bộ lọc + cột + sắp xếp).
- Tránh áp dụng lọc tự động quá nhanh trên dữ liệu lớn gây giật; dùng debounce ~300ms cho ô gõ, hoặc nút "Áp dụng" cho panel lọc nhiều điều kiện.

**Tìm kiếm**
- Làm nổi bật (highlight) phần khớp trong kết quả để người dùng đối chiếu nhanh.
- Hỗ trợ tìm không phân biệt dấu cho tiếng Việt (gõ "nguyen" tìm "Nguyễn"); xem `vietnam-localization.md`.
- Trạng thái "không có kết quả" phải đề xuất bước tiếp (xóa bộ lọc, đổi từ khóa).

## 6. Phân trang vs cuộn vô hạn vs virtualization

| Tình huống | Gợi ý |
|---|---|
| Danh sách làm việc, cần quay lại vị trí, so sánh, xuất | Phân trang (có chọn số dòng/trang: 25/50/100) |
| Duyệt kiểu feed, ít cần định vị | "Tải thêm" hoặc cuộn vô hạn có trạng thái cuối |
| Hàng nghìn hàng hiển thị cùng lúc, cần cuộn mượt | **Virtualization** (chỉ render hàng nhìn thấy) |

- Dữ liệu nhỏ (dưới khoảng 1.000 dòng): lọc/sắp xếp phía client được. Dữ liệu lớn: **lọc, sắp xếp, phân trang phía server**, kèm chỉ báo đang tải; đừng tải toàn bộ về trình duyệt.
- Phân trang: hiển thị tổng số, trang hiện tại, trước/sau; giữ vị trí khi quay lại từ trang chi tiết.
- Cuộn vô hạn làm footer và thanh công cụ cuối khó chạm tới và khó quay lại vị trí: cân nhắc kỹ cho bảng quản trị.

## 7. Chọn nhiều và bulk action

- Checkbox ở cột đầu; hiện khi hover hoặc luôn hiện nếu bảng thiên về thao tác. Có checkbox chọn tất cả (và phân biệt "chọn trang này" với "chọn tất cả N kết quả").
- Khi có hàng được chọn, hiện **thanh bulk action** (cố định phía trên hoặc dưới) với số lượng đã chọn và các hành động (Xuất, Gán, Đổi trạng thái, Xóa). Khi không chọn thì ẩn để giảm rối.
- Hành động phá hủy hàng loạt phải nêu rõ phạm vi và hậu quả: "Xóa 12 sản phẩm? Không thể hoàn tác." Ưu tiên undo cho hành động có thể đảo ngược.
- Hỗ trợ Shift+click chọn khoảng; giữ lựa chọn khi đổi trang nếu có thể và nói rõ nếu không.

## 8. Hành động trên hàng, xem chi tiết, sửa tại chỗ

**Hành động hàng**: hiện khi hover/focus trong cột cuối (nhưng phải truy cập được bằng bàn phím và trên cảm ứng); menu "..." cho hành động phụ; một hành động chính nhìn thấy rõ nếu là thao tác phổ biến.

**Xem chi tiết** (chọn theo lượng thông tin và chi phí phát triển):
- Tooltip: xem nhanh, ít thông tin, desktop.
- Mở rộng hàng tại chỗ: giữ ngữ cảnh, hợp với chi tiết ngắn.
- **Side panel (quick view)**: mở rộng tốt nhất; đủ chỗ cho tab/cuộn, giữ ngữ cảnh bảng.
- Modal: dễ làm nhưng làm mất ngữ cảnh; dùng cho tác vụ ngắn.
- Trang riêng/toàn màn hình: khi chi tiết phức tạp hoặc cần tập trung; hỗ trợ URL riêng và nút quay lại giữ nguyên bộ lọc.

**Sửa tại chỗ (inline edit)**: ít ma sát nhất, giữ ngữ cảnh; cần dấu hiệu "ô này sửa được" (con trỏ, viền khi hover), xác nhận bằng Enter/click ra ngoài/nút lưu, có phản hồi thành công/lỗi. Với dữ liệu rủi ro cao, thêm ma sát có chủ đích (chỉ sửa trong panel chi tiết, có bước xác nhận).

## 9. Bảng rỗng, lỗi, tải

- **Loading**: skeleton đúng số cột và cỡ hàng; giữ header; không đổi chiều cao khi dữ liệu về.
- **Empty lần đầu**: giải thích giá trị + nút tạo/nhập dữ liệu đầu tiên.
- **Empty do lọc**: "Không có kết quả cho bộ lọc hiện tại" + nút "Xóa bộ lọc".
- **Error**: thông báo ngay trong vùng bảng, nói rõ nguyên nhân và cách xử lý, nút "Thử lại"; không giả làm empty.
- Chi tiết tại `states-and-feedback.md`.

## 10. Checklist bảng

- [ ] Cột mặc định chọn theo nhu cầu role; có quản lý cột + đặt lại
- [ ] Text trái, số phải, không căn giữa; tabular-nums; số thập phân nhất quán
- [ ] Sticky header; freeze cột định danh khi cuộn ngang
- [ ] Sort mặc định có ý nghĩa; mũi tên chiều rõ; sort ổn định
- [ ] Filter nhìn thấy được, có chip + xóa tất cả + đếm kết quả
- [ ] Phân trang/virtualization phù hợp lượng dữ liệu; server-side khi lớn
- [ ] Chọn nhiều + thanh bulk action; hành động phá hủy có xác nhận/undo
- [ ] Hành động trên hàng dùng được bằng bàn phím và cảm ứng
- [ ] Loading skeleton, empty (2 loại), error + retry
- [ ] Density chuyển được; trạng thái xem được lưu
- [ ] Trạng thái không chỉ bằng màu; tương phản đạt AA
- [ ] Bảng có `<table>`/role phù hợp, tiêu đề cột liên kết đúng (xem `accessibility-and-performance.md`)

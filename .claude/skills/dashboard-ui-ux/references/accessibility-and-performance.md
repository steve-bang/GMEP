# Accessibility và hiệu năng cho dashboard

## Mục lục
1. Mục tiêu chuẩn
2. Màu và tương phản
3. Bàn phím và focus
4. Cấu trúc ngữ nghĩa, screen reader
5. Bảng và biểu đồ truy cập được
6. Form và bộ lọc
7. Chuyển động, thời gian, thông báo
8. Hiệu năng cảm nhận và thực
9. Dữ liệu lớn và real-time
10. Checklist kiểm thử

## 1. Mục tiêu chuẩn

Nhắm **WCAG 2.2 mức AA** cho sản phẩm mới. WCAG 2.2 tương thích ngược với 2.1. Những tiêu chí đáng chú ý với dashboard:

- **1.4.1 Use of Color (A)**: không dùng màu làm cách duy nhất truyền thông tin.
- **1.4.3 Contrast (AA)**: chữ 4.5:1 (chữ lớn 3:1).
- **1.4.11 Non-text Contrast (AA)**: thành phần giao diện và đồ họa mang thông tin (viền input, icon, cột/đường biểu đồ, trạng thái focus) >= 3:1.
- **1.4.10 Reflow / 1.4.4 Resize Text**: nội dung dùng được khi phóng to tới 200-400% mà không mất chức năng.
- **2.1.1 Keyboard (A)**: mọi chức năng dùng được bằng bàn phím.
- **2.4.7 Focus Visible (AA)** và **2.4.11 Focus Not Obscured (AA, mới ở 2.2)**: focus nhìn thấy và không bị header/panel sticky che mất.
- **2.5.8 Target Size Minimum (AA, mới ở 2.2)**: vùng bấm tối thiểu 24x24 CSS px (hoặc đủ khoảng cách).
- **2.5.7 Dragging Movements (AA, mới ở 2.2)**: thao tác kéo thả (sắp xếp widget, đổi thứ tự cột) phải có phương án thay thế không cần kéo.
- **3.3.7 Redundant Entry (A, mới ở 2.2)**: không bắt nhập lại cùng dữ liệu trong cùng phiên.
- **3.3.8 Accessible Authentication (AA, mới ở 2.2)**: đăng nhập không bắt người dùng giải bài toán nhận thức (cho phép dán mật khẩu/trình quản lý mật khẩu).

Ngoài tuân thủ: thiết kế accessible từ đầu thường cho biểu đồ và bảng rõ ràng hơn cho mọi người, trong khi chắp vá cuối dự án dễ sinh "chartjunk".

## 2. Màu và tương phản

- Mọi cặp text/nền, icon/nền, viền điều khiển, trạng thái hover/selected/disabled kiểm tra bằng công cụ đo (công cụ tương phản trình duyệt hoặc checker), cả light lẫn dark.
- Không chỉ dùng màu cho: trạng thái (thêm icon + nhãn), tăng/giảm (mũi tên + dấu), series biểu đồ (nhãn/hình dạng/nét), lỗi form (icon + văn bản), liên kết trong đoạn văn (gạch chân).
- Tránh cặp đỏ-xanh lá là tín hiệu duy nhất; kiểm tra mô phỏng mù màu (protanopia, deuteranopia) và thang xám (achromatopsia).
- Hỗ trợ `prefers-contrast` và chế độ forced-colors khi có thể (dùng viền thật, không chỉ nền màu).

## 3. Bàn phím và focus

- Thứ tự Tab theo thứ tự đọc/hình ảnh. Không tạo "bẫy bàn phím"; modal/drawer giữ focus bên trong, đóng bằng `Esc`, trả focus về phần tử gọi.
- **Focus ring rõ** (>= 3:1, dày ~2px, offset), không bị `outline: none` vô tình; không bị header/sidebar sticky che (`scroll-padding-top`).
- Có liên kết **"Bỏ qua tới nội dung chính"** đầu trang; landmarks (`header`, `nav`, `main`, `aside`).
- Bảng: phím mũi tên điều hướng ô cho grid dạng bảng tính (pattern grid) hoặc tab qua điều khiển trong hàng; phím tắt chọn hàng, mở chi tiết; hiển thị danh sách phím tắt (`?`).
- Menu, dropdown, combobox, tab, date picker theo pattern ARIA Authoring Practices (mũi tên, Home/End, Esc, Enter/Space).
- Không dùng hover làm cách duy nhất để lộ chức năng (hành động hàng, tooltip): phải xuất hiện khi focus và dùng được trên cảm ứng.
- Mọi thao tác kéo có thay thế bằng nút/menu.

## 4. Cấu trúc ngữ nghĩa, screen reader

- Dùng phần tử HTML đúng (`button`, `a`, `table`, `th scope`, `label`) trước khi dùng ARIA. ARIA sai tệ hơn không có ARIA.
- Mỗi trang có một `h1`, phân cấp tiêu đề logic; mỗi khối dashboard có tiêu đề (có thể ẩn trực quan) để người dùng screen reader nhảy qua.
- Icon-only button có nhãn truy cập (`aria-label`); icon trang trí `aria-hidden="true"`.
- Trạng thái động báo qua vùng live: `aria-live="polite"` cho cập nhật (đã lưu, tải xong, số kết quả thay đổi), `role="alert"` cho lỗi khẩn. Tránh phát thông báo liên tục từ dữ liệu real-time; gộp/điều tiết.
- Tooltip: gắn bằng `aria-describedby`, hiện khi focus, có thể tắt bằng `Esc`, con trỏ di chuyển vào tooltip vẫn giữ (WCAG 1.4.13).
- Sort/filter: thông báo thay đổi (`aria-sort` trên `th`, cập nhật số kết quả).
- Trạng thái tải: `aria-busy` trên vùng đang tải và thông báo "Đang tải".

## 5. Bảng và biểu đồ truy cập được

**Bảng**
- Dùng `<table>`, `<thead>`, `<th scope="col|row">`, `<caption>` (có thể ẩn). Tránh dùng `div` mô phỏng bảng; nếu virtualization buộc dùng role (`role="grid"`/`table`), giữ đủ `aria-rowcount`, `aria-rowindex`, `aria-colindex`.
- Căn lề và định dạng số không thay đổi ngữ nghĩa; đơn vị ở tiêu đề.
- Bảng cuộn ngang: vùng cuộn có thể focus (`tabindex="0"`) và có nhãn.

**Biểu đồ**
- Cung cấp **tóm tắt bằng chữ** (xu hướng chính, cực trị) và **bảng dữ liệu thay thế** hoặc nút xem dạng bảng.
- Ít nhất cho biểu đồ quan trọng: mô tả dài (`aria-describedby`) hoặc SVG `<title>/<desc>`; thư viện biểu đồ có hỗ trợ accessibility nên được ưu tiên, nhưng vẫn cần kiểm tra thực tế vì độ tương phản và mã hóa phi màu thường phụ thuộc cách triển khai.
- Điều hướng điểm dữ liệu bằng bàn phím nếu biểu đồ tương tác; trạng thái hover/focus/selected đạt 3:1 và không chỉ khác nhau bằng màu.
- Quá nhiều chuỗi: tách small multiples/sparkline (cũng thân thiện với screen reader hơn).

## 6. Form và bộ lọc

- Mỗi trường có `<label>` hiển thị (placeholder không thay thế label); lỗi gắn `aria-describedby`/`aria-invalid`; nhóm bằng `fieldset/legend`.
- Date picker/range: cho phép gõ tay theo định dạng rõ (dd/MM/yyyy), không bắt buộc chọn bằng chuột.
- Bộ lọc áp dụng xong: thông báo số kết quả; chip đang lọc là nút có nhãn "Xóa bộ lọc ...".
- Autocomplete và mật khẩu hỗ trợ trình quản lý mật khẩu; không chặn dán.

## 7. Chuyển động, thời gian, thông báo

- Tôn trọng `prefers-reduced-motion`; không có nhấp nháy quá 3 lần/giây.
- Animation lặp/tự cập nhật kéo dài hơn vài giây phải có cách tạm dừng (ví dụ tạm dừng làm mới real-time).
- Toast tự ẩn đủ lâu để đọc (thường >= 5-6 giây), hoặc không tự ẩn khi có hành động bắt buộc; có thể truy cập bằng bàn phím và screen reader; thông báo quan trọng phải ở lại.
- Hết phiên: cảnh báo trước và cho gia hạn thay vì mất dữ liệu đột ngột.

## 8. Hiệu năng cảm nhận và thực

Hiệu năng là một phần của UX dashboard: người dùng đổi bộ lọc hàng chục lần mỗi giờ.

- Mục tiêu cảm nhận: phản hồi thao tác <= ~100ms; nội dung chính hiện nhanh (skeleton ngay, dữ liệu về dần). Đo Core Web Vitals (LCP, INP, CLS) trên thiết bị tầm trung.
- **Tải theo khối, độc lập**: mỗi widget có truy vấn/trạng thái riêng; khối chậm không chặn khối nhanh; ưu tiên khối trong màn hình đầu.
- Tải lười (lazy) biểu đồ/khối ngoài màn hình, tách bundle theo route, tránh nạp thư viện biểu đồ nặng ở mọi trang.
- Cache và `stale-while-revalidate`: hiện dữ liệu cũ ngay, làm mới nền, ghi "cập nhật lúc".
- Debounce ô tìm kiếm/filter gõ (~300ms); hủy request cũ khi có request mới; tránh "race condition" làm kết quả cũ ghi đè kết quả mới.
- Dành sẵn kích thước cho biểu đồ/ảnh để tránh layout shift.
- Giảm re-render: ổn định tham chiếu dữ liệu, memo hóa thành phần nặng; throttle sự kiện tooltip/mousemove.

## 9. Dữ liệu lớn và real-time

- **Bảng**: virtualization khi hiển thị hàng nghìn dòng; phân trang/lọc/sắp xếp phía server khi dữ liệu lớn; chỉ tải cột đang hiển thị khi có thể.
- **Biểu đồ**: giảm mẫu (downsampling/aggregation) khi quá nhiều điểm; dùng canvas/WebGL cho hàng chục nghìn điểm, SVG cho dữ liệu nhỏ cần tương tác/accessibility; cho phép zoom để xem chi tiết.
- **Tổng hợp trước ở server** (pre-aggregation) cho số liệu KPI thay vì tính ở client.
- **Real-time**: WebSocket/SSE chỉ cho dữ liệu thật sự cần; gộp cập nhật (batching), tránh làm nhảy bố cục, cho tạm dừng; cung cấp chỉ báo "đang kết nối/đã mất kết nối" và tự kết nối lại có backoff.
- Xuất dữ liệu lớn (CSV/Excel) chạy nền, thông báo khi sẵn sàng, không treo giao diện.
- Phân quyền áp ở server (không chỉ ẩn ở UI); dữ liệu nhạy cảm không đưa xuống client nếu không cần.

## 10. Checklist kiểm thử

- [ ] Duyệt toàn bộ trang chỉ bằng bàn phím; focus thấy rõ và không bị che
- [ ] Chạy trình kiểm tra tự động (axe/Lighthouse) + kiểm tra tay với screen reader (NVDA/VoiceOver) ở luồng chính
- [ ] Phóng to 200% và đổi cỡ chữ hệ thống: không vỡ bố cục
- [ ] Mô phỏng mù màu và thang xám: biểu đồ, trạng thái vẫn phân biệt được
- [ ] Đo tương phản chữ/icon/biểu đồ ở light và dark
- [ ] Bật reduced motion: không còn animation gây khó chịu
- [ ] Thử với dữ liệu lớn (10k+ dòng), mạng chậm, CPU chậm
- [ ] Đổi filter liên tiếp: không race condition, không nhảy layout

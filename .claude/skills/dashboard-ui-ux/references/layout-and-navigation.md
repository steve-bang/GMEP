# Layout và điều hướng

## Mục lục
1. Khung trang (app shell)
2. Grid và thứ bậc thị giác
3. Bố cục màn Dashboard điển hình
4. Sidebar và điều hướng
5. Header, breadcrumb, bộ lọc toàn cục
6. Responsive
7. Tùy biến của người dùng

## 1. Khung trang (app shell)

```
┌───────────────────────────────────────────────────────────┐
│ Header: tenant/chi nhánh · tìm kiếm toàn cục · thông báo · user │
├──────────┬────────────────────────────────────────────────┤
│ Sidebar  │ Tiêu đề trang + hành động chính (1 nút primary)  │
│ (điều    │ Thanh bộ lọc toàn cục (sticky)                   │
│  hướng)  │ ─────────────────────────────────────────────── │
│          │ Nội dung: KPI -> biểu đồ -> bảng                 │
└──────────┴────────────────────────────────────────────────┘
```

- Khung (header + sidebar) cố định, chỉ vùng nội dung cuộn. Người dùng luôn biết mình đang ở đâu.
- Mỗi trang có đúng **một** hành động chính (primary button). Nhiều primary làm người dùng không biết nên làm gì.
- Nội dung có chiều rộng tối đa hợp lý (khoảng 1440-1600px) trên màn hình siêu rộng, để biểu đồ và bảng không bị kéo giãn khó đọc, trừ trang bảng dữ liệu lớn có thể dùng toàn chiều rộng.

## 2. Grid và thứ bậc thị giác

- Dùng grid 12 cột với gutter 16-24px, lưới spacing 8px (4px cho chi tiết nhỏ). Căn mọi khối theo grid; tránh offset tùy tiện.
- Thứ bậc được tạo bởi: **kích thước** (khối quan trọng to hơn), **vị trí** (trên-trái được nhìn đầu tiên theo mẫu quét F/Z), **độ tương phản** (đậm/nhạt), **khoảng trắng** (phần tử được bao quanh bởi khoảng trống nổi bật hơn), **màu** (dành cho điểm cần chú ý).
- Phân cấp chữ: tiêu đề trang > tiêu đề khối > nhãn > giá trị phụ. Đừng dùng cùng một cỡ/độ đậm cho mọi chữ.
- Nhóm các khối liên quan bằng khoảng cách và tiêu đề nhóm trước khi dùng viền hoặc đổ bóng. Khoảng trắng tách nhóm tốt hơn hộp lồng hộp.
- Giữ chiều cao hàng khối đồng đều trong cùng một hàng; tránh khối lệch tạo nhiễu.

## 3. Bố cục màn Dashboard điển hình

Thứ tự từ trên xuống (điều chỉnh theo loại dashboard):

1. **Bộ lọc toàn cục** (thời gian, chi nhánh...) kèm "cập nhật lúc HH:mm".
2. **Hàng KPI** 3-6 thẻ. Số lớn, nhãn rõ, so sánh kỳ trước, sparkline tùy chọn.
3. **Khối chính**: biểu đồ xu hướng quan trọng nhất (rộng 2/3 hoặc toàn chiều ngang).
4. **Khối phân rã**: so sánh theo danh mục, cơ cấu, top N (1/3 hoặc chia đôi).
5. **Khối cần hành động**: cảnh báo, việc quá hạn, hàng sắp hết... (với dashboard vận hành, đưa lên cao hơn, có thể đứng đầu).
6. **Bảng chi tiết** gần cuối, có liên kết từ các khối phía trên (bấm vào cột/thẻ thì bảng được lọc tương ứng).

Nguyên tắc:
- Dashboard vận hành: cái cần phản ứng ngay đặt trên cùng. Dashboard chiến lược: KPI và xu hướng trên cùng.
- Tối đa khoảng 5-6 khối trong màn hình đầu. Muốn thêm, hỏi lại: thay khối nào? Hoặc đưa vào tab/trang con.
- Một số ít loại biểu đồ lặp lại giúp nhất quán và dễ đọc hơn việc dùng nhiều kiểu.
- Mỗi khối có: tiêu đề ngắn (nói điều biểu đồ cho thấy), đơn vị/kỳ, nút phụ (xuất, mở rộng, thông tin cách tính) ở góc.

## 4. Sidebar và điều hướng

- Sidebar dọc phù hợp sản phẩm có nhiều module (ERP, WMS, CRM). Header ngang phù hợp sản phẩm ít mục.
- Mục cấp 1 tối đa khoảng 7±2; gom nhóm có nhãn (ví dụ "Bán hàng", "Kho", "Báo cáo", "Cài đặt"). Không lồng quá 2-3 cấp.
- Icon đi kèm nhãn chữ. Chỉ dùng icon đơn thuần khi sidebar thu gọn, và phải có tooltip + nhãn truy cập.
- Trạng thái active rõ (nền + chữ đậm/vạch bên), không chỉ đổi sắc nhạt. Hover và focus khác active.
- Có chế độ thu gọn (icon-only) và nhớ lựa chọn. Trên màn hình nhỏ chuyển thành drawer.
- Sắp xếp mục theo tần suất dùng và luồng công việc, không theo cấu trúc database. Đặt "Cài đặt", "Trợ giúp" ở cuối.
- Hỗ trợ **phím tắt và tìm kiếm toàn cục / command palette** (Ctrl/Cmd+K) cho người dùng thường xuyên; hiển thị phím tắt trong tooltip.
- Mục không có quyền: ẩn nếu người dùng không bao giờ cần biết; vô hiệu hóa kèm lý do nếu họ nên biết tính năng tồn tại (ví dụ nâng gói).
- Multi-tenant / nhiều chi nhánh: chỗ chuyển đổi tenant/chi nhánh ở vị trí cố định (thường đầu sidebar hoặc header), luôn hiển thị tenant đang chọn, đổi tenant phải thấy rõ phản hồi để tránh thao tác nhầm dữ liệu.

## 5. Header, breadcrumb, bộ lọc toàn cục

- Breadcrumb cho trang sâu hơn cấp 2 để quay lại dễ; tiêu đề trang khớp với nhãn menu.
- Bộ lọc toàn cục đặt thành **một hàng** phía trên nội dung, sticky khi cuộn. Gồm: khoảng thời gian (preset: Hôm nay, 7 ngày, 30 ngày, Tháng này, Tùy chọn), chiều dữ liệu (chi nhánh, nhóm hàng...), và chỉ báo so sánh kỳ.
- Hiển thị bộ lọc đang áp dụng dưới dạng chip có nút xóa, kèm "Xóa tất cả". Tránh bộ lọc nằm trong menu ẩn khiến người dùng không biết dữ liệu đang bị lọc.
- Mặc định thời gian phải có ý nghĩa với nghiệp vụ (ví dụ 30 ngày gần nhất) và ghi rõ múi giờ nếu liên quan (Asia/Ho_Chi_Minh).
- Bộ lọc áp dụng cho khối nào cần nói rõ: toàn trang hay chỉ một khối. Khối có bộ lọc riêng ghi nhãn tại chỗ.
- Cân nhắc đồng bộ filter lên URL để chia sẻ và quay lại bằng nút Back.

## 6. Responsive

Dashboard chủ yếu dùng trên desktop nhưng phải hạ cấp tử tế:

| Chiều rộng | Chiến lược |
|---|---|
| >= 1280 | Bố cục đầy đủ, sidebar mở |
| 1024-1279 | Sidebar thu gọn, giảm số cột KPI |
| 768-1023 | Sidebar thành drawer, khối xếp 1-2 cột, bảng cuộn ngang với cột đầu cố định |
| < 768 | Xếp dọc theo thứ tự ưu tiên, KPI chuyển thành carousel hoặc 2 cột, bảng thành danh sách thẻ hoặc ưu tiên vài cột quan trọng; chi tiết ở màn riêng |

- Quyết định thứ tự xếp dọc dựa trên thứ bậc thông tin, không dựa vào thứ tự DOM ngẫu nhiên.
- Biểu đồ trên màn nhỏ: giảm số nhãn trục, tăng vùng chạm cho tooltip (bấm để xem), cho phép xoay hoặc xem toàn màn hình.
- Không ẩn chức năng quan trọng chỉ vì màn nhỏ; nếu thật sự không phù hợp (bảng 20 cột), nói rõ và cung cấp lối thay thế.

## 7. Tùy biến của người dùng

- Cho sắp xếp lại / ẩn / đổi cỡ widget **khi** người dùng có nhu cầu khác nhau rõ rệt; nếu không, một layout tốt mặc định hiệu quả hơn.
- Luôn có "Đặt lại mặc định" và lưu cấu hình theo tài khoản (không chỉ trong session).
- Với dashboard theo role, mặc định mỗi role một layout riêng thay vì bắt người dùng tự dựng từ đầu.
- Saved views (bộ lọc + cột + sắp xếp được đặt tên) rất giá trị cho người dùng thường xuyên; cho chia sẻ trong team nếu phù hợp.

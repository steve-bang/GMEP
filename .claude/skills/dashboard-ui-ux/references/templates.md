# Template: brief, spec, review, bàn giao

## Mục lục
1. Brief dashboard (làm trước khi thiết kế)
2. Screen spec
3. Component spec (bảng, biểu đồ, KPI)
4. Review UX
5. Checklist bàn giao cho dev
6. Kế hoạch kiểm thử với người dùng

## 1. Brief dashboard

```
## [Tên dashboard]
- Mục đích / quyết định cần hỗ trợ:
- Người dùng (role) + mức am hiểu dữ liệu:
- Loại: Strategic / Tactical / Analytical / Operational / Hybrid
- Tần suất dùng, thiết bị, độ phân giải chính:
- Nguồn dữ liệu + độ tươi (real-time / phút / ngày) + khối lượng:
- Câu hỏi cần trả lời (xếp theo ưu tiên):
  1.
  2.
  3.
- Chỉ số (KPI) + định nghĩa + công thức + kỳ so sánh:
- Hành động người dùng có thể làm từ dashboard:
- Phân quyền / multi-tenant / chi nhánh:
- Ràng buộc kỹ thuật (thư viện biểu đồ, design system có sẵn, framework):
- Giả định và câu hỏi còn mở:
```

Mỗi KPI cần định nghĩa rõ (tử số, mẫu số, bộ lọc, múi giờ, kỳ) để mọi người cùng hiểu một con số và dev tính đúng.

## 2. Screen spec

```
## [Tên màn hình]
- Mục đích:
- Role truy cập / quyền:
- Điểm vào -> điểm ra:
- Hành động chính (1 primary):
- Bố cục (trên -> dưới, trái -> phải):
  - Header / bộ lọc toàn cục:
  - Hàng KPI:
  - Khối chính:
  - Khối phụ:
  - Bảng:
- Component sử dụng:
- Dữ liệu từng khối (API/truy vấn, kỳ, bộ lọc áp dụng):
- Tương tác (hover, click, drill-down, cross-filter, phím tắt):
- Trạng thái: loading / empty (lần đầu, do lọc) / error / partial / stale / offline / no-permission / success
- Responsive (>=1280, 1024, 768, <768):
- Accessibility (thứ tự focus, nhãn, bảng thay thế biểu đồ):
- Microcopy (tiêu đề, nhãn, tooltip, lỗi, empty):
- Hiệu năng (khối lượng dữ liệu, phân trang/virtualization, cache):
- Câu hỏi còn mở / giả định:
```

## 3. Component spec

**KPI card**
```
- Nhãn / định nghĩa / công thức:
- Định dạng giá trị (đơn vị, số thập phân, rút gọn):
- So sánh (kỳ trước / mục tiêu) + quy tắc màu theo ý nghĩa nghiệp vụ (tăng là tốt hay xấu?):
- Sparkline (có/không, khoảng thời gian):
- Hành vi click (drill-down tới đâu):
- Trạng thái: loading / empty ("—") / error / stale
```

**Biểu đồ**
```
- Câu hỏi biểu đồ trả lời:
- Loại + lý do chọn:
- Trục (đơn vị, bắt đầu từ 0?, thang):
- Chuỗi + màu (thứ tự cố định) + mã hóa phụ (nhãn/hình dạng/nét):
- Nhãn/legend/direct label:
- Tooltip (nội dung, định dạng):
- Tương tác (zoom, brush, click lọc):
- Xử lý nhiều điểm/nhiều chuỗi (downsample, small multiples, "Khác"):
- Bảng thay thế / mô tả văn bản:
- Trạng thái: loading / empty / error
```

**Data table**
```
- Mục đích bảng (đọc/so sánh hay thao tác):
- Cột mặc định theo role + cột tùy chọn + cột cố định:
- Căn lề + định dạng từng cột:
- Sort mặc định + cột sắp xếp được:
- Filter (trường, kiểu điều khiển), tìm kiếm (trường, không phân biệt dấu):
- Phân trang / virtualization / server-side:
- Chọn nhiều + bulk action:
- Hành động hàng + xem chi tiết (tooltip / expand / side panel / trang):
- Sửa tại chỗ (trường nào, xác nhận thế nào):
- Density + lưu trạng thái xem + saved view:
- Trạng thái: loading / empty / error
- Xuất dữ liệu (định dạng, phạm vi, chạy nền?):
```

## 4. Review UX

Bảng kết quả, sắp theo mức độ:

```
| # | Mức độ (Blocker/Major/Minor) | Màn hình/khối | Vấn đề | Bằng chứng / nguyên tắc | Tác động tới người dùng | Đề xuất sửa |
```

- **Blocker**: ngăn hoàn thành tác vụ chính hoặc gây quyết định sai (số liệu sai, lỗi hiển thị như empty, không dùng được bằng bàn phím).
- **Major**: gây chậm/nhầm đáng kể (thứ bậc sai, filter ẩn, thiếu trạng thái lỗi, tương phản không đạt).
- **Minor**: tinh chỉnh (căn lề nhỏ, microcopy, nhất quán).

Quy tắc review:
- Mỗi vấn đề nêu bằng chứng cụ thể (nguyên tắc vi phạm, tỷ lệ tương phản đo được, số bước thừa, ảnh chụp/vị trí).
- Chấm theo vai trò người dùng thực, không theo sở thích cá nhân.
- Nêu cả điểm làm tốt cần giữ.
- Không nêu số liệu nghiên cứu nếu chưa có dữ liệu thật; đề xuất cách kiểm chứng (usability test, analytics, A/B).
- Kết thúc bằng danh sách ưu tiên sửa (3-5 mục tác động lớn nhất).

Khung rà soát nhanh (đi qua theo thứ tự):
1. Mục đích và thứ bậc: 5-second test.
2. Dữ liệu: đúng loại biểu đồ, trục/đơn vị trung thực, KPI có ngữ cảnh.
3. Bảng và bộ lọc.
4. Đủ trạng thái.
5. Visual (token, nhất quán, tương phản, dark mode).
6. Accessibility.
7. Hiệu năng cảm nhận.
8. Tiếng Việt/bản địa hóa.

## 5. Checklist bàn giao cho dev

- [ ] Token màu, chữ, spacing, radius, elevation đã chốt, đặt tên theo vai trò, có light/dark
- [ ] Component có đủ trạng thái (default, hover, focus, active, disabled, loading, error) và quy tắc co giãn
- [ ] Mọi màn có spec loading/empty/error/partial/stale/no-permission và edge case dữ liệu
- [ ] Định nghĩa KPI (công thức, bộ lọc, múi giờ, kỳ) đã được xác nhận với bên nghiệp vụ
- [ ] API/truy vấn cho từng khối, phân trang/lọc/sắp xếp phía server nếu lớn, chiến lược cache
- [ ] Quy tắc định dạng số/ngày/tiền (vi-VN), danh sách chuỗi và bản dịch
- [ ] Quy tắc điều hướng, URL (đồng bộ filter), deep link, hành vi nút Back
- [ ] Ghi chú accessibility: thứ tự focus, vai trò ARIA, bảng thay thế biểu đồ, phím tắt
- [ ] Mô tả animation/transition (thời lượng, easing) và hành vi reduced motion
- [ ] Phân quyền: ai thấy/làm gì; hành vi khi thiếu quyền
- [ ] Chỉ số hiệu năng mục tiêu (LCP/INP, thời gian phản hồi lọc, kích thước bundle)
- [ ] Câu hỏi còn mở đã liệt kê và gán người trả lời

## 6. Kế hoạch kiểm thử với người dùng

- **5-second test**: cho xem dashboard 5 giây rồi hỏi "đây là gì, điều gì đáng chú ý nhất, bạn sẽ làm gì tiếp?".
- **Task-based test** (5 người thường đủ để lộ phần lớn vấn đề nghiêm trọng): giao 3-5 tác vụ thật ("tìm đơn quá hạn của chi nhánh Đà Nẵng tuần này", "xuất báo cáo tồn kho dưới mức tối thiểu"); đo tỷ lệ hoàn thành, thời gian, chỗ vấp.
- Thử với **dữ liệu thật hoặc gần thật** (nhiều, ít, bẩn), và trên thiết bị/độ phân giải người dùng thực dùng.
- Sau ra mắt: theo dõi analytics (khối nào được dùng/bỏ qua, filter nào hay dùng, tìm kiếm không ra kết quả, lỗi tải) để tinh gọn dashboard.

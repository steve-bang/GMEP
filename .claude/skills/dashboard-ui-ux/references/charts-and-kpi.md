# KPI card, biểu đồ và màu dữ liệu

> Nếu môi trường có skill `dataviz`, nạp skill đó trước khi viết code biểu đồ hoặc chọn bảng màu (nó có script kiểm tra palette). File này là phần cốt lõi độc lập, đủ dùng khi không có skill đó.

## Mục lục
1. Có cần biểu đồ không?
2. KPI card
3. Chọn loại biểu đồ
4. Trục, thang đo, tính trung thực
5. Màu trong biểu đồ
6. Nhãn, legend, tooltip
7. Tương tác và drill-down
8. Biểu đồ + accessibility
9. Anti-pattern biểu đồ

## 1. Có cần biểu đồ không?

Chọn theo công việc của dữ liệu:

| Công việc | Hình thức |
|---|---|
| Một con số quan trọng | KPI card / hero number (không dùng biểu đồ) |
| Xu hướng theo thời gian | Line hoặc area |
| So sánh giữa các hạng mục | Bar (ngang nếu nhãn dài) |
| Cơ cấu (phần của tổng) | Bar xếp chồng 100% hoặc donut với ít phần |
| Phân phối | Histogram / box plot |
| Tương quan hai biến | Scatter |
| Cần tra giá trị chính xác, nhiều thuộc tính, kiểm tra/audit | **Bảng** |
| Thứ hạng | Bar ngang đã sắp xếp (top N) |
| Tiến độ so với mục tiêu | Bullet chart / thanh tiến độ với mốc |

Khi bảng trả lời tốt hơn biểu đồ (tra cứu chính xác, nhiều chiều, ít điểm), dùng bảng. Biểu đồ phải "xứng đáng" với chỗ của nó.

## 2. KPI card

Cấu trúc một thẻ KPI:

```
Nhãn ngắn, rõ nghĩa            [i] (giải thích cách tính)
1.250.000.000 ₫                 <- giá trị lớn, tabular-nums
▲ 12,4% so với kỳ trước         <- so sánh + icon hướng + chữ
▁▂▃▅▆▇ (sparkline tùy chọn)
```

- **Giá trị phải có ngữ cảnh**: so với kỳ trước, mục tiêu hoặc benchmark. Con số đơn lẻ ít ý nghĩa.
- Giá trị dùng thang chữ riêng cho "metric" (to, đậm), tách khỏi thang tiêu đề, để người dùng đọc như con số chứ không phải tiêu đề.
- Rút gọn số lớn có kiểm soát (1,25 tỷ ₫ / 1,2 tr) kèm giá trị đầy đủ ở tooltip; đơn vị luôn rõ.
- Chỉ báo tăng/giảm: **icon + dấu + chữ**, không chỉ màu. Màu xanh/đỏ phải theo ý nghĩa nghiệp vụ (chi phí tăng là xấu, doanh thu tăng là tốt), không mặc định "tăng = xanh".
- Cho phép bấm vào thẻ để drill-down (mở báo cáo/bảng đã lọc tương ứng).
- 3-6 thẻ mỗi hàng; cùng kích thước; sắp theo mức quan trọng.
- Tránh thẻ "vanity" (số đẹp nhưng không dẫn đến hành động nào).
- Trạng thái: loading skeleton đúng hình, error riêng cho từng thẻ (một thẻ lỗi không làm hỏng cả hàng), "chưa có dữ liệu" khác với 0.

## 3. Chọn loại biểu đồ

- **Line**: thời gian liên tục; tối đa 4-5 đường dễ đọc; nhiều hơn dùng small multiples. Đánh dấu điểm hiện tại/cực trị thay vì gán nhãn mọi điểm.
- **Area**: tổng tích lũy hoặc cơ cấu theo thời gian; chồng nhiều lớp khó đọc giá trị từng lớp.
- **Bar**: so sánh hạng mục; cột bắt đầu từ 0; sắp xếp theo giá trị (trừ khi có thứ tự tự nhiên như tháng). Nhãn dài dùng bar ngang.
- **Stacked bar**: cơ cấu; chỉ nên 3-5 phần; phần so sánh chính đặt sát trục cơ sở.
- **Donut/pie**: chỉ khi 2-4 phần và ý chính là "phần của tổng"; luôn gắn nhãn trực tiếp kèm %; không dùng nhiều lát. Bar thường đọc chính xác hơn.
- **Scatter / bubble**: tương quan; cần chú giải cho kích thước/màu.
- **Heatmap**: mẫu theo hai chiều (giờ x ngày); dùng thang màu tuần tự một sắc hoặc phân kỳ có điểm giữa trung tính.
- **Sparkline**: xu hướng nhỏ trong thẻ/bảng; không có trục, kèm giá trị hiện tại.
- **Small multiples**: nhiều chuỗi cần so sánh riêng; dễ đọc và accessible hơn một biểu đồ rối.
- **Gauge/radar/3D**: tránh, trừ khi miền dữ liệu thật sự cần.

Giữ số loại biểu đồ trong một dashboard ở mức ít để nhất quán.

## 4. Trục, thang đo, tính trung thực

- Cột/bar luôn bắt đầu từ 0. Line có thể không bắt đầu từ 0 nhưng phải rõ ràng và không phóng đại biến động.
- **Không dual-axis** (hai thang y khác nhau): dễ gây hiểu sai và tạo tương quan giả. Hai đại lượng khác thang -> hai biểu đồ xếp trên/dưới cùng trục thời gian, hoặc chỉ số hóa về cơ sở chung (=100).
- Thang log chỉ khi người xem hiểu và có nhãn rõ.
- Nhãn trục có đơn vị; định dạng số nhất quán với bảng; mốc thời gian dễ đọc (T1/2026, 15/10).
- Hiển thị khoảng thiếu dữ liệu như khoảng trống (không nối đường qua chỗ thiếu một cách im lặng); thể hiện độ bất định (khoảng tin cậy) khi liên quan.
- So sánh kỳ: dùng cùng độ dài và căn chỉnh hợp lý (ngày trong tuần), ghi rõ kỳ nào so với kỳ nào.
- Dữ liệu chưa đầy đủ của kỳ hiện tại (hôm nay chưa hết) cần đánh dấu để không bị đọc thành sụt giảm.

## 5. Màu trong biểu đồ

Màu có bốn công việc, mỗi việc một quy tắc:

| Việc | Dùng | Quy tắc |
|---|---|---|
| Phân biệt hạng mục (categorical) | Bảng màu phân biệt, thứ tự cố định | Tối đa ~6-8 màu; hạng mục thứ 9 trở đi gom "Khác" hoặc tách small multiples; **màu gắn với thực thể, không gắn với thứ hạng** (lọc không được làm đổi màu các chuỗi còn lại) |
| Độ lớn (sequential) | Một sắc, nhạt -> đậm | Không cầu vồng |
| Phân cực (diverging) | Hai sắc + điểm giữa trung tính (xám) | Điểm giữa là giá trị trung tâm có ý nghĩa (0, mục tiêu) |
| Trạng thái (status) | Bộ màu riêng (tốt/cảnh báo/nghiêm trọng/lỗi) | Dành riêng, không tái sử dụng làm "series thứ 4"; luôn kèm icon + nhãn |

Thêm:
- **Màu thương hiệu thường không phải màu biểu đồ.** Buộc dùng màu thương hiệu làm màu chuỗi giới hạn khả năng phân biệt và dễ trùng màu trạng thái.
- Phần lớn biểu đồ nên **tối giản màu**: một sắc nhấn cho điều cần chú ý, còn lại xám trung tính (ví dụ: một chuỗi nổi bật, các chuỗi khác xám). Màu rực dành cho ngoại lệ/outlier.
- Chữ (giá trị, nhãn, legend) dùng màu chữ chuẩn, không tô theo màu chuỗi; ô màu nhỏ cạnh nhãn mang danh tính.
- Tránh cặp đỏ-xanh lá làm tín hiệu duy nhất (mù màu đỏ-lục khá phổ biến ở nam giới). Thêm icon, nhãn, hình dạng, mẫu nét.
- Khi màu không đủ tương phản 3:1 với nền/phần lân cận, dùng **viền tương phản + nền nhạt** cho phần tử để vừa đạt tiêu chuẩn vừa giữ điểm nhấn (đừng nhồi toàn màu bão hòa cạnh tranh nhau).
- Nền tối cho phép nhiều sắc thái đạt tương phản hơn, nhưng dark mode cần chọn lại bậc màu cho nền tối, không đảo tự động.
- Kiểm tra palette bằng công cụ (mô phỏng mù màu, kiểm tra tương phản) thay vì phán đoán bằng mắt.

## 6. Nhãn, legend, tooltip

- Tiêu đề biểu đồ nói **điều biểu đồ cho thấy** hoặc đo gì, kèm đơn vị và kỳ.
- **Gắn nhãn trực tiếp** lên đường/cột khi có ít chuỗi (<= 4), vì giảm phải liếc qua lại legend và không dựa vào màu. Từ 2 chuỗi trở lên vẫn nên có legend; một chuỗi thì tiêu đề đã đủ.
- Không ghi số lên mọi điểm; nhãn chọn lọc cho cực trị, điểm cuối, mốc quan trọng.
- Lưới và trục mờ, mảnh, lùi vào nền; dữ liệu là nhân vật chính (giảm "mực thừa").
- **Tooltip**: hiện giá trị chính xác, nhãn đầy đủ, đơn vị, so sánh nếu có; cursor/crosshair cho line; theo hover cho bar/cell; bám vào điểm có vùng hit lớn hơn dấu. Tooltip không phải nơi duy nhất chứa thông tin thiết yếu.
- Thêm nút/tab "Xem dạng bảng" để xem số liệu thô, hữu ích cho accessibility và kiểm tra số.

## 7. Tương tác và drill-down

- Bấm vào cột/lát/điểm để lọc phần còn lại của dashboard (cross-filtering) hoặc mở chi tiết; luôn hiển thị bộ lọc đang áp dụng và cách thoát.
- Chọn khoảng thời gian bằng brush/zoom trên biểu đồ xu hướng có kèm nút "Đặt lại zoom".
- Giữ tương tác dự đoán được: hover = xem, click = chọn/drill, không đảo vai trò giữa các biểu đồ.
- Cập nhật real-time: tránh nhảy giật; làm mượt, hiển thị "cập nhật lúc", cho tạm dừng nếu người dùng đang phân tích.

## 8. Biểu đồ + accessibility

- Mọi phần tử đồ họa mang thông tin (cột, đường, điểm, lát): tương phản >= **3:1** với nền và phần tử kề (WCAG 1.4.11). Chữ >= **4.5:1** (1.4.3).
- Không dùng màu làm cách truyền thông tin duy nhất (1.4.1): thêm nhãn, icon, hình dạng điểm, kiểu nét (liền/đứt), hoặc mẫu tô.
- Bảng thay thế/văn bản mô tả: tóm tắt xu hướng chính bằng chữ ("Doanh thu tháng 10 tăng 12% so với tháng 9") và/hoặc bảng dữ liệu truy cập được.
- Tương tác bằng bàn phím: có thể focus và duyệt điểm dữ liệu/chuỗi, mở tooltip bằng focus, hiển thị focus rõ.
- Trạng thái hover/focus/selected của phần tử biểu đồ cũng phải đạt tương phản và không chỉ khác nhau bằng màu.
- Animation ngắn, tôn trọng `prefers-reduced-motion`; animation lặp vô hạn cần có cách dừng.
- Quá nhiều chuỗi: tách small multiples hoặc sparkline, vừa dễ đọc hơn vừa accessible hơn.

## 9. Anti-pattern biểu đồ

- Dual-axis; trục cắt cụt cho bar; 3D; pie nhiều lát; donut nhiều lớp.
- Cầu vồng cho dữ liệu tuần tự; màu thay đổi theo thứ hạng/lọc.
- Legend rời xa biểu đồ làm người xem phải dò màu; nhãn chồng lên nhau.
- Nhãn số trên mọi điểm; lưới đậm hơn dữ liệu.
- Biểu đồ trang trí không trả lời câu hỏi nào.
- Dùng biểu đồ chỗ cần bảng (tra cứu giá trị chính xác, nhiều thuộc tính).
- Số liệu so sánh không cùng định nghĩa (kỳ không đầy đủ so với kỳ đầy đủ).

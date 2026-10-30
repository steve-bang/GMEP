---
name: dashboard-ui-ux
description: Quy trình, nguyên tắc best practice và checklist thiết kế UI/UX cho web dashboard (admin panel, trang quản trị, ERP, WMS, CRM, SaaS analytics, báo cáo/KPI). Dùng bất cứ khi nào người dùng muốn thiết kế, dựng, review hoặc cải thiện dashboard, màn hình tổng quan, bảng dữ liệu, biểu đồ, bộ lọc, sidebar/navigation, design system hoặc design token cho ứng dụng web nhiều dữ liệu, kể cả khi họ chỉ nói "làm giao diện quản trị", "trang thống kê", "màn hình báo cáo" mà không nhắc chữ "dashboard". Bao gồm layout, KPI card, data table, filter, loading/empty/error state, dark mode, accessibility (WCAG 2.2), hiệu năng, bản địa hóa tiếng Việt và bàn giao cho dev.
---

# Web Dashboard UI/UX

Skill này giúp thiết kế dashboard theo cách mà người dùng **ra quyết định nhanh và đúng**, không chỉ "đẹp". Trả lời bằng ngôn ngữ người dùng đang dùng (mặc định tiếng Việt, giữ nguyên thuật ngữ kỹ thuật tiếng Anh như KPI, sticky header, skeleton).

Một dashboard tốt có ba tính chất: **dễ hiểu** (không cần ai giải thích), **nhìn lướt là nắm** (glanceable) và **dẫn được tới chi tiết** (insightful). Mọi quyết định bên dưới phục vụ ba điều này. Khi hai nguyên tắc xung đột, ưu tiên: đúng dữ liệu > dễ hiểu > nhìn lướt được > đẹp.

## Cách dùng skill

Đọc file này trước. Chỉ mở file tham chiếu khi bước tương ứng cần chi tiết:

| Khi cần | Đọc |
|---|---|
| Chia vùng màn hình, sidebar, header, grid, responsive | `references/layout-and-navigation.md` |
| Bảng dữ liệu, filter, tìm kiếm, bulk action, phân trang | `references/data-tables-and-filters.md` |
| KPI card, chọn loại biểu đồ, màu biểu đồ, tooltip | `references/charts-and-kpi.md` |
| Loading / empty / error / offline / stale data, microcopy | `references/states-and-feedback.md` |
| Token màu, chữ, spacing, dark mode, density | `references/design-tokens.md` |
| WCAG 2.2, bàn phím, screen reader, hiệu năng, real-time | `references/accessibility-and-performance.md` |
| Font tiếng Việt, định dạng ngày/tiền/số, chuỗi dài, đa ngôn ngữ | `references/vietnam-localization.md` |
| Template spec màn hình, template review, checklist bàn giao | `references/templates.md` |

Nếu môi trường có skill `dataviz`, nạp nó trước khi viết bất kỳ code biểu đồ nào (chọn màu, validate palette, tooltip). Nếu không có, dùng `references/charts-and-kpi.md`.

## Quy trình 8 bước

### 1. Hiểu người dùng và quyết định (không bỏ qua)
Dashboard là công cụ ra quyết định, không phải nơi trưng bày dữ liệu. Trước khi vẽ gì, trả lời được các câu sau (hỏi người dùng nếu thiếu, tối đa vài câu quan trọng nhất; nếu không có người để hỏi thì nêu giả định rõ ràng và đi tiếp):

- Ai dùng (role)? Mức độ am hiểu dữ liệu của từng role?
- Họ mở dashboard để **quyết định hoặc làm hành động gì**? Hành động đầu tiên họ làm sau khi mở là gì?
- Tần suất dùng (cả ngày / hằng ngày / hằng tuần)? Thiết bị và độ phân giải màn hình chính?
- Dữ liệu cập nhật thế nào (real-time, theo phút, theo ngày)? Bao nhiêu bản ghi?
- Có multi-tenant, nhiều chi nhánh, phân quyền theo role không?

Xác định **loại dashboard** vì nó quyết định mật độ và tương tác:

| Loại | Mục đích | Đặc trưng |
|---|---|---|
| Strategic | Lãnh đạo theo dõi mục tiêu dài hạn | Ít chỉ số, xu hướng, so sánh kỳ trước, không cần real-time |
| Tactical | Quản lý nhóm theo dõi tiến độ | So sánh, mốc, cảnh báo, drill-down vừa phải |
| Analytical | Phân tích sâu | Filter/segment mạnh, khám phá, bảng + biểu đồ |
| Operational | Vận hành, giám sát thời gian thực | Dữ liệu sống, trạng thái, cảnh báo nổi bật, hành động nhanh |
| Hybrid | Kết hợp | Tách vùng rõ, hoặc tách theo tab/role |

Một dashboard cố phục vụ mọi role bằng một màn hình duy nhất thường hỏng. Tách theo role hoặc theo mục đích.

### 2. Xây thứ bậc thông tin trước khi dựng layout
Liệt kê các câu hỏi người dùng cần trả lời, xếp theo mức quan trọng, rồi gán mỗi câu hỏi một thành phần (con số, biểu đồ, bảng). Chỉ giữ thứ gì trả lời một câu hỏi thật. Với mỗi phần tử, tự hỏi: "Có thật sự cần hiện không? Có cách hiện đơn giản hơn không? Có gộp được không?"

- Màn hình đầu tiên chỉ nên có khoảng **5-6 khối** chính. Phần còn lại nằm ở tầng sâu (progressive disclosure): tóm tắt trước, chi tiết khi người dùng yêu cầu.
- Thứ cần hành động ngay (cảnh báo, việc quá hạn, tồn kho thấp) đặt ở vùng dễ thấy nhất, không chôn trong biểu đồ.
- Cấu trúc đi từ tổng quan -> phân rã -> bản ghi chi tiết (hierarchy), mỗi bước có đường dẫn rõ ràng.

### 3. Layout và điều hướng
Chi tiết ở `references/layout-and-navigation.md`. Điểm cốt lõi:
- Dùng grid nhất quán (12 cột, lưới 8px). Kích thước khối thể hiện độ quan trọng: khối quan trọng nhất to nhất và nằm trên-trái.
- Thứ tự thường dùng: thanh bộ lọc toàn cục -> hàng KPI -> biểu đồ xu hướng chính -> phân rã/so sánh -> bảng chi tiết.
- Sidebar cho sản phẩm có nhiều module; giữ tối đa 7±2 mục cấp 1, gom nhóm có nhãn, trạng thái active rõ, có chế độ thu gọn.

### 4. Chọn thành phần đúng cho từng dữ liệu
- **Con số đơn lẻ** -> KPI card (giá trị, nhãn, so sánh kỳ trước, xu hướng nhỏ). Không dùng biểu đồ cho một con số.
- **Xu hướng theo thời gian** -> line/area. **So sánh hạng mục** -> bar ngang/dọc, sắp xếp có chủ đích. **Cơ cấu** -> bar xếp chồng hoặc donut với ít hơn 5 phần. **Phân phối** -> histogram.
- **Tra cứu giá trị chính xác, nhiều thuộc tính, cần thao tác** -> **bảng**, không phải biểu đồ.
- Tránh: pie nhiều lát, 3D, dual-axis, gauge trang trí. Chi tiết ở `references/charts-and-kpi.md`.

### 5. Thiết kế tương tác
- Bộ lọc toàn cục (khoảng thời gian, chi nhánh, tenant) ở một hàng cố định phía trên; hiển thị bộ lọc đang áp dụng và nút xóa/đặt lại.
- Mọi biểu đồ có tooltip; mọi con số có thể drill-down hoặc ít nhất giải thích cách tính (icon thông tin).
- Lưu trạng thái xem của người dùng (cột hiển thị, density, filter hay dùng, saved view) và luôn có "đặt lại mặc định".
- Hành động phá hủy cần xác nhận nêu rõ hậu quả; hành động ít rủi ro dùng undo thay vì hộp thoại.

### 6. Thiết kế đủ trạng thái
Một màn hình chỉ thiết kế cho trạng thái "đầy dữ liệu đẹp" sẽ vỡ ngoài thực tế. Mỗi khối phải có: loading (skeleton đúng hình dạng), empty lần đầu, empty do lọc, error có nút thử lại, partial data, stale/offline, no-permission, dữ liệu cực dài/cực nhiều. Chi tiết và ngưỡng thời gian ở `references/states-and-feedback.md`.

### 7. Token, theme, accessibility, hiệu năng
- Định nghĩa token theo **vai trò** (surface, text-muted, status-danger), không theo màu. Có dark mode ngay từ đầu bằng token, không đảo màu tự động. Xem `references/design-tokens.md`.
- Đạt WCAG 2.2 AA là mức tối thiểu: chữ 4.5:1, chữ lớn và thành phần đồ họa (cột, đường, icon) 3:1, không dùng màu làm tín hiệu duy nhất, điều khiển bằng bàn phím, focus nhìn thấy rõ. Xem `references/accessibility-and-performance.md`.
- Dashboard nhiều dữ liệu phải nhanh: virtualization cho danh sách dài, lọc/sắp xếp/phân trang phía server khi dữ liệu lớn, tải theo từng khối.

### 8. Kiểm tra và bàn giao
- **Trunk test + 5-second test**: người dùng nhìn 5 giây có biết mình đang ở đâu và nên làm gì tiếp theo không? Nếu không, sửa thứ bậc và nhãn.
- Chạy checklist ở cuối file này, rồi tạo spec/handoff theo `references/templates.md`.
- Nếu đã có sản phẩm, thử với dữ liệu thật (rất ít, rất nhiều, dài bất thường), không chỉ dữ liệu mẫu đẹp.

## Quy tắc vàng (kèm lý do)

1. **Mỗi thứ phải phục vụ một quyết định.** Dashboard bị bỏ rơi sau vài tuần thường vì quá tải thông tin, không phải vì thiếu tính năng.
2. **Màu truyền thông tin, không trang trí.** Dùng màu trung tính cho phần lớn giao diện; để màu rực cho cảnh báo và điểm cần chú ý, nếu không mọi thứ cạnh tranh sự chú ý và không còn gì nổi bật.
3. **Số liệu phải so sánh được.** Con số trơ trọi không có nghĩa; luôn có ngữ cảnh (kỳ trước, mục tiêu, benchmark) và đơn vị rõ.
4. **Nhất quán hơn sáng tạo.** Dashboard là công cụ làm việc hằng ngày; dùng pattern quen thuộc để giảm tải nhận thức. Sáng tạo dành cho nơi thật sự cần.
5. **Dữ liệu sai nguy hiểm hơn dữ liệu thiếu.** Trục bắt đầu không từ 0 với cột, biểu đồ cắt cụt, định dạng số không nhất quán, dữ liệu cũ không báo là cũ đều làm người dùng quyết định sai.
6. **Kiểm soát nằm ở người dùng.** Cho chọn cột, density, filter, saved view, nhưng luôn có đường quay về mặc định.
7. **Thiết kế cho sự bất toàn của dữ liệu thật** (trống, lỗi, trễ, quá dài) ngay từ đầu, không để sau.

## Anti-pattern cần tránh

- Nhồi mọi thứ vào một màn hình; 10+ biểu đồ cùng cỡ không phân cấp.
- Biểu đồ chọn vì "trông ngầu" (3D, radar, gauge, pie 8 lát) thay vì vì dữ liệu.
- Dual-axis; trục cắt cụt gây hiểu lầm; so sánh qua 2 biểu đồ khác thang.
- Đỏ/xanh lá là tín hiệu duy nhất (màu mù màu); dùng màu thương hiệu làm màu biểu đồ.
- Căn giữa cột số, số không dùng tabular figures, số thập phân không đồng đều.
- Zebra stripe kết hợp hover/selected/disabled tạo quá nhiều sắc xám.
- Spinner toàn màn hình khi chỉ một khối đang tải; layout nhảy khi dữ liệu về.
- Lỗi tải dữ liệu hiển thị như "không có dữ liệu" (empty state giả).
- Hiện dữ liệu cũ mà không ghi thời điểm cập nhật.
- Tooltip là nơi duy nhất chứa thông tin thiết yếu (không dùng được trên bàn phím/cảm ứng).
- Copy giao diện light mode sang dark mode mà không chỉnh lại độ tương phản, chiều sâu, màu biểu đồ.
- Bộ lọc ẩn sâu, áp dụng xong không thấy đang lọc gì.
- Animation nặng làm chậm hoặc gây khó chịu; không tôn trọng `prefers-reduced-motion`.

## Checklist nhanh trước khi giao

**Mục đích và thứ bậc**
- [ ] Biết rõ role, quyết định và loại dashboard
- [ ] Qua được 5-second test; thông tin quan trọng nhất nổi bật nhất
- [ ] Màn đầu không quá ~6 khối; chi tiết nằm ở tầng sâu

**Dữ liệu và biểu đồ**
- [ ] Mỗi biểu đồ đúng loại cho dữ liệu; trục, đơn vị, kỳ so sánh rõ ràng
- [ ] Không dual-axis, không 3D, không pie nhiều lát
- [ ] Có bảng thay thế hoặc cách xem số liệu thô cho biểu đồ quan trọng

**Bảng và bộ lọc**
- [ ] Text căn trái, số căn phải + tabular figures, không căn giữa
- [ ] Sticky header; sort mặc định có ý nghĩa; bulk action hiện khi có chọn
- [ ] Filter đang áp dụng luôn nhìn thấy, có "xóa tất cả"; trạng thái xem được lưu

**Trạng thái**
- [ ] Loading skeleton đúng hình, empty (lần đầu / do lọc), error + retry, stale/offline, no-permission
- [ ] Hiển thị "cập nhật lúc ..." với dữ liệu có thể cũ

**Visual và accessibility**
- [ ] Token theo vai trò; light/dark kiểm tra tương phản từng cặp
- [ ] Chữ 4.5:1, thành phần đồ họa 3:1; không dựa vào màu đơn thuần
- [ ] Dùng được hoàn toàn bằng bàn phím; focus rõ; vùng bấm đủ lớn (tối thiểu 24x24 CSS px theo WCAG 2.2)
- [ ] Tôn trọng `prefers-reduced-motion`

**Tiếng Việt và hiệu năng**
- [ ] Font hiển thị đúng dấu; line-height đủ rộng; chuỗi dài không vỡ layout
- [ ] Ngày, số, tiền theo locale vi-VN
- [ ] Danh sách dài có virtualization hoặc phân trang; thao tác lọc phản hồi nhanh

## Khi được yêu cầu dựng code / mockup

- Dựng HTML/CSS (hoặc React + Tailwind/shadcn nếu dự án đã dùng) với CSS variables cho token, hỗ trợ `prefers-color-scheme`, layout hoạt động từ 1280px trở lên và co lại hợp lý ở 768px.
- Dùng dữ liệu mẫu **thực tế** (tên, số tiền VND, ngày dd/MM/yyyy, trạng thái đa dạng, một vài giá trị dài và trống), không dùng "Lorem ipsum" hay toàn số tròn.
- Dựng luôn các trạng thái loading/empty/error ít nhất ở dạng có thể chuyển đổi, vì đây là chỗ nhiều dashboard hỏng.
- Không dùng logo/thương hiệu thật của bên thứ ba; dùng placeholder.
- Nếu dự án đã có design system, dùng nó thay vì tạo token mới.

## Khi được yêu cầu review

Dùng template review ở `references/templates.md`: xếp theo mức độ (Blocker / Major / Minor), nêu bằng chứng cụ thể (nguyên tắc vi phạm, tỷ lệ tương phản đo được, số bước thừa), tác động tới người dùng và đề xuất sửa. Không bịa số liệu nghiên cứu; nếu cần xác minh, đề xuất cách kiểm chứng (usability test 5 người, analytics, A/B).
